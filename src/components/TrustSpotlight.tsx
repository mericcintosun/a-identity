import { useEffect, useReducer, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Search, CornerDownLeft, X, ArrowUpRight } from 'lucide-react'
import { resolveAgent, getReputation, getLeaderboard, type AgentIdentity, type Reputation, type FeedAgent } from '../lib/mcp-client'

/*
 * TrustSpotlight — a command-palette (⌘K / Ctrl+K) + a floating "magic" FAB that opens a
 * live agent trust lookup from anywhere. Follows command-palette best practice (platform-aware
 * shortcut, ESC to close, autofocus, debounced lookup, featured quick-picks) with a delightful
 * glowing sparkle trigger. Opens on ⌘K, on the FAB, or on a window 'open-trust-spotlight' event
 * (fired by the hero button). Palette unchanged; status hues match /explorer.
 */

const ACCENT = '#7342E2'
const RISK = { ALLOW: '#059669', WARN: '#d97706', DENY: '#dc2626' } as const
type Verdict = keyof typeof RISK
const riskOf = (s: number, kya?: string, verified = true): Verdict => (kya === 'revoked' || !verified || s < 200 ? 'DENY' : s < 500 ? 'WARN' : 'ALLOW')
const gradeOf = (s: number) =>
  s >= 800 ? 'Excellent' : s >= 650 ? 'Strong' : s >= 500 ? 'Good' : s >= 350 ? 'Fair' : s >= 200 ? 'Weak' : 'High risk'
const shorten = (a?: string | null) => (a && a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a ?? '')

function hash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}
function Identicon({ seed, size = 40 }: { seed: string; size?: number }) {
  const h = hash(seed), hue = h % 360, fg = `hsl(${hue} 62% 52%)`
  const at = (r: number, c: number) => ((h >> (r * 3 + (c < 3 ? c : 4 - c))) & 1) === 1
  const u = size / 5
  return (
    <svg width={size} height={size} className="shrink-0 rounded-lg" style={{ background: `hsl(${hue} 40% 96% / 0.08)` }}>
      {Array.from({ length: 5 }).map((_, r) => Array.from({ length: 5 }).map((_, c) => (at(r, c) ? <rect key={`${r}-${c}`} x={c * u} y={r * u} width={u} height={u} fill={fg} /> : null)))}
    </svg>
  )
}
function useCountUp(target: number, duration = 800) {
  const [val, setVal] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const start = performance.now(), begin = from.current
    let raf = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / duration)
      setVal(Math.round(begin + (target - begin) * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(tick); else from.current = target
    })
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent || '')

type Result = { identity: AgentIdentity | null; reputation: Reputation | null } | null

function ResultCard({ result, q, onOpen }: { result: NonNullable<Result>; q: string; onOpen: () => void }) {
  const { identity, reputation } = result
  const verified = identity?.valid ?? reputation?.onchain === 'registered'
  const score = reputation?.score ?? 0
  const shown = useCountUp(score)
  const v = riskOf(score, reputation?.kya, verified)
  const name = reputation?.name || (identity ? `Agent #${identity.tokenId}` : q)
  const seed = identity?.owner || identity?.tokenId?.toString() || q
  return (
    <motion.button onClick={onOpen} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="group flex w-full flex-col gap-4 rounded-xl border border-border bg-background/40 p-4 text-left transition-colors hover:bg-foreground/[0.03]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Identicon seed={seed} />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-foreground">{name}</div>
            <div className="truncate font-mono text-[11px] text-foreground/45">
              {identity ? `#${identity.tokenId}` : q}{identity?.owner ? ` · ${shorten(identity.owner)}` : ''} · KYA {reputation?.kya ?? '—'}
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold" style={{ color: RISK[v], background: `${RISK[v]}14`, boxShadow: `inset 0 0 0 1px ${RISK[v]}33` }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: RISK[v] }} /> {v}
        </span>
      </div>
      {reputation && (
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold tabular-nums tracking-tight text-foreground">{shown}</span>
            <span className="font-mono text-xs text-foreground/35">/ 1000</span>
            <span className="ml-auto text-xs font-semibold" style={{ color: RISK[v] }}>{gradeOf(score)}</span>
          </div>
          <div className="mt-2.5 h-2 w-full rounded-full" style={{ background: 'linear-gradient(90deg,#dc2626,#d97706 45%,#059669)' }}>
            <div className="relative h-full">
              <motion.span className="absolute -top-1 h-4 w-[3px] -translate-x-1/2 rounded-full bg-foreground shadow-[0_0_0_2px_var(--color-card)]"
                initial={{ left: 0 }} animate={{ left: `${Math.max(0, Math.min(100, score / 10))}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-1 text-xs font-semibold text-accent opacity-0 transition-opacity group-hover:opacity-100">Open full profile <ArrowUpRight size={13} /></div>
    </motion.button>
  )
}

export default function TrustSpotlight() {
  const navigate = useNavigate()
  const [open, toggle] = useReducer((o: boolean, next?: boolean) => (typeof next === 'boolean' ? next : !o), false)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result>(null)
  const [featured, setFeatured] = useState<FeedAgent[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Global open triggers: ⌘K / Ctrl+K, and a window event fired by the hero button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); toggle() }
      else if (e.key === 'Escape') toggle(false)
    }
    const onOpen = () => toggle(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('open-trust-spotlight', onOpen)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('open-trust-spotlight', onOpen) }
  }, [])

  // On first open: featured agents + focus.
  useEffect(() => {
    if (!open) return
    setTimeout(() => inputRef.current?.focus(), 40)
    if (!featured.length) void getLeaderboard().then((r) => { if (r.ok) setFeatured(r.data.filter((a) => (a.reputation?.score ?? 0) > 0).slice(0, 5)) })
  }, [open, featured.length])

  // Debounced live lookup.
  useEffect(() => {
    const term = q.trim()
    if (!term) { setResult(null); setLoading(false); return }
    setLoading(true)
    const t = setTimeout(async () => {
      const [idRes, repRes] = await Promise.all([resolveAgent(term), getReputation(term)])
      const identity = idRes.ok && idRes.data.found ? (idRes.data.agent ?? null) : null
      const reputation = repRes.ok && repRes.data.found ? (repRes.data.reputation ?? null) : null
      setResult(identity || reputation ? { identity, reputation } : null)
      setLoading(false)
    }, 350)
    return () => clearTimeout(t)
  }, [q])

  const goExplorer = (term?: string) => { toggle(false); navigate(`/explorer${term ? `?q=${encodeURIComponent(term)}` : ''}`) }
  const kbd = isMac ? '⌘K' : 'Ctrl K'

  return (
    <>
      {/* Floating magic trigger */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab" onClick={() => toggle(true)} aria-label="Verify an agent"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
            className="group fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full py-3 pl-3.5 pr-4 text-white shadow-[0_12px_40px_-8px_rgba(115,66,226,0.6)]"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, #4f2bb0)` }}
          >
            <span className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 0 ${ACCENT}` }}>
              <motion.span className="absolute inset-0 rounded-full" style={{ border: `1px solid ${ACCENT}` }}
                animate={{ scale: [1, 1.5], opacity: [0.6, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }} />
            </span>
            <Sparkles size={18} className="relative" />
            <span className="relative hidden text-sm font-semibold sm:inline">Verify an agent</span>
            <kbd className="relative hidden rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold sm:inline">{kbd}</kbd>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Spotlight modal */}
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => toggle(false)}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div role="dialog" aria-modal="true" aria-label="Trust lookup"
              initial={{ opacity: 0, scale: 0.97, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: -6 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_40px_120px_-20px_rgba(10,15,25,0.6)]">
              {/* search row */}
              <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
                <Search size={18} className="shrink-0 text-foreground/40" />
                <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') goExplorer(q.trim() || undefined) }}
                  placeholder="Verify an agent by token id or 0x address"
                  className="w-full bg-transparent font-mono text-sm text-foreground outline-none placeholder:font-sans placeholder:text-foreground/40" />
                <button onClick={() => toggle(false)} aria-label="Close" className="shrink-0 rounded-md p-1 text-foreground/40 hover:bg-foreground/5 hover:text-foreground"><X size={16} /></button>
              </div>

              {/* body */}
              <div className="max-h-[52vh] overflow-y-auto p-4">
                {loading && <div className="flex items-center gap-2 px-1 py-6 text-sm text-foreground/45"><span className="h-3 w-3 animate-spin rounded-full border-2 border-foreground/20 border-t-accent" /> Reading the chain…</div>}
                {!loading && result && <ResultCard result={result} q={q.trim()} onOpen={() => goExplorer(q.trim())} />}
                {!loading && !result && q.trim() && <div className="px-1 py-6 text-sm text-foreground/50">No agent found for <span className="font-mono text-foreground/70">{q.trim()}</span>. Try a token id like <button onClick={() => setQ('849980')} className="font-mono text-accent hover:underline">849980</button>.</div>}
                {!loading && !q.trim() && (
                  <div>
                    <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground/40">Featured agents</div>
                    <div className="flex flex-col">
                      {(featured.length ? featured : []).map((a) => {
                        const s = a.reputation?.score ?? 0, v = riskOf(s, a.kya)
                        return (
                          <button key={a.id} onClick={() => setQ(a.onchainAgentId || a.id)}
                            className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-foreground/[0.04]">
                            <Identicon seed={a.onchainAgentId || a.id} size={30} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-foreground">{a.name}</div>
                              <div className="truncate font-mono text-[11px] text-foreground/40">{a.category}{a.onchainAgentId ? ` · #${a.onchainAgentId}` : ''}</div>
                            </div>
                            <span className="font-mono text-xs font-semibold tabular-nums text-foreground/70">{s}</span>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: RISK[v] }} />
                          </button>
                        )
                      })}
                      {!featured.length && <div className="px-2 py-4 text-sm text-foreground/40">Loading agents…</div>}
                    </div>
                  </div>
                )}
              </div>

              {/* footer hints */}
              <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-[11px] text-foreground/45">
                <span className="inline-flex items-center gap-1.5"><CornerDownLeft size={12} /> open in explorer</span>
                <span className="inline-flex items-center gap-1.5"><kbd className="rounded border border-border px-1.5 py-0.5 font-mono">{kbd}</kbd> toggle · <kbd className="rounded border border-border px-1.5 py-0.5 font-mono">Esc</kbd> close</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
