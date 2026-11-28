/**
 * The console's Network list, held to the generated chain registry (src/lib/chains.ts): a row
 * names only what the registry lists, never calls a chain undeployed, and says where a rail of
 * ours paused instead of claiming it settles. The pinned rows are the record of 2026-11-28;
 * change them with the registry, never to make a row say more than it does.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CHAINS, CHAIN_BY_ID, CHAIN_SETTLEMENT_PAUSED } from './chains.ts'
import { onNetworkList, registryLine } from './network-rows.ts'

test('only live and beta chains get a row, read from the registry status', () => {
  for (const c of CHAINS) assert.equal(onNetworkList(c), c.status === 'live' || c.status === 'beta', c.id)
  assert.equal(onNetworkList(CHAIN_BY_ID.avalanche), false, 'Avalanche is planned, so it has no row')
})

test('a row never calls a chain undeployed, and a paused rail never reads as settling', () => {
  for (const c of CHAINS.filter(onNetworkList)) {
    const line = registryLine(c)
    assert.doesNotMatch(line, /deployed/, `${c.id}: absent from the registry is not the same as not deployed`)
    const paused = CHAIN_SETTLEMENT_PAUSED[c.id]
    if (paused) {
      assert.ok(line.endsWith(`${paused.symbol} rail paused since ${paused.since}`), `${c.id}: ${line}`)
      assert.doesNotMatch(line, /settles in/, `${c.id}: a paused rail does not settle`)
    } else if (c.settlementSymbol) {
      assert.ok(line.endsWith(`settles in ${c.settlementSymbol}`), `${c.id}: ${line}`)
    }
  }
  // NEAR testnet lists no canonical ERC-8004 address and declares no settlement token, so the
  // row says only that we read there. Its engine does read Arras's NEAR ERC-8004 registries, so
  // the row must not say none is wired.
  assert.equal(registryLine(CHAIN_BY_ID['near-testnet']), 'read side only')
  // Arbitrum One's only rail of ours paused on 2026-11-11.
  assert.equal(registryLine(CHAIN_BY_ID.arbitrum), 'identity and reputation registries live, USDC rail paused since 2026-11-11')
  // On Base the EIP-3009 rail paused the same day, and Circle Gateway still sells there.
  assert.equal(registryLine(CHAIN_BY_ID.base), 'identity and reputation registries live, settles in USDC')
})
