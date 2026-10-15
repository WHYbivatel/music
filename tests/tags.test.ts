import assert from 'node:assert/strict';
import test from 'node:test';
import { defaults } from '../lib/types';
import { addTag, prepareRequest, removeTag, suggestTags, tagConflict } from '../lib/tags';

const base = { genre: 'auto' as const, vocal: false, tempo: 'auto' as const };

test('ночное описание предлагает теги и не зависит от языка интерфейса', () => {
  assert.deepEqual(suggestTags('Хочу музыку для видео о ночном городе', base), ['atmospheric', 'electronic', 'synth', 'no-vocal']);
  assert.deepEqual(suggestTags('Night drive through the city', base), ['atmospheric', 'electronic', 'synth', 'no-vocal']);
  assert.deepEqual(suggestTags('Түнгі қала сапарына арналған музыка', base), ['atmospheric', 'electronic', 'synth', 'no-vocal']);
});

test('другие темы и нейтральный текст дают устойчивый список', () => {
  assert.deepEqual(suggestTags('музыка для работы и учёбы', base).slice(0, 3), ['lofi', 'calm', 'soft']);
  assert.deepEqual(suggestTags('workout montage', base), ['energetic', 'rhythm']);
  assert.deepEqual(suggestTags('эпичный трейлер', base), ['cinematic', 'orchestral', 'buildup']);
  assert.deepEqual(suggestTags('meditation in nature', base), ['calm', 'ambient', 'flowing']);
  assert.deepEqual(suggestTags('рекламная презентация', base), ['memorable', 'confident', 'bright']);
  assert.deepEqual(suggestTags('подкаст с речью', base), ['no-vocal', 'unobtrusive', 'background']);
  assert.deepEqual(suggestTags('просто что-нибудь', base), ['atmospheric', 'calm', 'soft', 'memorable']);
  assert.deepEqual(suggestTags('просто что-нибудь', base), suggestTags('просто что-нибудь', base));
});

test('отрицания и части слов не дают ложных тегов', () => {
  assert.equal(suggestTags('не рок, что-нибудь спокойное', base).includes('rock'), false);
  assert.equal(suggestTags('урок гитары и огород', base).includes('rock'), false);
  assert.equal(suggestTags('урок гитары и огород', base).includes('electronic'), false);
  assert.equal(suggestTags('спорт, но не слишком быстро', base).includes('energetic'), false);
  assert.equal(suggestTags('спорт, но не слишком быстро', base).includes('rhythm'), false);
  assert.equal(suggestTags('без вокала', base).includes('no-vocal'), true);
  assert.equal(suggestTags('вокалсыз ән', base).includes('no-vocal'), true);
  assert.equal(suggestTags('with vocals', base).includes('no-vocal'), false);
});

test('ручные настройки скрывают конфликт и не снимают уже выбранный тег сами', () => {
  assert.equal(suggestTags('ночной город', { ...base, vocal: true }).includes('no-vocal'), false);
  assert.equal(suggestTags('ночной город', { ...base, genre: 'rock' }).includes('electronic'), false);
  assert.equal(tagConflict('no-vocal', { ...base, vocal: true }), true);
  assert.equal(tagConflict('electronic', { ...base, genre: 'rock' }), true);
  assert.equal(tagConflict('electronic', base), false);
});

test('теги не дублируются, жанр заменяется, настроение сочетается', () => {
  assert.deepEqual(addTag(['atmospheric'], 'atmospheric'), ['atmospheric']);
  assert.deepEqual(addTag(['electronic', 'calm'], 'lofi'), ['calm', 'lofi']);
  assert.deepEqual(addTag(['calm'], 'soft'), ['calm', 'soft']);
  assert.deepEqual(removeTag(['calm', 'soft'], 'calm'), ['soft']);
});

test('запрос сохраняет описание и не повторяет уже заданную настройку', () => {
  const prompt = 'Хочу музыку для видео о ночном городе';
  const open = prepareRequest({ ...defaults, prompt, tags: ['electronic', 'atmospheric', 'no-vocal'] });
  assert.equal(open.prompt, prompt);
  assert.match(open.brief, /ночном городе/);
  assert.match(open.brief, /electronic/);
  assert.match(open.brief, /atmospheric/);
  assert.doesNotMatch(open.brief, /no vocals/);
  const set = prepareRequest({ ...defaults, prompt, genre: 'electronic', tags: ['electronic', 'synth'] });
  assert.equal(set.brief.includes('electronic'), false);
  assert.match(set.brief, /synthesizers/);
  const conflict = prepareRequest({ ...defaults, prompt, vocal: true, tags: ['no-vocal', 'atmospheric'] });
  assert.equal(conflict.tags.includes('no-vocal'), false);
  assert.match(conflict.brief, /atmospheric/);
});
