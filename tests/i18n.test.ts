import test from 'node:test';
import assert from 'node:assert/strict';
import { messages } from '../lib/i18n-messages';
import { count, placeholders, pluralCoverage, stripLocale, translate, withLocale } from '../lib/i18n';

test('словари kk, ru и en содержат одни и те же ключи и параметры', () => {
  const locales = ['kk', 'ru', 'en'] as const;
  const keys = locales.map(locale => Object.keys(messages[locale]).sort());
  assert.deepEqual(keys[0], keys[1]);
  assert.deepEqual(keys[1], keys[2]);
  for (const key of keys[0]) {
    const params = locales.map(locale => placeholders(messages[locale][key as keyof typeof messages.ru]));
    assert.deepEqual(params[1], params[0], key);
    assert.deepEqual(params[2], params[0], key);
    for (const locale of locales) assert.deepEqual(pluralCoverage(locale, messages[locale][key as keyof typeof messages.ru]), [], `${locale}:${key}`);
  }
});

test('формы числа и валютный контекст зависят от языка', () => {
  assert.equal(count('ru', 'tokens', 1), '1 токен');
  assert.equal(count('ru', 'tokens', 2), '2 токена');
  assert.equal(count('ru', 'tokens', 5), '5 токенов');
  assert.equal(count('en', 'tracks', 1), '1 track');
  assert.equal(count('en', 'tracks', 2), '2 tracks');
  assert.equal(count('kk', 'minutes', 1), '1 минут');
  assert.equal(count('kk', 'minutes', 5), '5 минут');
  assert.match(translate('en', 'package.creator.name'), /Creator/);
  assert.equal(translate('kk', 'Создать музыку'), 'Музыка жасау');
});

test('префикс языка снимается без цикла и сохраняет остальной адрес', () => {
  assert.equal(stripLocale('/en/library'), '/library');
  assert.equal(stripLocale('/ru'), '/');
  assert.equal(stripLocale('/library'), '/library');
  assert.equal(withLocale('kk', '/balance'), '/kk/balance');
  assert.equal(withLocale('en', '/'), '/en');
});
