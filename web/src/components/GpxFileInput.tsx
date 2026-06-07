import { useTranslation } from 'react-i18next';
import { useAppState } from '../context/AppContext';
import { useGpxFileLoader } from '../hooks/useFileLoader';
import { FileUpload } from './FileUpload';

export function GpxFileInput() {
  const { t } = useTranslation();
  const { gpxFile } = useAppState();
  const loadGpx = useGpxFileLoader();

  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        {t('file.gpx.label')}
      </label>
      <FileUpload accept=".gpx" hint={t('file.gpx.hint')} onFile={loadGpx}>
        {gpxFile ? (
          <div className="text-sm">
            <p className="font-medium text-green-600 dark:text-green-400">
              {t('file.loaded', { name: gpxFile.name })}
            </p>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {t('file.gpx.points', { count: gpxFile.points.length })} &middot;{' '}
              {t('file.gpx.distance', {
                distance: gpxFile.trackDistanceKm.toFixed(2),
              })}
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('file.gpx.hint')}
          </p>
        )}
      </FileUpload>
    </div>
  );
}
