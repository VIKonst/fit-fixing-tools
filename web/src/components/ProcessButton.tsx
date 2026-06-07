import { useTranslation } from 'react-i18next';
import { useFitProcessor } from '../hooks/useFitProcessor';

export function ProcessButton() {
  const { t } = useTranslation();
  const { process, canProcess, processing } = useFitProcessor();

  return (
    <button
      onClick={process}
      disabled={!canProcess}
      className="w-full md:w-auto px-6 py-3 min-h-[44px] bg-blue-600 text-white rounded-lg font-medium
        hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500
        dark:disabled:bg-gray-700 dark:disabled:text-gray-500
        transition-colors cursor-pointer disabled:cursor-not-allowed"
    >
      {processing ? (
        <span className="flex items-center justify-center gap-2">
          <svg
            className="animate-spin h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          {t('process.processing')}
        </span>
      ) : (
        t('process.button')
      )}
    </button>
  );
}
