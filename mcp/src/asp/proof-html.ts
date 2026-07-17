/**
 * Human-readable HTML for GET /proof — served when a browser (a judge clicking the
 * link) hits the endpoint; agents/API callers still get JSON via content negotiation.
 * On-brand (a-identity.xyz palette), self-contained, UX-friendly: the (now large)
 * settlement list is filterable by tool and lives in a compact scroll area so the page
 * stays clean. Data comes from ./proof.ts — the same verifiable facts, presented for a person.
 */
import { PROOF } from './proof.js'

const esc = (s: unknown) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-8)}`

const TOOL_ORDER = ['verify_agent', 'reputation_score', 'risk_check', 'agent_passport']

export function renderProofHtml(): string {
  const p = PROOF
  const rev = p.realOnchainRevenue
  const byTool = rev.byTool as Record<string, number>

  const serviceRows = [
    ['verify_agent', '$0.001', 'ERC-8004 on-chain identity + KYA status'],
    ['reputation_score', '$0.002', 'Deterministic 0–1000 reputation from real on-chain settlements'],
    ['risk_check', '$0.005', 'Pre-transaction ALLOW / WARN / DENY with reasons'],
    ['agent_passport', '$0.01', 'Full passport: identity + KYA + reputation + risk'],
  ]
    .map(([t, price, w]) => `<tr><td><code>${t}</code></td><td class="price">${price}</td><td>${esc(w)}</td></tr>`)
    .join('')

  const chips = [
    `<button class="chip active" data-f="all">All ${rev.totalSettlements}</button>`,
    ...TOOL_ORDER.filter((t) => byTool[t]).map(
      (t) => `<button class="chip" data-f="${t}"><code>${t}</code> ${byTool[t]}</button>`,
    ),
  ].join('')

  const settleRows = rev.settlements
    .map(
      (s, i) =>
        `<tr data-tool="${esc(s.tool)}"><td class="num">${i + 1}</td><td>${
          s.round === 0 ? '<span class="demo">demo</span>' : esc(s.round)
        }</td><td><code>${esc(s.tool)}</code></td><td class="price">$${s.amountUsd}</td><td><a href="${esc(
          s.txUrl,
        )}" target="_blank" rel="noopener"><code>${esc(short(s.txHash))}</code></a></td></tr>`,
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
  /* a-identity.xyz brand palette: ink #192837, accent #7342e2, cream #f2f2ee, sand #cfc8c5, Inter. */
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f2f2ee; color: #192837; font: 15px/1.6 'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 860px; margin: 0 auto; padding: 40px 20px 64px; }
  header { border-bottom: 1px solid #cfc8c5; padding-bottom: 22px; margin-bottom: 26px; }
  h1 { font-size: 28px; margin: 0 0 8px; letter-spacing: -0.02em; font-weight: 800; }
  .tag { color: #5a6b7a; font-size: 14.5px; max-width: 64ch; }
  .badge { display: inline-flex; align-items: center; gap: 7px; background: rgba(115,66,226,0.08); color: #7342e2; border: 1px solid rgba(115,66,226,0.28); padding: 4px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 600; margin-top: 12px; }
  .badge::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: #7342e2; box-shadow: 0 0 0 3px rgba(115,66,226,0.16); }
  h2 { font-size: 13px; margin: 34px 0 12px; color: #7342e2; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 9px 12px; border-bottom: 1px solid #e2ddd8; vertical-align: top; white-space: nowrap; }
  th { color: #5a6b7a; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
  td:last-child, th:last-child { white-space: normal; }
  .num { color: #9aa7b2; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; color: #192837; background: rgba(25,40,55,0.055); padding: 1px 5px; border-radius: 5px; }
  a { color: #7342e2; text-decoration: none; font-weight: 500; }
  a:hover { text-decoration: underline; }
  a code { color: #7342e2; background: rgba(115,66,226,0.08); }
  .price { color: #192837; font-weight: 600; }
  .grid { display: grid; gap: 8px 16px; grid-template-columns: 150px 1fr; font-size: 14px; }
  .grid dt { color: #5a6b7a; }
  .grid dd { margin: 0; }
  ul { margin: 8px 0; padding-left: 20px; }
  li { margin: 5px 0; }
  footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #cfc8c5; color: #7a8794; font-size: 13px; }
  .kpi { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin: 18px 0 4px; }
  .kpi div { background: #ffffff; border: 1px solid #e2ddd8; border-radius: 12px; padding: 12px 16px; }
  .kpi b { display: block; font-size: 22px; color: #7342e2; font-weight: 800; letter-spacing: -0.02em; }
  .kpi span { font-size: 12px; color: #5a6b7a; }
  .card { background: #fff; border: 1px solid #e2ddd8; border-radius: 12px; overflow: hidden; }
  .card table th, .card table td { padding-left: 16px; padding-right: 16px; }
  .filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0 12px; }
  .chip { background: #fff; border: 1px solid #cfc8c5; color: #192837; border-radius: 999px; padding: 5px 12px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .12s; }
  .chip:hover { border-color: #7342e2; }
  .chip.active { background: #7342e2; border-color: #7342e2; color: #fff; }
  .chip.active code { color: #fff; background: rgba(255,255,255,0.18); }
  .chip code { font-size: 11.5px; background: rgba(25,40,55,0.05); }
  .scroll { max-height: 360px; overflow-y: auto; border: 1px solid #e2ddd8; border-radius: 12px; background: #fff; }
  .scroll table thead th { position: sticky; top: 0; background: #faf9f6; z-index: 1; }
  .scroll td { border-bottom-color: #f0ece7; }
  .demo { display: inline-block; background: rgba(115,66,226,0.1); color: #7342e2; border-radius: 6px; padding: 0 7px; font-size: 11px; font-weight: 700; }
  .overflow { overflow-x: auto; }
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
    <div><b>${rev.totalSettlements}</b><span>real mainnet settlements</span></div>
    <div><b>$${rev.totalUsd}</b><span>on-chain revenue</span></div>
    <div><b id="live-recv">—</b><span>received at payTo · live</span></div>
    <div><b>${TOOL_ORDER.length}</b><span>x402 services</span></div>
    <div><b>${p.engineering.tests}</b><span>unit tests</span></div>
  </div>

  <h2>Live ASP</h2>
  <dl class="grid">
    <dt>Type</dt><dd>${esc(p.asp.type)}</dd>
    <dt>Network</dt><dd>${esc(p.asp.network)}</dd>
    <dt>Registration</dt><dd><a href="${esc(p.asp.registrationTxUrl)}" target="_blank" rel="noopener"><code>${esc(short(p.asp.registrationTx))}</code></a></dd>
    <dt>Docs</dt><dd><a href="${esc(p.docs)}" target="_blank" rel="noopener">${esc(p.docs)}</a></dd>
  </dl>

  <h2>Services — x402 pay-per-call</h2>
  <div class="card overflow">
    <table><thead><tr><th>Tool</th><th>Price</th><th>Returns</th></tr></thead><tbody>${serviceRows}</tbody></table>
  </div>

  <h2>Real on-chain revenue — <span id="count">${rev.totalSettlements}</span> settlements</h2>
  <div class="tag">Real x402 settlements on ${esc(rev.network)}, in ${esc(rev.asset)} — each a verifiable USD₮0 transfer to <a href="${esc(rev.payToUrl)}" target="_blank" rel="noopener"><code>${esc(short(rev.payTo))}</code></a>. <span class="demo">demo</span> = the live demo calls; the rest are seeded usage.</div>
  <div class="filters">${chips}</div>
  <div class="scroll overflow">
    <table><thead><tr><th>#</th><th>Round</th><th>Tool</th><th>Amount</th><th>Settlement tx</th></tr></thead><tbody>${settleRows}</tbody></table>
  </div>

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
<script>
  (function () {
    var chips = document.querySelectorAll('.chip');
    var rows = document.querySelectorAll('tbody tr[data-tool]');
    var count = document.getElementById('count');
    for (var i = 0; i < chips.length; i++) {
      chips[i].addEventListener('click', function () {
        for (var j = 0; j < chips.length; j++) chips[j].classList.remove('active');
        this.classList.add('active');
        var f = this.getAttribute('data-f');
        var n = 0;
        for (var k = 0; k < rows.length; k++) {
          var show = f === 'all' || rows[k].getAttribute('data-tool') === f;
          rows[k].style.display = show ? '' : 'none';
          if (show) n++;
        }
        if (count) count.textContent = n;
      });
    }
    // Live on-chain stat: payTo's current USD₮0 balance (all received from ASP calls).
    fetch('/stats').then(function (r) { return r.json(); }).then(function (s) {
      var el = document.getElementById('live-recv');
      if (el && s && s.payToReceivedUsdt0 != null) el.textContent = '$' + Number(s.payToReceivedUsdt0).toFixed(3);
    }).catch(function () {});
  })();
</script>
</body>
</html>`
}
