import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
  type Dispatch,
} from 'react';
import type { GpxPoint, FitProcessingResult } from '../lib/types';

interface AppState {
  fitFile: { name: string; buffer: ArrayBuffer } | null;
  gpxFile: {
    name: string;
    text: string;
    points: GpxPoint[];
    trackDistanceKm: number;
  } | null;
  processing: boolean;
  result: FitProcessingResult | null;
  error: string | null;
}

type AppAction =
  | {
      type: 'SET_FIT_FILE';
      payload: { name: string; buffer: ArrayBuffer };
    }
  | {
      type: 'SET_GPX_FILE';
      payload: {
        name: string;
        text: string;
        points: GpxPoint[];
        trackDistanceKm: number;
      };
    }
  | { type: 'START_PROCESSING' }
  | { type: 'PROCESSING_COMPLETE'; payload: FitProcessingResult }
  | { type: 'PROCESSING_ERROR'; payload: string }
  | { type: 'RESET' };

const initialState: AppState = {
  fitFile: null,
  gpxFile: null,
  processing: false,
  result: null,
  error: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_FIT_FILE':
      return {
        ...state,
        fitFile: action.payload,
        result: null,
        error: null,
      };
    case 'SET_GPX_FILE':
      return {
        ...state,
        gpxFile: action.payload,
        result: null,
        error: null,
      };
    case 'START_PROCESSING':
      return { ...state, processing: true, result: null, error: null };
    case 'PROCESSING_COMPLETE':
      return { ...state, processing: false, result: action.payload };
    case 'PROCESSING_ERROR':
      return { ...state, processing: false, error: action.payload };
    case 'RESET':
      return initialState;
  }
}

const AppContext = createContext<AppState>(initialState);
const AppDispatchContext = createContext<Dispatch<AppAction>>(() => {});

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return (
    <AppContext value={state}>
      <AppDispatchContext value={dispatch}>{children}</AppDispatchContext>
    </AppContext>
  );
}

export function useAppState() {
  return useContext(AppContext);
}

export function useAppDispatch() {
  return useContext(AppDispatchContext);
}
