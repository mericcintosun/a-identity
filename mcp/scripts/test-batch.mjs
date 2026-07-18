#!/usr/bin/env node
/**
 * On-chain integration test for batched settlement via Arc's Multicall3From, against real
 * Arc testnet. Settles several USDC transfers ATOMICALLY in ONE tx and verifies that the
 * batch emitted one USDC Transfer per payment with `from` = our EOA (the CallFrom
 * sender-preservation check). Transfers go back to the signer, so only gas is spent.
 *
 * Run:  node --env-file=.env scripts/test-batch.mjs   (needs a funded ARC_SIGNER_KEY)
 */
import { payUsdcBatchOnchain, ARC_RPCS } from '../dist/arc-contracts.js'
import { createPublicClient, http, fallback, parseAbiItem, getAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const signer = privateKeyToAccount(process.env.ARC_SIGNER_KEY).address
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? '✓' : '✗'} ${name}${extra ? `  — ${extra}` : ''}`); cond ? pass++ : fail++ }

console.log('signer (EOA):', signer, '\n')

// Batch 3 transfers of $0.01 back to the signer -> one atomic tx, only gas spent.
const payments = [
  { to: signer, amountUsd: 0.01 },
  { to: signer, amountUsd: 0.01 },
  { to: signer, amountUsd: 0.01 },
]
const res = await payUsdcBatchOnchain(payments)
ok('batch settled', res.executed === true, res.executed ? res.txHash : res.reason)
if (!res.executed) process.exit(1)
console.log('   tx   :', res.explorerUrl)
console.log('   count:', res.count, '| total $' + res.totalUsd)
ok('all 3 payments batched into one tx', res.count === 3)
ok('total is the sum of the batch', Math.abs(res.totalUsd - 0.03) < 1e-9, String(res.totalUsd))

// Verify on-chain: the single tx emitted 3 USDC Transfer events, each from = our EOA.
const client = createPublicClient({ transport: fallback(ARC_RPCS.map((u) => http(u))) })
const receipt = await client.getTransactionReceipt({ hash: res.txHash })
ok('the batch tx succeeded on-chain', receipt.status === 'success', receipt.status)
const transferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
const { parseEventLogs } = await import('viem')
const transfers = parseEventLogs({ abi: [transferEvent], logs: receipt.logs }).filter((l) => l.address.toLowerCase() === '0x3600000000000000000000000000000000000000')
ok('one USDC Transfer per payment (3) in the single tx', transfers.length === 3, `${transfers.length} transfers`)
const allFromSigner = transfers.every((t) => getAddress(t.args.from) === getAddress(signer))
ok('EOA preserved: every Transfer.from is our wallet (CallFrom)', allFromSigner)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
