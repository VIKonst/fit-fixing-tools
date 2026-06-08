# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo does

Tools for post-processing Garmin FIT activity files. The core use case: a fitness device records an activity (pace, HR, cadence, power) but no GPS — these tools inject GPS coordinates from a GPX track into the FIT file so it can be uploaded to Garmin Connect or Strava with a map.

Two interfaces exist: a browser-based React web app (`web/`) and standalone Node.js CLI scripts (`cli-tools/`).

## Web App (`web/`)

A client-side React app — no server required. Users upload a FIT file and a GPX track, the app injects GPS coordinates, previews both tracks on a map, and provides a download of the processed FIT file.

### Development

```
cd web
npm install
npm run dev        # Vite dev server on http://localhost:5173
npm run build      # TypeScript check + production build → web/dist/
npm test           # Run unit tests once (Vitest)
npm run test:watch # Re-run tests on file change
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Bundler | Vite 6 |
| UI | React 19 + TypeScript |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite` plugin) |
| Maps | Leaflet + react-leaflet (OpenStreetMap tiles, no API key) |
| i18n | react-i18next (English + Ukrainian, auto-detects browser language) |
| FIT processing | `@garmin/fitsdk` in a Web Worker (off main thread) |

### Project Structure

- **`src/lib/`** — Pure logic modules (no React, no DOM):
  - `types.ts` — Shared TypeScript interfaces (`GpxPoint`, `TrackPoint`, `FitProcessingResult`, `WorkerRequest`/`WorkerResponse`)
  - `geo.ts` — Math utilities: `degreesToSemicircles`, `semicirclesToDegrees`, `haversineDistance`, `lerp`
  - `gpx-parser.ts` — `parseGpx()` (regex-based, handles `<trkpt>` and `<rtept>`), `buildTrackWithDistances()` (cumulative Haversine)
  - `fit-processor.ts` — Core pipeline: `decodeFit()`, `interpolatePosition()` (binary search + lerp), `injectGpsFromGpx()` (record/session/lap mutation), `encodeFit()`, `processFitWithGpx()` (full pipeline)
  - `fit-encoder-order.ts` — Message ordering constants for FIT encoding (`MESG_ORDER_BEFORE_TIMESTAMPED`, `MESG_ORDER_AFTER_TIMESTAMPED`)

- **`src/worker/fit-worker.ts`** — Web Worker that receives FIT `ArrayBuffer` + GPX text, runs the full pipeline, posts back the processed result via structured clone (not `Transferable` — see known issues below)

- **`src/hooks/`** — Custom React hooks:
  - `useFileLoader.ts` — `useFitFileLoader()` reads FIT as `ArrayBuffer` and validates via `Decoder.isFIT()`; `useGpxFileLoader()` reads GPX as text, runs `parseGpx()` for validation
  - `useFitProcessor.ts` — Creates/terminates the Web Worker, exposes `process()` and `canProcess`/`processing` state

- **`src/context/AppContext.tsx`** — App state via `useReducer`: `fitFile`, `gpxFile`, `processing`, `result`, `error`. Actions: `SET_FIT_FILE`, `SET_GPX_FILE`, `START_PROCESSING`, `PROCESSING_COMPLETE`, `PROCESSING_ERROR`, `RESET`

- **`src/components/`** — UI components (all responsive, mobile-first):
  - `Layout.tsx` — Page shell with header (title + `LanguageSwitcher`) and main content area
  - `LanguageSwitcher.tsx` — EN/UA toggle buttons
  - `FileUpload.tsx` — Reusable drag-and-drop zone (tap-to-browse on mobile)
  - `FitFileInput.tsx` / `GpxFileInput.tsx` — File pickers with validation feedback (file size, point count, track distance)
  - `ProcessButton.tsx` — Enabled when both files loaded, shows spinner while processing
  - `MapPreview.tsx` — Leaflet map with two polylines: GPX track (blue dashed) and generated GPS (red solid), auto-fits bounds, legend
  - `TrackStats.tsx` — Stats grid (records, GPX points, distances) with warning when activity exceeds GPX track length
  - `DownloadButton.tsx` — Creates blob URL on-click and triggers programmatic download
  - `ErrorDisplay.tsx` — Translatable error messages

- **`src/i18n/`** — i18next setup with `en.json` and `uk.json` translation files (~30 keys each)

- **`src/types/garmin-fitsdk.d.ts`** — TypeScript declarations for `@garmin/fitsdk` (no `@types` package exists)

### Testing

Framework: **Vitest** (`vitest.config.ts` at `web/`). Tests live in `src/lib/__tests__/` alongside the modules they cover. Only business logic is tested — no UI components.

| Test file | Covers |
|---|---|
| `geo.test.ts` | `degreesToSemicircles`, `semicirclesToDegrees`, `toRadians`, `haversineDistance`, `lerp` |
| `gpx-parser.test.ts` | `parseGpx` (trkpt/rtept parsing, elevation, NaN skipping, fallback), `buildTrackWithDistances` |
| `fit-processor.test.ts` | `injectGpsFromGpx` (GPS injection, key insertion order, interpolation edges, session/lap positions, stats), `decodeFit` (error paths via mocked SDK), `encodeFit` (message ordering, timestamp sort) |

`@garmin/fitsdk` is mocked at module level in `fit-processor.test.ts` — no real FIT binary data needed. `injectGpsFromGpx` is tested with plain TypeScript objects and requires no mock.

### Known Issues & Design Decisions

- **Download uses on-click blob creation**: The `DownloadButton` creates the blob URL in the click handler (not in `useMemo`/`useEffect`) because React StrictMode's double-mount cycle revokes eagerly-created blob URLs before the user can click them.

- **Web Worker uses structured clone, not Transferable**: Transferring `fitData.buffer` via `Transferable` detaches the `ArrayBuffer`, causing the `Uint8Array` wrapper to lose its data on the main thread. For sub-MB FIT files, the structured clone copy cost is negligible.

- **Browser FIT API**: Use `Stream.fromArrayBuffer(buffer)` not `fromBuffer()` (which expects a Node.js `Buffer`). Encoder `close()` returns `Uint8Array`.

- **Property insertion order**: When adding `positionLat`/`positionLong` to FIT records that lack them, the object must be reconstructed to insert these keys before `distance` in `Object.keys()` order — the FIT encoder uses insertion order for binary layout. See `fit-processor.ts` `injectGpsFromGpx()`.

### Hosting

Configured for Azure Static Web Apps (`staticwebapp.config.json` with SPA fallback). Also works with Cloudflare Pages, GitHub Pages, or Vercel — deploy the `web/dist/` output.

## CLI Scripts (`cli-tools/`)

Standalone Node.js ESM scripts — no build step:

```
# Add a synthetic straight-line GPS track based on distance
node cli-tools/add-gps.mjs tracks/FIT/input.fit [output.fit]

# Merge a real GPX route into a FIT file (GPS interpolated by distance)
node cli-tools/add-gps-from-gpx.mjs tracks/FIT/input.fit tracks/GPX/track.gpx [output.fit]

# Same as above, but also corrects wrong timestamps
node cli-tools/add-gps-from-gpx_timestampfix.mjs tracks/FIT/input.fit tracks/GPX/track.gpx "2025-05-19T07:30:00" [output.fit]
```

Output defaults to `<input>_with_gps.fit` if not specified. Dependency: `@garmin/fitsdk` (installed in root `package.json`).

## Core Algorithm (shared by web app and CLI)

1. **Decode FIT** → `messages` object (recordMesgs, lapMesgs, sessionMesgs, eventMesgs, etc.)
2. **Parse GPX** → array of `{lat, lon, ele}` points via regex
3. **Build cumulative distance array** from GPX points using Haversine formula
4. **For each FIT record**: use its `distance` field (meters, scale-applied) to binary-search into the GPX track and linearly interpolate lat/lon/elevation
5. **Update session and lap** start/end positions to match
6. **Re-encode** in strict message order: `file_id → file_creator → device_settings → user_profile → sport → zones_target → training_settings → training_file → workout → workout_step → device_info → [events+records interleaved by timestamp] → laps → sessions → activity`

**FIT timestamps**: seconds since Dec 31, 1989 00:00:00 UTC (`FIT_EPOCH_OFFSET = 631065600`). The `_timestampfix` CLI variant shifts all timestamps by a uniform offset.

**Coordinate conversion**: degrees → semicircles via `Math.round(deg * (2^31 / 180))`.

## Track Files

`tracks/FIT/` — input and output `.fit` files
`tracks/GPX/` — reference GPX routes for GPS injection

Both directories are gitignored.
