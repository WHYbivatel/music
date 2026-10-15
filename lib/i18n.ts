import { messages, type MessageId } from './i18n-messages';

export const LOCALES = ['kk', 'ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = 'neon-locale';
const INTL: Record<Locale, string> = { kk: 'kk-KZ', ru: 'ru-KZ', en: 'en-KZ' };

export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'kk' || value === 'ru' || value === 'en';
}

export function stripLocale(pathname: string) {
  const bare = pathname.replace(/^\/(kk|ru|en)(?=\/|$)/, '');
  return bare || '/';
}

export function localeFromPath(pathname: string): Locale | null {
  const match = pathname.match(/^\/(kk|ru|en)(?=\/|$)/);
  return match ? (match[1] as Locale) : null;
}

export function withLocale(locale: Locale, pathname: string) {
  const bare = stripLocale(pathname);
  return `/${locale}${bare === '/' ? '' : bare}`;
}

let active: Locale = 'ru';
export function setActiveLocale(locale: Locale) { active = locale; }
export function getActiveLocale() { return active; }

function apply(template: string, locale: Locale, vars?: Record<string, string | number>) {
  const plural = template.replace(/\{(\w+),\s*plural,\s*((?:[a-z]+\s*\{[^{}]*\}\s*)+)\}/g, (_, name, body) => {
    const value = Number(vars?.[name] ?? 0);
    const forms = Object.fromEntries([...body.matchAll(/([a-z]+)\s*\{([^{}]*)\}/g)].map(item => [item[1], item[2]]));
    const category = new Intl.PluralRules(INTL[locale]).select(value);
    const chosen = forms[category] || forms.other || '';
    return chosen.replaceAll('#', formatNumber(locale, value));
  });
  return plural.replace(/\{(\w+)\}/g, (_, name) => vars?.[name] === undefined ? `{${name}}` : String(vars[name]));
}

export function translate(locale: Locale, id: string, vars?: Record<string, string | number>) {
  const table = messages[locale] as Record<string, string>;
  const fallback = messages.ru as Record<string, string>;
  const template = table[id] ?? (process.env.NODE_ENV === 'production' ? fallback[id] : undefined);
  if (!template) return process.env.NODE_ENV === 'production' ? (fallback[id] || id) : `⟦${id}⟧`;
  return apply(template, locale, vars);
}

export function t(id: string, vars?: Record<string, string | number>) {
  return translate(active, id, vars);
}

export function formatNumber(locale: Locale, value: number) {
  return new Intl.NumberFormat(INTL[locale]).format(value);
}

export function formatMoney(locale: Locale, value: number) {
  return new Intl.NumberFormat(INTL[locale], { style: 'currency', currency: 'KZT', maximumFractionDigits: 0, currencyDisplay: 'narrowSymbol' }).format(value);
}

export function formatDate(locale: Locale, value: number, dateStyle: 'short' | 'long' = 'short') {
  if (!value) return translate(locale, 'Нет событий');
  const options: Intl.DateTimeFormatOptions = dateStyle === 'long'
    ? { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Almaty' }
    : { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' };
  return new Intl.DateTimeFormat(INTL[locale], options).format(value);
}

export function formatDateOnly(locale: Locale, value: number) {
  return new Intl.DateTimeFormat(INTL[locale], { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Almaty' }).format(value);
}

export function count(locale: Locale, id: 'tokens' | 'tracks' | 'minutes' | 'seconds' | 'operations' | 'requests' | 'users' | 'events' | 'generations', n: number) {
  return translate(locale, `count.${id}`, { n });
}

export function durationChoice(locale: Locale, seconds: number) {
  if (seconds < 60) return count(locale, 'seconds', seconds);
  return count(locale, 'minutes', seconds / 60);
}

const ERRORS: Record<string, string> = {
  'Дождитесь завершения текущего трека': 'error.wait',
  'Опишите музыку, которую хотите создать': 'error.prompt',
  'Проверьте описание и длительность': 'error.settings',
  'Недостаточно токенов. Пополните баланс': 'error.balance',
  'Пакет не найден': 'error.package',
  'Заявка не найдена': 'error.payment',
  'Не удалось сохранить данные. Освободите место в браузере.': 'error.storage',
  'API не настроен. Укажите NEXT_PUBLIC_API_BASE_URL и перезапустите приложение.': 'error.api',
  'Задание не найдено': 'error.job',
  'Трек не найден': 'error.track',
  'Демопанель недоступна в API-режиме': 'error.demoPanel',
  'Демовход доступен только в mock-режиме. Для API требуется серверная авторизация администратора.': 'error.adminLogin',
  'Войдите в админку': 'error.adminSession',
  'Аудиофайл недоступен': 'Аудиофайл недоступен',
};
export function userError(locale: Locale, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const status = message.match(/^Ошибка API \((\d+)\)/);
  if (status) return translate(locale, 'error.apiStatus', { status: status[1] });
  const id = ERRORS[message];
  return id ? translate(locale, id) : message;
}

const OPERATIONS: Record<string, string> = {
  'Резерв на создание трека': 'op.reserve',
  'Возврат: ошибка генерации': 'op.refund',
  'Создание трека': 'op.charge',
  'Резерв освобождён': 'op.released',
  'Пополнение баланса': 'op.topup',
};
export function operationText(locale: Locale, label: string, kind: string) {
  return translate(locale, OPERATIONS[label] || (kind === 'reserve' ? 'op.reserve' : kind === 'refund' ? 'op.refund' : kind === 'topup' ? 'op.topup' : 'op.charge'));
}

const AUDIT: Record<string, string> = {
  'session.visit': 'audit.session.visit',
  'auth.login': 'audit.auth.login',
  'auth.logout': 'audit.auth.logout',
  'admin.login': 'audit.admin.login',
  'admin.logout': 'audit.admin.logout',
  'payment.created': 'audit.payment.created',
  'payment.submitted': 'audit.payment.submitted',
  'payment.confirmed': 'audit.payment.confirmed',
  'payment.rejected': 'audit.payment.rejected',
  'generation.created': 'audit.generation.created',
  'generation.completed': 'audit.generation.completed',
  'generation.failed': 'audit.generation.failed',
  'track.renamed': 'audit.track.renamed',
  'track.favorite': 'audit.track.favorite',
  'track.deleted': 'audit.track.deleted',
  'track.download': 'audit.track.download',
  'profile.updated': 'audit.profile.updated',
  'demo.reset': 'audit.demo.reset',
};
export function auditLabel(locale: Locale, action: string) {
  return AUDIT[action] ? translate(locale, AUDIT[action]) : action;
}
export function auditText(locale: Locale, action: string, summary: string) {
  const renamed = summary.match(/^Трек переименован: (.+)$/);
  if (renamed) return translate(locale, 'audit.renamedDetail', { title: renamed[1] });
  return AUDIT[action] ? translate(locale, AUDIT[action]) : summary;
}

export function packageName(locale: Locale, id: string) { return translate(locale, `package.${id}.name`); }
export function packageDescription(locale: Locale, id: string) { return translate(locale, `package.${id}.description`); }
export function optionLabel(locale: Locale, group: string, id: string) { return translate(locale, `${group}.${id}`); }

const SEED_TITLES = ['Midnight in Tokyo', 'Тихие орбиты', 'Beyond the horizon'];
const UNTITLED = new Set(['Новая волна', 'New wave', 'Жаңа толқын']);
export function displayTitle(locale: Locale, track: { id: string; title: string }) {
  const index = ['seed-0', 'seed-1', 'seed-2'].indexOf(track.id);
  if (index >= 0 && track.title === SEED_TITLES[index]) return translate(locale, `seed.${index}.title`);
  if (UNTITLED.has(track.title)) return translate(locale, 'track.untitled');
  return track.title;
}
export function displayPrompt(locale: Locale, track: { id: string; settings: { prompt: string } }) {
  const index = ['seed-0', 'seed-1', 'seed-2'].indexOf(track.id);
  if (index >= 0) return translate(locale, `seed.${index}.prompt`);
  return track.settings.prompt;
}

export function placeholders(template: string) {
  const names = new Set<string>();
  const without = template.replace(/\{([A-Za-z_]\w*),\s*plural,\s*(?:[a-z]+\s*\{[^{}]*\}\s*)+\}/g, (_, name) => { names.add(name); return ''; });
  for (const match of without.matchAll(/\{([A-Za-z_]\w*)\}/g)) names.add(match[1]);
  return [...names].sort();
}

export function pluralCoverage(locale: Locale, template: string) {
  const rules = new Intl.PluralRules(INTL[locale]);
  const needed = new Set<string>();
  for (let n = 0; n <= 120; n += 1) needed.add(rules.select(n));
  const missing: string[] = [];
  for (const block of template.matchAll(/\{(\w+),\s*plural,\s*((?:[a-z]+\s*\{[^{}]*\}\s*)+)\}/g)) {
    const forms = new Set([...block[2].matchAll(/([a-z]+)\s*\{/g)].map(item => item[1]));
    if (!forms.has('other')) missing.push(`${block[1]}:other`);
    for (const category of needed) if (!forms.has(category) && !forms.has('other')) missing.push(`${block[1]}:${category}`);
  }
  return missing;
}

export type { MessageId };
