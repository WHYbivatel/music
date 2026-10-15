export const PRODUCT = { name: 'NEON SOUND', subtitle: 'Твоя идея. Твоё звучание.' };
export const PRICING = { currency: '₸', perBlock: 5, blockSeconds: 30, initialBalance: 50, packages: [
  { id: 'start', name: 'Старт', price: 15000, tokens: 300, description: 'Чтобы найти своё звучание' },
  { id: 'creator', name: 'Создатель', price: 35000, tokens: 800, description: 'Для регулярной работы над песнями и видео' },
  { id: 'studio', name: 'Студия', price: 65000, tokens: 1600, description: 'Для больших идей и новых проектов' }
] };
export const cost = (seconds: number) => Math.ceil(seconds / PRICING.blockSeconds) * PRICING.perBlock;
export const money = (n: number) => new Intl.NumberFormat('ru-RU').format(n).replace(/\u00a0/g, ' ') + ' ' + PRICING.currency;
export const time = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
export const MOTION = { press: .15, switch: .25, reveal: .4, ease: [.22, 1, .36, 1] as [number, number, number, number], spring: { stiffness: 220, damping: 24 } };
export const GENRES = ['Автоматически', 'Поп', 'Электроника', 'Хип-хоп', 'Рок', 'Джаз', 'Эмбиент', 'Оркестровая', 'Lo-fi'];
export const PURPOSES = ['Песня', 'Музыка для видео', 'Реклама', 'Подкаст', 'Игра', 'Кино / трейлер', 'Фон для работы'];
export const MOODS = ['Спокойное', 'Энергичное', 'Романтичное', 'Мрачное', 'Эпичное', 'Радостное'];
export const EXAMPLES = [
 { label: 'Ночной драйв', genre: 'Электроника', cover: 1, prompt: 'Атмосферная электронная музыка для ночной поездки по городу, глубокий бас, мягкие синтезаторы, без вокала.' },
 { label: 'Lo-fi для фокуса', genre: 'Lo-fi', cover: 2, prompt: 'Тёплый lo-fi для работы: мягкое пианино, пыльные ударные, шум винила и спокойный ритм.' },
 { label: 'Кинематографично', genre: 'Оркестровая', cover: 3, prompt: 'Эпичная кинематографичная музыка с оркестром: нарастающие струнные, глубокие барабаны и ощущение большого приключения.' },
 { label: 'Летний вайб', genre: 'Поп', cover: 4, prompt: 'Лёгкая летняя поп-мелодия с гитарой, живым басом и солнечным настроением.' }
];
