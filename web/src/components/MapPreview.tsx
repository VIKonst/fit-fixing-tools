import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import type { LatLngBoundsExpression, LatLngTuple } from 'leaflet';
import type { LatLon } from '../lib/types';

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  useMemo(() => {
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [map, bounds]);
  return null;
}

interface MapPreviewProps {
  gpxTrack: LatLon[];
  generatedTrack: LatLon[];
}

export function MapPreview({ gpxTrack, generatedTrack }: MapPreviewProps) {
  const { t } = useTranslation();
  const [showGpx, setShowGpx] = useState(true);
  const [showGenerated, setShowGenerated] = useState(true);

  const gpxPositions: LatLngTuple[] = useMemo(
    () => gpxTrack.map((p) => [p.lat, p.lon]),
    [gpxTrack],
  );

  const genPositions: LatLngTuple[] = useMemo(
    () => generatedTrack.map((p) => [p.lat, p.lon]),
    [generatedTrack],
  );

  const bounds = useMemo((): LatLngBoundsExpression => {
    const all = [...gpxPositions, ...genPositions];
    if (all.length === 0) return [[0, 0], [0, 0]];
    const lats = all.map((p) => p[0]);
    const lons = all.map((p) => p[1]);
    return [
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)],
    ];
  }, [gpxPositions, genPositions]);

  const center = useMemo((): LatLngTuple => {
    if (gpxPositions.length === 0) return [0, 0];
    const lats = gpxPositions.map((p) => p[0]);
    const lons = gpxPositions.map((p) => p[1]);
    return [
      (Math.min(...lats) + Math.max(...lats)) / 2,
      (Math.min(...lons) + Math.max(...lons)) / 2,
    ];
  }, [gpxPositions]);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">{t('map.title')}</h2>
      <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <MapContainer
          center={center}
          zoom={13}
          className="h-64 md:h-96 w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {showGpx && (
            <Polyline
              positions={gpxPositions}
              pathOptions={{
                color: '#3b82f6',
                weight: 4,
                opacity: 0.7,
                dashArray: '10, 8',
              }}
            />
          )}
          {showGenerated && (
            <Polyline
              positions={genPositions}
              pathOptions={{
                color: '#ef4444',
                weight: 3,
                opacity: 0.9,
              }}
            />
          )}
          <FitBounds bounds={bounds} />
        </MapContainer>
      </div>
      <div className="flex gap-4 mt-2 text-sm">
        <button
          onClick={() => setShowGpx((v) => !v)}
          className={`flex items-center gap-2 px-2 py-1 rounded transition-opacity ${showGpx ? 'opacity-100' : 'opacity-40'}`}
        >
          <span className="w-6 inline-block border-t-2 border-dashed border-blue-500" />
          <span className="text-gray-600 dark:text-gray-400">
            {t('map.legend.gpx')}
          </span>
        </button>
        <button
          onClick={() => setShowGenerated((v) => !v)}
          className={`flex items-center gap-2 px-2 py-1 rounded transition-opacity ${showGenerated ? 'opacity-100' : 'opacity-40'}`}
        >
          <span className="w-6 inline-block border-t-2 border-red-500" />
          <span className="text-gray-600 dark:text-gray-400">
            {t('map.legend.generated')}
          </span>
        </button>
      </div>
    </div>
  );
}
