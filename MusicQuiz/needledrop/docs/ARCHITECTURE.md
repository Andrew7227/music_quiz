# Architecture

## Process model

```
Renderer (React, sandboxed)  <--typed IPC via preload-->  Main process (Node)
  pages, stores, <audio> player                              MusicService
  tournament UI                                                ├─ DeezerProvider   (rate limited, cached)
                                                               └─ ItunesProvider   (rate limited, cached)
```

- The renderer has no Node access. `window.api` (see `src/shared/ipc.ts`) is the only way out.
- All provider HTTP happens in the main process through Chromium's network stack (system proxy and certificates), so there is no CORS problem and keys, if ever needed, never reach the renderer.
- Audio plays in the renderer with one shared `<audio>` element (`src/renderer/src/audio/player.ts`).

## Music abstraction

`src/main/providers/types.ts` defines `MusicProvider`. Optional methods (artist search, top tracks, charts) mean "this provider cannot do that". `MusicService`:

- fans a search out to all enabled providers, tolerates partial failure, merges duplicates (same internal track id) and combines their playback sources;
- caches searches (5 min) and lookups (30 min);
- `resolvePlayback(track)` returns fresh preview URLs: it re-looks-up the providers it knows and searches the others by artist and title (`pickBestMatch` refuses to guess when title or length disagree).

A `Track` carries an internal id (hash of normalized artist and title), title, artist, album, artwork, release date, duration, provider ids and `sources[]`. A source with `url: null` means "the provider has metadata but no audio". The app never pretends otherwise.

## Player control

`player.acquire(owner)` gives a game exclusive control: the user transport locks, the game chooses what plays and when it stops, and `release()` stops audio. Everyone else uses `player.play/pause/seek`. Playback tries stored URLs first, then asks the main process for fresh ones, then reports the track unavailable (`onUnavailable`).

## Game engine

`src/shared/engine/` is pure TypeScript with no DOM, Electron or network code:

- `tournament.ts`: immutable single-elimination state machine (byes for non-power-of-two sizes, picks, forfeits, stats, restart, reshuffle), seeded RNG so a bracket is reproducible.
- `contestants.ts`: turns setup choices into contestants.

Because it is pure, the same reducer can later run inside a server-authoritative function for multiplayer.

## Planned (not built yet)

- **M2**: Guess the Song, Pick One, Daily Clue, Blind Ranking, Higher or Lower (Deezer fan counts and track rank, labelled as such), collections. Each game is a module that implements the same small interface and runs on the same engine and player.
- **M3**: Supabase (Postgres, Auth, Realtime). Rooms and game state in tables with row-level security, game logic in Edge Functions that import `src/shared/engine`, correct answers kept in a table clients cannot read until reveal, answers timestamped by the server. Synchronized start: the server stamps a start time; clients preload and start at that time using an estimated clock offset (expect about 100 to 300 ms drift; previews cannot be sample-synchronized across devices).
- **M4**: profiles, stats, leaderboards, achievements.

## Decisions worth knowing

- Single npm package instead of a workspace monorepo for M1: workspaces add build friction on Windows for no benefit yet. Engine code stays under `src/shared` so it can move to its own package or be imported by Edge Functions later.
- Deezer is primary because it needs no key and exposes ranks and fan counts. iTunes is secondary because its rate limit is much lower.
- Persistence is `localStorage` (settings, history, in-progress tournament) for now; it moves to the backend with accounts in M3/M4.
