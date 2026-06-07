export interface GpxPoint {
  lat: number;
  lon: number;
  ele: number | null;
}

export interface TrackPoint extends GpxPoint {
  cumulDist: number;
}

export interface InterpolatedPosition {
  lat: number;
  lon: number;
  ele: number | null;
}

export interface LatLon {
  lat: number;
  lon: number;
}

export interface ProcessingStats {
  recordCount: number;
  gpxPointCount: number;
  activityDistanceKm: number;
  gpxTrackDistanceKm: number;
  trackUsedKm: number;
  activityLongerThanTrack: boolean;
}

export interface FitProcessingResult {
  fitData: Uint8Array;
  generatedTrack: LatLon[];
  gpxTrack: LatLon[];
  stats: ProcessingStats;
}

export interface WorkerRequest {
  type: 'process';
  fitBuffer: ArrayBuffer;
  gpxText: string;
}

export interface WorkerResponse {
  type: 'result' | 'error';
  result?: FitProcessingResult;
  error?: string;
}
