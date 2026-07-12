import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Eip1193 } from '../lib/wallets'

import { MCP_BASE } from '../lib/mcpBase'

export type User = {
  name: string
  email: string
}

type AuthState = {
  user: User | null
  /** Session token issued by the backend; required for mutating requests. */
  token: string | null
  /** Guest preview: an email-only local session (no token → browse-only). */
  login: (email: string, name?: string) => Promise<void>
  /** Real auth: Sign-In with Ethereum. Prove wallet ownership by signing a nonce.
   *  Pass the chosen EIP-1193 provider (an injected wallet or WalletConnect). */
  loginWallet: (provider: Eip1193) => Promise<void>
  /** Real email auth: send a one-time magic sign-in link (via Resend). */
  requestMagicLink: (email: string) => Promise<void>
  /** Finish magic-link sign-in with the token carried by the emailed link. */
  loginWithMagicToken: (token: string) => Promise<void>
  logout: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: async (email, name) => {
        try {
          const res = await fetch(`${MCP_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name }),
          })
          if (res.ok) {
            const data = (await res.json()) as { token: string; user: User }
            set({ user: data.user, token: data.token })
            return
          }
        } catch {
          // Backend unreachable, fall through to a local-only session (no token).
        }
        set({ user: { email, name: name?.trim() || email.split('@')[0] }, token: null })
      },
      loginWallet: async (provider) => {
        const eth = provider
        let address: string | undefined
        try {
          const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
          address = accounts?.[0]
        } catch (e) {
          throw new Error(walletError(e, 'connect to your wallet'))
        }
        if (!address) throw new Error('No account selected in your wallet.')
        const nres = await fetch(`${MCP_BASE}/api/auth/nonce`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address }),
        }).catch(() => null)
        if (!nres || !nres.ok) throw new Error('Could not reach the server (it may be waking up). Try again in a moment.')
        const { message } = (await nres.json()) as { message: string }
        let signature: string
        try {
          signature = (await eth.request({ method: 'personal_sign', params: [message, address] })) as string
        } catch (e) {
          throw new Error(walletError(e, 'sign the message'))
        }
        const vres = await fetch(`${MCP_BASE}/api/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, message, signature }),
        })
        if (!vres.ok) {
          const e = (await vres.json().catch(() => ({}))) as { error?: string }
          throw new Error(e.error ?? 'Wallet sign-in failed.')
        }
        const data = (await vres.json()) as { token: string; user: User }
        set({ user: data.user, token: data.token })
      },
      requestMagicLink: async (email) => {
        const res = await fetch(`${MCP_BASE}/api/auth/magic/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }).catch(() => null)
        const data = (res ? await res.json().catch(() => ({})) : {}) as { sent?: boolean; error?: string }
        if (!res || !res.ok || !data.sent) throw new Error(data.error ?? 'Could not send the sign-in link.')
      },
      loginWithMagicToken: async (token) => {
        const res = await fetch(`${MCP_BASE}/api/auth/magic/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        if (!res.ok) {
          const e = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(e.error ?? 'This sign-in link is invalid or expired.')
        }
        const data = (await res.json()) as { token: string; user: User }
        set({ user: data.user, token: data.token })
      },
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'a-identity-auth' },
  ),
)

/** Authorization header for authenticated (mutating) requests. */
export function authHeaders(): Record<string, string> {
  const t = useAuth.getState().token
  return t ? { Authorization: `Bearer ${t}` } : {}
}

/** Turn a raw wallet/provider error into a friendly, human message. */
function walletError(e: unknown, action: string): string {
  const code = (e as { code?: number })?.code
  const msg = (e as { message?: string })?.message ?? ''
  if (code === 4001 || /reject|denied|cancel/i.test(msg)) return 'Request cancelled in your wallet.'
  return `Could not ${action}${msg ? `: ${msg}` : ''}.`
}
