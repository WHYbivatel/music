import type { AuditEvent } from './audit';
export type Settings = { prompt: string; tags: string[]; vocal: boolean; duration: number; genre: string; purpose: string; mood: string; tempo: string; instruments: string[]; language: string; lyricsMode: string; lyrics: string; title: string };
export const defaults: Settings = { prompt: '', tags: [], vocal: false, duration: 120, genre: 'auto', purpose: 'video', mood: 'calm', tempo: 'auto', instruments: [], language: 'ru', lyricsMode: 'auto', lyrics: '', title: '' };
export type Track = { id: string; title: string; created: number; settings: Settings; cover: number; favorite: boolean; audioUrl: string; demo: true };
export type Job = { id: string; key: string; settings: Settings; status: 'queued' | 'generating' | 'ready' | 'error'; created: number; cost: number; fail: boolean; trackId?: string };
export type Payment = { id: string; packageId: string; status: 'awaiting_payment' | 'pending_review' | 'confirmed' | 'rejected'; created: number; price: number; tokens: number };
export type Operation = { id: string; kind: 'reserve' | 'generation' | 'refund' | 'topup'; amount: number; label: string; created: number };
export type DemoState = { version: 1; audit?: AuditEvent[]; adminExamples?: Payment[]; adminSeedAudit?: AuditEvent[]; balance: number; tracks: Track[]; jobs: Job[]; payments: Payment[]; operations: Operation[]; draft: Settings; user: { name: string; email: string } | null };
export type AppAdapter = {
 auth: { current(): Promise<DemoState['user']>; login(): Promise<DemoState['user']>; logout(): Promise<void> };
 generation: { active(): Promise<Job|null>; create(settings: Settings, key: string, fail?: boolean): Promise<Job>; status(id: string): Promise<Job> };
 library: { list(): Promise<Track[]>; update(id: string, patch: Partial<Pick<Track, 'title' | 'favorite'>>): Promise<void>; remove(id: string): Promise<void>; download(id: string): Promise<{ url: string }> };
 balance: { get(): Promise<{ available: number; reserved: number }>; operations(): Promise<Operation[]> };
 payments: { list(): Promise<Payment[]>; create(packageId: string): Promise<Payment>; paid(id: string): Promise<void> };
};
