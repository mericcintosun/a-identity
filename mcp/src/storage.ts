/**
 * Durable state storage.
 *
 * When DATABASE_URL is set (production / ephemeral hosts like Render free tier)
 * the whole state is persisted to Postgres as a single JSONB blob. Otherwise it
 * falls back to a local JSON file (dev). Writes are debounced; there is no mock
 * data — an empty store simply starts empty.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data')
const DATA_FILE = join(DATA_DIR, 'platform.json')
const DB_URL = process.env.DATABASE_URL

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pool: any = null

async function getPool() {
  if (!DB_URL) return null
  if (pool) return pool
  // Variable specifier so tsc doesn't require pg's types at build time.
  const spec = 'pg'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pgMod: any = await import(spec)
  const Pool = pgMod.default?.Pool ?? pgMod.Pool
  const local = DB_URL.includes('localhost') || DB_URL.includes('127.0.0.1')
  pool = new Pool({ connectionString: DB_URL, ssl: local ? false : { rejectUnauthorized: false } })
  await pool.query('CREATE TABLE IF NOT EXISTS app_state (id text PRIMARY KEY, data jsonb NOT NULL)')
  return pool
}

/** Load the persisted state blob, or null if none yet. */
export async function loadState<T>(): Promise<T | null> {
  const p = await getPool()
  if (p) {
    const r = await p.query('SELECT data FROM app_state WHERE id = $1', ['platform'])
    return (r.rows[0]?.data as T) ?? null
  }
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf8')) as T
  } catch {
    return null
  }
}

let pending: unknown = null
let timer: ReturnType<typeof setTimeout> | null = null

/** Persist the full state blob (debounced ~300ms). Callers stay synchronous. */
export function saveState(state: unknown): void {
  pending = state
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    void flush()
  }, 300)
}

// Serialize flushes so two overlapping persists (e.g. a debounced flush racing the
// SIGTERM flush) never interleave writes to the same row/file. Each flush awaits the
// previous one, then persists the LATEST pending snapshot.
let flushChain: Promise<void> = Promise.resolve()

function flush(): Promise<void> {
  flushChain = flushChain.then(doFlush, doFlush)
  return flushChain
}

async function doFlush() {
  const data = pending
  pending = null
  if (data == null) return
  try {
    const p = await getPool()
    if (p) {
      await p.query(
        'INSERT INTO app_state (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2',
        ['platform', JSON.stringify(data)],
      )
    } else {
      mkdirSync(DATA_DIR, { recursive: true })
      writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
    }
  } catch (e) {
    console.error('[storage] persist failed:', e instanceof Error ? e.message : e)
  }
}

// ── durable spent-payment set (x402 replay protection) ───────────────────────────
//
// x402 unlocks a resource with a real USDC tx hash exactly once. If that "already
// spent" set lives only in memory, a restart (Render cold-start / redeploy) resets
// it and a previously-used payment could be replayed. So we persist spent hashes:
// Postgres when DATABASE_URL is set, else a local JSON file alongside the state.

const SPENT_FILE = join(DATA_DIR, 'spent-payments.json')

/** Load every spent payment hash (lowercase) recorded so far. */
export async function loadSpentPayments(): Promise<string[]> {
  const p = await getPool()
  if (p) {
    await p.query('CREATE TABLE IF NOT EXISTS spent_payments (hash text PRIMARY KEY)')
    const r = await p.query('SELECT hash FROM spent_payments')
    return r.rows.map((row: { hash: string }) => row.hash)
  }
  try {
    return JSON.parse(readFileSync(SPENT_FILE, 'utf8')) as string[]
  } catch {
    return []
  }
}

/** Durably record one spent payment hash (idempotent). */
export async function persistSpentPayment(hash: string): Promise<void> {
  const h = hash.toLowerCase()
  try {
    const p = await getPool()
    if (p) {
      await p.query('CREATE TABLE IF NOT EXISTS spent_payments (hash text PRIMARY KEY)')
      await p.query('INSERT INTO spent_payments (hash) VALUES ($1) ON CONFLICT DO NOTHING', [h])
      return
    }
    let arr: string[] = []
    try {
      arr = JSON.parse(readFileSync(SPENT_FILE, 'utf8')) as string[]
    } catch {
      /* first write */
    }
    if (!arr.includes(h)) {
      arr.push(h)
      mkdirSync(DATA_DIR, { recursive: true })
      writeFileSync(SPENT_FILE, JSON.stringify(arr))
    }
  } catch (e) {
    console.error('[storage] spent-payment persist failed:', e instanceof Error ? e.message : e)
  }
}

// Flush pending state on shutdown, then exit (Render sends SIGTERM on redeploy).
process.on('SIGTERM', () => {
  void flush().finally(() => process.exit(0))
})
process.on('beforeExit', () => void flush())
