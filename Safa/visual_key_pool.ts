/**
 * Visual-section API key pool — rotation & failover service.
 *
 * Responsibility split (per project requirements):
 *  - Conversation system: ALWAYS the Main (Maira) key — untouched, see
 *    server.ts Live session & agent_core.ts (they still call getGeminiApiKey()
 *    directly and never touch this module).
 *  - Visual section: uses THIS pool.
 *      • Backup keys added  → [Backup 1, Backup 2, …, Main key (last resort)]
 *      • No backup keys     → existing behavior: [Main key, Sabit key]
 *
 * Failover: any recoverable failure on one key (429 quota, auth rejection,
 * network error, timeout, model error, …) automatically rotates to the next
 * key, so a single bad key never stops Visual functionality. A failing key is
 * put on a short in-memory cooldown so subsequent requests start from a
 * healthy key; cooldowns are ignored when every key is cooling down. The pool
 * state is process-local only — nothing is persisted except the keys
 * themselves (secrets.json via server_paths).
 */

import { getGeminiApiKey, getSabitApiKey, getBackupApiKeys } from './server_paths';

const COOLDOWN_MS = 2 * 60 * 1000; // a failed key rests 2 minutes

/** key → timestamp until which it is considered unhealthy. */
const cooldowns = new Map<string, number>();

function dedupe(keys: (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of keys) {
    const trimmed = (k || '').trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Ordered candidate keys for Visual requests (cooldowns NOT applied — use
 * getActiveVisualApiKeys() for the practical working set).
 */
export function getVisualApiKeyPool(): string[] {
  const backups = getBackupApiKeys().map(b => b.key);
  if (backups.length > 0) {
    // Backups first; the Main key stays available as the final fallback.
    // The Sabit key is deliberately NOT used when backups exist.
    return dedupe([...backups, getGeminiApiKey()]);
  }
  // No backups → existing behavior: Main key first, Sabit key as fallback.
  return dedupe([getGeminiApiKey(), getSabitApiKey()]);
}

/** Pool with cooled-down keys deprioritized (skipped when healthy keys exist). */
export function getActiveVisualApiKeys(): string[] {
  const pool = getVisualApiKeyPool();
  const now = Date.now();
  const healthy = pool.filter(k => (cooldowns.get(k) || 0) <= now);
  if (healthy.length > 0) return healthy;
  // Everyone is cooling down — ignore cooldowns rather than refusing to run.
  return pool;
}

/** Record a key failure (called by the failover runner). */
export function markVisualKeyFailed(key: string): void {
  cooldowns.set(key, Date.now() + COOLDOWN_MS);
}

/** Record a key success — instantly re-admits it as healthy. */
export function markVisualKeySucceeded(key: string): void {
  cooldowns.delete(key);
}

/** Test/dev helper. */
export function resetVisualKeyCooldowns(): void {
  cooldowns.clear();
}

/**
 * Run an API operation against the Visual key pool with automatic failover.
 * The operation receives one API key; ANY thrown error rotates to the next
 * key. Throws the last error only after every key has failed.
 */
export async function runWithVisualKeyFailover<T>(
  op: (apiKey: string) => Promise<T>,
): Promise<T> {
  const candidates = getActiveVisualApiKeys();
  if (candidates.length === 0) {
    throw new Error('NO_API_KEY');
  }
  let lastError: any = null;
  for (const key of candidates) {
    try {
      const result = await op(key);
      markVisualKeySucceeded(key);
      return result;
    } catch (err) {
      lastError = err;
      if (String(err?.message || '') === 'NO_API_KEY') continue;
      markVisualKeyFailed(key);
      console.warn(
        `[VisualKeyPool] Key …${key.slice(-6)} failed (${err?.message || err}); rotating to next key`,
      );
    }
  }
  throw lastError ?? new Error('All Visual API keys failed');
}
