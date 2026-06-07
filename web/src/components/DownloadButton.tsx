import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '../context/AppContext';

export function DownloadButton() {
  const { t } = useTranslation();
  const { fitFile, result } = useAppState();

  const handleDownload = useCallback(() => {
    if (!result || !fitFile) return;
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(result.fitData)], {
        type: 'application/octet-stream',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = fitFile.name.replace(/\.fit$/i, '_with_gps.fit');
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, [result, fitFile]);

  if (!result || !fitFile) return null;

  return (
    <button
      onClick={handleDownload}
      className="inline-flex items-center justify-center w-full md:w-auto px-6 py-3 min-h-[44px]
        bg-green-600 text-white rounded-lg font-medium
        hover:bg-green-700 transition-colors cursor-pointer"
    >
      {t('download.button')}
    </button>
  );
}
