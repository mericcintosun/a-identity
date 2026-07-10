import { test } from 'node:test'
import assert from 'node:assert/strict'
import { issueToken, verifyToken, isVerified } from './auth.js'

test('issueToken -> verifyToken round-trips subject + method', () => {
  const token = issueToken('alice@example.com', 'email')
  assert.deepEqual(verifyToken(token), { subject: 'alice@example.com', method: 'email' })
})

test('wallet and guest methods are carried through the token', () => {
  assert.equal(verifyToken(issueToken('0xabc', 'wallet'))?.method, 'wallet')
  assert.equal(verifyToken(issueToken('bob@x.com', 'guest'))?.method, 'guest')
})

test('isVerified: only wallet/email are verified, guest is not', () => {
  assert.equal(isVerified(verifyToken(issueToken('0xabc', 'wallet'))), true)
  assert.equal(isVerified(verifyToken(issueToken('a@b.co', 'email'))), true)
  assert.equal(isVerified(verifyToken(issueToken('a@b.co', 'guest'))), false)
  assert.equal(isVerified(null), false)
})

test('verifyToken rejects a tampered payload (kept signature)', () => {
  const token = issueToken('alice@example.com', 'wallet')
  const [, sig] = token.split('.')
  const forgedPayload = Buffer.from(JSON.stringify({ sub: 'bob@example.com', method: 'wallet', iat: 1 })).toString('base64url')
  assert.equal(verifyToken(`${forgedPayload}.${sig}`), null)
})

test('verifyToken rejects a tampered signature', () => {
  const token = issueToken('x@y.z', 'email')
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

test('legacy { email }-only tokens fail closed to guest (never verified)', async () => {
  // Simulate an old token that carried only { email } and no method, correctly signed.
  const { createHmac } = await import('node:crypto')
  const secret = process.env.AUTH_SECRET ?? 'a-identity-dev-secret-change-me'
  const payload = Buffer.from(JSON.stringify({ email: 'legacy@x.com', iat: 1 })).toString('base64url')
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  const legacy = `${payload}.${sig}`
  assert.deepEqual(verifyToken(legacy), { subject: 'legacy@x.com', method: 'guest' })
  assert.equal(isVerified(verifyToken(legacy)), false)
})

test('two different subjects get distinct tokens', () => {
  assert.notEqual(issueToken('a@x.com', 'email'), issueToken('b@x.com', 'email'))
})
