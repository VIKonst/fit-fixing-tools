/**
 * add-gps.mjs
 * 
 * Adds GPS coordinates to a FIT activity file that lacks them.
 * Preserves all existing data (time, pace, heart rate, cadence, power, etc.)
 * 
 * Usage: node add-gps.mjs <input.fit> [output.fit]
 *   If output is omitted, writes to <input>_with_gps.fit
 * 
 * The script generates a short straight-line GPS track starting from a
 * configurable origin, distributing points based on recorded distance.
 */

import fs from 'fs';
import path from 'path';
import { Decoder, Encoder, Stream, Profile } from '@garmin/fitsdk';

// --- Configuration ---
// Starting coordinates (default: central park, NYC)
const START_LAT = 50.0044961;
const START_LONG = 36.2357333;
// Bearing in degrees (0=north, 90=east, etc.)
const BEARING_DEG = 45;

// --- Helpers ---
function degreesToSemicircles(deg) {
  return Math.round(deg * (2 ** 31 / 180));
}

function toRadians(deg) {
  return deg * Math.PI / 180;
}

/**
 * Given a start point, distance (m), and bearing (deg), returns destination coords.
 * Uses simplified flat-earth approximation (good enough for <20km).
 */
function offsetPosition(lat, lon, distanceMeters, bearingDeg) {
  const bearingRad = toRadians(bearingDeg);
  const dLat = (distanceMeters * Math.cos(bearingRad)) / 111320;
  const dLon = (distanceMeters * Math.sin(bearingRad)) / (111320 * Math.cos(toRadians(lat)));
  return { lat: lat + dLat, lon: lon + dLon };
}

// --- Main ---
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node add-gps.mjs <input.fit> [output.fit]');
  process.exit(1);
}

const inputPath = args[0];
const outputPath = args[1] || inputPath.replace(/\.fit$/i, '_with_gps.fit');

// Read and decode
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

// Add GPS coordinates to each record based on distance field
records.forEach((record) => {
  // With applyScaleAndOffset: true, distance is already in meters
  const distMeters = (record.distance != null) ? record.distance : 0;
  const pos = offsetPosition(START_LAT, START_LONG, distMeters, BEARING_DEG);
  record.positionLat = degreesToSemicircles(pos.lat);
  record.positionLong = degreesToSemicircles(pos.lon);
});

// Update session start/end positions
const sessions = messages.sessionMesgs || [];
if (sessions.length > 0 && records.length > 0) {
  const firstPos = offsetPosition(START_LAT, START_LONG, 0, BEARING_DEG);
  const lastRecord = records[records.length - 1];
  const lastDist = (lastRecord.distance != null) ? lastRecord.distance : 0;
  const lastPos = offsetPosition(START_LAT, START_LONG, lastDist, BEARING_DEG);

  sessions.forEach(session => {
    session.startPositionLat = degreesToSemicircles(firstPos.lat);
    session.startPositionLong = degreesToSemicircles(firstPos.lon);
    session.endPositionLat = degreesToSemicircles(lastPos.lat);
    session.endPositionLong = degreesToSemicircles(lastPos.lon);
  });
}

// Update lap start/end positions
const laps = messages.lapMesgs || [];
let lapRecordIdx = 0;
laps.forEach(lap => {
  // Use first record distance for start, approximate end
  const startDist = records[lapRecordIdx]?.distance ?? 0;
  const startPos = offsetPosition(START_LAT, START_LONG, startDist, BEARING_DEG);
  lap.startPositionLat = degreesToSemicircles(startPos.lat);
  lap.startPositionLong = degreesToSemicircles(startPos.lon);

  // Find the end of this lap by timestamp
  const lapEnd = lap.timestamp;
  while (lapRecordIdx < records.length - 1 && records[lapRecordIdx].timestamp <= lapEnd) {
    lapRecordIdx++;
  }
  const endDist = records[Math.max(0, lapRecordIdx - 1)]?.distance ?? 0;
  const endPos = offsetPosition(START_LAT, START_LONG, endDist, BEARING_DEG);
  lap.endPositionLat = degreesToSemicircles(endPos.lat);
  lap.endPositionLong = degreesToSemicircles(endPos.lon);
});

// Encode the modified data back to FIT
const encoder = new Encoder();

// Write messages in the correct order
// file_id must be first
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

// Laps, sessions, activity (order matters for Garmin Connect)
laps.forEach(m => encoder.onMesg(Profile.MesgNum.LAP, m));
sessions.forEach(m => encoder.onMesg(Profile.MesgNum.SESSION, m));
messages.activityMesgs?.forEach(m => encoder.onMesg(Profile.MesgNum.ACTIVITY, m));

// Write to file
const outputBuffer = encoder.close();
fs.writeFileSync(outputPath, outputBuffer);

console.log(`Done! GPS data added to ${records.length} records.`);
console.log(`Output: ${outputPath}`);
console.log(`Track: straight line from (${START_LAT}, ${START_LONG}) bearing ${BEARING_DEG}°`);
