import type { SqlExecutor } from "./executor";
import { normalizeCacheKey } from "./normalize";
import { type CommandResult, err, ok } from "./result";

export type VersionType = "acoustic" | "live" | "cover" | "session" | "demo" | "other";

export interface Track {
  id: number;
  cacheKey: string;
  artist: string;
  title: string;
  album: string | null;
  artworkUrl: string | null;
  spotifyTrackId: string | null;
  lastCheckedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrackResult {
  id: number;
  trackId: number;
  youtubeVideoId: string;
  title: string;
  channelId: string;
  channelName: string;
  thumbnailUrl: string;
  viewCount: number | null;
  publishedAt: string | null;
  versionType: VersionType;
  isOfficialChannel: boolean;
  relevanceScore: number;
  isDismissed: boolean;
  fetchedAt: string;
}

export type NewTrackResult = Omit<TrackResult, "id" | "trackId" | "isDismissed" | "fetchedAt">;

// Raw shapes as SQLite actually returns them: snake_case columns, booleans
// as 0/1 integers.
interface TrackRow {
  id: number;
  cache_key: string;
  artist: string;
  title: string;
  album: string | null;
  artwork_url: string | null;
  spotify_track_id: string | null;
  last_checked_at: string;
  created_at: string;
  updated_at: string;
}

interface TrackResultRow {
  id: number;
  track_id: number;
  youtube_video_id: string;
  title: string;
  channel_id: string;
  channel_name: string;
  thumbnail_url: string;
  view_count: number | null;
  published_at: string | null;
  version_type: VersionType;
  is_official_channel: number;
  relevance_score: number;
  is_dismissed: number;
  fetched_at: string;
}

function mapTrackRow(row: TrackRow): Track {
  return {
    id: row.id,
    cacheKey: row.cache_key,
    artist: row.artist,
    title: row.title,
    album: row.album,
    artworkUrl: row.artwork_url,
    spotifyTrackId: row.spotify_track_id,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTrackResultRow(row: TrackResultRow): TrackResult {
  return {
    id: row.id,
    trackId: row.track_id,
    youtubeVideoId: row.youtube_video_id,
    title: row.title,
    channelId: row.channel_id,
    channelName: row.channel_name,
    thumbnailUrl: row.thumbnail_url,
    viewCount: row.view_count,
    publishedAt: row.published_at,
    versionType: row.version_type,
    isOfficialChannel: row.is_official_channel === 1,
    relevanceScore: row.relevance_score,
    isDismissed: row.is_dismissed === 1,
    fetchedAt: row.fetched_at,
  };
}

const SORT_COLUMNS: Record<"relevance" | "recency" | "views", string> = {
  relevance: "relevance_score DESC",
  recency: "published_at DESC",
  views: "view_count DESC",
};

export class TrackRepository {
  constructor(private db: SqlExecutor) {}

  /** Cache lookup — the first thing the Search Orchestrator does (Phase 2). */
  async getCachedTrack(artist: string, title: string): Promise<CommandResult<Track | null>> {
    try {
      const cacheKey = normalizeCacheKey(artist, title);
      const rows = await this.db.select<TrackRow>(
        "SELECT * FROM tracks WHERE cache_key = ? LIMIT 1",
        [cacheKey],
      );
      return ok(rows[0] ? mapTrackRow(rows[0]) : null);
    } catch (e) {
      return err("UNKNOWN", `getCachedTrack failed: ${String(e)}`);
    }
  }

  /** Insert-or-refresh a track cache entry. Refreshing never clobbers an
   *  already-resolved Spotify track ID with a null one. */
  async upsertTrack(input: {
    artist: string;
    title: string;
    album?: string;
    artworkUrl?: string;
    spotifyTrackId?: string;
  }): Promise<CommandResult<Track>> {
    try {
      const cacheKey = normalizeCacheKey(input.artist, input.title);
      const now = new Date().toISOString();
      await this.db.execute(
        `INSERT INTO tracks
           (cache_key, artist, title, album, artwork_url, spotify_track_id, last_checked_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET
           last_checked_at = excluded.last_checked_at,
           updated_at = excluded.updated_at,
           spotify_track_id = COALESCE(excluded.spotify_track_id, tracks.spotify_track_id)`,
        [
          cacheKey,
          input.artist,
          input.title,
          input.album ?? null,
          input.artworkUrl ?? null,
          input.spotifyTrackId ?? null,
          now,
          now,
          now,
        ],
      );
      const rows = await this.db.select<TrackRow>("SELECT * FROM tracks WHERE cache_key = ?", [
        cacheKey,
      ]);
      return ok(mapTrackRow(rows[0]));
    } catch (e) {
      return err("UNKNOWN", `upsertTrack failed: ${String(e)}`);
    }
  }

  /** Ranked results for display — matches the get_cached_results /
   *  search_track_versions response shape from Phase 5. */
  async getTrackResults(
    trackId: number,
    opts: { limit?: number; sortBy?: "relevance" | "recency" | "views" } = {},
  ): Promise<CommandResult<TrackResult[]>> {
    try {
      const limit = opts.limit ?? 10;
      const orderBy = SORT_COLUMNS[opts.sortBy ?? "relevance"];
      const rows = await this.db.select<TrackResultRow>(
        `SELECT * FROM track_results WHERE track_id = ? AND is_dismissed = 0
         ORDER BY ${orderBy} LIMIT ?`,
        [trackId, limit],
      );
      return ok(rows.map(mapTrackResultRow));
    } catch (e) {
      return err("UNKNOWN", `getTrackResults failed: ${String(e)}`);
    }
  }

  /** Bulk upsert after a fresh search — re-running a search updates scores
   *  in place rather than duplicating rows for the same video. */
  async upsertTrackResults(
    trackId: number,
    results: NewTrackResult[],
  ): Promise<CommandResult<void>> {
    try {
      const now = new Date().toISOString();
      for (const r of results) {
        await this.db.execute(
          `INSERT INTO track_results
             (track_id, youtube_video_id, title, channel_id, channel_name, thumbnail_url,
              view_count, published_at, version_type, is_official_channel, relevance_score, fetched_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(track_id, youtube_video_id) DO UPDATE SET
             relevance_score = excluded.relevance_score,
             view_count = excluded.view_count,
             fetched_at = excluded.fetched_at`,
          [
            trackId,
            r.youtubeVideoId,
            r.title,
            r.channelId,
            r.channelName,
            r.thumbnailUrl,
            r.viewCount,
            r.publishedAt,
            r.versionType,
            r.isOfficialChannel ? 1 : 0,
            r.relevanceScore,
            now,
          ],
        );
      }
      return ok(undefined);
    } catch (e) {
      return err("UNKNOWN", `upsertTrackResults failed: ${String(e)}`);
    }
  }

  /** "Don't show me this again" — FR from Phase 1, the is_dismissed flag
   *  from Phase 4 that stands in for a full soft-delete pattern. */
  async dismissResult(trackId: number, youtubeVideoId: string): Promise<CommandResult<void>> {
    try {
      const result = await this.db.execute(
        "UPDATE track_results SET is_dismissed = 1 WHERE track_id = ? AND youtube_video_id = ?",
        [trackId, youtubeVideoId],
      );
      if (result.rowsAffected === 0) {
        return err("NOT_FOUND", `no result ${youtubeVideoId} for track ${trackId}`);
      }
      return ok(undefined);
    } catch (e) {
      return err("UNKNOWN", `dismissResult failed: ${String(e)}`);
    }
  }

  /** TTL cleanup job from Phase 2's caching strategy. Cascades to
   *  track_results automatically via the foreign key. */
  async cleanupExpiredTracks(ttlDays: number): Promise<CommandResult<number>> {
    try {
      const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000).toISOString();
      const result = await this.db.execute("DELETE FROM tracks WHERE last_checked_at < ?", [
        cutoff,
      ]);
      return ok(result.rowsAffected);
    } catch (e) {
      return err("UNKNOWN", `cleanupExpiredTracks failed: ${String(e)}`);
    }
  }
}
