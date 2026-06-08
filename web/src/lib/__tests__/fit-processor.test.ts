import { vi, describe, it, expect, beforeEach } from 'vitest';

// vi.mock is hoisted — this mock is applied before any imports below
vi.mock('@garmin/fitsdk', () => ({
  Decoder: vi.fn(),
  Encoder: vi.fn(),
  Stream: { fromArrayBuffer: vi.fn() },
  Profile: {
    MesgNum: {
      FILE_ID: 0,
      FILE_CREATOR: 49,
      DEVICE_SETTINGS: 2,
      USER_PROFILE: 3,
      SPORT: 12,
      ZONES_TARGET: 7,
      TRAINING_SETTINGS: 17,
      TRAINING_FILE: 72,
      WORKOUT: 26,
      WORKOUT_STEP: 27,
      DEVICE_INFO: 23,
      EVENT: 21,
      RECORD: 20,
      LAP: 19,
      SESSION: 18,
      ACTIVITY: 34,
    },
  },
}));

import { Decoder, Encoder, Stream } from '@garmin/fitsdk';
import { decodeFit, encodeFit, injectGpsFromGpx } from '../fit-processor';
import { degreesToSemicircles } from '../geo';
import type { TrackPoint } from '../types';

// Helpers to cast mocked constructors to vi.fn types
const MockDecoder = vi.mocked(Decoder);
const MockEncoder = vi.mocked(Encoder);
const mockFromArrayBuffer = Stream.fromArrayBuffer as ReturnType<typeof vi.fn>;

// A simple 3-point track spanning 0–1000 m (cumulDist set manually)
const track: TrackPoint[] = [
  { lat: 48.0, lon: 24.0, ele: 100, cumulDist: 0 },
  { lat: 48.1, lon: 24.0, ele: 150, cumulDist: 500 },
  { lat: 48.2, lon: 24.0, ele: 200, cumulDist: 1000 },
];

// ─── injectGpsFromGpx ────────────────────────────────────────────────────────

describe('injectGpsFromGpx — record GPS injection', () => {
  it('updates positionLat/Long in-place when a record already has them', () => {
    const record = { positionLat: 1, positionLong: 2, distance: 0 };
    injectGpsFromGpx({ recordMesgs: [record] } as any, track);
    expect(record.positionLat).toBe(degreesToSemicircles(48.0));
    expect(record.positionLong).toBe(degreesToSemicircles(24.0));
  });

  it('inserts positionLat/Long before distance when a record lacks them', () => {
    const messages = { recordMesgs: [{ timestamp: 100, distance: 500, heartRate: 120 }] } as any;
    injectGpsFromGpx(messages, track);
    const keys = Object.keys(messages.recordMesgs[0]);
    expect(keys.indexOf('positionLat')).toBeLessThan(keys.indexOf('distance'));
    expect(keys.indexOf('positionLong')).toBeLessThan(keys.indexOf('distance'));
  });

  it('preserves all original fields on a reconstructed record', () => {
    const messages = { recordMesgs: [{ timestamp: 100, distance: 500, heartRate: 120 }] } as any;
    injectGpsFromGpx(messages, track);
    const r = messages.recordMesgs[0];
    expect(r.timestamp).toBe(100);
    expect(r.distance).toBe(500);
    expect(r.heartRate).toBe(120);
  });

  it('appends positionLat/Long at the end when the record has no distance field', () => {
    const messages = { recordMesgs: [{ timestamp: 100 }] } as any;
    injectGpsFromGpx(messages, track);
    const r = messages.recordMesgs[0];
    expect(r.positionLat).toBeDefined();
    expect(r.positionLong).toBeDefined();
  });
});

describe('injectGpsFromGpx — interpolation boundary conditions', () => {
  it('assigns first track point when distance=0', () => {
    const messages = { recordMesgs: [{ distance: 0 }] } as any;
    injectGpsFromGpx(messages, track);
    const r = messages.recordMesgs[0] as any;
    expect(r.positionLat).toBe(degreesToSemicircles(48.0));
    expect(r.positionLong).toBe(degreesToSemicircles(24.0));
  });

  it('clamps to last track point when distance exceeds track length', () => {
    const messages = { recordMesgs: [{ distance: 9999 }] } as any;
    injectGpsFromGpx(messages, track);
    const r = messages.recordMesgs[0] as any;
    expect(r.positionLat).toBe(degreesToSemicircles(48.2));
    expect(r.positionLong).toBe(degreesToSemicircles(24.0));
  });

  it('linearly interpolates between track points at a midpoint distance', () => {
    // distance=750 → halfway between track[1] (500 m) and track[2] (1000 m)
    // t = (750-500)/(1000-500) = 0.5
    // lat = lerp(48.1, 48.2, 0.5) = 48.15
    const messages = { recordMesgs: [{ distance: 750 }] } as any;
    injectGpsFromGpx(messages, track);
    const r = messages.recordMesgs[0] as any;
    expect(r.positionLat).toBe(degreesToSemicircles(48.15));
  });

  it('assigns lat=0, lon=0 (0 semicircles) when the track is empty', () => {
    const messages = { recordMesgs: [{ distance: 500 }] } as any;
    injectGpsFromGpx(messages, []);
    const r = messages.recordMesgs[0] as any;
    expect(r.positionLat).toBe(0);
    expect(r.positionLong).toBe(0);
  });
});

describe('injectGpsFromGpx — generatedTrack', () => {
  it('has the same length as recordMesgs', () => {
    const messages = {
      recordMesgs: [{ distance: 0 }, { distance: 500 }, { distance: 1000 }],
    } as any;
    const { generatedTrack } = injectGpsFromGpx(messages, track);
    expect(generatedTrack).toHaveLength(3);
  });

  it('contains degree values (not semicircles)', () => {
    const messages = { recordMesgs: [{ distance: 0 }, { distance: 1000 }] } as any;
    const { generatedTrack } = injectGpsFromGpx(messages, track);
    expect(generatedTrack[0].lat).toBeCloseTo(48.0, 5);
    expect(generatedTrack[1].lat).toBeCloseTo(48.2, 5);
  });
});

describe('injectGpsFromGpx — session positions', () => {
  it('sets session start and end positions', () => {
    const session = {} as any;
    const messages = {
      recordMesgs: [{ distance: 0 }, { distance: 1000 }],
      sessionMesgs: [session],
    } as any;
    injectGpsFromGpx(messages, track);
    expect(session.startPositionLat).toBe(degreesToSemicircles(48.0));
    expect(session.startPositionLong).toBe(degreesToSemicircles(24.0));
    expect(session.endPositionLat).toBe(degreesToSemicircles(48.2));
    expect(session.endPositionLong).toBe(degreesToSemicircles(24.0));
  });

  it('does not throw when sessionMesgs is absent', () => {
    expect(() =>
      injectGpsFromGpx({ recordMesgs: [{ distance: 0 }] } as any, track),
    ).not.toThrow();
  });
});

describe('injectGpsFromGpx — lap positions', () => {
  it('sets lap start and end positions based on timestamp boundary', () => {
    // records: @100=0m, @200=500m, @300=1000m; lap ends at timestamp=200
    // start = records[0].distance = 0 → track[0] = (48.0, 24.0)
    // loop advances lapRecordIdx past records with timestamp ≤ 200 → idx=2
    // end = records[idx-1].distance = records[1].distance = 500
    //   distance=500 → exactly track[1] = (48.1, 24.0)
    const lap = { timestamp: 200 } as any;
    const messages = {
      recordMesgs: [
        { timestamp: 100, distance: 0 },
        { timestamp: 200, distance: 500 },
        { timestamp: 300, distance: 1000 },
      ],
      lapMesgs: [lap],
    } as any;
    injectGpsFromGpx(messages, track);
    expect(lap.startPositionLat).toBe(degreesToSemicircles(48.0));
    expect(lap.endPositionLat).toBe(degreesToSemicircles(48.1));
  });

  it('does not throw when lapMesgs is absent', () => {
    expect(() =>
      injectGpsFromGpx({ recordMesgs: [{ distance: 0 }] } as any, track),
    ).not.toThrow();
  });
});

describe('injectGpsFromGpx — stats', () => {
  it('returns correct recordCount and gpxPointCount', () => {
    const messages = {
      recordMesgs: [{ distance: 0 }, { distance: 500 }, { distance: 800 }],
    } as any;
    const { stats } = injectGpsFromGpx(messages, track);
    expect(stats.recordCount).toBe(3);
    expect(stats.gpxPointCount).toBe(3);
  });

  it('returns distances in km', () => {
    const messages = {
      recordMesgs: [{ distance: 0 }, { distance: 800 }],
    } as any;
    const { stats } = injectGpsFromGpx(messages, track);
    expect(stats.activityDistanceKm).toBeCloseTo(0.8, 5);
    expect(stats.gpxTrackDistanceKm).toBeCloseTo(1.0, 5);
    expect(stats.trackUsedKm).toBeCloseTo(0.8, 5);
  });

  it('sets activityLongerThanTrack=false when activity fits within the track', () => {
    const messages = { recordMesgs: [{ distance: 0 }, { distance: 800 }] } as any;
    const { stats } = injectGpsFromGpx(messages, track);
    expect(stats.activityLongerThanTrack).toBe(false);
  });

  it('sets activityLongerThanTrack=true when activity exceeds the track', () => {
    const messages = { recordMesgs: [{ distance: 0 }, { distance: 2000 }] } as any;
    const { stats } = injectGpsFromGpx(messages, track);
    expect(stats.activityLongerThanTrack).toBe(true);
    expect(stats.trackUsedKm).toBeCloseTo(1.0, 5); // clamped to track length
  });
});

// ─── decodeFit ───────────────────────────────────────────────────────────────

describe('decodeFit', () => {
  beforeEach(() => {
    mockFromArrayBuffer.mockReturnValue({});
  });

  it('returns messages on success', () => {
    const fakeMessages = { recordMesgs: [{ distance: 0 }] };
    MockDecoder.mockImplementation(function () {
      return { isFIT: () => true, read: () => ({ messages: fakeMessages, errors: [] }) };
    } as any);
    expect(decodeFit(new ArrayBuffer(8))).toBe(fakeMessages);
  });

  it('throws NOT_VALID_FIT when isFIT() returns false', () => {
    MockDecoder.mockImplementation(function () {
      return { isFIT: () => false, read: vi.fn() };
    } as any);
    expect(() => decodeFit(new ArrayBuffer(8))).toThrow('NOT_VALID_FIT');
  });

  it('throws FIT_DECODE_ERRORS when errors are present', () => {
    MockDecoder.mockImplementation(function () {
      return {
        isFIT: () => true,
        read: () => ({ messages: {}, errors: ['bad header', 'crc mismatch'] }),
      };
    } as any);
    expect(() => decodeFit(new ArrayBuffer(8))).toThrow('FIT_DECODE_ERRORS');
  });
});

// ─── encodeFit ───────────────────────────────────────────────────────────────

describe('encodeFit', () => {
  let onMesg: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onMesg = vi.fn();
    close = vi.fn().mockReturnValue(new Uint8Array([1, 2, 3]));
    MockEncoder.mockImplementation(function () {
      return { onMesg, close };
    } as any);
  });

  it('returns the Uint8Array produced by encoder.close()', () => {
    const result = encodeFit({ recordMesgs: [{ timestamp: 100 }] } as any);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result[0]).toBe(1);
  });

  it('interleaves events and records sorted by timestamp', () => {
    // events: @200; records: @300, @100 (out of order on purpose)
    const messages = {
      recordMesgs: [{ timestamp: 300 }, { timestamp: 100 }],
      eventMesgs: [{ timestamp: 200 }],
    } as any;
    encodeFit(messages);

    // Extract only the timestamped calls (no before/after groups present)
    const calls = onMesg.mock.calls;
    expect(calls).toHaveLength(3);
    // Expected order after sort: record@100 (20), event@200 (21), record@300 (20)
    expect(calls[0][0]).toBe(20); // RECORD
    expect(calls[0][1]).toMatchObject({ timestamp: 100 });
    expect(calls[1][0]).toBe(21); // EVENT
    expect(calls[1][1]).toMatchObject({ timestamp: 200 });
    expect(calls[2][0]).toBe(20); // RECORD
    expect(calls[2][1]).toMatchObject({ timestamp: 300 });
  });

  it('writes before-timestamped groups before records', () => {
    const fileId = { manufacturer: 1 };
    const messages = {
      fileIdMesgs: [fileId],
      recordMesgs: [{ timestamp: 100 }],
    } as any;
    encodeFit(messages);

    const calls = onMesg.mock.calls;
    // FILE_ID (mesgNum=0) must come before RECORD (mesgNum=20)
    const fileIdIdx = calls.findIndex((c) => c[0] === 0);
    const recordIdx = calls.findIndex((c) => c[0] === 20);
    expect(fileIdIdx).toBeLessThan(recordIdx);
    expect(calls[fileIdIdx][1]).toBe(fileId);
  });

  it('writes after-timestamped groups after records', () => {
    const lap = { totalDistance: 5000 };
    const messages = {
      recordMesgs: [{ timestamp: 100 }],
      lapMesgs: [lap],
    } as any;
    encodeFit(messages);

    const calls = onMesg.mock.calls;
    const recordIdx = calls.findIndex((c) => c[0] === 20);
    const lapIdx = calls.findIndex((c) => c[0] === 19); // LAP
    expect(lapIdx).toBeGreaterThan(recordIdx);
    expect(calls[lapIdx][1]).toBe(lap);
  });

  it('skips message groups that are absent from the messages object', () => {
    encodeFit({ recordMesgs: [{ timestamp: 100 }] } as any);
    // Only 1 call: the single record. No file_id, no lap, etc.
    expect(onMesg).toHaveBeenCalledTimes(1);
  });
});
