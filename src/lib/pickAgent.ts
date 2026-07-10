/**
 * Pick the most demo-worthy agent to feature on the Dashboard / Agent ID screens.
 *
 * The platform can hold several agents (including throwaway test ones); rather than
 * blindly showing the first-created, surface the one with the strongest real,
 * verifiable proof: anchored on-chain > KYA-verified > has a wallet, newest as the
 * tiebreak. Falls back to the first agent when nothing stands out.
 *
 * Generic over the caller's agent shape; the ranking fields are read defensively
 * (the /api/platform-agents objects carry them even when a local type narrows them out).
 */
type Rankable = {
  onchain?: string
  kya?: string
  walletAddress?: string | null
  createdAt?: string
}

export function pickPrimaryAgent<T>(agents: T[] | undefined): T | undefined {
  if (!agents?.length) return undefined
  const proof = (a: T) => {
    const r = a as Rankable
    return (r.onchain === 'registered' ? 4 : 0) + (r.kya === 'verified' ? 2 : 0) + (r.walletAddress ? 1 : 0)
  }
  const at = (a: T) => (a as Rankable).createdAt ?? ''
  return [...agents].sort((x, y) => proof(y) - proof(x) || at(y).localeCompare(at(x)))[0]
}
