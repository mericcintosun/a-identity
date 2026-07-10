import { test } from 'node:test'
import assert from 'node:assert/strict'
import { issueToken, verifyToken } from './auth.js'

test('issueToken -> verifyToken round-trips the email', () => {
  const token = issueToken('alice@example.com')
  assert.equal(verifyToken(token), 'alice@example.com')
})

test('verifyToken rejects a tampered payload (kept signature)', () => {
  const token = issueToken('alice@example.com')
  const [, sig] = token.split('.')
  const forgedPayload = Buffer.from(JSON.stringify({ email: 'bob@example.com', iat: 1 })).toString('base64url')
  assert.equal(verifyToken(`${forgedPayload}.${sig}`), null)
})

test('verifyToken rejects a tampered signature', () => {
  const token = issueToken('x@y.z')
  const [payload] = token.split('.')
  assert.equal(verifyToken(`${payload}.deadbeef`), null)
})

test('verifyToken rejects garbage and empty input', () => {
  assert.equal(verifyToken(''), null)
  assert.equal(verifyToken(undefined), null)
  assert.equal(verifyToken(null), null)
  assert.equal(verifyToken('not-a-token'), null)
  assert.equal(verifyToken('a.b.c'), null)
})

test('two different emails get distinct tokens', () => {
  assert.notEqual(issueToken('a@x.com'), issueToken('b@x.com'))
})
