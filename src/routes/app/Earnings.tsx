import { useCallback, useEffect, useState } from 'react'
import { Coins, RefreshCw, ExternalLink, ArrowUpRight, Loader2, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BACKEND_UNREACHABLE } from '../../lib/mcpBase'
import { apiFetch, readJson, explainError } from '../../lib/api'
import { fetchPlatformAgents } from '../../lib/platformAgents'
import { pickPrimaryAgent } from '../../lib/pickAgent'
import { authHeaders } from '../../store/auth'

/**
 * Earnings: what an agent has earned as a marketplace worker (released jobs), its live USDC
 * balance, and a one-click "move to Base Sepolia" via Circle Gateway. Closes the loop:
 * get hired -> get paid -> redeem cross-chain.
 */

type Agent = { id: string; name: string; walletAddress: string | null }
type Task = {
  id: string
  service: string
  priceUsd: number
  status: string
  settlement?: 'onchain' | 'simulated'
  escrowExplorer?: string
  updatedAt: string
}

const jsonHeaders = () => ({ 'Content-Type': 'application/json', ...authHeaders() })

export default function Earnings() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentId, setAgentId] = useState('')
  const [jobs, setJobs] = useState<Task[]>([])
  const [balance, setBalance] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [redeeming, setRedeeming] = useState(false)
  const [redeemNote, setRedeemNote] = useState('')

  const agent = agents.find((a) => a.id === agentId)

  const loadAgents = useCallback(async () => {
    try {
      const data = await fetchPlatformAgents<Agent>({})
      setAgents(data.agents)
      if (data.agents.length) setAgentId((cur) => cur || pickPrimaryAgent(data.agents)?.id || data.agents[0].id)
      setError(null)
    } catch {
      setError(BACKEND_UNREACHABLE)
    } finally {
      setLoaded(true)
    }
  }, [])

  const loadEarnings = useCallback(async (id: string, addr: string | null) => {
    try {
      const res = await apiFetch(`/api/marketplace/tasks?agentId=${encodeURIComponent(id)}`)
      const data = await readJson<{ tasks?: Task[] }>(res)
      setJobs(Array.isArray(data.tasks) ? data.tasks : [])
    } catch {
      setJobs([])
    }
    if (addr) {
      try {
        const r = await apiFetch(`/api/wallet-balance?address=${addr}`)
        const b = await readJson<{ balance: string | null }>(r)
        setBalance(b.balance ?? null)
      } catch {
        setBalance(null)
      }
    } else {
      setBalance(null)
    }
  }, [])

  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  useEffect(() => {
    if (agentId) loadEarnings(agentId, agent?.walletAddress ?? null)
  }, [agentId, agent?.walletAddress, loadEarnings])

  const released = jobs.filter((j) => j.status === 'released')
  const earnedUsd = released.reduce((s, j) => s + j.priceUsd, 0)

  async function redeem() {
    setRedeeming(true)
    setRedeemNote('')
    try {
      const res = await apiFetch('/api/arc/gateway-demo', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ amountUsd: 0.1 }),
        timeoutMs: 90_000,
        onWaking: () => setRedeemNote('Moving USDC to Base via Circle Gateway...'),
      })
      const data = await readJson<{ executed?: boolean; transfer?: { transferId?: string; error?: string }; reason?: string; error?: string }>(res)
      if (!res.ok) setRedeemNote(explainError(res.status, data.error))
      else if (data.executed === false) setRedeemNote(data.reason ?? 'Prepared: add a funded ARC_SIGNER_KEY to move real USDC cross-chain.')
      else if (data.transfer?.transferId) setRedeemNote(`Moved to Base Sepolia via Gateway (transfer ${data.transfer.transferId.slice(0, 10)}...).`)
      else setRedeemNote(data.transfer?.error ?? 'Redeem submitted.')
    } catch {
      setRedeemNote('Timed out. The backend may be waking up; try again.')
    } finally {
      setRedeeming(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="text-2xl font-bold tracking-tight">Earnings</h2>
      <p className="mt-1 max-w-xl text-sm text-foreground/55">
        What your agent has earned as a marketplace worker, its live USDC balance on Arc, and a
        one-click move to Base Sepolia via Circle Gateway.
      </p>

      {error && (
        <div className="mt-6 rounded-2xl border border-amber-200 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/10 p-5 text-sm text-foreground/70">
          {error}
        </div>
      )}

      {loaded && !error && agents.length === 0 && (
        <div className="mt-6 rounded-3xl border border-dashed border-foreground/15 bg-card p-12 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent">
            <Store size={26} />
          </div>
          <h3 className="mt-4 text-lg font-bold text-foreground">No agents yet.</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-foreground/55">
            Register an agent and list it on the marketplace to start earning.
          </p>
          <Link
            to="/app/agent-id"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
          >
            Register an agent
          </Link>
        </div>
      )}

      {agents.length > 0 && (
        <>
          {/* Agent selector */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-foreground/45">Agent</span>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="rounded-full border border-foreground/15 bg-background px-3 py-1.5 text-sm text-foreground"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => agentId && loadEarnings(agentId, agent?.walletAddress ?? null)}
              className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-3 py-1.5 text-xs font-semibold text-foreground/60 hover:bg-foreground/5"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {/* Stat cards */}
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-foreground/10 bg-card p-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground/45">
                <Coins size={14} className="text-accent" /> Earned (released jobs)
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground">{earnedUsd.toFixed(2)} <span className="text-sm font-semibold text-foreground/50">USDC</span></div>
              <div className="mt-1 text-xs text-foreground/45">{released.length} completed job{released.length === 1 ? '' : 's'}</div>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-card p-5">
              <div className="text-xs font-semibold text-foreground/45">Live wallet balance</div>
              <div className="mt-2 text-2xl font-bold text-foreground">
                {balance !== null ? Number(balance).toFixed(4) : '--'} <span className="text-sm font-semibold text-foreground/50">USDC</span>
              </div>
              <div className="mt-1 text-xs text-foreground/45">on Arc testnet</div>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-card p-5">
              <div className="text-xs font-semibold text-foreground/45">Redeem cross-chain</div>
              <button
                type="button"
                onClick={redeem}
                disabled={redeeming}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {redeeming ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpRight size={14} />}
                Move to Base (Gateway)
              </button>
              {redeemNote && <p className="mt-2 text-[11px] text-foreground/55">{redeemNote}</p>}
            </div>
          </div>

          {/* Completed jobs */}
          <h3 className="mt-8 text-lg font-bold tracking-tight">Completed jobs</h3>
          {released.length === 0 ? (
            <p className="mt-2 text-sm text-foreground/50">No completed jobs yet. Once a client releases the escrow on a delivered task, it shows up here.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {released
                .slice()
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .map((j) => (
                  <div key={j.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-foreground/10 bg-card p-4">
                    <div>
                      <span className="font-semibold text-foreground">{j.service}</span>
                      <span className="ml-2 text-xs text-foreground/45">
                        {new Date(j.updatedAt).toLocaleDateString()}
                        {j.settlement === 'onchain' ? ' · on-chain' : j.settlement === 'simulated' ? ' · simulated' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-accent">+{j.priceUsd.toFixed(2)} USDC</span>
                      {j.escrowExplorer && (
                        <a href={j.escrowExplorer} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#2775CA] hover:underline">
                          <ExternalLink size={12} /> arcscan
                        </a>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
