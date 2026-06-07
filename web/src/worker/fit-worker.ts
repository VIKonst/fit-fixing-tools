import { parseGpx, buildTrackWithDistances } from '../lib/gpx-parser';
import { processFitWithGpx } from '../lib/fit-processor';
import type { WorkerRequest, WorkerResponse } from '../lib/types';

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  try {
    const { fitBuffer, gpxText } = e.data;

    const gpxPoints = parseGpx(gpxText);
    if (gpxPoints.length < 2) {
      throw new Error('GPX_TOO_FEW_POINTS');
    }

    const track = buildTrackWithDistances(gpxPoints);
    const result = processFitWithGpx(fitBuffer, track);

    self.postMessage(
      { type: 'result', result } satisfies WorkerResponse,
    );
  } catch (err) {
    self.postMessage({
      type: 'error',
      error: err instanceof Error ? err.message : String(err),
    } satisfies WorkerResponse);
  }
};
