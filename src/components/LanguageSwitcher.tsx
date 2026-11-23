import React from 'react';
import { LOCALE_OPTIONS, useI18n } from '../lib/i18n';

export const LanguageSwitcher: React.FC = () => {
  const { locale, setLocale } = useI18n();

  return (
    <div
      className="inline-flex items-center gap-0.5 p-0.5 bg-stone-100 border border-stone-200 rounded-md"
      role="group"
      aria-label="Language selector"
    >
      {LOCALE_OPTIONS.map((opt) => (
        <button
          key={opt.code}
          type="button"
          onClick={() => setLocale(opt.code)}
          title={opt.label}
          className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
            locale === opt.code
              ? 'bg-white text-[#9E2A2B] shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          {opt.short}
        </button>
      ))}
    </div>
  );
};
