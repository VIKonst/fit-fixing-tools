# FIT GPS Fixer

Add GPS coordinates from a GPX track to a Garmin FIT activity file.

When a fitness device records an activity without GPS (e.g., a treadmill run with pace/HR/cadence), these tools inject real GPS coordinates from a separately recorded GPX track. The result can be uploaded to Garmin Connect or Strava with a route map.

## Web App

A browser-based UI that runs entirely on the client — no server or upload required. Your files never leave your device.

### Features

- Drag-and-drop or click to select FIT and GPX files
- GPS injection based on distance interpolation along the GPX track
- Interactive map preview showing both the original GPX track and the generated GPS
- Activity statistics (distance, record count, track coverage)
- Download the processed FIT file
- English and Ukrainian interface
- Responsive design (desktop and mobile)

### Quick Start

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Testing

```bash
cd web
npm test           # run unit tests once
npm run test:watch # re-run on file change
```

Unit tests cover the core business logic (`geo`, `gpx-parser`, `fit-processor`) using [Vitest](https://vitest.dev/).

### Production Build

```bash
cd web
npm run build
```

Output is in `web/dist/` — deploy to any static hosting (Azure Static Web Apps, Cloudflare Pages, GitHub Pages, Vercel, etc.).

### Tech Stack

React 19, TypeScript, Vite 6, Tailwind CSS v4, Leaflet/OpenStreetMap, react-i18next.

## CLI Scripts

Standalone Node.js scripts in `cli-tools/` for command-line usage:

```bash
# Merge a GPX track into a FIT file
node cli-tools/add-gps-from-gpx.mjs <input.fit> <track.gpx> [output.fit]

# Same, but also fix incorrect timestamps
node cli-tools/add-gps-from-gpx_timestampfix.mjs <input.fit> <track.gpx> "2025-05-19T07:30:00" [output.fit]

# Add a synthetic straight-line GPS track (no GPX needed)
node cli-tools/add-gps.mjs <input.fit> [output.fit]
```

If output is omitted, writes to `<input>_with_gps.fit`.

Requires Node.js 18+ and `npm install` in the project root.

## How It Works

1. The FIT file is decoded into message objects (records, laps, sessions, events)
2. The GPX track is parsed and converted into a cumulative distance array using the Haversine formula
3. For each FIT record, its `distance` field is used to find the corresponding position along the GPX track via binary search and linear interpolation
4. GPS coordinates are injected into records, and session/lap start/end positions are updated
5. The FIT file is re-encoded in the message order required by Garmin Connect

If the activity is longer than the GPX track, records beyond the end of the track use the last GPX point.

## License

ISC
