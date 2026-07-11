/**
 * Builds the A-Identity MCP server and registers its read-only tools.
 * Shared by the stdio entry (index.ts) and the HTTP entry (http.ts).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { listCapabilities, CHAIN_CONFIG } from './data.js'
import { createIdentityProvider } from './erc8004.js'
import { getArcStatus } from './arc.js'
import { getCircleStatus } from './circle.js'

const json = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
})

/**
 * Real-data hooks the HTTP entry (http.ts) injects so the discovery tools return
 * live platform state instead of nothing. The stdio entry passes none — there,
 * `list_agents` is empty (the Arc registry isn't enumerable) and `get_reputation`
 * says reputation lives on the platform. No mocks in either path.
 */
export type ServerData = {
  listAgents?: () => Array<{ agentId: string; name?: string; chain: string; kya?: string; onchain?: string; walletAddress?: string | null }>
  getReputation?: (agentId: string) => unknown | null
}

export function buildServer(data: ServerData = {}): McpServer {
  const server = new McpServer({ name: 'a-identity-mcp', version: '0.2.0' })
  const identity = createIdentityProvider()

  server.registerTool(
    'resolve_agent',
    {
      title: 'Resolve agent identity',
      description:
        "Resolve an agent's identity with a LIVE on-chain read of Circle Arc's ERC-8004 IdentityRegistry (ownerOf + tokenURI). Query by agent id (CAIP-10), token id, or owner address. Extra EVM chains are read when configured. Read-only, no mocks.",
      inputSchema: {
        query: z
          .string()
          .describe(
            'Agent id (e.g. "eip155:5042002:8004/849980"), token id ("#849980"), or owner address (0x…)',
          ),
        chain: z
          .enum(['arc', 'ethereum', 'base', 'arbitrum'])
          .optional()
          .describe('Optional chain filter. Omit to search all configured chains (Arc by default).'),
      },
    },
    async ({ query, chain }) => {
      const agent = await identity.resolve(query)
      if (!agent) return json({ found: false, query, reason: 'No matching registration' })
      if (chain && agent.chain !== chain) {
        return json({
          found: false,
          query,
          reason: `Agent resolved on "${agent.chain}", not the requested chain "${chain}"`,
        })
      }
      return json({ found: true, source: identity.kind, agent })
    },
  )

  server.registerTool(
    'get_reputation',
    {
      title: 'Get agent reputation',
      description:
        "An agent's deterministic reputation (0-1000) computed from REAL activity: on-chain USDC settlements, verified ERC-8004 identity, clean ratio, and tenure. Read-only.",
      inputSchema: {
        agentId: z
          .string()
          .describe('The platform agent id (e.g. "agent_…") or an on-chain agent id'),
      },
    },
    async ({ agentId }) => {
      if (!data.getReputation) {
        return json({
          found: false,
          agentId,
          reason:
            'Reputation is computed from real platform settlements; query it against a running A-Identity platform instance (REST /api/agents/reputation) or the app.',
        })
      }
      const rep = data.getReputation(agentId)
      if (!rep || (typeof rep === 'object' && 'error' in (rep as object)))
        return json({ found: false, agentId, reason: 'Unknown agent or no activity yet' })
      return json({ found: true, reputation: rep })
    },
  )

  server.registerTool(
    'list_agents',
    {
      title: 'List registered agents',
      description:
        'List the real agents registered on this A-Identity platform (name, chain, KYA + on-chain status). The Arc ERC-8004 registry is not enumerable, so this lists agents this instance knows — not every token ever minted.',
      inputSchema: {},
    },
    async () => {
      const agents = data.listAgents ? data.listAgents() : []
      return json({
        total: agents.length,
        source: data.listAgents ? 'platform' : 'none (registry not enumerable; connect to a platform instance)',
        agents,
      })
    },
  )

  server.registerTool(
    'get_chain_status',
    {
      title: 'Get supported chain status',
      description:
        'List the chains A-Identity supports for identity and x402 payments (Arc, Base, Arbitrum, Stellar, Algorand), with identity standard, x402 support, status, and registered agent counts.',
      inputSchema: {},
    },
    async () => {
      return json({ chains: CHAIN_CONFIG })
    },
  )

  server.registerTool(
    'get_arc_status',
    {
      title: 'Get live Circle Arc status',
      description:
        'Connect to the Circle Arc testnet over JSON-RPC and read live chain state (chainId, latest block). Arc pays gas in USDC with sub-second finality. Read-only, no keys.',
      inputSchema: {},
    },
    async () => json(await getArcStatus()),
  )

  server.registerTool(
    'get_circle_status',
    {
      title: 'Get Circle platform status',
      description:
        'Report the Circle developer platform link: wallets (W3S), Gateway (unified balance), USDC. Performs a real authenticated ping when CIRCLE_API_KEY is set; otherwise explains what to configure. Read-only.',
      inputSchema: {},
    },
    async () => json(await getCircleStatus()),
  )

  server.registerTool(
    'list_capabilities',
    {
      title: 'List A-Identity capabilities',
      description:
        'Describe the full A-Identity protocol surface: identity, payments, connectivity, reputation, and supported chains.',
      inputSchema: {},
    },
    async () => json(listCapabilities()),
  )

  return server
}
