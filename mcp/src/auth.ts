/**
 * Session auth for the write side of the platform.
 *
 * This is a SESSION layer, not identity verification (that's KYA). Login issues an
 * HMAC-signed token carrying the user's email; mutating endpoints require it, and
 * agent-scoped actions (pay, approve, set limits) are restricted to the agent's owner.
 * The signing secret comes from AUTH_SECRET; set a strong one in production.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

const SECRET = process.env.AUTH_SECRET ?? 'a-identity-dev-secret-change-me'

function sign(data: string): string {
  return createHmac('sha256', SECRET).update(data).digest('base64url')
}

/** Issue an opaque session token for an email. */
export function issueToken(email: string): string {
  const payload = Buffer.from(JSON.stringify({ email, iat: Date.now() })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

/** Verify a token and return the email, or null if invalid/tampered. */
export function verifyToken(token: string | undefined | null): string | null {
  if (!token) return null
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const expected = sign(payload)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const { email } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { email?: string }
    return email ?? null
  } catch {
    return null
  }
}
