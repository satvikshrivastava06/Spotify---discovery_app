/**
 * Produces a stable lookup key for the tracks.cache_key column. Two
 * differently-formatted mentions of the same song ("Ed Sheeran" / "ED
 * SHEERAN", "Perfect" / "Perfect!") must normalize to the same key, or the
 * cache silently stops working — this is the concrete implementation of
 * the "ambiguous titles / casing variance" edge case flagged in Phase 1.
 */
export function normalizeCacheKey(artist: string, title: string): string {
  return `${normalizeString(artist)}::${normalizeString(title)}`;
}

/** Exported for reuse by the orchestrator's title-similarity logic (Module
 *  3) — one normalization implementation, not two that could drift apart. */
export function normalizeString(input: string): string {
  return input
    .normalize("NFKD") // decompose accented characters (é -> e + ´)
    .replace(/[\u0300-\u036f]/g, "") // strip the decomposed diacritic marks
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "") // strip punctuation, unicode-aware
    .replace(/\s+/g, " ")
    .trim();
}
