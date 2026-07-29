import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../context/LanguageContext';
import AppIcon from './icons/AppIcon';

/**
 * @param {'dropdown' | 'panel'} variant
 * @param {'student' | 'app'} tone — student = violet accents; app = neutral/brand for admin & login
 */
export default function LanguageSwitcher({ variant = 'dropdown', tone = 'student' }) {
  const { language, setLanguage, languages, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const current = languages.find((l) => l.code === language) || languages[0];
  const rootClass = tone === 'app' ? 'language-dropdown language-dropdown-app' : 'language-dropdown';
  const panelClass = tone === 'app' ? 'language-panel language-panel-app' : 'language-panel';

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (code) => {
    setLanguage(code);
    setOpen(false);
  };

  if (variant === 'panel') {
    return (
      <div className={panelClass}>
        <p className="language-panel-label">{t('language')}</p>
        <p className="language-panel-hint">{t('app.languageHint')}</p>
        <div className="language-panel-grid" role="listbox" aria-label={t('language')}>
          {languages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              role="option"
              aria-selected={language === lang.code}
              onClick={() => pick(lang.code)}
              className={`language-panel-option ${language === lang.code ? 'language-panel-option-active' : ''}`}
            >
              <span className="language-panel-code">{lang.code.toUpperCase()}</span>
              <span className="language-panel-name">{lang.nativeLabel}</span>
              {language === lang.code && <AppIcon name="check" className="w-4 h-4 language-panel-check" />}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={rootClass} ref={rootRef}>
      <button
        type="button"
        className="language-dropdown-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t('language')}
      >
        <AppIcon name="language" className="w-4 h-4 shrink-0" />
        <span className="language-dropdown-current">{current.nativeLabel}</span>
        <span className="language-dropdown-code">{current.code.toUpperCase()}</span>
      </button>

      {open && (
        <div className="language-dropdown-menu" role="listbox" aria-label={t('language')}>
          <p className="language-dropdown-menu-title">{t('language')}</p>
          {languages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              role="option"
              aria-selected={language === lang.code}
              onClick={() => pick(lang.code)}
              className={`language-dropdown-item ${language === lang.code ? 'language-dropdown-item-active' : ''}`}
            >
              <span className="language-dropdown-item-code">{lang.code.toUpperCase()}</span>
              <span className="language-dropdown-item-label">{lang.nativeLabel}</span>
              {language === lang.code && (
                <AppIcon name="check" className={`w-4 h-4 ${tone === 'app' ? 'text-brand-600' : 'text-violet-600'}`} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
