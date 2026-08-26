import { normalizeString } from "../db/normalize";

/**
 * Sørensen–Dice coefficient over character bigrams. Simple, dependency-
 * free, and a well-established technique for short-string similarity —
 * good enough for song titles without pulling in a full string-distance
 * library. Returns 0 (no overlap) to 1 (identical after normalization).
 *
 * Note: raw whole-title similarity is NOT length-independent — a short
 * qualifier appended to a long title moves the score less than the same
 * qualifier appended to a short title. That's fine for ranking (a relative
 * ordering signal), but it made this function unsuitable as the sole
 * signal for dedup's binary include/exclude decision — see dedup.ts for
 * how that's handled instead.
 */
export function titleSimilarity(a: string, b: string): number {
  const normA = normalizeString(a);
  const normB = normalizeString(b);
  if (normA === normB) return 1;
  if (normA.length < 2 || normB.length < 2) return normA === normB ? 1 : 0;

  const bigramsA = bigrams(normA);
  const bigramsBRemaining = [...bigrams(normB)];
  let matches = 0;
  for (const bg of bigramsA) {
    const idx = bigramsBRemaining.indexOf(bg);
    if (idx !== -1) {
      matches++;
      bigramsBRemaining.splice(idx, 1);
    }
  }
  const totalBigrams = bigramsA.length + bigrams(normB).length;
  return (2 * matches) / totalBigrams;
}

function bigrams(s: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < s.length - 1; i++) result.push(s.slice(i, i + 2));
  return result;
}
