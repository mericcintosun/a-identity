/**
 * Live on-chain stats for the ASP. Reads payTo's current USD₮0 balance on X Layer
 * mainnet — since payTo only ever receives from our ASP, this is the live cumulative
 * revenue. Raw JSON-RPC eth_call, timeout-guarded, no extra deps, never throws.
 * Served at GET /stats and fetched by the /proof page so the number reads "live".
 */
const RPC = process.env.XLAYER_RPC_URL ?? 'https://rpc.xlayer.tech'
const USDT0 = '0x779Ded0c9e1022225f8E0630b35a9b54bE713736'
const PAY_TO = '0x6a5f1b8e56a19d456b799c2fa00e513244f58ce6'

export type LiveStats = {
  network: string
  payTo: string
  asset: string
  /** Live cumulative USD₮0 held at payTo (all of it received from ASP calls); null if the read fails. */
  payToReceivedUsdt0: number | null
  checkedAt: string
}

export async function getLiveStats(): Promise<LiveStats> {
  const base = {
    network: 'X Layer mainnet (eip155:196)',
    payTo: PAY_TO,
    asset: 'USD₮0',
    checkedAt: new Date().toISOString(),
  }
  try {
    // balanceOf(payTo): selector 0x70a08231 + 32-byte left-padded address.
    const data = '0x70a08231' + '0'.repeat(24) + PAY_TO.slice(2).toLowerCase()
    const res = await fetch(RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: USDT0, data }, 'latest'] }),
      signal: AbortSignal.timeout(5000),
    })
    const j = (await res.json()) as { result?: string }
    const raw = BigInt(j.result ?? '0x0')
    return { ...base, payToReceivedUsdt0: Number(raw) / 1_000_000 }
  } catch {
    return { ...base, payToReceivedUsdt0: null }
  }
}
