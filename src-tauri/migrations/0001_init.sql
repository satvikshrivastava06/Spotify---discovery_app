-- Matches the Phase 4 database design exactly. This file is the single
-- source of truth for the schema: the real app loads it via include_str!
-- in lib.rs, and the test suite loads the same file (see src/db/testExecutor.ts)
-- so repository tests run against real SQL, not a hand-maintained duplicate
-- that could quietly drift from what's documented in Phase 4.
--
-- schema_migrations is NOT created here — @tauri-apps/plugin-sql manages
-- migration tracking itself (Phase 6 correction #2).

CREATE TABLE tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT NOT NULL UNIQUE,
    artist TEXT NOT NULL,
    title TEXT NOT NULL,
    album TEXT,
    artwork_url TEXT,
    spotify_track_id TEXT,
    last_checked_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_tracks_last_checked_at ON tracks (last_checked_at);

CREATE TABLE track_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL REFERENCES tracks (id) ON DELETE CASCADE,
    youtube_video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL,
    view_count INTEGER,
    published_at TEXT,
    version_type TEXT NOT NULL CHECK (
        version_type IN ('acoustic', 'live', 'cover', 'session', 'demo', 'other')
    ),
    is_official_channel INTEGER NOT NULL DEFAULT 0,
    relevance_score REAL NOT NULL,
    is_dismissed INTEGER NOT NULL DEFAULT 0,
    fetched_at TEXT NOT NULL,
    UNIQUE (track_id, youtube_video_id)
);

CREATE INDEX idx_track_results_track_id ON track_results (track_id);
CREATE INDEX idx_track_results_track_relevance ON track_results (track_id, relevance_score DESC);

CREATE TABLE api_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_name TEXT NOT NULL,
    usage_date TEXT NOT NULL,
    units_used INTEGER NOT NULL DEFAULT 0,
    UNIQUE (api_name, usage_date)
);

CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
