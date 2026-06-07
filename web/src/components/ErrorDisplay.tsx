import { useTranslation } from 'react-i18next';
import { useAppState } from '../context/AppContext';

export function ErrorDisplay() {
  const { t } = useTranslation();
  const { error } = useAppState();

  if (!error) return null;

  const errorKey = `error.${error}`;
  const message = t(errorKey, { defaultValue: error });

  return (
    <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p className="text-sm text-red-700 dark:text-red-400">{message}</p>
    </div>
  );
}
