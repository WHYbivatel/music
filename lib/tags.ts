import type { Settings } from './types';

export type TagCategory = 'genre' | 'mood' | 'instrument' | 'vocal' | 'character';

export type TagDef = {
  id: string;
  category: TagCategory;
  exclusive: boolean;
  trait: string;
  value: string;
};

export const TAGS: TagDef[] = [
  { id: 'atmospheric', category: 'mood', exclusive: false, trait: 'mood:atmospheric', value: 'atmospheric' },
  { id: 'electronic', category: 'genre', exclusive: true, trait: 'genre:electronic', value: 'electronic' },
  { id: 'synth', category: 'instrument', exclusive: false, trait: 'instrument:synth', value: 'synthesizers' },
  { id: 'no-vocal', category: 'vocal', exclusive: true, trait: 'vocal:no', value: 'no vocals' },
  { id: 'lofi', category: 'genre', exclusive: true, trait: 'genre:lofi', value: 'lo-fi' },
  { id: 'calm', category: 'mood', exclusive: false, trait: 'mood:calm', value: 'calm' },
  { id: 'soft', category: 'character', exclusive: false, trait: 'character:soft', value: 'soft sound' },
  { id: 'energetic', category: 'mood', exclusive: false, trait: 'mood:energetic', value: 'energetic' },
  { id: 'rhythm', category: 'character', exclusive: false, trait: 'character:rhythm', value: 'expressive rhythm' },
  { id: 'cinematic', category: 'mood', exclusive: false, trait: 'mood:cinematic', value: 'cinematic' },
  { id: 'orchestral', category: 'genre', exclusive: true, trait: 'genre:orchestral', value: 'orchestral' },
  { id: 'buildup', category: 'character', exclusive: false, trait: 'character:buildup', value: 'build-up' },
  { id: 'ambient', category: 'genre', exclusive: true, trait: 'genre:ambient', value: 'ambient' },
  { id: 'flowing', category: 'character', exclusive: false, trait: 'character:flowing', value: 'flowing' },
  { id: 'memorable', category: 'mood', exclusive: false, trait: 'mood:memorable', value: 'memorable' },
  { id: 'confident', category: 'mood', exclusive: false, trait: 'mood:confident', value: 'confident' },
  { id: 'bright', category: 'mood', exclusive: false, trait: 'mood:bright', value: 'bright' },
  { id: 'unobtrusive', category: 'character', exclusive: false, trait: 'character:unobtrusive', value: 'unobtrusive' },
  { id: 'background', category: 'character', exclusive: false, trait: 'character:background', value: 'background' },
  { id: 'rock', category: 'genre', exclusive: true, trait: 'genre:rock', value: 'rock' },
];

const NEUTRAL = ['atmospheric', 'calm', 'soft', 'memorable'];
const FAST = ['energetic', 'rhythm'];

const GROUPS: { tags: string[]; words: string[]; stems: string[] }[] = [
  { tags: ['atmospheric', 'electronic', 'synth', 'no-vocal'], words: ['night', 'city', 'cities', 'drive', 'driving'], stems: ['ночн', 'ночь', 'ночью', 'ночи', 'город', 'поездк', 'драйв', 'түнгі', 'түнде', 'қала', 'сапар'] },
  { tags: ['lofi', 'calm', 'soft'], words: ['work', 'working', 'study', 'studying', 'focus', 'concentration'], stems: ['работ', 'учёб', 'учеб', 'концентрац', 'фокус', 'жұмыс', 'оқу', 'назар'] },
  { tags: ['energetic', 'rhythm'], words: ['workout', 'training', 'sport', 'dynamic', 'montage'], stems: ['спорт', 'трениров', 'динамичн', 'монтаж', 'жаттығу', 'серпінді'] },
  { tags: ['cinematic', 'orchestral', 'buildup'], words: ['cinematic', 'cinema', 'trailer', 'epic'], stems: ['кино', 'трейлер', 'эпичн', 'эпик', 'кинематограф', 'эпика'] },
  { tags: ['ambient', 'calm', 'flowing'], words: ['nature', 'relax', 'relaxation', 'meditation'], stems: ['природ', 'отдых', 'медитац', 'табиғат', 'демалыс', 'медитация', 'тынығу'] },
  { tags: ['memorable', 'confident', 'bright'], words: ['commercial', 'advertisement', 'presentation'], stems: ['реклам', 'презентац', 'жарнама', 'таныстырылым'] },
  { tags: ['unobtrusive', 'background', 'no-vocal'], words: ['podcast', 'voiceover', 'narration', 'speech'], stems: ['подкаст', 'озвучк', 'речь', 'дыбыстау', 'сөйлеу'] },
  { tags: ['rock'], words: ['rock'], stems: ['рок'] },
];

const VOCAL = { words: ['vocals', 'vocal', 'singing'], stems: ['вокал', 'әнші'] };
const FAST_WORDS = ['быстро', 'быстрый', 'быстрая', 'fast', 'жылдам'];

export function tagById(id: string) {
  return TAGS.find(tag => tag.id === id);
}

export function normalizeTags(ids: string[] | undefined) {
  const seen = new Set<string>();
  return (ids ?? []).filter(id => {
    if (!tagById(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function phrasePattern(phrase: string, stem: boolean) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}${stem ? '' : '(?![\\p{L}\\p{N}])'}`, 'iu');
}

function isNegated(text: string, index: number, word: string) {
  const before = text.slice(Math.max(0, index - 28), index);
  if (/(?:не|без|no|not|without|емес|жоқ)(?:\s+\p{L}+){0,2}\s*$/iu.test(before)) return true;
  if (/(?:сыз|сіз)$/iu.test(word)) return true;
  const after = text.slice(index + word.length, index + word.length + 12);
  return /^(?:сыз|сіз)(?![\p{L}\p{N}])|^\s+(?:емес|жоқ)/iu.test(after);
}

function mentions(text: string, words: string[], stems: string[] = []) {
  let positive = false;
  let negative = false;
  for (const phrase of [...words.map(word => ({ word, stem: false })), ...stems.map(word => ({ word, stem: true }))]) {
    const pattern = phrasePattern(phrase.word, phrase.stem);
    let from = 0;
    let match = pattern.exec(text.slice(from));
    while (match) {
      const index = from + match.index;
      if (isNegated(text, index, match[0])) negative = true;
      else positive = true;
      from = index + match[0].length;
      if (match[0].length === 0) break;
      match = pattern.exec(text.slice(from));
    }
  }
  return { positive, negative };
}

export function tagConflict(id: string, settings: Pick<Settings, 'genre' | 'vocal' | 'tempo'>) {
  const tag = tagById(id);
  if (!tag) return false;
  if (tag.id === 'no-vocal' && settings.vocal) return true;
  if (tag.category === 'genre' && settings.genre !== 'auto' && tag.trait !== `genre:${settings.genre}`) return true;
  if (FAST.includes(tag.id) && settings.tempo === 'slow') return true;
  return false;
}

export function suggestTags(prompt: string, settings: Pick<Settings, 'genre' | 'vocal' | 'tempo'>) {
  const text = prompt.toLocaleLowerCase();
  const suppressed = new Set<string>();
  const scores = new Map<string, number>();
  const vocal = mentions(text, VOCAL.words, VOCAL.stems);
  const fast = mentions(text, FAST_WORDS);
  if (vocal.positive && !vocal.negative) suppressed.add('no-vocal');
  if (fast.negative) FAST.forEach(id => suppressed.add(id));
  let matched = false;
  for (const group of GROUPS) {
    const hit = mentions(text, group.words, group.stems);
    if (hit.negative && !hit.positive) {
      group.tags.forEach(id => suppressed.add(id));
      continue;
    }
    if (!hit.positive) continue;
    matched = true;
    for (const id of group.tags) scores.set(id, (scores.get(id) ?? 0) + 1);
  }
  if (vocal.negative) { scores.set('no-vocal', (scores.get('no-vocal') ?? 0) + 2); matched = true; }
  const pool = matched ? [...scores.keys()] : NEUTRAL;
  return pool
    .filter(id => !suppressed.has(id) && !tagConflict(id, settings))
    .sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0) || TAGS.findIndex(tag => tag.id === a) - TAGS.findIndex(tag => tag.id === b))
    .slice(0, 6);
}

export function addTag(current: string[] | undefined, id: string) {
  const tag = tagById(id);
  const tags = normalizeTags(current);
  if (!tag || tags.includes(id)) return tags;
  const next = tag.exclusive ? tags.filter(existing => tagById(existing)?.category !== tag.category) : tags;
  return [...next, id];
}

export function removeTag(current: string[] | undefined, id: string) {
  return normalizeTags(current).filter(existing => existing !== id);
}

export function prepareRequest(settings: Settings) {
  const tags = normalizeTags(settings.tags).filter(id => !tagConflict(id, settings));
  const used = new Set<string>();
  if (settings.genre !== 'auto') used.add(`genre:${settings.genre}`);
  used.add(settings.vocal ? 'vocal:yes' : 'vocal:no');
  if (settings.tempo !== 'auto') used.add(`tempo:${settings.tempo}`);
  used.add(`mood:${settings.mood}`);
  settings.instruments.forEach(id => used.add(`instrument:${id}`));
  const added: string[] = [];
  for (const id of tags) {
    const tag = tagById(id)!;
    if (used.has(tag.trait)) continue;
    used.add(tag.trait);
    added.push(tag.value);
  }
  return {
    prompt: settings.prompt,
    tags,
    traits: [...used],
    brief: [settings.prompt.trim(), ...added].filter(Boolean).join('\n'),
  };
}
