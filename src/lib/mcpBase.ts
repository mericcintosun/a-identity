/**
 * Base URL for the A-Identity MCP HTTP backend, resolved per environment.
 *
 * Production: '' (same-origin). The deployed app calls /health, /api/*, /mcp on its
 * OWN domain, and vercel.json proxies those to the backend as first-party requests.
 * This dodges ad blockers / privacy lists that block *.onrender.com and would
 * otherwise show a false "backend offline". The production backend URL now lives in
 * vercel.json (change it there), so VITE_MCP_URL is a dev-only override.
 *
 * Dev: VITE_MCP_URL if set, else the local backend on :3399.
 */
export const MCP_BASE = import.meta.env.PROD
  ? ''
  : ((import.meta.env.VITE_MCP_URL as string | undefined) ?? 'http://localhost:3399')

/**
 * User-facing copy when a backend request fails. Honest and plain: on prod the app
 * uses a same-origin proxy, so "run the server / npm run dev" is wrong and confusing
 * to a judge. The free-tier backend usually just needs a few seconds to wake.
 */
export const BACKEND_UNREACHABLE =
  'The backend is waking up or briefly unreachable (free tier). Give it a few seconds and refresh.'
