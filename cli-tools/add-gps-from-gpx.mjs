/**
 * add-gps-from-gpx.mjs
 * 
 * Merges a FIT activity (without GPS) with a GPX track.
 * The activity's distance field is used to find the corresponding position
 * along the GPX track via interpolation.
 * 
 * If the activity is shorter than the GPX track, only the needed portion is used.
 * If the activity is longer, the remaining records get the last GPX point.
 * 
 * Usage: node add-gps-from-gpx.mjs <input.fit> <track.gpx> [output.fit]
 *   If output is omitted, writes to <input>_with_gps.fit
 */

import fs from 'fs';
import path from 'path';
import { Decoder, Encoder, Stream, Profile } from '@garmin/fitsdk';

// --- Helpers ---
function degreesToSemicircles(deg) {
  return Math.round(deg * (2 ** 31 / 180));
}

function toRadians(deg) {
  return deg * Math.PI / 180;
}

/**
 * Haversine distance between two points in meters.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Linear interpolation between two points.
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Parse GPX file and extract track points as [{lat, lon, ele?}]
 * Simple XML parsing without dependencies.
 */
function parseGpx(gpxContent) {
  const points = [];

  // Match <trkpt> elements (handles both self-closing and with children)
  const trkptRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*(?:\/>|>([\s\S]*?)<\/trkpt>)/gi;
  let match;

  while ((match = trkptRegex.exec(gpxContent)) !== null) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    const inner = match[3] || '';

    let ele = null;
    const eleMatch = inner.match(/<ele>([^<]+)<\/ele>/);
    if (eleMatch) {
      ele = parseFloat(eleMatch[1]);
    }

    if (!isNaN(lat) && !isNaN(lon)) {
      points.push({ lat, lon, ele });
    }
  }

  // Also try <rtept> (route points) if no track points found
  if (points.length === 0) {
    const rteptRegex = /<rtept\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*(?:\/>|>([\s\S]*?)<\/rtept>)/gi;
    while ((match = rteptRegex.exec(gpxContent)) !== null) {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lon)) {
        points.push({ lat, lon, ele: null });
      }
    }
  }

  return points;
}

/**
 * Build cumulative distance array for GPX points.
 * Returns array of { lat, lon, ele, cumulDist } with cumulDist in meters.
 */
function buildTrackWithDistances(points) {
  if (points.length === 0) return [];

  const result = [{ ...points[0], cumulDist: 0 }];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const segDist = haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);
    result.push({ ...curr, cumulDist: result[i - 1].cumulDist + segDist });
  }

  return result;
}

/**
 * Given a distance along the track, interpolate the position.
 * Uses binary search for efficiency.
 */
function interpolatePosition(track, distanceMeters) {
  if (track.length === 0) return null;
  if (distanceMeters <= 0) return { lat: track[0].lat, lon: track[0].lon, ele: track[0].ele };

  const totalDist = track[track.length - 1].cumulDist;
  if (distanceMeters >= totalDist) {
    const last = track[track.length - 1];
    return { lat: last.lat, lon: last.lon, ele: last.ele };
  }

  // Binary search for the segment
  let lo = 0, hi = track.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (track[mid].cumulDist <= distanceMeters) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  // Interpolate between track[lo] and track[hi]
  const segLen = track[hi].cumulDist - track[lo].cumulDist;
  const t = segLen > 0 ? (distanceMeters - track[lo].cumulDist) / segLen : 0;

  return {
    lat: lerp(track[lo].lat, track[hi].lat, t),
    lon: lerp(track[lo].lon, track[hi].lon, t),
    ele: (track[lo].ele != null && track[hi].ele != null)
      ? lerp(track[lo].ele, track[hi].ele, t)
      : null,
  };
}

// --- Main ---
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node add-gps-from-gpx.mjs <input.fit> <track.gpx> [output.fit]');
  process.exit(1);
}

const inputPath = args[0];
const gpxPath = args[1];
const outputPath = args[2] || inputPath.replace(/\.fit$/i, '_with_gps.fit');

// Parse GPX
const gpxContent = fs.readFileSync(gpxPath, 'utf-8');
const gpxPoints = parseGpx(gpxContent);

if (gpxPoints.length < 2) {
  console.error(`Error: GPX file has only ${gpxPoints.length} point(s). Need at least 2.`);
  process.exit(1);
}

const track = buildTrackWithDistances(gpxPoints);
const trackLength = track[track.length - 1].cumulDist;
console.log(`GPX track: ${gpxPoints.length} points, ${(trackLength / 1000).toFixed(2)} km`);

// Read and decode FIT
const buffer = fs.readFileSync(inputPath);
const decoder = new Decoder(Stream.fromBuffer(buffer));

if (!decoder.isFIT()) {
  console.error('Error: Not a valid FIT file');
  process.exit(1);
}

const { messages, errors } = decoder.read({
  applyScaleAndOffset: true,
  expandSubFields: true,
  expandComponents: true,
  convertTypesToStrings: false,
  convertDateTimesToDates: false,
  includeUnknownData: true,
  mergeHeartRates: false,
});

if (errors.length > 0) {
  console.error('Decode errors:', errors);
  process.exit(1);
}

// Check if records already have GPS
const records = messages.recordMesgs || [];
const hasGps = records.some(r => r.positionLat != null && r.positionLong != null);

// if (hasGps) {
//   console.log('File already has GPS data. No modification needed.');
//   process.exit(0);
// }

console.log(`Processing ${records.length} records...`);

// Determine activity distance
const lastDist = records[records.length - 1]?.distance ?? 0;
console.log(`Activity distance: ${(lastDist / 1000).toFixed(2)} km`);

if (lastDist > trackLength) {
  console.warn(`Warning: Activity (${(lastDist / 1000).toFixed(2)} km) is longer than GPX track (${(trackLength / 1000).toFixed(2)} km).`);
  console.warn('Records beyond the track will use the last GPX point.');
}

// Add GPS coordinates to each record
records.forEach((record, idx) => {
  const distMeters = (record.distance != null) ? record.distance : 0;
  const pos = interpolatePosition(track, distMeters);
  const latSemi = degreesToSemicircles(pos.lat);
  const lonSemi = degreesToSemicircles(pos.lon);

  if (record.positionLat != null) {
    // Record already has positionLat as an own property — safe to overwrite in-place.
    record.positionLat = latSemi;
    record.positionLong = lonSemi;
  } else {
    // positionLat is missing from this record's own properties.
    // The FIT encoder uses Object.keys() insertion order to build the binary LMD,
    // so positionLat/Long must appear BEFORE distance in the key order to match
    // the layout expected by decoders. Reconstruct the object with the fields
    // injected at the correct position.
    const newRecord = {};
    let injected = false;
    for (const key of Object.keys(record)) {
      if (key === 'distance' && !injected) {
        newRecord.positionLat = latSemi;
        newRecord.positionLong = lonSemi;
        injected = true;
      }
      newRecord[key] = record[key];
    }
    if (!injected) {
      newRecord.positionLat = latSemi;
      newRecord.positionLong = lonSemi;
    }
    records[idx] = newRecord;
  }
});

// Update session start/end positions
const sessions = messages.sessionMesgs || [];
if (sessions.length > 0 && records.length > 0) {
  const startPos = interpolatePosition(track, 0);
  const endPos = interpolatePosition(track, lastDist);

  sessions.forEach(session => {
    session.startPositionLat = degreesToSemicircles(startPos.lat);
    session.startPositionLong = degreesToSemicircles(startPos.lon);
    session.endPositionLat = degreesToSemicircles(endPos.lat);
    session.endPositionLong = degreesToSemicircles(endPos.lon);
  });
}

// Update lap start/end positions
const laps = messages.lapMesgs || [];
let lapRecordIdx = 0;
laps.forEach(lap => {
  const startDist = records[lapRecordIdx]?.distance ?? 0;
  const startPos = interpolatePosition(track, startDist);
  lap.startPositionLat = degreesToSemicircles(startPos.lat);
  lap.startPositionLong = degreesToSemicircles(startPos.lon);

  const lapEnd = lap.timestamp;
  while (lapRecordIdx < records.length - 1 && records[lapRecordIdx].timestamp <= lapEnd) {
    lapRecordIdx++;
  }
  const endDist = records[Math.max(0, lapRecordIdx - 1)]?.distance ?? 0;
  const endPos = interpolatePosition(track, endDist);
  lap.endPositionLat = degreesToSemicircles(endPos.lat);
  lap.endPositionLong = degreesToSemicircles(endPos.lon);
});

// Encode the modified data back to FIT
const encoder = new Encoder();

// Write messages in correct order (file_id must be first)
messages.fileIdMesgs?.forEach(m => encoder.onMesg(Profile.MesgNum.FILE_ID, m));
messages.fileCreatorMesgs?.forEach(m => encoder.onMesg(Profile.MesgNum.FILE_CREATOR, m));
messages.deviceSettingsMesgs?.forEach(m => encoder.onMesg(Profile.MesgNum.DEVICE_SETTINGS, m));
messages.userProfileMesgs?.forEach(m => encoder.onMesg(Profile.MesgNum.USER_PROFILE, m));
messages.sportMesgs?.forEach(m => encoder.onMesg(Profile.MesgNum.SPORT, m));
messages.zonesTargetMesgs?.forEach(m => encoder.onMesg(Profile.MesgNum.ZONES_TARGET, m));
messages.trainingSettingsMesgs?.forEach(m => encoder.onMesg(Profile.MesgNum.TRAINING_SETTINGS, m));
messages.trainingFileMesgs?.forEach(m => encoder.onMesg(Profile.MesgNum.TRAINING_FILE, m));
messages.workoutMesgs?.forEach(m => encoder.onMesg(Profile.MesgNum.WORKOUT, m));
messages.workoutStepMesgs?.forEach(m => encoder.onMesg(Profile.MesgNum.WORKOUT_STEP, m));
messages.deviceInfoMesgs?.forEach(m => encoder.onMesg(Profile.MesgNum.DEVICE_INFO, m));

// Events and records interleaved by timestamp
const events = messages.eventMesgs || [];
const allTimestamped = [
  ...events.map(m => ({ type: 'event', msg: m })),
  ...records.map(m => ({ type: 'record', msg: m })),
];
allTimestamped.sort((a, b) => (a.msg.timestamp || 0) - (b.msg.timestamp || 0));

allTimestamped.forEach(({ type, msg }) => {
  if (type === 'event') {
    encoder.onMesg(Profile.MesgNum.EVENT, msg);
  } else {
    encoder.onMesg(Profile.MesgNum.RECORD, msg);
  }
});

// Laps, sessions, activity
laps.forEach(m => encoder.onMesg(Profile.MesgNum.LAP, m));
sessions.forEach(m => encoder.onMesg(Profile.MesgNum.SESSION, m));
messages.activityMesgs?.forEach(m => encoder.onMesg(Profile.MesgNum.ACTIVITY, m));

// Write to file
const outputBuffer = encoder.close();
fs.writeFileSync(outputPath, outputBuffer);

console.log(`\nDone! GPS data added to ${records.length} records.`);
console.log(`Output: ${outputPath}`);
console.log(`Track used: ${(Math.min(lastDist, trackLength) / 1000).toFixed(2)} km of ${(trackLength / 1000).toFixed(2)} km GPX track`);
