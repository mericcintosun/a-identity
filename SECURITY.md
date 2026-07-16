# Security

A-Identity is a **testnet** application. It runs on Arc testnet with test USDC, generates
wallet keys **in the browser** (the server only ever sees public addresses), and keeps a
human on the loop for anything that holds a key, deploys a contract, or moves value.

## Secrets and where they live

No secret is committed to git. Runtime credentials live in the host env (Render) and, for
local development, in `mcp/.env` (git-ignored). The frontend build only bakes in *public*
values (e.g. the WalletConnect project id).

| Secret | Scope | Notes |
| --- | --- | --- |
| `ARC_SIGNER_KEY` | Arc **testnet** signer | Broadcasts real testnet writes. Test funds only, but a live key on disk. |
| `CIRCLE_API_KEY` / `CIRCLE_ENTITY_SECRET` | Circle **sandbox** | `CIRCLE_ENTITY_SECRET` is the master credential for the developer-controlled wallets. **Re-registering a new entity secret orphans existing wallets** — coordinate before rotating. |
| `RESEND_API_KEY` | **Production** email (Resend) | Not testnet-scoped: it can send real email from the verified domain. Treat as production-grade. |
| `AUTH_SECRET` | Session-token signing | Rotating it invalidates all live sessions (users re-sign-in). |
| `DATABASE_URL` | Postgres (Neon) | Durable platform state. |

## Rotation guidance

Any credential that has ever been shared in a chat or paste should be rotated:

1. **`RESEND_API_KEY` — rotate first (priority).** It is a production email credential, not
   scoped to testnet. Issue a new key in the Resend dashboard, update it in the Render env,
   and redeploy.
2. **`ARC_SIGNER_KEY`** — rotate after the event. Move testnet funds to a fresh key, set it
   in the Render env. Low value (test funds), but good hygiene.
3. **`CIRCLE_ENTITY_SECRET` / `CIRCLE_API_KEY`** — rotate after the event, but note that a new
   entity secret orphans the existing Circle wallets; provision fresh wallets afterward.
4. **`AUTH_SECRET`** — rotate if you suspect exposure; users simply sign in again.

## Known limitations (by design, for a testnet MVP)

- **Single-instance state.** Nonce / KYA-challenge / x402-spent stores, the double-settle
  guard, and rate-limit buckets are in-memory and process-local. Correct for the single
  backend instance deployed today; a horizontally-scaled deploy must move them to shared
  storage (Postgres/Redis) so replay protection, the double-settle guard, and rate limiting
  hold across instances.
- **Rate limiting** is a basic per-IP fixed window on auth challenges, the magic-link email,
  and the on-chain demo endpoints — enough to stop casual abuse, not a full WAF.

## Reporting

Found something? Email `security@a-identity.xyz` (or `agents@a-identity.xyz`) rather than
opening a public issue.
