/**
 * Deterministic reputation engine — the SINGLE scorer, used in production.
 *
 * `platform.ts` `repOf` gathers an agent's real signals (on-chain settlements, rejections,
 * on-chain identity, tenure) and calls `computeAgentReputation` here. This module holds the
 * pure math so it can be unit-tested independently and independently recomputed by anyone
 * from the same signals (the score can later be anchored on-chain, e.g. a hash in the
 * ERC-8004 Reputation Registry).
 *
 * Historical note: an earlier version of this file scored from a mock `AgentActionHistory`
 * with different constants and was never wired into the running backend — so the tested
 * scorer and the production scorer had drifted apart. They are now the same function.
 *
 * Score (0-1000) = settlement(0-600, incl. a +60 on-chain-identity credit) + validation(0-240)
 * + tenure(0-160) + behavior(-150..+40, from real job outcomes), clamped 0-1000.
 */

const DAY_MS = 86_400_000

/** The real, verifiable signals an agent's score is computed from. */
export type ReputationSignals = {
  /** Count of instructions that settled on-chain (status executed_onchain). */
  settledCount: number
  /** Count of instructions that were rejected. */
  rejected: number
  /** True once the agent holds a verified on-chain ERC-8004 identity. */
  onchainRegistered: boolean
  /** When the agent was created (for tenure). ISO string, ms, or Date. */
  createdAt: string | number | Date
  /** Total USD settled on-chain (carried through for display; not part of the score). */
  settledUsd?: number
  // ── behavioral signals (all optional; absent/zero => neutral, score unchanged) ──
  /** Marketplace jobs this agent completed as the worker (task status 'released'). */
  completedTasks?: number
  /** Jobs that ended contested as the worker (task status 'refunded' or 'disputed'). */
  disputedTasks?: number
  /** Mean client star rating (1..5) over the agent's reviewed jobs. */
  avgRating?: number
  /** How many client reviews back `avgRating` (a single review must not dominate). */
  ratedCount?: number
}

export type ReputationResult = {
  score: number
  breakdown: { settlement: number; validation: number; tenure: number; behavior: number }
  settledOnchain: number
  settledUsd: number
}

/** Bounds on the behavioral adjustment: it sharpens the score, it never dominates it. */
const BEHAVIOR_FLOOR = -150
const BEHAVIOR_CEIL = 40

/**
 * Signed behavioral adjustment (BEHAVIOR_FLOOR..BEHAVIOR_CEIL) from an agent's REAL job
 * outcomes: the share of concluded jobs that ended contested (dispute/refund) is a penalty,
 * and the mean client rating (needs >=2 reviews so one can't dominate) a small bonus/penalty.
 * Every input is optional; with no job history this returns 0, so an agent that has never
 * been hired scores exactly as it did before this signal existed.
 */
function behaviorAdjustment(s: ReputationSignals): number {
  const completed = Math.max(0, Math.floor(s.completedTasks ?? 0))
  const disputed = Math.max(0, Math.floor(s.disputedTasks ?? 0))
  const terminalHired = completed + disputed
  const rated = Math.max(0, Math.floor(s.ratedCount ?? 0))
  const avg = typeof s.avgRating === 'number' && Number.isFinite(s.avgRating) ? s.avgRating : NaN

  let behavior = 0
  // Reliability: fraction of concluded jobs that ended contested (0..1) => up to -150.
  if (terminalHired > 0) behavior -= Math.round(150 * (disputed / terminalHired))
  // Satisfaction: client ratings around a 4-star neutral, bounded, needs >=2 reviews.
  if (rated >= 2 && Number.isFinite(avg)) behavior += Math.max(-40, Math.min(40, Math.round((avg - 4) * 40)))
  return Math.max(BEHAVIOR_FLOOR, Math.min(BEHAVIOR_CEIL, behavior))
}

/**
 * Pure, deterministic reputation from real signals. `asOf` defaults to now but is
 * injectable for tests. This is exactly the math `platform.ts` runs in production.
 */
export function computeAgentReputation(s: ReputationSignals, asOf: Date = new Date()): ReputationResult {
  const total = s.settledCount + s.rejected
  // Settlement: on-chain settlements with diminishing returns, plus a credit for holding
  // a verified on-chain identity. Capped at 600.
  const idBonus = s.onchainRegistered ? 60 : 0
  const settlement = Math.min(600, Math.round(600 * (1 - Math.exp(-s.settledCount / 6))) + idBonus)
  // Validation: share of clean (settled vs rejected) actions. Capped at 240.
  const validation = total === 0 ? 0 : Math.round(240 * (s.settledCount / total))
  // Tenure: ~1 point per 2 days since creation. Capped at 160. An unparseable/absent
  // createdAt contributes 0 tenure (never NaN) — a NaN score would otherwise slip past
  // every downstream risk comparison (`NaN < threshold` is always false).
  const createdMs = new Date(s.createdAt).getTime()
  const days = Number.isFinite(createdMs) ? Math.max(0, Math.floor((asOf.getTime() - createdMs) / DAY_MS)) : 0
  const tenure = Math.min(160, Math.round(days / 2))
  // Behavior: a signed adjustment from real marketplace job outcomes (dispute rate + client
  // ratings). Bounded and defaulting to 0 without history, so it sharpens the score without
  // rewriting how an agent with no jobs is scored.
  const behavior = behaviorAdjustment(s)
  const score = Math.max(0, Math.min(1000, settlement + validation + tenure + behavior))
  return { score, breakdown: { settlement, validation, tenure, behavior }, settledOnchain: s.settledCount, settledUsd: s.settledUsd ?? 0 }
}
