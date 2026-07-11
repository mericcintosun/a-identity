# A-Identity — Hackathon Vision & Roadmap

> Date: 2026-07-09 · Branch: `review/critical-gaps`
> Focus: **Arc + Circle** (these two hackathons are judged only on this)
> Team: one Developer (backend) · one Marketing/Presentation lead

This document is the plan for preparing A-Identity for two hackathons: "what we build, what we fix, how we position it." Key rule: **closing the gaps in `CRITICAL-GAPS.md` = building the winning feature.** They are not separate work.

---

## 0. Target hackathons

| | Encode "Programmable Money" | Ignyte "Stablecoins Commerce Stack" |
|---|---|---|
| Priority | **PRIMARY** | Secondary (same project) |
| Sponsor | Arc + Circle | Circle + Arc (technical), Ignyte (Dubai/DIFC) |
| Track | **Agentic Economy** | **Best Agentic Economy Experience** (1st = 4000, 2nd = 2000 USDC) |
| Prize | Cash + top-8 → 8-week accelerator | 25k USDC pool |
| Critical date | Launch Jul 13 · Final **Aug 9** · Demo Day Aug 20 | **Entry deadline Jul 13** (register this week!) |

Both tracks want the same thing: **autonomous AI agents that pay/settle in USDC + clear decision logic + real sub-cent micro-payments (we ship this as an open, on-chain-verifiable x402 rail).**

---

## 1. Winning thesis: "verified identity + bounded autonomy"

A-Identity's edge isn't just "an agent that pays"; it's **an agent whose identity is verified AND whose authority is bounded.** A tweet featured on Encode's own page captures this exactly:

> *"Bounded authority is the only way M2M scales. When a machine's financial blast radius is locked down to a zero-trust utility... if it can't run amok, it's safe."*

Our story is precisely this: **ERC-8004 identity (passport) + policy engine (cap/allowlist/human approval) + USDC payment rail.** It maps directly to the judges' "clear decision logic," "demonstrable autonomy," and "bounded authority" criteria.

**Demo narrative (the "money shot" for the 3-min video):**
1. Register an agent → a **real ERC-8004 identity** is minted on Arc *(already works — proven with tx `0xfedb67…811046`)*.
2. Give it a Circle Wallet + set a policy (daily cap, auto-approve line, allowlist) — **actually enforced**.
3. The agent pays a service via a **real x402 pay-per-call rail** (sub-cent, USDC, verified on-chain) settled through its **on-chain policy vault**: under the line it's automatic; above it the vault **reverts on Arc** and it goes to **human approval**.
4. Watch it in Agent House; reputation grows from real settlements.
5. All on Arc testnet, verifiable on arcscan.

---

## 2. Feature roadmap (by priority)

Each item closes a **gap** and maps to a **judging criterion** / **Circle product**.

### P0 — Must-have (submission requirement + core criteria)
| Feature | Gap closed | Criterion / Circle product |
|---|---|---|
| **Deploy: frontend→Vercel, backend→Render** + live URL | #10 | "Working MVP deployed on Arc" (submission requirement) |
| **Wire `register-onchain` into the UI "create agent" flow** | #6 | Real on-chain identity (ERC-8004) — already works, just connect it |
| **Real payment: USDC settlement via a real x402 rail + on-chain vault** (move `executeInstruction` off "simulated") | #2, #5, #6 | "Autonomous spending/settlement flows" + **x402 / USDC on Arc** |
| **Wire Permissions UI → backend policy engine** | #3 | "Clear decision logic / bounded authority" |

### P1 — Strong differentiators
| Feature | Gap closed | Criterion / Circle product |
|---|---|---|
| **Circle Wallets** (instead of raw viem keypair) | #2, #5 | Security story + a judged Circle product |
| **Instruction Console UI** (pay/purchase/rental/batch + a visible human-approval queue) | #6 | The demo centerpiece; "demonstrable autonomy" |
| **Real reputation** (from real on-chain settlements, not mock) | #4 | Once payments are real, feed them into the score |
| **Live balance on the Wallet screen** (`/api/wallet-balance` already exists, just uncalled) | #7 | Small but adds real credibility on camera |

### P2 — Bonus / stretch
| Feature | Gap closed | Note |
|---|---|---|
| **Backend auth** (so the approval gate is truly protected) | #1 | Hardens the "zero-trust" story |
| **ERC-8183 job escrow demo** (`createJobOnchain` already coded) | — | "Agent-to-agent commerce / escrow" example |
| **Real unified balance via CCTP/Gateway** | — | "Cross-chain USDC liquidity" (shows range) |
| **On-chain policy guard contract** (enforce cap/allowlist on-chain) | #1, #3 | Strongest "bounded authority" proof — stretch |

---

## 3. New code / contracts / integrations needed

**No new custom contract is required for P0/P1.** The existing on-chain pieces + Circle products are enough:
- **ERC-8004 IdentityRegistry** (on Arc, real) — identity. `arc-contracts.ts:registerAgentOnchain` works; wire it into the UI.
- **ERC-8183 AgenticCommerce** (on Arc, real) — escrow/job. `createJobOnchain` coded; wire it (P2).

**New backend integrations (Circle SDK):**
- `@circle-fin/developer-controlled-wallets` → Circle Agent Wallets, hosted wallet-layer screening (SHIPPED).
- **x402** → the real micro-payment rail (SHIPPED): HTTP-402 pay-per-call, USDC on Arc, verified on-chain with replay protection. (We deliberately chose the open x402 standard over Circle Nanopayments — see README "Why x402 instead of Nanopayments.")
- **Circle Gateway** → chain-abstracted USDC: deposit on Arc → unified balance → mint on Base Sepolia gaslessly (SHIPPED, verified live).

**On-chain policy vault (SHIPPED, the strongest edge):** the `AgentSpendPolicy` contract on Arc enforces the daily cap/allowlist/auto-approve/freeze **on-chain** — an over-limit payment **reverts on Arc**, not in the backend. Proves the "if it can't run amok, it's safe" thesis in code.

---

## 4. UI/UX notes (shadcn optional)

The current UI is already good (Tailwind v4 + Framer Motion + consistent brand). **No rewrite.** shadcn is only for **building new surfaces quickly**, layered on top of the existing brand, used selectively:
- **Dialog** → the human-approval modal
- **Toast/Sonner** → tx-confirmation notifications (+ arcscan link)
- **Data table** → Instruction Console / transaction history
- **Form** → agent registration + policy form

**Screens to add/fix:**
- **Instruction Console** (new) — create an instruction, show the policy result, the approval queue.
- **Permissions** — take it out of "cosmetic," wire it to the backend, show real values (#3).
- **Wallet** — replace mock balances/txs with live `/api/wallet-balance` + a real tx feed (#7).
- **Live activity/tx feed** — an arcscan link per real tx (the "look, it's real" effect on camera).

Note: some screens can stay as they are; use shadcn only where it speeds up building, never forced.

---

## 5. Deploy plan (live URL)

| Part | Where | Why |
|---|---|---|
| Frontend (Vite/React, static) | **Vercel** | Ideal for a static build |
| Backend (Node `http.createServer` + JSON state) | **Render** (or Railway) | Long-running process + persistent disk; ~0 code change |

**Why Vercel doesn't fit the backend:** the serverless model won't run a persistent port-listening server, and its filesystem is ephemeral/read-only → the `mcp/data/platform.json` state is lost. If forced: serverless functions + an external DB (Vercel KV/Postgres) — unnecessary work at hackathon speed.
After deploy: set `VITE_MCP_URL` = the backend's live URL. (Also: the backend does not auto-load `.env` — see CRITICAL-GAPS.md #8; on Render, set `ARC_SIGNER_KEY` via the env-vars panel.)

---

## 6. Submission checklist

**Encode (final Aug 9):** working MVP on Arc (live URL) · public repo (add judges if private) · **3-min video pitch+demo** · deck. Checkpoint 1 (Jul 19) and 2 (Jul 26) can be placeholder/WIP.

**Ignyte:** Circle Developer Account email · working **frontend+backend MVP + architecture diagram** · video + presentation · GitHub (with setup + Circle integration docs) · demo URL · a **"Circle Product Feedback" section** (why these products, what worked, what to improve).

---

## 7. Timeline (against Encode dates)

| When | Work |
|---|---|
| **Now → Jul 13** | Register for both hackathons (**Ignyte closes Jul 13!**) · close P0 gaps · solve the live URL |
| Jul 13 (Launch) → Jul 19 (CP1) | Create project + idea + team (outline is fine) |
| → Jul 26 (CP2) | Repo + WIP (P0 done, P1 started) |
| → Aug 9 (Final) | P1 done · video + deck ready |
| Aug 20 | Demo Day |

---

## 8. Next concrete step

1. **Now:** start on the `CRITICAL-GAPS.md` P0 items — first the backend deploy (live URL) + wiring `register-onchain` into the UI.
2. In parallel, Marketing: Ignyte + Encode registration, deck skeleton, the "bounded authority" narrative.
