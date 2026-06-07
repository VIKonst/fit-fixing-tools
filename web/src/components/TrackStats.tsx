import { useTranslation } from 'react-i18next';
import type { ProcessingStats } from '../lib/types';

export function TrackStats({ stats }: { stats: ProcessingStats }) {
  const { t } = useTranslation();

  const items = [
    { label: t('stats.records'), value: stats.recordCount.toLocaleString() },
    { label: t('stats.gpxPoints'), value: stats.gpxPointCount.toLocaleString() },
    {
      label: t('stats.activityDistance'),
      value: t('stats.km', { value: stats.activityDistanceKm.toFixed(2) }),
    },
    {
      label: t('stats.gpxTrackDistance'),
      value: t('stats.km', { value: stats.gpxTrackDistanceKm.toFixed(2) }),
    },
    {
      label: t('stats.trackUsed'),
      value: t('stats.km', { value: stats.trackUsedKm.toFixed(2) }),
    },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">{t('stats.title')}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
          >
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {item.label}
            </p>
            <p className="text-lg font-semibold mt-1">{item.value}</p>
          </div>
        ))}
      </div>
      {stats.activityLongerThanTrack && (
        <p className="mt-3 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          {t('stats.warning.longerThanTrack')}
        </p>
      )}
    </div>
  );
}
