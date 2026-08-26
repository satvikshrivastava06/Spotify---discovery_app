import type { ApiUsageRepository } from "../db/apiUsageRepository";
import { type CommandResult, err, ok } from "../db/result";
import type { NewTrackResult, TrackRepository, TrackResult } from "../db/trackRepository";
import type { Credentials, CredentialsProvider } from "./credentialsProvider";
import { filterAlreadyOnSpotify } from "./dedup";
import type { HttpClient } from "./httpClient";
import { computeRelevanceScore } from "./ranking";
import { SpotifyClient } from "./spotifyClient";
import { classifyVersionType } from "./versionClassifier";
import { YouTubeClient, type YouTubeVideo } from "./youtubeClient";

// Kept short deliberately, per Phase 2: each template costs a full
// 100-unit search call, so the set favors the most commonly-requested
// version types over exhaustive coverage.
const QUERY_TEMPLATES = ["acoustic", "live", "session", "cover"];

const CACHE_TTL_DAYS = 30;

export interface SearchTrackVersionsOptions {
  limit?: number;
  sortBy?: "relevance" | "recency" | "views";
}

export class SearchOrchestrator {
  constructor(
    private trackRepo: TrackRepository,
    private apiUsageRepo: ApiUsageRepository,
    private credentials: CredentialsProvider,
    private http: HttpClient,
  ) {}

  /** The Phase 5 search_track_versions equivalent — cache-first, full
   *  pipeline only on a miss or stale entry, matching Phase 2's request
   *  lifecycle diagram exactly. */
  async searchTrackVersions(
    artist: string,
    title: string,
    opts: SearchTrackVersionsOptions = {},
  ): Promise<CommandResult<TrackResult[]>> {
    const cached = await this.trackRepo.getCachedTrack(artist, title);
    if (!cached.ok) return cached;

    if (cached.data && !isStale(cached.data.lastCheckedAt)) {
      return this.trackRepo.getTrackResults(cached.data.id, opts);
    }

    return this.runFullPipeline(artist, title, opts);
  }

  private async runFullPipeline(
    artist: string,
    title: string,
    opts: SearchTrackVersionsOptions,
  ): Promise<CommandResult<TrackResult[]>> {
    const creds = await this.credentials.getCredentials();
    if (!creds.youtubeApiKey) {
      return err("INVALID_INPUT", "no YouTube API key configured");
    }

    const youtube = new YouTubeClient(this.http, creds.youtubeApiKey);
    const candidates = await this.collectCandidates(youtube, artist, title);
    if (!candidates.ok) return candidates;

    const filtered = await this.applySpotifyDedup(candidates.data, creds, artist);

    const track = await this.trackRepo.upsertTrack({ artist, title });
    if (!track.ok) return track;

    const newResults: NewTrackResult[] = filtered.map((video) => ({
      youtubeVideoId: video.videoId,
      title: video.title,
      channelId: video.channelId,
      channelName: video.channelName,
      thumbnailUrl: video.thumbnailUrl,
      viewCount: video.viewCount,
      publishedAt: video.publishedAt,
      versionType: classifyVersionType(video.title),
      isOfficialChannel: isLikelyOfficialChannel(video.channelName, artist),
      relevanceScore: computeRelevanceScore(video, artist, title),
    }));

    const saved = await this.trackRepo.upsertTrackResults(track.data.id, newResults);
    if (!saved.ok) return saved;

    return this.trackRepo.getTrackResults(track.data.id, opts);
  }

  /** Runs the query template set, merging candidates across templates by
   *  video ID (the same video often surfaces under more than one
   *  qualifier search), then makes one additional 1-unit call for view
   *  counts — search.list doesn't return statistics. Quota is checked
   *  via ApiUsageRepository before every call, never after. */
  private async collectCandidates(
    youtube: YouTubeClient,
    artist: string,
    title: string,
  ): Promise<CommandResult<YouTubeVideo[]>> {
    const byId = new Map<string, YouTubeVideo>();

    for (const qualifier of QUERY_TEMPLATES) {
      const canSpend = await this.apiUsageRepo.tryRecordUsage(
        "youtube",
        YouTubeClient.UNITS_PER_SEARCH,
      );
      if (!canSpend.ok) return canSpend;
      if (!canSpend.data) {
        // Quota exhausted partway through the template set — return
        // whatever was already found rather than failing the whole
        // search. A partial result set beats none.
        break;
      }

      const result = await youtube.search(`${artist} ${title} ${qualifier}`);
      if (!result.ok) {
        if (result.error.code === "QUOTA_EXCEEDED") break;
        continue; // one bad template shouldn't sink the whole search
      }
      for (const video of result.data) {
        if (!byId.has(video.videoId)) byId.set(video.videoId, video);
      }
    }

    const uniqueCandidates = [...byId.values()];
    if (uniqueCandidates.length === 0) return ok([]);

    const statsUsage = await this.apiUsageRepo.tryRecordUsage(
      "youtube",
      YouTubeClient.UNITS_PER_STATS_CALL,
    );
    if (statsUsage.ok && statsUsage.data) {
      const counts = await youtube.getViewCounts(uniqueCandidates.map((v) => v.videoId));
      if (counts.ok) {
        for (const video of uniqueCandidates) {
          video.viewCount = counts.data.get(video.videoId) ?? null;
        }
      }
      // A failed stats call isn't fatal — ranking just falls back to
      // viewCount: null (treated as no signal, not an error) this run.
    }

    return ok(uniqueCandidates);
  }

  private async applySpotifyDedup(
    candidates: YouTubeVideo[],
    creds: Credentials,
    artist: string,
  ): Promise<YouTubeVideo[]> {
    if (!creds.spotifyClientId || !creds.spotifyClientSecret) {
      return candidates; // no Spotify credentials configured — show everything, unverified
    }
    const spotify = new SpotifyClient(this.http, creds.spotifyClientId, creds.spotifyClientSecret);
    const catalog = await spotify.searchTracksByArtist(artist);
    if (!catalog.ok) {
      // Phase 2's explicit error-handling decision: a failed Spotify
      // check doesn't block YouTube results, it just skips the filter.
      return candidates;
    }
    return filterAlreadyOnSpotify(candidates, catalog.data);
  }
}

function isLikelyOfficialChannel(channelName: string, artist: string): boolean {
  return /vevo|official/i.test(channelName) || channelName.toLowerCase().includes(artist.toLowerCase());
}

function isStale(lastCheckedAt: string): boolean {
  const ageMs = Date.now() - new Date(lastCheckedAt).getTime();
  return ageMs > CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
}
