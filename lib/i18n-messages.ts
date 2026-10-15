import { extra } from './i18n-extra';
import copy from './ui-copy.json';

const phrase = { ru: {} as Record<string,string>, en: {} as Record<string,string>, kk: {} as Record<string,string> };
for (const [source, pair] of Object.entries(copy as unknown as Record<string, [string, string]>)) {
  phrase.ru[source] = source;
  phrase.en[source] = pair[0];
  phrase.kk[source] = pair[1];
}
export const messages = {
  ru: { ...phrase.ru, ...extra.ru },
  en: { ...phrase.en, ...extra.en },
  kk: { ...phrase.kk, ...extra.kk },
};
export type MessageId = keyof typeof messages.ru;
