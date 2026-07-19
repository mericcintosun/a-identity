/**
 * Generic A-Identity marketplace worker: registers as a verified worker for one SERVICE, then
 * polls for funded tasks, does the real work with Claude, BUYS a helper service over x402 while
 * working (autonomous spending), and delivers.
 *
 * Three presets ship: translation, data-analysis, code-review. Pick one with WORKER_SERVICE.
 * Real work + real x402 purchase with ANTHROPIC_API_KEY / a funded backend signer; honest stubs
 * without, so the loop runs keyless.
 *
 * Run:  WORKER_SERVICE=data-analysis BASE=http://localhost:3399 node agents/worker.mjs
 * Env:  BASE, WORKER_SERVICE (translation|data-analysis|code-review), WORKER_KEY,
 *       ANTHROPIC_API_KEY, WORKER_POLL_MS, WORKER_MAX_CYCLES, WORKER_ENDPOINT.
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { MarketplaceClient } from '../sdk/dist/index.js'

const MODEL = 'claude-opus-4-8'

/** Service presets: what the agent sells and how it does the work. */
export const PRESETS = {
  translation: {
    name: 'Lingua (translation worker)',
    service: 'translation',
    priceUsd: 2,
    unit: 'per doc',
    capabilities: ['translation'],
    system: 'You are a professional translator. Do exactly what the request asks. Output ONLY the translation, no preamble.',
  },
  'data-analysis': {
    name: 'DataMind (data-analysis worker)',
    service: 'data-analysis',
    priceUsd: 3,
    unit: 'per report',
    capabilities: ['data-analysis'],
    system: 'You are a data analyst. Given a request, produce a crisp, structured analysis or summary with concrete numbers where possible. Output only the analysis.',
  },
  'code-review': {
    name: 'CodeReviewer (code-review worker)',
    service: 'code-review',
    priceUsd: 5,
    unit: 'per PR',
    capabilities: ['code-review'],
    system: 'You are a senior code reviewer. Given a diff or snippet, list concrete issues (bugs, edge cases, security) with a short fix each. If none, say so. Output only the review.',
  },
}

/** Do the work for a preset. Claude with ANTHROPIC_API_KEY, else a labeled stub. */
export async function doWork(preset, instruction, env = process.env) {
  const text = String(instruction ?? '').slice(0, 6000)
  if (!env.ANTHROPIC_API_KEY) return `[stub ${preset.service} - set ANTHROPIC_API_KEY for real work] ${text}`
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic()
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: preset.system,
    messages: [{ role: 'user', content: text }],
  })
  return msg.content.find((b) => b.type === 'text')?.text?.trim() || `[no output] ${text}`
}

/** Register + KYA-verify a worker for a preset (owner and agent wallet are the same key). */
export async function registerWorker(mp, account, preset) {
  return mp.registerAndVerify({
    name: preset.name,
    description: `An autonomous ${preset.service} worker on the A-Identity marketplace.`,
    category: preset.service,
    capabilities: preset.capabilities,
    services: [{ name: preset.service, priceUsd: preset.priceUsd, unit: preset.unit }],
    walletAddress: account.address,
    endpoint: process.env.WORKER_ENDPOINT,
    signMessage: (m) => account.signMessage({ message: m }),
  })
}

/** Process funded tasks: buy a helper service over x402, do the work, deliver. */
export async function processFundedTasks(mp, agentId, preset, env = process.env) {
  const { tasks } = await mp.agentJobs(agentId)
  const funded = (tasks ?? []).filter((t) => t.status === 'funded')
  for (const task of funded) {
    // Autonomous spending: buy a quality-check helper over x402 (gasless nanopayment) mid-task.
    let bought = ''
    try {
      const pay = await mp.nanopay(0.002)
      if (pay?.settle?.success || pay?.executed) bought = ' [bought a quality-check API via x402 nanopayment]'
      else if (pay?.executed === false) bought = ' [x402 helper prepared; no signer]'
    } catch {
      /* helper purchase is best-effort; never blocks delivery */
    }
    const result = await doWork(preset, task.description || `Do a ${preset.service} task`, env)
    await mp.deliver(task.id, result)
    console.error(`[worker:${preset.service}] delivered ${task.id}${bought}`)
  }
  return funded.length
}

async function main() {
  const base = process.env.BASE ?? 'https://a-identity-backend.onrender.com'
  const presetKey = process.env.WORKER_SERVICE ?? 'translation'
  const preset = PRESETS[presetKey]
  if (!preset) {
    console.error(`Unknown WORKER_SERVICE "${presetKey}". Options: ${Object.keys(PRESETS).join(', ')}`)
    process.exit(1)
  }
  const account = privateKeyToAccount(process.env.WORKER_KEY ?? generatePrivateKey())
  const pollMs = Number(process.env.WORKER_POLL_MS ?? 5000)
  const maxCycles = Number(process.env.WORKER_MAX_CYCLES ?? Infinity)

  console.error(`[worker:${preset.service}] wallet ${account.address} · backend ${base}`)
  console.error(`[worker:${preset.service}] work: ${process.env.ANTHROPIC_API_KEY ? `Claude (${MODEL})` : 'stub'}`)

  const mp = await MarketplaceClient.withWallet({ baseUrl: base, address: account.address, signMessage: (m) => account.signMessage({ message: m }) })
  const reg = await registerWorker(mp, account, preset)
  const agentId = reg.agent.id
  console.error(`[worker:${preset.service}] registered + verified as ${agentId}. Waiting for tasks...`)

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  let cycles = 0
  while (cycles < maxCycles) {
    try {
      await processFundedTasks(mp, agentId, preset)
    } catch (e) {
      console.error(`[worker:${preset.service}] cycle error:`, e?.message ?? e)
    }
    cycles += 1
    if (cycles < maxCycles) await sleep(pollMs)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error('[worker] fatal:', e)
    process.exit(1)
  })
}
