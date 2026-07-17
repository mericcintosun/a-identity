/**
 * Human-readable HTML for GET /proof — served when a browser (a judge clicking the
 * link) hits the endpoint; agents/API callers still get JSON via content negotiation.
 * Self-contained (inline CSS), dark, responsive. Data comes from ./proof.ts — the same
 * verifiable facts, just presented for a person.
 */
import { PROOF } from './proof.js'

const esc = (s: unknown) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-8)}`

export function renderProofHtml(): string {
  const p = PROOF
  const rev = p.realOnchainRevenue

  const serviceRows = [
    ['verify_agent', '$0.001', 'ERC-8004 on-chain identity + KYA status'],
    ['reputation_score', '$0.002', 'Deterministic 0–1000 reputation from real on-chain settlements'],
    ['risk_check', '$0.005', 'Pre-transaction ALLOW / WARN / DENY with reasons'],
    ['agent_passport', '$0.01', 'Full passport: identity + KYA + reputation + risk'],
  ]
    .map(([t, price, w]) => `<tr><td><code>${t}</code></td><td class="price">${price}</td><td>${esc(w)}</td></tr>`)
    .join('')

  const settleRows = rev.settlements
    .map(
      (s) =>
        `<tr><td><code>${esc(s.tool)}</code></td><td class="price">$${s.priceUsd}</td><td><a href="${esc(s.txUrl)}" target="_blank" rel="noopener"><code>${esc(short(s.txHash))}</code></a></td></tr>`,
    )
    .join('')

  const verifyList = p.howToVerify.map((v) => `<li>${esc(v)}</li>`).join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>A-Identity Trust Oracle — Proof (OKX.AI Agent #6271)</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0b0d10; color: #e6e9ef; font: 15px/1.6 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  .wrap { max-width: 880px; margin: 0 auto; padding: 32px 20px 64px; }
  header { border-bottom: 1px solid #1e2530; padding-bottom: 20px; margin-bottom: 24px; }
  h1 { font-size: 26px; margin: 0 0 6px; letter-spacing: -0.02em; }
  .tag { color: #8aa0b6; font-size: 14px; }
  .badge { display: inline-block; background: #12331f; color: #4ade80; border: 1px solid #1f6b3a; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; margin-top: 10px; }
  h2 { font-size: 16px; margin: 30px 0 10px; color: #cdd6e2; text-transform: uppercase; letter-spacing: 0.06em; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 14px; overflow-x: auto; display: block; }
  @media (min-width: 560px) { table { display: table; } }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #171d26; vertical-align: top; }
  th { color: #8aa0b6; font-weight: 600; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; color: #a7f3d0; }
  a { color: #60a5fa; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .price { color: #4ade80; white-space: nowrap; }
  .grid { display: grid; gap: 6px 16px; grid-template-columns: 160px 1fr; font-size: 14px; }
  .grid dt { color: #8aa0b6; }
  .grid dd { margin: 0; }
  ul { margin: 6px 0; padding-left: 20px; }
  li { margin: 4px 0; }
  footer { margin-top: 36px; padding-top: 18px; border-top: 1px solid #1e2530; color: #6b7a8d; font-size: 13px; }
  .kpi { display: flex; flex-wrap: wrap; gap: 10px; margin: 12px 0; }
  .kpi div { background: #11151b; border: 1px solid #1e2530; border-radius: 10px; padding: 10px 14px; }
  .kpi b { display: block; font-size: 20px; color: #fff; }
  .kpi span { font-size: 12px; color: #8aa0b6; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>A-Identity Trust Oracle</h1>
    <div class="tag">The identity &amp; reputation oracle for the agent economy — verify a counterparty before any agent-to-agent transaction.</div>
    <span class="badge">● LIVE on OKX.AI · A2MCP · Agent ${esc(p.asp.agentId)}</span>
  </header>

  <div class="kpi">
    <div><b>${esc(p.asp.agentId)}</b><span>OKX.AI Agent</span></div>
    <div><b>4</b><span>real mainnet settlements</span></div>
    <div><b>$${rev.totalUsd}</b><span>on-chain revenue</span></div>
    <div><b>${p.engineering.tests}</b><span>unit tests</span></div>
    <div><b>0–1000</b><span>deterministic reputation</span></div>
  </div>

  <h2>Live ASP</h2>
  <dl class="grid">
    <dt>Type</dt><dd>${esc(p.asp.type)}</dd>
    <dt>Network</dt><dd>${esc(p.asp.network)}</dd>
    <dt>Registration</dt><dd><a href="${esc(p.asp.registrationTxUrl)}" target="_blank" rel="noopener"><code>${esc(short(p.asp.registrationTx))}</code></a></dd>
    <dt>Docs</dt><dd><a href="${esc(p.docs)}" target="_blank" rel="noopener">${esc(p.docs)}</a></dd>
  </dl>

  <h2>Services (x402 pay-per-call)</h2>
  <table><thead><tr><th>Tool</th><th>Price</th><th>Returns</th></tr></thead><tbody>${serviceRows}</tbody></table>

  <h2>Real on-chain revenue — not a mock</h2>
  <div class="tag">Four real x402 settlements on ${esc(rev.network)}, in ${esc(rev.asset)}. Each is independently verifiable on OKLink. payTo received exactly $${rev.totalUsd} across the four.</div>
  <table><thead><tr><th>Tool</th><th>Amount</th><th>Settlement tx</th></tr></thead><tbody>${settleRows}</tbody></table>
  <dl class="grid">
    <dt>payTo</dt><dd><a href="${esc(rev.payToUrl)}" target="_blank" rel="noopener"><code>${esc(rev.payTo)}</code></a></dd>
  </dl>

  <h2>Backed by real data</h2>
  <dl class="grid">
    <dt>Showcase agent</dt><dd>${esc(p.showcaseAgent.name)} (ERC-8004 ${esc(p.showcaseAgent.erc8004TokenId)}, ${esc(p.showcaseAgent.chain)})</dd>
    <dt>Reputation</dt><dd>${esc(p.showcaseAgent.reputation)}</dd>
    <dt>KYA</dt><dd>${esc(p.showcaseAgent.kya)}</dd>
  </dl>

  <h2>Engineering rigor</h2>
  <dl class="grid">
    <dt>Tests</dt><dd>${p.engineering.tests} unit tests · deterministic reputation scorer</dd>
    <dt>On-chain reads</dt><dd>${esc(p.engineering.liveOnchainReads)}</dd>
    <dt>Standards</dt><dd>${esc(p.engineering.standards.join(', '))}</dd>
    <dt>Methodology</dt><dd><a href="/methodology">/methodology</a> — exact, reproducible formulas</dd>
    <dt>Repo</dt><dd><a href="${esc(p.engineering.repo)}" target="_blank" rel="noopener">${esc(p.engineering.repo)}</a></dd>
  </dl>

  <h2>Verify it yourself</h2>
  <ul>${verifyList}</ul>

  <footer>
    A-Identity · ${esc(p.submission)} · <a href="/proof.json">JSON</a> · <a href="/methodology">/methodology</a> · <a href="${esc(p.docs)}" target="_blank" rel="noopener">a-identity.xyz</a><br>
    Verify first. Pay at machine speed.
  </footer>
</div>
</body>
</html>`
}
