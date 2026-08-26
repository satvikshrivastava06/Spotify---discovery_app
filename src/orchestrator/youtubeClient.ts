import { type CommandResult, err, ok } from "../db/result";
import type { HttpClient } from "./httpClient";

export interface YouTubeVideo {
  videoId: string;
  title: string;
  channelId: string;
  channelName: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: number | null;
}

const SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

interface YouTubeSearchResponse {
  items?: Array<{
    id: { videoId?: string };
    snippet: {
      title: string;
      channelId: string;
      channelTitle: string;
      publishedAt: string;
      thumbnails?: { medium?: { url: string }; default?: { url: string } };
    };
  }>;
}

interface YouTubeVideosResponse {
  items?: Array<{ id: string; statistics?: { viewCount?: string } }>;
}

export class YouTubeClient {
  // search.list costs 100 units regardless of maxResults; videos.list
  // (statistics) costs 1 unit regardless of how many IDs are batched in
  // (up to 50) — see Phase 2/3 for the daily budget these are checked
  // against via ApiUsageRepository before each call.
  static readonly UNITS_PER_SEARCH = 100;
  static readonly UNITS_PER_STATS_CALL = 1;

  constructor(
    private http: HttpClient,
    private apiKey: string,
  ) {}

  /** search.list only returns snippet data — title, channel, thumbnails,
   *  publish date. No view counts here; see getViewCounts(). */
  async search(query: string, maxResults = 5): Promise<CommandResult<YouTubeVideo[]>> {
    try {
      const response = await this.http.get(SEARCH_URL, {
        part: "snippet",
        q: query,
        type: "video",
        maxResults: String(maxResults),
        key: this.apiKey,
      });

      if (response.status === 403) {
        return err("QUOTA_EXCEEDED", "YouTube API quota exceeded");
      }
      if (response.status !== 200) {
        return err("NETWORK_ERROR", `YouTube search failed with status ${response.status}`);
      }

      const body = (await response.json()) as YouTubeSearchResponse;
      const videos: YouTubeVideo[] = [];
      for (const item of body.items ?? []) {
        // search.list occasionally returns channel/playlist results even
        // with type=video filtering applied; skip anything without a
        // real video ID rather than let a malformed entry through.
        if (!item.id?.videoId) continue;
        videos.push({
          videoId: item.id.videoId,
          title: item.snippet.title,
          channelId: item.snippet.channelId,
          channelName: item.snippet.channelTitle,
          thumbnailUrl:
            item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? "",
          publishedAt: item.snippet.publishedAt,
          viewCount: null,
        });
      }
      return ok(videos);
    } catch (e) {
      return err("NETWORK_ERROR", `YouTube search failed: ${String(e)}`);
    }
  }

  /** Batches up to 50 video IDs into a single 1-unit call. Always a
   *  required second call after search(), never optional — search.list
   *  simply doesn't carry statistics in its response. */
  async getViewCounts(videoIds: string[]): Promise<CommandResult<Map<string, number>>> {
    if (videoIds.length === 0) return ok(new Map());
    try {
      const response = await this.http.get(VIDEOS_URL, {
        part: "statistics",
        id: videoIds.slice(0, 50).join(","),
        key: this.apiKey,
      });
      if (response.status !== 200) {
        return err("NETWORK_ERROR", `YouTube statistics lookup failed with status ${response.status}`);
      }
      const body = (await response.json()) as YouTubeVideosResponse;
      const counts = new Map<string, number>();
      for (const item of body.items ?? []) {
        counts.set(item.id, Number(item.statistics?.viewCount ?? 0));
      }
      return ok(counts);
    } catch (e) {
      return err("NETWORK_ERROR", `YouTube statistics lookup failed: ${String(e)}`);
    }
  }
}
