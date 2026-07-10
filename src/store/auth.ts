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
