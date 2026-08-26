# Spotify Discovery Companion

A desktop companion that sits quietly in the tray while you listen to
Spotify. The moment a track changes, it surfaces the acoustic versions,
live performances, covers, and YouTube-exclusive uploads that Spotify's
own catalog doesn't have — with thumbnails and one-click links.

**Core promise:** while you listen on Spotify, instantly reveal every
meaningful official version, platform-exclusive release, live
performance, acoustic version, collaboration, and related content that
Spotify does not expose. See `spotify-discovery-project-spec.md` for the
full product vision, architecture, and the reasoning behind every major
decision — this README is just the practical setup guide.

## Status

Backend (media detection, local cache, search/dedup/ranking pipeline,
secure key storage) and frontend (the full popup UI, Settings screen,
tray/window packaging) are built and tested. **Not yet done:** real
device testing of the Rust/tray code (no Rust toolchain was available in
the environment this was built in — see the CI workflow, which runs that
check for the first time), and generating actual icon asset files (see
`src-tauri/icons/README.md`).

## Requirements

- Node.js ≥ 22.5.0 (for the built-in `node:sqlite` module used in tests)
- [Rust](https://rustup.rs/) (stable toolchain)
- Platform build dependencies for Tauri — see the
  [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/)
  for your OS

## Setup

```bash
npm install
cp .env.example .env.local
# fill in VITE_SPOTIFY_CLIENT_ID and VITE_SPOTIFY_CLIENT_SECRET in .env.local
# — see .env.example for what these are and where to get them
npm run tauri icon path/to/a-1024x1024-source-image.png
```

## Development

```bash
npm run dev          # Vite dev server only (for iterating on UI in a browser tab)
npm run tauri dev    # full app — Rust + webview together, what you actually want
```

## Testing

```bash
npm test             # frontend unit/integration tests (Vitest)
npm run typecheck    # tsc --noEmit
bash scripts/security-check.sh   # the automated Phase 10 security regression checks
cd src-tauri && cargo test       # Rust tests (Module 1's media bridge, mostly #[ignore]d
                                  # manual/integration tests — see that module's notes)
```

99 tests passing as of the last verified run (frontend + backend TS combined);
see the project spec's Phase 6/7 module notes for what each test suite actually
covers and, just as importantly, what it doesn't.

## Building a release

Push a tag matching `v*` (e.g. `git tag v0.1.0 && git push --tags`) —
`.github/workflows/release.yml` builds Windows and macOS (both Apple
Silicon and Intel) installers and attaches them to a draft GitHub
release. **These builds are unsigned** — see the workflow file for why
(a deliberate cost tradeoff, not an oversight) and expect Gatekeeper/
SmartScreen warnings on first launch until that's addressed.

## Project layout

```
src/                    # React frontend
├── App.tsx               # top-level view switching (main ↔ settings)
├── services.ts             # composition root — wires every real backend dependency together
├── hooks/                    # data-fetching + business logic, kept separate from components
├── components/                 # presentational + container components
└── db/, orchestrator/            # the actual backend logic — see below

src-tauri/               # Rust: OS media detection (Module 1), SQL/Stronghold
                          # plugin wiring, tray icon, window chrome

design/preview.html      # open directly in a browser — the design system reference,
                          # no build step required
```

The `src/db/` and `src/orchestrator/` folders contain the real
application logic (caching, YouTube/Spotify API clients, dedup, ranking)
— they run inside the Tauri webview as TypeScript, not in `src-tauri/`,
per the Phase 3 decision to keep Rust scoped to the one thing that
genuinely needs it (native OS media session access).

## Contributing

Read `spotify-discovery-project-spec.md` first — it's the record of
*why* the codebase looks the way it does, not just what it does. Most
non-obvious decisions (why there's no Spotify OAuth, why dedup uses a
two-part check instead of one similarity score, why Rust is scoped the
way it is) are explained there with the reasoning that led to them, which
matters more than the code itself when extending this project.
