import { useCallback, useEffect, useRef } from 'react';
import { useAppState, useAppDispatch } from '../context/AppContext';
import type { WorkerResponse } from '../lib/types';

export function useFitProcessor() {
  const { fitFile, gpxFile, processing } = useAppState();
  const dispatch = useAppDispatch();
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL('../worker/fit-worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.type === 'result' && e.data.result) {
        dispatch({ type: 'PROCESSING_COMPLETE', payload: e.data.result });
      } else {
        dispatch({
          type: 'PROCESSING_ERROR',
          payload: e.data.error || 'UNKNOWN_ERROR',
        });
      }
    };

    worker.onerror = () => {
      dispatch({ type: 'PROCESSING_ERROR', payload: 'WORKER_ERROR' });
    };

    workerRef.current = worker;
    return () => worker.terminate();
  }, [dispatch]);

  const process = useCallback(() => {
    if (!fitFile || !gpxFile || !workerRef.current) return;

    dispatch({ type: 'START_PROCESSING' });
    workerRef.current.postMessage(
      { type: 'process', fitBuffer: fitFile.buffer, gpxText: gpxFile.text },
      [fitFile.buffer.slice(0)],
    );
  }, [fitFile, gpxFile, dispatch]);

  const canProcess = fitFile !== null && gpxFile !== null && !processing;

  return { process, canProcess, processing };
}
