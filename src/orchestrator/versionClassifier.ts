import type { VersionType } from "../db/trackRepository";

const PATTERNS: Array<{ type: VersionType; keywords: RegExp }> = [
  // Order matters — more specific patterns are checked before broader
  // ones they could otherwise be shadowed by.
  { type: "session", keywords: /\bsession\b|\bunplugged\b/i },
  { type: "acoustic", keywords: /\bacoustic\b/i },
  { type: "live", keywords: /\blive\b|\bconcert\b|\bat\s+\w+.*\btour\b/i },
  { type: "demo", keywords: /\bdemo\b|\bunreleased\b|\brough mix\b/i },
  { type: "cover", keywords: /\bcover\b|\btribute\b/i },
];

/** Best-effort classification from a YouTube video title — used to
 *  populate track_results.version_type (Phase 4). Falls back to "other"
 *  rather than guessing when nothing matches. */
export function classifyVersionType(title: string): VersionType {
  for (const { type, keywords } of PATTERNS) {
    if (keywords.test(title)) return type;
  }
  return "other";
}
