/**
 * add-gps-from-gpx_timestampfix.mjs
 * 
 * Merges a FIT activity (without GPS) with a GPX track, AND fixes timestamps.
 * The activity's distance field is used to find the corresponding position
 * along the GPX track via interpolation.
 * 
 * Timestamps are corrected by providing the correct start date/time.
 * All timestamps in the file are shifted so the first record starts at the
 * given time, preserving relative offsets between records.
 * 
 * Usage: node add-gps-from-gpx_timestampfix.mjs <input.fit> <track.gpx> <startDateTime> [output.fit]
 *   startDateTime: correct start time in ISO format, e.g. "2025-05-19T07:30:00"
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
if (args.length < 3) {
  console.error('Usage: node add-gps-from-gpx_timestampfix.mjs <input.fit> <track.gpx> <startDateTime> [output.fit]');
  console.error('  startDateTime: correct start time, e.g. "2025-05-19T07:30:00"');
  process.exit(1);
}

const inputPath = args[0];
const gpxPath = args[1];
const correctStartDateTime = args[2];
const outputPath = args[3] || inputPath.replace(/\.fit$/i, '_with_gps.fit');

// Validate start date/time
const correctStartDate = new Date(correctStartDateTime);
if (isNaN(correctStartDate.getTime())) {
  console.error(`Error: Invalid date/time "${correctStartDateTime}". Use ISO format like "2025-05-19T07:30:00"`);
  process.exit(1);
}

// FIT epoch is Dec 31, 1989 00:00:00 UTC (631065600 seconds after Unix epoch)
const FIT_EPOCH_OFFSET = 631065600;

function dateToFitTimestamp(date) {
  return Math.round(date.getTime() / 1000) - FIT_EPOCH_OFFSET;
}

const correctStartFit = dateToFitTimestamp(correctStartDate);
console.log(`Correct start time: ${correctStartDate.toISOString()} (FIT timestamp: ${correctStartFit})`);

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

if (hasGps) {
  console.log('File already has GPS data. No modification needed.');
  process.exit(0);
}

console.log(`Processing ${records.length} records...`);

// Determine activity distance
const lastDist = records[records.length - 1]?.distance ?? 0;
console.log(`Activity distance: ${(lastDist / 1000).toFixed(2)} km`);

if (lastDist > trackLength) {
  console.warn(`Warning: Activity (${(lastDist / 1000).toFixed(2)} km) is longer than GPX track (${(trackLength / 1000).toFixed(2)} km).`);
  console.warn('Records beyond the track will use the last GPX point.');
}

// Add GPS coordinates to each record
records.forEach((record) => {
  const distMeters = (record.distance != null) ? record.distance : 0;
  const pos = interpolatePosition(track, distMeters);
  record.positionLat = degreesToSemicircles(pos.lat);
  record.positionLong = degreesToSemicircles(pos.lon);
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

// --- Fix timestamps ---
// Find the earliest timestamp in the file to compute the offset
const allRecordTimestamps = records.map(r => r.timestamp).filter(t => t != null);
const eventTimestamps = (messages.eventMesgs || []).map(e => e.timestamp).filter(t => t != null);
const lapTimestamps = laps.map(l => l.timestamp).filter(t => t != null);
const lapStartTimestamps = laps.map(l => l.startTime).filter(t => t != null);
const sessionTimestamps = sessions.map(s => s.timestamp).filter(t => t != null);
const sessionStartTimestamps = sessions.map(s => s.startTime).filter(t => t != null);
const activityTimestamps = (messages.activityMesgs || []).map(a => a.timestamp).filter(t => t != null);

const allTimestampsForMin = [
  ...allRecordTimestamps,
  ...eventTimestamps,
  ...lapTimestamps,
  ...lapStartTimestamps,
  ...sessionTimestamps,
  ...sessionStartTimestamps,
  ...activityTimestamps,
];

if (allTimestampsForMin.length === 0) {
  console.error('Error: No timestamps found in the FIT file.');
  process.exit(1);
}

const oldStartTimestamp = Math.min(...allTimestampsForMin);
const timeOffset = correctStartFit - oldStartTimestamp;

console.log(`Original start FIT timestamp: ${oldStartTimestamp}`);
console.log(`Time offset applied: ${timeOffset} seconds (${(timeOffset / 3600).toFixed(2)} hours)`);

function shiftTimestamp(ts) {
  return ts != null ? ts + timeOffset : ts;
}

// Shift record timestamps
records.forEach(record => {
  record.timestamp = shiftTimestamp(record.timestamp);
});

// Shift event timestamps
(messages.eventMesgs || []).forEach(event => {
  event.timestamp = shiftTimestamp(event.timestamp);
});

// Shift lap timestamps
laps.forEach(lap => {
  lap.timestamp = shiftTimestamp(lap.timestamp);
  lap.startTime = shiftTimestamp(lap.startTime);
});

// Shift session timestamps
sessions.forEach(session => {
  session.timestamp = shiftTimestamp(session.timestamp);
  session.startTime = shiftTimestamp(session.startTime);
});

// Shift activity timestamps
(messages.activityMesgs || []).forEach(activity => {
  activity.timestamp = shiftTimestamp(activity.timestamp);
  activity.localTimestamp = shiftTimestamp(activity.localTimestamp);
});

// Shift device info timestamps
(messages.deviceInfoMesgs || []).forEach(di => {
  di.timestamp = shiftTimestamp(di.timestamp);
});

// Shift fileId timeCreated
(messages.fileIdMesgs || []).forEach(fi => {
  fi.timeCreated = shiftTimestamp(fi.timeCreated);
});

// Shift trainingFile timestamps
(messages.trainingFileMesgs || []).forEach(tf => {
  tf.timestamp = shiftTimestamp(tf.timestamp);
});

console.log(`Timestamps fixed: shifted ${allTimestampsForMin.length} timestamps by ${timeOffset}s`);

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
