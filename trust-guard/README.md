# @a-identity/trust-guard

One line of code that stops your AI agent from paying a counterparty it should not trust.

Agents are starting to hire and pay other agents at machine speed. `trust-guard` puts a
verification gate in front of that payment: it calls the live **A-Identity Trust Oracle**
(ERC-8004 on-chain identity + KYA + a deterministic 0-1000 reputation + a Sybil check) and
**throws if the verdict is DENY**, so a revoked, Sybil, or unverified counterparty never gets paid.

```bash
npm install @a-identity/trust-guard
```

```ts
import { guard, TrustDenyError } from '@a-identity/trust-guard'

try {
  // Verify before you pay. Throws if the counterparty is DENY.
  await guard(counterpartyAgentId, { txContext: { amountUsd: 500, kind: 'payment' } })
  await payAgent(counterpartyAgentId, 500) // only runs if the guard passed
} catch (e) {
  if (e instanceof TrustDenyError) {
    console.warn('Blocked:', e.verdict.decision, e.verdict.reasons)
    return // do not pay
  }
  throw e
}
```

## Verdicts

`guard()` runs `risk_check` and returns an `ALLOW` / `WARN` verdict, or throws `TrustDenyError`
on `DENY`. Block warnings too by widening `denyOn`:

```ts
await guard(id, { denyOn: ['DENY', 'WARN'] }) // stricter: throw on WARN as well
```

## The full client

```ts
import { TrustGuard } from '@a-identity/trust-guard'

const oracle = new TrustGuard() // defaults to https://a-identity-asp.onrender.com

await oracle.verify(id)        // ERC-8004 identity + KYA status
await oracle.reputation(id)    // 0-1000 score (+ its on-chain attestation, if published)
await oracle.riskCheck(id, tx) // ALLOW / WARN / DENY
await oracle.passport(id)      // identity + reputation + KYA + risk in one call
await oracle.guard(id, opts)   // the gate: throws on DENY
```

## Paying for calls (x402)

The Trust Oracle tools settle per call via **x402 on X Layer** (verify_agent $0.001,
reputation_score $0.002, risk_check $0.005, agent_passport $0.01). If a call returns HTTP 402,
the guard invokes your `onPaymentRequired` payer and retries; without one it throws
`PaymentRequiredError` carrying the challenge. Wire your OKX Agentic Wallet (or any x402
client) to sign the payment:

```ts
const oracle = new TrustGuard({
  onPaymentRequired: async (challenge, { resource }) => {
    const header = await myWallet.payX402(challenge) // your x402 signer
    return { 'X-PAYMENT': header }                   // headers to retry with
  },
})
```

## Notes

- Zero runtime dependencies. Uses the global `fetch` (Node >= 18, Deno, Bun, browsers); inject
  `opts.fetch` for other runtimes or tests.
- Point `baseUrl` at your own instance if you self-host the oracle.
- Verify first. Pay at machine speed.

MIT
