'use client';
import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LOCALE_COOKIE, LOCALES, localeFromPath, setActiveLocale, stripLocale, translate, withLocale, type Locale } from '@/lib/i18n';

type I18nValue = { locale: Locale; t: (id: string, vars?: Record<string, string | number>) => string; href: (path: string) => string };
const I18nContext = createContext<I18nValue>({ locale: 'ru', t: (id, vars) => translate('ru', id, vars), href: path => path });

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const pathname = usePathname() || '/';
  const locale = localeFromPath(pathname) ?? initialLocale;
  setActiveLocale(locale);
  useLayoutEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = useMemo<I18nValue>(() => ({
    locale,
    t: (id, vars) => translate(locale, id, vars),
    href: path => !path.startsWith('/') ? path : localeFromPath(pathname) ? withLocale(locale, stripLocale(path.split('?')[0])) + (path.includes('?') ? path.slice(path.indexOf('?')) : '') : stripLocale(path),
  }), [locale, pathname]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useI18n() { return useContext(I18nContext); }

export function LocaleLink({ href, ...props }: React.ComponentProps<typeof Link>) {
  const { href: localize } = useI18n();
  const target = typeof href === 'string' ? localize(href) : href;
  return <Link href={target} {...props} />;
}

const NAMES: Record<Locale, string> = { kk: 'Қазақша', ru: 'Русский', en: 'English' };
export function LocaleSwitch() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { locale, t } = useI18n();
  function choose(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;SameSite=Lax`;
    const bare = stripLocale(pathname);
    router.push(`${withLocale(next, bare)}${window.location.search}`, { scroll: false });
  }
  return <div className="locale-switch" role="radiogroup" aria-label={t('lang.switch')}>{LOCALES.map(code => <button key={code} type="button" role="radio" aria-checked={locale === code} onClick={() => choose(code)}>{NAMES[code]}</button>)}</div>;
}
