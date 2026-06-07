import { Decoder, Encoder, Stream, Profile } from '@garmin/fitsdk';
import type { FitMessages } from '@garmin/fitsdk';
import { degreesToSemicircles, lerp } from './geo';
import {
  MESG_ORDER_BEFORE_TIMESTAMPED,
  MESG_ORDER_AFTER_TIMESTAMPED,
} from './fit-encoder-order';
import type {
  TrackPoint,
  InterpolatedPosition,
  LatLon,
  FitProcessingResult,
  ProcessingStats,
} from './types';

export function decodeFit(buffer: ArrayBuffer): FitMessages {
  const stream = Stream.fromArrayBuffer(buffer);
  const decoder = new Decoder(stream);

  if (!decoder.isFIT()) {
    throw new Error('NOT_VALID_FIT');
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
    throw new Error(`FIT_DECODE_ERRORS: ${errors.join(', ')}`);
  }

  return messages;
}

function interpolatePosition(
  track: TrackPoint[],
  distanceMeters: number,
): InterpolatedPosition {
  if (track.length === 0) {
    return { lat: 0, lon: 0, ele: null };
  }
  if (distanceMeters <= 0) {
    return { lat: track[0].lat, lon: track[0].lon, ele: track[0].ele };
  }

  const totalDist = track[track.length - 1].cumulDist;
  if (distanceMeters >= totalDist) {
    const last = track[track.length - 1];
    return { lat: last.lat, lon: last.lon, ele: last.ele };
  }

  let lo = 0;
  let hi = track.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (track[mid].cumulDist <= distanceMeters) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const segLen = track[hi].cumulDist - track[lo].cumulDist;
  const t = segLen > 0 ? (distanceMeters - track[lo].cumulDist) / segLen : 0;

  const loEle = track[lo].ele;
  const hiEle = track[hi].ele;
  return {
    lat: lerp(track[lo].lat, track[hi].lat, t),
    lon: lerp(track[lo].lon, track[hi].lon, t),
    ele: loEle != null && hiEle != null ? lerp(loEle, hiEle, t) : null,
  };
}

export function injectGpsFromGpx(
  messages: FitMessages,
  track: TrackPoint[],
): { generatedTrack: LatLon[]; stats: ProcessingStats } {
  const records = messages.recordMesgs || [];
  const generatedTrack: LatLon[] = [];

  const lastDist =
    (records[records.length - 1]?.distance as number | undefined) ?? 0;
  const trackLength = track[track.length - 1]?.cumulDist ?? 0;

  records.forEach((record, idx) => {
    const distMeters = (record.distance as number | undefined) ?? 0;
    const pos = interpolatePosition(track, distMeters);
    const latSemi = degreesToSemicircles(pos.lat);
    const lonSemi = degreesToSemicircles(pos.lon);

    generatedTrack.push({ lat: pos.lat, lon: pos.lon });

    if (record.positionLat != null) {
      record.positionLat = latSemi;
      record.positionLong = lonSemi;
    } else {
      // Property insertion order matters for the FIT encoder's binary layout.
      // positionLat/Long must appear before distance in Object.keys() order.
      const newRecord: Record<string, unknown> = {};
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

  const sessions = messages.sessionMesgs || [];
  if (sessions.length > 0 && records.length > 0) {
    const startPos = interpolatePosition(track, 0);
    const endPos = interpolatePosition(track, lastDist);

    sessions.forEach((session) => {
      session.startPositionLat = degreesToSemicircles(startPos.lat);
      session.startPositionLong = degreesToSemicircles(startPos.lon);
      session.endPositionLat = degreesToSemicircles(endPos.lat);
      session.endPositionLong = degreesToSemicircles(endPos.lon);
    });
  }

  const laps = messages.lapMesgs || [];
  let lapRecordIdx = 0;
  laps.forEach((lap) => {
    const startDist =
      (records[lapRecordIdx]?.distance as number | undefined) ?? 0;
    const startPos = interpolatePosition(track, startDist);
    lap.startPositionLat = degreesToSemicircles(startPos.lat);
    lap.startPositionLong = degreesToSemicircles(startPos.lon);

    const lapEnd = lap.timestamp as number;
    while (
      lapRecordIdx < records.length - 1 &&
      (records[lapRecordIdx].timestamp as number) <= lapEnd
    ) {
      lapRecordIdx++;
    }
    const endDist =
      (records[Math.max(0, lapRecordIdx - 1)]?.distance as
        | number
        | undefined) ?? 0;
    const endPos = interpolatePosition(track, endDist);
    lap.endPositionLat = degreesToSemicircles(endPos.lat);
    lap.endPositionLong = degreesToSemicircles(endPos.lon);
  });

  const stats: ProcessingStats = {
    recordCount: records.length,
    gpxPointCount: track.length,
    activityDistanceKm: lastDist / 1000,
    gpxTrackDistanceKm: trackLength / 1000,
    trackUsedKm: Math.min(lastDist, trackLength) / 1000,
    activityLongerThanTrack: lastDist > trackLength,
  };

  return { generatedTrack, stats };
}

export function encodeFit(messages: FitMessages): Uint8Array {
  const encoder = new Encoder();

  for (const { key, mesgNum } of MESG_ORDER_BEFORE_TIMESTAMPED) {
    const mesgs = messages[key];
    if (mesgs) {
      mesgs.forEach((m) => encoder.onMesg(mesgNum, m));
    }
  }

  const events = messages.eventMesgs || [];
  const records = messages.recordMesgs || [];
  const allTimestamped = [
    ...events.map((m) => ({ type: 'event' as const, msg: m })),
    ...records.map((m) => ({ type: 'record' as const, msg: m })),
  ];
  allTimestamped.sort(
    (a, b) =>
      ((a.msg.timestamp as number) || 0) - ((b.msg.timestamp as number) || 0),
  );

  allTimestamped.forEach(({ type, msg }) => {
    encoder.onMesg(
      type === 'event' ? Profile.MesgNum.EVENT : Profile.MesgNum.RECORD,
      msg,
    );
  });

  for (const { key, mesgNum } of MESG_ORDER_AFTER_TIMESTAMPED) {
    const mesgs = messages[key];
    if (mesgs) {
      mesgs.forEach((m) => encoder.onMesg(mesgNum, m));
    }
  }

  return encoder.close();
}

export function processFitWithGpx(
  fitBuffer: ArrayBuffer,
  gpxTrack: TrackPoint[],
): FitProcessingResult {
  const messages = decodeFit(fitBuffer);
  const { generatedTrack, stats } = injectGpsFromGpx(messages, gpxTrack);
  const fitData = encodeFit(messages);

  const gpxLatLon: LatLon[] = gpxTrack.map((p) => ({
    lat: p.lat,
    lon: p.lon,
  }));

  return { fitData, generatedTrack, gpxTrack: gpxLatLon, stats };
}
