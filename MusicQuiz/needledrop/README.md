# Needledrop

Music games you play with friends. **Milestone 1** ships the music engine and the first game:

- Real music search (songs, artists, albums) with artwork and metadata.
- Real audio: 30-second previews from Deezer, with Apple iTunes as a backup source.
- A global player that keeps playing while you navigate, and that games can take over.
- **Music Tournament**: single-elimination bracket of songs, artists or albums, 2 to 64 contestants, any size (byes are handled), random or hand-picked, bracket view, match history, skip-unavailable, restart/reshuffle, results screen. An unfinished tournament resumes after you close the app.
- Windows installer and portable `.exe`.

Coming next (see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)): the other games, collections, online multiplayer, accounts and stats.

## For your friends: install it

Download from the **Releases** page of this GitHub repository (the repo must be public, or your friend needs access):

| File | What it is |
| --- | --- |
| `Needledrop-Setup-x.y.z.exe` | Installer. Double-click, wait a few seconds, the app opens. Installs for the current Windows user only (no admin rights). Updates itself later. |
| `Needledrop-x.y.z-portable.exe` | No install. Run it from anywhere, for example a USB stick. Does not auto-update. |

The app is **not code-signed** (certificates cost money), so Windows SmartScreen shows "Windows protected your PC". Click **More info**, then **Run anyway**.

Needs Windows 10 or 11, 64-bit, and an internet connection. No Node.js, no database, no accounts, no API keys.

## For you: get the .exe onto the Releases page

You do not need Node.js on your own PC for this. GitHub builds it on a Windows machine.

1. Create a GitHub repository and push this folder to it (`git init`, `git add .`, `git commit`, `git remote add origin ...`, `git push -u origin main`).
2. On GitHub: **Settings, Actions, General, Workflow permissions: Read and write permissions**.
3. Tag a release (the tag must match `version` in `package.json`, with a `v` in front):
   ```
   git tag v0.1.0
   git push origin v0.1.0
   ```
4. Wait a few minutes for the **Build** workflow (Actions tab). The installer and portable exe appear under **Releases**. Send your friend that link.

Every push to `main` also runs the checks and builds the exe as a downloadable workflow artifact (Actions run page), without publishing.

## Develop

Needs Node.js 22 or newer.

```
npm install
npm run dev          # run the app with hot reload
npm run typecheck
npm test             # unit tests (engine, providers, service)
npm run test:e2e     # builds, then drives the real Electron app (needs a display; on Linux: xvfb-run -a npm run test:e2e)
npm run dist         # Windows installer + portable exe into release/ (run this on Windows)
```

Project layout:

```
src/main/       Electron main process: window, IPC, music providers (Deezer, iTunes), caching, rate limiting
src/preload/    The only bridge the UI can use to reach the main process
src/renderer/   React UI: pages, global player, tournament screens
src/shared/     Pure TypeScript shared by both sides: types, tournament engine, contestant builder
e2e/            End-to-end test with a fake HTTPS music server
```

## Music sources and their limits

| Source | Used for | Key needed | Limit |
| --- | --- | --- | --- |
| Deezer public API | search, artwork, charts, top songs, previews | none | about 50 requests per 5 seconds (the app stays under 40) |
| Apple iTunes Search API | backup previews and a second source per song | none | about 20 requests per minute (the app stays under 18) |

- Audio is **30-second previews only**. Full tracks are not available from these free sources.
- Not every song has a preview. Songs without audio are skipped when building a bracket, and a song that fails mid-match can be skipped (the opponent advances).
- The app never downloads or stores music. Previews are streamed from the provider.
- Spotify is deliberately not used: new apps get no preview URLs, and development mode needs a Premium account and caps users.

## Security

- No secrets in the app. Both providers are keyless.
- Renderer is sandboxed (`contextIsolation`, no Node integration), with a strict Content Security Policy in production builds. All network calls to providers go through the main process.
- Only `https:` links can be opened externally. Window navigation is locked to the app.
