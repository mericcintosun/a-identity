/**
 * What the console's Network list (routes/app/Dashboard.tsx) shows for each chain, kept out of
 * the component so network-rows.test.ts can hold every row to the generated chain registry.
 * Siblings are imported with a .ts extension because node --test loads this file directly.
 */
import { CHAIN_SETTLEMENT_PAUSED, type Chain } from './chains.ts'

/**
 * Which chains get a row on the Network list: live and beta only, the same status rule the
 * wallet lists use (chainsFor in lib/wallet/types.ts). A planned entry is descriptor only, so
 * a row for it would describe nothing of ours. On 2026-11-28 that is Avalanche: the canonical
 * ERC-8004 registries are live there, but we hold no agent on them and no rail of ours is
 * wired. The filter reads the registry status, never a list of ids, so promoting a chain in
 * mcp/src/chains/registry.ts brings its row back with no edit here.
 */
export const onNetworkList = (c: Chain): boolean => c.status === 'live' || c.status === 'beta'

/**
 * What one network row can honestly say under its status badge.
 *
 * Every non-Arc row used to read "no live agents yet", which was false for the three chains
 * carrying real registries and real agents. We do not have a per-chain agent count (an
 * ERC-8004 registry is not enumerable), so the row states what the chain registry does know:
 * which canonical ERC-8004 addresses it lists for that chain, and the token of a settlement
 * rail it declares there. An absent key means the chain registry lists no canonical ERC-8004
 * address here: not that none is deployed (Avalanche), and not that nothing of ours reads one
 * (the NEAR engine reads Arras's NEAR registries). So a row with neither claims no absence:
 * the fallback says only that we read there.
 */
export function registryLine(c: Chain): string {
  const parts = [
    c.registries.identity && 'identity',
    c.registries.reputation && 'reputation',
    c.registries.validation && 'validation',
  ].filter((p): p is string => Boolean(p))
  // Both halves are derived from the registry: a chain says what it carries, this line does
  // not guess. A declared rail that sells nothing today says so, with the day it paused,
  // instead of "settles in" (Arbitrum One since 2026-11-11).
  const paused = CHAIN_SETTLEMENT_PAUSED[c.id]
  const settles = paused
    ? `${paused.symbol} rail paused since ${paused.since}`
    : c.settlementSymbol
      ? `settles in ${c.settlementSymbol}`
      : ''
  if (parts.length === 0) return settles || 'read side only'
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  const registries = `${list} registr${parts.length === 1 ? 'y' : 'ies'} live`
  return settles ? `${registries}, ${settles}` : registries
}
