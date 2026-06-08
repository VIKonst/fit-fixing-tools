import { useState } from 'react';
import { useTranslation } from 'react-i18next';

function StepBadge({ n }: { n: number }) {
  return (
    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
      {n}
    </span>
  );
}

function SubStep({ text }: { text: string }) {
  return (
    <li className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
      <span className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
      {text}
    </li>
  );
}

function Note({ text }: { text: string }) {
  return (
    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded px-3 py-2">
      {text}
    </p>
  );
}

function PlatformBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
        {label}
      </span>
      <ul className="mt-1 space-y-1">{children}</ul>
    </div>
  );
}

export function HowToUse() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const steps = [
    {
      title: t('guide.step1.title'),
      content: (
        <>
          <ul className="mt-2 space-y-1">
            <SubStep text={t('guide.step1.step1')} />
            <SubStep text={t('guide.step1.step2')} />
            <SubStep text={t('guide.step1.step3')} />
            <SubStep text={t('guide.step1.step4')} />
          </ul>
          <Note text={t('guide.step1.note')} />
        </>
      ),
    },
    {
      title: t('guide.step2.title'),
      content: (
        <>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{t('guide.step2.intro')}</p>
          <PlatformBlock label={t('guide.step2.strava.label')}>
            <SubStep text={t('guide.step2.strava1')} />
            <SubStep text={t('guide.step2.strava2')} />
          </PlatformBlock>
          <PlatformBlock label={t('guide.step2.garmin.label')}>
            <SubStep text={t('guide.step2.garmin1')} />
            <SubStep text={t('guide.step2.garmin2')} />
          </PlatformBlock>
          <Note text={t('guide.step2.other')} />
        </>
      ),
    },
    {
      title: t('guide.step3.title'),
      content: (
        <>
          <ul className="mt-2 space-y-1">
            <SubStep text={t('guide.step3.step1')} />
            <SubStep text={t('guide.step3.step2')} />
            <SubStep text={t('guide.step3.step3')} />
            <SubStep text={t('guide.step3.step4')} />
            <SubStep text={t('guide.step3.step5')} />
          </ul>
          <Note text={t('guide.step3.note')} />
        </>
      ),
    },
    {
      title: t('guide.step4.title'),
      content: (
        <>
          <PlatformBlock label={t('guide.step4.garmin.label')}>
            <SubStep text={t('guide.step4.garmin1')} />
            <SubStep text={t('guide.step4.garmin2')} />
            <SubStep text={t('guide.step4.garmin3')} />
          </PlatformBlock>
          <PlatformBlock label={t('guide.step4.strava.label')}>
            <SubStep text={t('guide.step4.strava1')} />
            <SubStep text={t('guide.step4.strava2')} />
          </PlatformBlock>
          <Note text={t('guide.step4.note')} />
        </>
      ),
    },
  ];

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white dark:bg-gray-900
          hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left cursor-pointer"
        aria-expanded={open}
      >
        <span className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('guide.toggle')}
        </span>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-5 py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {steps.map((step, i) => (
              <div
                key={i}
                className="border border-gray-100 dark:border-gray-800 rounded-lg p-4 bg-gray-50 dark:bg-gray-950"
              >
                <div className="flex items-center gap-3">
                  <StepBadge n={i + 1} />
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight">
                    {step.title}
                  </h3>
                </div>
                {step.content}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
