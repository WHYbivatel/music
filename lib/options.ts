import type { DemoState, Settings } from './types';

export const GENRE_IDS = ['auto', 'pop', 'electronic', 'hiphop', 'rock', 'jazz', 'ambient', 'orchestral', 'lofi'] as const;
export const PURPOSE_IDS = ['song', 'video', 'ad', 'podcast', 'game', 'trailer', 'focus'] as const;
export const MOOD_IDS = ['calm', 'energetic', 'romantic', 'dark', 'epic', 'joyful'] as const;
export const TEMPO_IDS = ['auto', 'slow', 'medium', 'fast'] as const;
export const VOCAL_IDS = ['ru', 'kk', 'en'] as const;
export const LYRICS_IDS = ['auto', 'custom'] as const;
export const INSTRUMENT_IDS = ['piano', 'guitar', 'synth', 'bass', 'drums', 'strings'] as const;

const legacy = (map: Record<string, string>, value: string) => map[value] || value;
const genres: Record<string, string> = { 'Автоматически': 'auto', 'Поп': 'pop', 'Электроника': 'electronic', 'Хип-хоп': 'hiphop', 'Рок': 'rock', 'Джаз': 'jazz', 'Эмбиент': 'ambient', 'Оркестровая': 'orchestral', 'Lo-fi': 'lofi' };
const purposes: Record<string, string> = { 'Песня': 'song', 'Музыка для видео': 'video', 'Реклама': 'ad', 'Подкаст': 'podcast', 'Игра': 'game', 'Кино / трейлер': 'trailer', 'Фон для работы': 'focus' };
const moods: Record<string, string> = { 'Спокойное': 'calm', 'Энергичное': 'energetic', 'Романтичное': 'romantic', 'Мрачное': 'dark', 'Эпичное': 'epic', 'Радостное': 'joyful' };
const tempos: Record<string, string> = { 'Автоматически': 'auto', 'Медленный': 'slow', 'Средний': 'medium', 'Быстрый': 'fast' };
const vocals: Record<string, string> = { 'Русский': 'ru', 'Казахский': 'kk', 'Английский': 'en' };
const lyrics: Record<string, string> = { 'Автоматически': 'auto', 'Свой текст': 'custom' };
const instruments: Record<string, string> = { 'Пианино': 'piano', 'Гитара': 'guitar', 'Синтезатор': 'synth', 'Бас': 'bass', 'Ударные': 'drums', 'Струнные': 'strings' };

export function migrateSettings(settings: Settings): Settings {
  return { ...settings, genre: legacy(genres, settings.genre), purpose: legacy(purposes, settings.purpose), mood: legacy(moods, settings.mood), tempo: legacy(tempos, settings.tempo), language: legacy(vocals, settings.language), lyricsMode: legacy(lyrics, settings.lyricsMode), instruments: settings.instruments.map(item => legacy(instruments, item)) };
}
export function migrateState(state: DemoState): DemoState {
  return { ...state, draft: migrateSettings(state.draft), tracks: state.tracks.map(track => ({ ...track, settings: migrateSettings(track.settings) })), jobs: state.jobs.map(job => ({ ...job, settings: migrateSettings(job.settings) })) };
}
