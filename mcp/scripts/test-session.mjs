#!/usr/bin/env node
/**
 * On-chain integration test for the session-key EXPIRY on the AgentSpendPolicy vault,
 * against real Arc testnet. The `operator` is the agent's session key; the human `owner`
 * grants it a time bound. Proves the full bounded-authority lifecycle on-chain:
 *   grant (short expiry) → agent pays within the window → key EXPIRES → agent pay reverts
 *   (SessionKeyExpired) → owner EXTENDS → agent pays again → owner REVOKES → pay reverts.
 * Payments cycle back to the signer; only gas is spent.
 *
 * Run:  node --env-file=.env scripts/test-session.mjs   (needs a funded ARC_SIGNER_KEY)
 */
import {
  deployPolicyVault, payUsdcOnchain, policyPay, policySetSessionExpiry,
  readPolicyVault, policyWithdraw,
} from '../dist/arc-contracts.js'
import { privateKeyToAccount } from 'viem/accounts'

const signer = privateKeyToAccount(process.env.ARC_SIGNER_KEY).address
const now = () => Math.floor(Date.now() / 1000)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? `  — ${extra}` : ''}`)
  cond ? pass++ : fail++
}

console.log('owner / operator (session key):', signer, '\n')

// 1. Deploy a vault (owner == operator == signer, so both paths sign here).
const dep = await deployPolicyVault({ dailyCapUsd: 5, autoApproveUsd: 1 })
ok('deploy vault', dep.executed === true, dep.executed ? dep.vault : dep.reason)
if (!dep.executed) process.exit(1)
const vault = dep.vault
console.log('   vault:', dep.explorerUrl)

// 2. Fund it with $2.
const fund = await payUsdcOnchain(vault, 2)
ok('fund vault $2', fund.executed === true, fund.executed ? fund.txHash : fund.reason)

// 3. GRANT a session key valid for ~30 seconds. (A short window makes the test fast; the
//    generous 30s absorbs clock skew between the host and Arc's block.timestamp + tx latency.)
const shortExpiry = now() + 30
const grant = await policySetSessionExpiry(vault, shortExpiry)
ok('grant session key (expiry now+30s)', grant.executed === true, grant.executed ? grant.txHash : grant.reason)

// 4. Agent pays $0.10 WITHIN the window → settles (done first, to spend minimal window).
const p1 = await policyPay(vault, signer, 0.1)
ok('agent pays within the window → settles', p1.executed === true, p1.executed ? p1.txHash : p1.reason)
const afterGrant = await readPolicyVault(vault)
ok('vault reports the session-key expiry', afterGrant.sessionKeyExpiry === shortExpiry, String(afterGrant.sessionKeyExpiry))
ok('session key is not yet expired', afterGrant.sessionKeyExpired === false)

// 5. Wait for the key to EXPIRE (chain time passes the expiry).
console.log('   ...waiting ~34s for the session key to expire...')
await wait(34000)

// 6. Agent pays after expiry → reverts SessionKeyExpired (off-chain simulate, no gas).
const p2 = await policyPay(vault, signer, 0.1)
ok('agent pay after expiry reverts SessionKeyExpired', p2.executed === false && p2.reverted === true && p2.reason === 'SessionKeyExpired', p2.reason)
const afterExpiry = await readPolicyVault(vault)
ok('vault now reports the key as expired', afterExpiry.sessionKeyExpired === true)

// 7. Owner EXTENDS the session key by 1 hour.
const extend = await policySetSessionExpiry(vault, now() + 3600)
ok('owner extends the session key (+1h)', extend.executed === true, extend.executed ? extend.txHash : extend.reason)

// 8. Agent pays again → settles.
const p3 = await policyPay(vault, signer, 0.1)
ok('agent pays after the extension → settles', p3.executed === true, p3.executed ? p3.txHash : p3.reason)

// 9. Owner REVOKES the session key (expiry = now).
const revoke = await policySetSessionExpiry(vault, now())
ok('owner revokes the session key', revoke.executed === true, revoke.executed ? revoke.txHash : revoke.reason)

// 10. Agent pay after revoke → reverts SessionKeyExpired.
await wait(2000)
const p4 = await policyPay(vault, signer, 0.1)
ok('agent pay after revoke reverts SessionKeyExpired', p4.executed === false && p4.reverted === true && p4.reason === 'SessionKeyExpired', p4.reason)

// 11. Recover the remaining USDC to the signer.
const bal = await readPolicyVault(vault)
if (bal.balanceUsd > 0) {
  const w = await policyWithdraw(vault, signer, bal.balanceUsd)
  ok('owner withdraws the remainder', w.executed === true, w.executed ? w.txHash : w.reason)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
