import { normalizeString } from "../db/normalize";
import { titleSimilarity } from "./titleSimilarity";
import type { YouTubeVideo } from "./youtubeClient";

// Weights sum to 1. Title match dominates deliberately — a highly-viewed
// but off-target result is worse than a quiet, exactly-on-target one for
// this product; ranking, unlike dedup, is a soft ordering signal, not a
// correctness-critical binary decision, so these weights are a reasonable
// starting point rather than something requiring the same empirical
// tuning pass dedup got.
const WEIGHTS = { titleMatch: 0.5, channelAuthority: 0.25, views: 0.15, recency: 0.1 };

function channelAuthorityScore(channelName: string, artist: string): number {
  const normChannel = normalizeString(channelName);
  const normArtist = normalizeString(artist);
  if (normChannel === normArtist) return 1;
  if (normChannel.includes(normArtist)) return 0.85; // e.g. "Ed Sheeran - Topic", "Ed Sheeran VEVO"
  if (/vevo|official/i.test(channelName)) return 0.6;
  return 0.2;
}

function viewCountScore(viewCount: number | null): number {
  if (!viewCount || viewCount <= 0) return 0;
  // log10-scaled so a handful of very popular reposts can't completely
  // bury a legitimate but less-viewed official upload: ~100 views -> 0.25,
  // ~10k -> 0.5, ~1M -> 0.75, ~100M+ -> capped at 1.
  return Math.min(1, Math.log10(viewCount + 1) / 8);
}

function recencyScore(publishedAt: string | null): number {
  if (!publishedAt) return 0.5; // unknown — neutral, neither rewarded nor punished
  const ageYears = (Date.now() - new Date(publishedAt).getTime()) / (365 * 24 * 60 * 60 * 1000);
  // Mild decay, floored at 0.3 — an official session from a decade ago
  // shouldn't be buried just for being old.
  return Math.max(0.3, 1 - ageYears * 0.05);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function computeRelevanceScore(
  candidate: YouTubeVideo,
  targetArtist: string,
  targetTitle: string,
): number {
  const titleMatch = titleSimilarity(candidate.title, targetTitle);
  const channelAuthority = channelAuthorityScore(candidate.channelName, targetArtist);
  const views = viewCountScore(candidate.viewCount);
  const recency = recencyScore(candidate.publishedAt);

  return clamp01(
    WEIGHTS.titleMatch * titleMatch +
      WEIGHTS.channelAuthority * channelAuthority +
      WEIGHTS.views * views +
      WEIGHTS.recency * recency,
  );
}
