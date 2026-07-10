import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const MCP_BASE = (import.meta.env.VITE_MCP_URL as string | undefined) ?? 'http://localhost:3399'

export type User = {
  name: string
  email: string
}

type AuthState = {
  user: User | null
  /** Session token issued by the backend; required for mutating requests. */
  token: string | null
  /**
   * Sign in. Exchanges the email for a backend session token (used to authorize
   * writes and to scope agent ownership). Still email-only for the MVP; real
   * identity verification is KYA, handled separately.
   */
  login: (email: string, name?: string) => Promise<void>
  /** Real auth: Sign-In with Ethereum — prove wallet ownership by signing a nonce. */
  loginWallet: () => Promise<void>
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
          // Backend unreachable — fall through to a local-only session (no token).
        }
        set({ user: { email, name: name?.trim() || email.split('@')[0] }, token: null })
      },
      loginWallet: async () => {
        const eth = pickWallet()
        if (!eth) throw new Error('No browser wallet found — install MetaMask, or continue as guest below.')
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

type Eip1193 = {
  request: (a: { method: string; params?: unknown[] }) => Promise<unknown>
  isMetaMask?: boolean
}

/**
 * Pick a usable injected wallet. With several extensions installed they clobber
 * each other on window.ethereum (the "Cannot redefine property: ethereum" noise);
 * when a `providers` array is exposed, prefer MetaMask, else the first one.
 */
function pickWallet(): Eip1193 | null {
  const injected = (window as unknown as { ethereum?: Eip1193 & { providers?: Eip1193[] } }).ethereum
  if (!injected) return null
  if (injected.providers?.length) return injected.providers.find((p) => p.isMetaMask) ?? injected.providers[0]
  return injected
}

/** Turn a raw wallet/provider error into a friendly, human message. */
function walletError(e: unknown, action: string): string {
  const code = (e as { code?: number })?.code
  const msg = (e as { message?: string })?.message ?? ''
  if (code === 4001 || /reject|denied|cancel/i.test(msg)) return 'Request cancelled in your wallet.'
  return `Could not ${action}${msg ? `: ${msg}` : ''}.`
}
