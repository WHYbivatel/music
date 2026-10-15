export const PRODUCT = { name: 'NEON SOUND', subtitle: 'Твоя идея. Твоё звучание.' };
export const PRICING = { currency: '₸', perBlock: 5, blockSeconds: 30, initialBalance: 50, packages: [
  { id: 'start', name: 'Старт', price: 15000, tokens: 300, description: 'Чтобы найти своё звучание' },
  { id: 'creator', name: 'Создатель', price: 35000, tokens: 800, description: 'Для регулярной работы над песнями и видео' },
  { id: 'studio', name: 'Студия', price: 65000, tokens: 1600, description: 'Для больших идей и новых проектов' }
] };
export const cost = (seconds: number) => Math.ceil(seconds / PRICING.blockSeconds) * PRICING.perBlock;
export const money = (n: number) => new Intl.NumberFormat('ru-RU').format(n).replace(/\u00a0/g, ' ') + ' ' + PRICING.currency;
export const time = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
export const MOTION = { press: .15, switch: .25, reveal: .42, revealDuration: .42, revealDurationMobile: .32, revealReduced: .2, revealOffset: 20, revealOffsetMobile: 12, revealStagger: .06, revealMaxDelay: .25, ease: [.22, 1, .36, 1] as [number, number, number, number], spring: { stiffness: 220, damping: 24 } };
export const revealDelay = (index: number) => Math.min(Math.max(0, index) * MOTION.revealStagger, MOTION.revealMaxDelay);
export const GENRES = ['auto', 'pop', 'electronic', 'hiphop', 'rock', 'jazz', 'ambient', 'orchestral', 'lofi'];
export const PURPOSES = ['song', 'video', 'ad', 'podcast', 'game', 'trailer', 'focus'];
export const MOODS = ['calm', 'energetic', 'romantic', 'dark', 'epic', 'joyful'];
export const TEMPOS = ['auto', 'slow', 'medium', 'fast'];
export const VOCAL_LANGS = ['ru', 'kk', 'en'];
export const LYRIC_MODES = ['auto', 'custom'];
export const INSTRUMENTS = ['piano', 'guitar', 'synth', 'bass', 'drums', 'strings'];
export const EXAMPLES = [
 { label: 'Ночной драйв', genre: 'electronic', cover: 1, prompt: 'Атмосферная электронная музыка для ночной поездки по городу, глубокий бас, мягкие синтезаторы, без вокала.' },
 { label: 'Lo-fi для фокуса', genre: 'lofi', cover: 2, prompt: 'Тёплый lo-fi для работы: мягкое пианино, пыльные ударные, шум винила и спокойный ритм.' },
 { label: 'Кинематографично', genre: 'orchestral', cover: 3, prompt: 'Эпичная кинематографичная музыка с оркестром: нарастающие струнные, глубокие барабаны и ощущение большого приключения.' },
 { label: 'Летний вайб', genre: 'pop', cover: 4, prompt: 'Лёгкая летняя поп-мелодия с гитарой, живым басом и солнечным настроением.' }
];
