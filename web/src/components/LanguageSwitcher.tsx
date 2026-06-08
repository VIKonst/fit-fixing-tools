import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const handleChange = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('lang', lang);
  };

  return (
    <div className="flex gap-1">
      <button
        onClick={() => handleChange('en')}
        className={`px-3 py-1.5 rounded text-sm font-medium min-h-[44px] min-w-[44px] cursor-pointer transition-colors ${
          i18n.language === 'en'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
        }`}
      >
        {t('lang.en')}
      </button>
      <button
        onClick={() => handleChange('uk')}
        className={`px-3 py-1.5 rounded text-sm font-medium min-h-[44px] min-w-[44px] cursor-pointer transition-colors ${
          i18n.language === 'uk'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
        }`}
      >
        {t('lang.uk')}
      </button>
    </div>
  );
}
