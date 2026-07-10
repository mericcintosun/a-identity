import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeReputation } from './reputation.js'

const asOf = new Date('2026-07-10T00:00:00Z')

test('same input + asOf is deterministic', () => {
  const h = { agentId: 'a', settledActions: 100, disputes: 5, registeredAt: '2026-01-01' }
  assert.deepEqual(computeReputation(h, asOf), computeReputation(h, asOf))
})

test('score is bounded 0..1000', () => {
  const r = computeReputation({ agentId: 'a', settledActions: 100000, disputes: 0, registeredAt: '2020-01-01' }, asOf)
  assert.ok(r.score >= 0 && r.score <= 1000, `score out of range: ${r.score}`)
})

test('more settled actions => higher settlement score', () => {
  const low = computeReputation({ agentId: 'a', settledActions: 10, disputes: 0, registeredAt: '2026-07-01' }, asOf)
  const high = computeReputation({ agentId: 'a', settledActions: 500, disputes: 0, registeredAt: '2026-07-01' }, asOf)
  assert.ok(high.breakdown.settlement > low.breakdown.settlement)
})

test('disputes lower the validation score', () => {
  const clean = computeReputation({ agentId: 'a', settledActions: 100, disputes: 0, registeredAt: '2026-07-01' }, asOf)
  const disputed = computeReputation({ agentId: 'a', settledActions: 100, disputes: 100, registeredAt: '2026-07-01' }, asOf)
  assert.ok(disputed.breakdown.validation < clean.breakdown.validation)
})

test('a brand-new agent with no activity scores 0', () => {
  const r = computeReputation({ agentId: 'a', settledActions: 0, disputes: 0, registeredAt: '2026-07-10' }, asOf)
  assert.equal(r.score, 0)
})
