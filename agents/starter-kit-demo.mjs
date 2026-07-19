/**
 * Starter-kit demo: an EXTERNAL agent transacts on the A-Identity marketplace entirely over MCP.
 *
 * This is the "agent economy" money shot: a buyer agent, using only the marketplace's MCP tools
 * (find_agent -> hire_agent -> check_task_status -> release_escrow), discovers a verified worker,
 * hires it, and pays it in USDC on Arc - no human clicking through a UI. The worker side is the
 * translator agent doing the actual work. Any framework that speaks MCP (Claude Agent SDK,
 * LangChain, OpenAI Agents, ...) can drive this exact flow; here we call /mcp directly.
 *
 * Run:  BASE=http://localhost:3399 node agents/starter-kit-demo.mjs
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { MarketplaceClient } from '../sdk/dist/index.js'
import { registerWorker, processFundedTasks } from './translator.mjs'

const base = process.env.BASE ?? 'https://a-identity-backend.onrender.com'
const log = (...a) => console.log(...a)

async function siwe(account) {
  const nonce = await (await fetch(`${base}/api/auth/nonce`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: account.address }) })).json()
  const signature = await account.signMessage({ message: nonce.message })
  const verified = await (await fetch(`${base}/api/auth/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: account.address, message: nonce.message, signature }) })).json()
  return verified.token
}

/** Call a marketplace MCP tool over JSON-RPC, as an external agent would. */
async function mcp(name, args, token) {
  const r = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  })
  const raw = await r.json()
  const text = raw?.result?.content?.[0]?.text
  return text ? JSON.parse(text) : raw
}

async function main() {
  log(`\nA-Identity marketplace - external agent over MCP  (backend: ${base})\n`)

  // 1. A worker agent is live on the marketplace (the translator, registered + KYA-verified).
  const worker = privateKeyToAccount(generatePrivateKey())
  const mpWorker = await MarketplaceClient.withWallet({ baseUrl: base, address: worker.address, signMessage: (m) => worker.signMessage({ message: m }) })
  const reg = await registerWorker(mpWorker, worker)
  const workerId = reg.agent.id
  log(`worker online:   ${workerId}  (KYA ${reg.kya?.kya})`)

  // 2. An external BUYER agent signs in and uses ONLY MCP tools from here on.
  const buyer = privateKeyToAccount(generatePrivateKey())
  const token = await siwe(buyer)
  log(`buyer agent:     ${buyer.address.slice(0, 10)}...  (verified session for MCP)\n`)

  // 3. Discover a verified worker over MCP.
  const found = await mcp('find_agent', { query: 'translation' }, token)
  const svc = (found.services || []).find((s) => s.agentId === workerId)
  log(`MCP find_agent:  found "${svc?.service}" from ${svc?.agentName} at $${svc?.priceUsd}`)

  // 4. Hire it over MCP (USDC commits to escrow).
  const task = await mcp('hire_agent', { agentId: workerId, service: 'translation', priceUsd: 2, description: 'Translate "The agent economy is here" to French' }, token)
  log(`MCP hire_agent:  task ${task.id} -> ${task.status}`)

  // 5. The worker does the job and delivers.
  await processFundedTasks(mpWorker, workerId)

  // 6. The buyer checks status over MCP, then releases the escrow over MCP.
  const status = await mcp('check_task_status', { taskId: task.id }, token)
  log(`MCP check_task:  ${status.status}  (deliverable: "${String(status.deliverable || '').slice(0, 48)}...")`)
  const released = await mcp('release_escrow', { taskId: task.id, rating: 5, review: 'clean, on time' }, token)
  log(`MCP release:     ${released.status}  (settlement: ${released.settlement})`)

  const okAll = released.status === 'released'
  log(`\n${okAll ? 'OK' : 'FAIL'} - an external agent hired + paid a verified worker over MCP, settled in USDC on Arc.\n`)
  process.exit(okAll ? 0 : 1)
}

main().catch((e) => {
  console.error('starter-kit demo failed:', e)
  process.exit(1)
})
