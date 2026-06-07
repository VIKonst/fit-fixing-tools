import { useCallback } from 'react';
import { useAppDispatch } from '../context/AppContext';
import { parseGpx, buildTrackWithDistances } from '../lib/gpx-parser';
import { Decoder, Stream } from '@garmin/fitsdk';

export function useFitFileLoader() {
  const dispatch = useAppDispatch();

  return useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const buffer = reader.result as ArrayBuffer;
        const stream = Stream.fromArrayBuffer(buffer);
        const decoder = new Decoder(stream);

        if (!decoder.isFIT()) {
          dispatch({ type: 'PROCESSING_ERROR', payload: 'NOT_VALID_FIT' });
          return;
        }

        dispatch({
          type: 'SET_FIT_FILE',
          payload: { name: file.name, buffer },
        });
      };
      reader.readAsArrayBuffer(file);
    },
    [dispatch],
  );
}

export function useGpxFileLoader() {
  const dispatch = useAppDispatch();

  return useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const points = parseGpx(text);

        if (points.length < 2) {
          dispatch({ type: 'PROCESSING_ERROR', payload: 'GPX_TOO_FEW_POINTS' });
          return;
        }

        const track = buildTrackWithDistances(points);
        const trackDistanceKm = track[track.length - 1].cumulDist / 1000;

        dispatch({
          type: 'SET_GPX_FILE',
          payload: { name: file.name, text, points, trackDistanceKm },
        });
      };
      reader.readAsText(file);
    },
    [dispatch],
  );
}
