import type { Metadata } from 'next';
import { headers } from 'next/headers';
import App from '@/components/app';
import { isLocale, translate, type Locale } from '@/lib/i18n';

const ORIGIN = 'https://music.esl.kz';

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const slug = (await params).slug ?? [];
  const headerLocale = (await headers()).get('x-locale');
  const locale: Locale = isLocale(slug[0]) ? slug[0] : isLocale(headerLocale) ? headerLocale : 'ru';
  const rest = isLocale(slug[0]) ? slug.slice(1) : slug;
  const path = rest.length ? `/${rest.join('/')}` : '/';
  const publicPage = path === '/' || path === '/library';
  const suffix = path === '/' ? '' : path;
  const titles: Record<string, string> = {
    '/': 'meta.home.title', '/library': 'meta.library.title', '/balance': 'meta.balance.title', '/profile': 'meta.profile.title',
    '/login': 'meta.login.title', '/register': 'meta.register.title', '/ui-kit': 'meta.kit.title',
  };
  const titleKey = titles[path] || (path.startsWith('/admin') ? 'meta.admin.title' : path === '/offline' ? 'offline.title' : 'meta.missing.title');
  return {
    title: translate(locale, titleKey),
    description: publicPage ? translate(locale, path === '/library' ? 'meta.library.description' : 'meta.home.description') : undefined,
    robots: publicPage ? { index: true, follow: true } : { index: false, follow: false },
    alternates: publicPage ? {
      canonical: `${ORIGIN}/${locale}${suffix}`,
      languages: { kk: `${ORIGIN}/kk${suffix}`, ru: `${ORIGIN}/ru${suffix}`, en: `${ORIGIN}/en${suffix}`, 'x-default': `${ORIGIN}/ru${suffix}` },
    } : undefined,
  };
}

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const slug = (await params).slug ?? [];
  const headerLocale = (await headers()).get('x-locale');
  const locale: Locale = isLocale(slug[0]) ? slug[0] : isLocale(headerLocale) ? headerLocale : 'ru';
  return <App initialLocale={locale} />;
}
