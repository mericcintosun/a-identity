import { useState } from 'react'
import { Gauge, CheckCircle2, ExternalLink, Loader2, Zap } from 'lucide-react'
import { apiFetch } from '../../lib/api'
import { Button } from '../ui/button'
import { authHeaders } from '../../store/auth'

type Result =
  | { executed: false; reason: string; verifyingContract?: string }
  | {
      executed: true
      amountUsd: number
      network: string
      payTo: string
      verifyingContract: string
      gatewayBalanceBefore: number
      gatewayBalanceAfter: number
      deposit: { amountUsd: number; depositTx?: string; explorerUrl?: string } | null
      authorization: { from: string; to: string; value: string; nonce: string }
      settle: { success: boolean; errorReason?: string; transaction?: string; network?: string; payer?: string; explorerUrl?: string }
    }

/**
 * Circle Nanopayments: gas-free, sub-cent USDC over Gateway batched settlement. One
 * click makes the server signer sign an EIP-3009 authorization OFFCHAIN (zero gas) and
 * settle it through Circle Gateway on Arc. Hits POST /api/arc/nanopay-demo. This is the
 * second x402 rail alongside the on-chain self-verifying one.
 */
export default function NanopayPanel() {
  const [amount, setAmount] = useState('0.001')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await apiFetch('/api/arc/nanopay-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ amountUsd: Number(amount) || 0.001 }),
        timeoutMs: 120_000,
      })
      if (res.status === 401 || res.status === 403) {
        setError('Sign in with a wallet or email link to run a real nanopayment (guests are read-only).')
        return
      }
      setResult((await res.json()) as Result)
    } catch {
      setError('Could not run the nanopayment (the backend may be waking up, try again).')
    } finally {
      setBusy(false)
    }
  }

  const settled = result?.executed && result.settle.success
  const short = (a?: string) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '-')

  return (
    <div className="mt-8 rounded-2xl border border-foreground/10 bg-card p-6">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#7342E2]/10 text-[#7342E2]">
          <Gauge size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground">Gasless nanopayments (Circle Nanopayments)</h3>
          <p className="mt-0.5 text-sm text-foreground/55">
            The second x402 rail: the payer signs an <b>EIP-3009 authorization off-chain (zero gas)</b> and
            Circle Gateway settles it in a <b>batch</b>, making true sub-cent USDC payments economical for
            high-frequency agent traffic.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold text-foreground/50">Amount</label>
        <div className="flex items-center gap-1 rounded-xl border border-foreground/10 bg-background/40 px-3 py-2">
          <span className="text-sm text-foreground/50">$</span>
          <input
            type="number"
            min="0"
            step="0.001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-24 bg-transparent text-sm outline-none"
          />
          <span className="text-xs font-semibold text-[#7342E2]">USDC</span>
        </div>
        <Button type="button" size="sm" className="text-sm" onClick={run} disabled={busy}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
          {busy ? 'Signing & settling' : 'Pay gasless (nanopayment)'}
        </Button>
      </div>

      {error && <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/10 p-3 text-sm text-foreground/70">{error}</div>}

      {result && result.executed === false && (
        <div className="mt-4 rounded-xl border border-foreground/10 bg-background/40 p-3 text-sm text-foreground/70">
          Prepared (no signer configured on the server): {result.reason}
          {result.verifyingContract && (
            <div className="mt-1 font-mono text-[11px] text-foreground/45">GatewayWalletBatched: {result.verifyingContract}</div>
          )}
        </div>
      )}

      {result && result.executed && (
        <div className="mt-4 space-y-2 text-sm">
          {result.deposit && (
            <Row label={`Topped up Gateway balance +${result.deposit.amountUsd} USDC`} link={result.deposit.explorerUrl} linkText="tx" />
          )}
          <Row
            label="EIP-3009 authorization signed, 0 gas"
            value={`nonce ${short(result.authorization.nonce)}`}
            badge={<span className="rounded bg-[#7342E2]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#7342E2]">offchain</span>}
          />
          <Row label={`Paid ${result.amountUsd} USDC → ${short(result.payTo)}`} value={`from Gateway balance`} />
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
              settled ? 'border-emerald-200 dark:border-emerald-500/25 bg-emerald-50/60 dark:bg-emerald-500/10' : 'border-amber-200 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/10'
            }`}
          >
            {settled ? <Zap size={14} className="text-emerald-600" /> : <Loader2 size={14} className="animate-spin text-amber-600" />}
            <span className="text-foreground/75">
              {settled ? (
                <>Settled through Circle Gateway, <b>batched on-chain</b>, gasless for buyer &amp; seller</>
              ) : (
                <>Not settled{result.settle.errorReason ? `: ${result.settle.errorReason}` : ''}</>
              )}
            </span>
            {settled && result.settle.transaction && (
              <span className="ml-auto font-mono text-[10px] text-foreground/40">batch {result.settle.transaction.slice(0, 8)}...</span>
            )}
            {result.settle.explorerUrl && (
              <a
                href={result.settle.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-semibold text-accent hover:underline"
              >
                settlement <ExternalLink size={9} />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  link,
  linkText,
  badge,
}: {
  label: string
  value?: string
  link?: string
  linkText?: string
  badge?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-foreground/8 bg-background/40 px-3 py-2">
      <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
      <span className="text-foreground/75">{label}</span>
      {badge}
      <span className="ml-auto flex items-center gap-2">
        {value && <span className="text-xs font-semibold text-foreground/50">{value}</span>}
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-accent hover:underline"
          >
            {linkText ?? 'link'} <ExternalLink size={9} />
          </a>
        )}
      </span>
    </div>
  )
}
