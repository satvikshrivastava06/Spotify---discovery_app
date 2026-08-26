import { normalizeString } from "../db/normalize";
import type { SpotifyTrack } from "./spotifyClient";
import { titleSimilarity } from "./titleSimilarity";
import type { YouTubeVideo } from "./youtubeClient";

// Words that genuinely distinguish different content — a candidate tagged
// "acoustic" and a Spotify track with no tags are NOT the same release,
// however similar their base titles look.
const QUALIFIER_TAGS = ["acoustic", "live", "session", "unplugged", "demo", "cover", "remix"];

// Generic boilerplate that shows up in YouTube titles constantly
// ("Official Video", "Audio", "Remastered") but doesn't by itself signal
// a different version of the song — stripped from the core title, never
// tracked as a distinguishing tag on its own.
const FILLER_WORDS = [
  "version",
  "edit",
  "remaster",
  "remastered",
  "radio",
  "official",
  "video",
  "music",
  "audio",
];

const STRIP_WORDS = new Set([...QUALIFIER_TAGS, ...FILLER_WORDS]);

// Verified against ~15 realistic title pairs while building this module
// (see the module notes in the project spec) — 0.85 is the threshold that
// separated genuine same-release pairs from different-song pairs across
// those cases without misclassifying either direction.
const CORE_TITLE_THRESHOLD = 0.85;

function extractQualifierTags(title: string): Set<string> {
  const normalized = normalizeString(title);
  const found = new Set<string>();
  for (const tag of QUALIFIER_TAGS) {
    if (normalized.includes(tag)) found.add(tag);
  }
  return found;
}

function stripToCore(title: string): string {
  const words = normalizeString(title)
    .split(" ")
    .filter((w) => !STRIP_WORDS.has(w));
  return words.join(" ").trim();
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

/**
 * Two titles are treated as the "same release" only if their core song
 * title (qualifier/filler words removed) matches closely AND they carry
 * the exact same set of meaningful qualifier tags. Comparing whole-title
 * similarity directly (tried first — see titleSimilarity.ts) turned out
 * to scale with title length in a way that made one global threshold
 * unreliable; this two-part check fixed that.
 *
 * Bias deliberately favors under-filtering: when a comparison is
 * genuinely ambiguous (e.g. a specific "Live at Wembley" recording vs. a
 * generic "Live" catalog entry), this returns `false` — showing a
 * possibly-redundant result costs the user one extra glance, but wrongly
 * hiding a genuine find defeats the entire point of the app.
 */
export function isSameRelease(titleA: string, titleB: string): boolean {
  const coreSimilarity = titleSimilarity(stripToCore(titleA), stripToCore(titleB));
  if (coreSimilarity < CORE_TITLE_THRESHOLD) return false;
  return setsEqual(extractQualifierTags(titleA), extractQualifierTags(titleB));
}

/** Filters out any candidate that's already available on Spotify, per the
 *  artist's catalog fetched via Client Credentials search (Phase 2/5). */
export function filterAlreadyOnSpotify(
  candidates: YouTubeVideo[],
  spotifyCatalog: SpotifyTrack[],
): YouTubeVideo[] {
  return candidates.filter(
    (candidate) => !spotifyCatalog.some((track) => isSameRelease(candidate.title, track.name)),
  );
}
