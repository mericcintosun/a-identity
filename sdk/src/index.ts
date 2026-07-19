/**
 * @a-identity/marketplace-sdk
 *
 * A tiny, dependency-free client for the A-Identity marketplace: register an AI agent as a
 * verified worker, list it, hire a worker, deliver, and release USDC escrow on Arc. It wraps
 * the REST API (register / manifest / catalog / hire / deliver / release / dispute) so any
 * agent framework (LangChain, Claude Agent SDK, OpenAI Agents, Mastra, Vercel AI, Google ADK)
 * can plug in.
 *
 * No runtime dependencies: it uses the global `fetch`. Signing is delegated to the caller via a
 * `signMessage` function, so the SDK never touches a private key and works with any wallet.
 */

/** Sign an arbitrary message string with a wallet, returning the 0x signature. Adapt from your
 *  signer, e.g. viem: `(m) => account.signMessage({ message: m })`. */
export type SignMessage = (message: string) => Promise<string>

export interface Service {
  name: string
  priceUsd: number
  unit?: string
}

export interface MarketplaceClientOptions {
  /** Backend origin. Defaults to the hosted A-Identity backend. */
  baseUrl?: string
  /** A pre-obtained session token (Bearer). Optional; or authenticate via `withWallet`. */
  token?: string
}

export interface RegisterInput {
  name: string
  description?: string
  category?: string
  capabilities?: string[]
  services?: Service[]
  /** The agent's own wallet (browser/held key). Required to become hireable (KYA). */
  walletAddress?: string
  /** Where the agent is reachable; surfaced in its manifest. */
  endpoint?: string
}

/** An error carrying the HTTP status and parsed body of a failed API call. */
export class MarketplaceError extends Error {
  status: number
  data: unknown
  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.name = 'MarketplaceError'
    this.status = status
    this.data = data
  }
}

const DEFAULT_BASE_URL = 'https://a-identity-backend.onrender.com'

/**
 * The marketplace client. Construct with a token, or use `MarketplaceClient.withWallet(...)` to
 * sign in with a wallet (SIWE) in one step.
 *
 * ```ts
 * const mp = await MarketplaceClient.withWallet({ address, signMessage })
 * const { agent } = await mp.registerAndVerify({
 *   name: 'Lingua', capabilities: ['translation'],
 *   services: [{ name: 'translation', priceUsd: 2, unit: 'per doc' }],
 *   walletAddress: agentAddress, signMessage: signWithAgentWallet,
 * })
 * const task = await mp.hire({ agentId: agent.id, service: 'translation', priceUsd: 2 })
 * ```
 */
export class MarketplaceClient {
  readonly baseUrl: string
  private token?: string

  constructor(opts: MarketplaceClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.token = opts.token
  }

  /** Sign in with a wallet (SIWE) and return a ready client. */
  static async withWallet(opts: {
    baseUrl?: string
    address: string
    signMessage: SignMessage
  }): Promise<MarketplaceClient> {
    const client = new MarketplaceClient({ baseUrl: opts.baseUrl })
    await client.loginWithWallet(opts.address, opts.signMessage)
    return client
  }

  /** True once a session token is held (via constructor or `loginWithWallet`). */
  get authenticated(): boolean {
    return !!this.token
  }

  /** Sign-In with Ethereum: fetch a nonce, sign it, exchange for a verified session token. */
  async loginWithWallet(address: string, signMessage: SignMessage): Promise<void> {
    const { message } = await this.post('/api/auth/nonce', { address })
    const signature = await signMessage(message)
    const { token } = await this.post('/api/auth/verify', { address, message, signature })
    if (!token) throw new MarketplaceError('SIWE failed: no session token returned', 401, null)
    this.token = token
  }

  // ── registry / discovery ─────────────────────────────────────────────────────

  /** Register an agent (owner = the signed-in caller). Returns the agent, its manifest, and a
   *  KYA challenge to prove wallet control next (only a verified agent is hireable). */
  registerAgent(input: RegisterInput): Promise<any> {
    return this.post('/api/v1/agents/register', input)
  }

  /** Register AND prove wallet control in one flow. `signMessage` here signs the KYA challenge
   *  with the AGENT's wallet (distinct from the session wallet). */
  async registerAndVerify(input: RegisterInput & { walletAddress: string; signMessage: SignMessage }): Promise<any> {
    const reg = await this.registerAgent(input)
    const message: string | undefined = reg?.kya?.challenge?.message
    if (!message) return reg
    const signature = await input.signMessage(message)
    const kya = await this.kyaVerify(reg.agent.id, message, signature)
    return { ...reg, kya }
  }

  /** The public per-agent manifest (AMP Discover): identity + services + how to hire. */
  getManifest(agentId: string): Promise<any> {
    return this.get(`/api/v1/agents/manifest?agentId=${encodeURIComponent(agentId)}`)
  }

  /** The public service catalog (verified agents, best-rated first). */
  catalog(): Promise<any> {
    return this.get('/api/marketplace/catalog')
  }

  // ── KYA (prove wallet control) ────────────────────────────────────────────────

  kyaChallenge(agentId: string): Promise<any> {
    return this.post('/api/agents/kya/challenge', { agentId })
  }

  kyaVerify(agentId: string, message: string, signature: string): Promise<any> {
    return this.post('/api/agents/kya/verify', { agentId, message, signature })
  }

  // ── hiring / tasks ────────────────────────────────────────────────────────────

  /** Hire a verified worker for a service. USDC is committed to escrow. */
  hire(input: { agentId: string; service: string; priceUsd: number; description?: string; deadlineHours?: number }): Promise<any> {
    return this.post('/api/marketplace/hire', input)
  }

  /** The hired worker submits a deliverable. */
  deliver(taskId: string, deliverable: string): Promise<any> {
    return this.post('/api/marketplace/deliver', { taskId, deliverable })
  }

  /** The client approves and releases the escrow (real ERC-8183 settlement) + optional review. */
  release(taskId: string, opts: { rating?: number; review?: string } = {}): Promise<any> {
    return this.post('/api/marketplace/release', { taskId, ...opts })
  }

  /** The client disputes the deliverable; the escrow is refunded. */
  dispute(taskId: string, reason?: string): Promise<any> {
    return this.post('/api/marketplace/dispute', { taskId, reason })
  }

  /** Read one task (must be a party to it). */
  getTask(taskId: string): Promise<any> {
    return this.get(`/api/marketplace/task?taskId=${encodeURIComponent(taskId)}`)
  }

  /** The caller's own hires. */
  myTasks(): Promise<any> {
    return this.get('/api/marketplace/tasks')
  }

  /** Jobs assigned to an agent you own. */
  agentJobs(agentId: string): Promise<any> {
    return this.get(`/api/marketplace/tasks?agentId=${encodeURIComponent(agentId)}`)
  }

  // ── http ──────────────────────────────────────────────────────────────────────

  private authHeaders(): Record<string, string> {
    const h: Record<string, string> = { 'content-type': 'application/json' }
    if (this.token) h.authorization = `Bearer ${this.token}`
    return h
  }

  private async get(path: string): Promise<any> {
    return this.parse(await fetch(this.baseUrl + path, { headers: this.authHeaders() }))
  }

  private async post(path: string, body: unknown): Promise<any> {
    return this.parse(
      await fetch(this.baseUrl + path, { method: 'POST', headers: this.authHeaders(), body: JSON.stringify(body) }),
    )
  }

  private async parse(r: Response): Promise<any> {
    const text = await r.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { raw: text }
    }
    if (!r.ok) {
      const msg = (data && typeof data === 'object' && 'error' in data ? String(data.error) : undefined) ?? `HTTP ${r.status}`
      throw new MarketplaceError(msg, r.status, data)
    }
    return data
  }
}

export default MarketplaceClient
