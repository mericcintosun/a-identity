/**
 * Unit tests for the ASP agent-id resolution helpers — pure, offline, deterministic.
 * These parse the `agentId` a caller passes into the four paid tools.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { asTokenId, isAddress } from './tools.js'

test('asTokenId: plain number', () => {
  assert.equal(asTokenId('849980'), 849980n)
})

test('asTokenId: hash-prefixed token id', () => {
  assert.equal(asTokenId('#849980'), 849980n)
})

test('asTokenId: whitespace tolerated', () => {
  assert.equal(asTokenId('  #6271  '), 6271n)
})

test('asTokenId: non-numeric -> null', () => {
  assert.equal(asTokenId('meridian'), null)
  assert.equal(asTokenId('0x6a5f1b8e56a19d456b799c2fa00e513244f58ce6'), null)
  assert.equal(asTokenId('#12ab'), null)
  assert.equal(asTokenId(''), null)
})

test('isAddress: valid 20-byte hex address', () => {
  assert.equal(isAddress('0x6a5f1b8e56a19d456b799c2fa00e513244f58ce6'), true)
  assert.equal(isAddress('0x6A5F1b8e56A19D456b799C2fA00E513244F58Ce6'), true) // mixed case ok
})

test('isAddress: rejects non-addresses', () => {
  assert.equal(isAddress('0x123'), false) // too short
  assert.equal(isAddress('6a5f1b8e56a19d456b799c2fa00e513244f58ce6'), false) // no 0x
  assert.equal(isAddress('#849980'), false)
  assert.equal(isAddress('0xZZZZ1b8e56a19d456b799c2fa00e513244f58ce6'), false) // non-hex
})
