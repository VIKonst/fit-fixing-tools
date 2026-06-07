import { useTranslation } from 'react-i18next';
import { useAppState } from '../context/AppContext';
import { useFitFileLoader } from '../hooks/useFileLoader';
import { FileUpload } from './FileUpload';

export function FitFileInput() {
  const { t } = useTranslation();
  const { fitFile } = useAppState();
  const loadFit = useFitFileLoader();

  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        {t('file.fit.label')}
      </label>
      <FileUpload accept=".fit" hint={t('file.fit.hint')} onFile={loadFit}>
        {fitFile ? (
          <div className="text-sm">
            <p className="font-medium text-green-600 dark:text-green-400">
              {t('file.loaded', { name: fitFile.name })}
            </p>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {t('file.size', {
                size: (fitFile.buffer.byteLength / 1024).toFixed(1),
              })}
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('file.fit.hint')}
          </p>
        )}
      </FileUpload>
    </div>
  );
}
