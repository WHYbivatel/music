import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE, isLocale } from '@/lib/i18n';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.includes('.')) return NextResponse.next();
  const fromPath = pathname.match(/^\/(kk|ru|en)(?=\/|$)/)?.[1];
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(fromPath) ? fromPath : isLocale(saved) ? saved : 'ru';
  const headers = new Headers(request.headers);
  headers.set('x-locale', locale);
  const response = NextResponse.next({ request: { headers } });
  if (!isLocale(saved) || (isLocale(fromPath) && saved !== fromPath)) {
    response.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  }
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
