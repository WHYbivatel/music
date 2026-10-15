import type { MetadataRoute } from 'next';

const origin = 'https://music.esl.kz';
const pages = ['', '/library'];
export default function sitemap(): MetadataRoute.Sitemap {
  return ['kk', 'ru', 'en'].flatMap(locale => pages.map(page => ({
    url: `${origin}/${locale}${page}`,
    alternates: { languages: { kk: `${origin}/kk${page}`, ru: `${origin}/ru${page}`, en: `${origin}/en${page}`, 'x-default': `${origin}/ru${page}` } },
  })));
}
