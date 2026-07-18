#!/usr/bin/env node
/**
 * On-chain integration test for the ERC-8183 refund/dispute path, against real Arc
 * testnet. Runs the full escrow lifecycle to a DISPUTE outcome (create → setBudget →
 * approve → fund → submit → reject) and proves the escrowed USDC is refunded to the
 * client in the same tx — buyer protection for agent-to-agent commerce. Client, provider,
 * and evaluator are all the signer, so the budget cycles back and only gas is spent.
 *
 * Run:  node --env-file=.env scripts/test-refund.mjs   (needs a funded ARC_SIGNER_KEY)
 */
import { runEscrowJobDemo, readJobOnchain } from '../dist/arc-contracts.js'
import { privateKeyToAccount } from 'viem/accounts'

const signer = privateKeyToAccount(process.env.ARC_SIGNER_KEY).address
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? `  — ${extra}` : ''}`)
  cond ? pass++ : fail++
}

console.log('signer (client=provider=evaluator):', signer, '\n')

// Run the dispute lifecycle: hire → fund escrow → submit → EVALUATOR REJECTS → client refunded.
const budgetUsd = 0.05
const res = await runEscrowJobDemo({ budgetUsd, outcome: 'refund' })
ok('refund lifecycle executed', res.executed === true, res.executed ? `job #${res.jobId}` : res.reason)
if (!res.executed) process.exit(1)

for (const s of res.steps) console.log(`   ${s.step.padEnd(14)} ${s.explorerUrl}`)
console.log('   status   :', res.status)
console.log('   refunded :', res.refundedUsd, 'USDC')

ok('final status is Rejected', res.status === 'Rejected', res.status)
ok('lifecycle ended in a reject step', res.steps.some((s) => s.step === 'reject'))
ok('the escrowed budget was refunded to the client', res.refundedUsd === budgetUsd, `${res.refundedUsd} vs ${budgetUsd}`)
ok('no failure recorded', !res.failedAt, res.failedAt ?? '')

// Confirm the on-chain job state directly (independent read).
const job = await readJobOnchain(BigInt(res.jobId))
ok('on-chain job read confirms Rejected', job.status === 'Rejected', job.error ?? job.status)
ok('on-chain client == signer', (job.client ?? '').toLowerCase() === signer.toLowerCase(), job.client)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
