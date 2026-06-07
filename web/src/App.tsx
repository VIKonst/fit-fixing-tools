import { useTranslation } from 'react-i18next';
import { AppProvider, useAppState, useAppDispatch } from './context/AppContext';
import { Layout } from './components/Layout';
import { FitFileInput } from './components/FitFileInput';
import { GpxFileInput } from './components/GpxFileInput';
import { ProcessButton } from './components/ProcessButton';
import { MapPreview } from './components/MapPreview';
import { TrackStats } from './components/TrackStats';
import { DownloadButton } from './components/DownloadButton';
import { ErrorDisplay } from './components/ErrorDisplay';

function AppContent() {
  const { t } = useTranslation();
  const { result } = useAppState();
  const dispatch = useAppDispatch();

  return (
    <Layout>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FitFileInput />
        <GpxFileInput />
      </div>

      <ErrorDisplay />

      <div className="flex flex-col md:flex-row gap-3">
        <ProcessButton />
        {result && (
          <button
            onClick={() => dispatch({ type: 'RESET' })}
            className="px-6 py-3 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-lg
              text-gray-700 dark:text-gray-300 font-medium
              hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            {t('reset.button')}
          </button>
        )}
      </div>

      {result && (
        <div className="space-y-6">
          <MapPreview
            gpxTrack={result.gpxTrack}
            generatedTrack={result.generatedTrack}
          />
          <TrackStats stats={result.stats} />
          <DownloadButton />
        </div>
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
