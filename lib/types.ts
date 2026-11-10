import type { AuditEvent } from './audit';
export type Settings = { prompt: string; tags: string[]; vocal: boolean; duration: number; genre: string; purpose: string; mood: string; tempo: string; instruments: string[]; language: string; lyricsMode: string; lyrics: string; title: string };
export const defaults: Settings = { prompt: '', tags: [], vocal: false, duration: 120, genre: 'auto', purpose: 'video', mood: 'calm', tempo: 'auto', instruments: [], language: 'ru', lyricsMode: 'auto', lyrics: '', title: '' };
export type Track = { id: string; title: string; created: number; settings: Settings; cover: number; favorite: boolean; audioUrl: string; demo: boolean; durationMs?: number };
export type Job = { id: string; key: string; settings: Settings; status: 'queued' | 'generating' | 'ready' | 'error'; created: number; cost: number; fail: boolean; trackId?: string; errorCode?: string | null; demo?: boolean };
export type Payment = { id: string; packageId: string; status: 'awaiting_payment' | 'pending_review' | 'confirmed' | 'rejected' | 'cancelled' | 'expired'; created: number; price: number; tokens: number; amountMinor?: number; currency?: string; test?: boolean };
export type Operation = { id: string; kind: 'reserve' | 'generation' | 'refund' | 'topup'; amount: number; label: string; created: number };
export type DemoState = { version: 1; audit?: AuditEvent[]; adminExamples?: Payment[]; adminSeedAudit?: AuditEvent[]; balance: number; reserved?: number; realBalance?: number; testBalance?: number; balanceKind?: 'demo' | 'test' | 'real'; mailReset?: boolean; transfersEnabled?: boolean; tracks: Track[]; jobs: Job[]; payments: Payment[]; operations: Operation[]; draft: Settings; user: { name: string; email: string; role?: string } | null };
export type Credentials = { email: string; password: string };
export type AppAdapter = {
 auth: { current(): Promise<DemoState['user']>; login(input?: Credentials): Promise<DemoState['user']>; register(input: Credentials & { name: string }): Promise<DemoState['user']>; logout(): Promise<void>; updateName(name: string): Promise<DemoState['user']>; changePassword(current: string, password: string): Promise<void>; requestReset(email: string): Promise<{ code: string }>; resetPassword(token: string, password: string): Promise<void>; revokeOthers(): Promise<void> };
 generation: { active(): Promise<Job|null>; create(settings: Settings, key: string, fail?: boolean): Promise<Job>; status(id: string): Promise<Job> };
 library: { list(): Promise<Track[]>; update(id: string, patch: Partial<Pick<Track, 'title' | 'favorite'>>): Promise<void>; remove(id: string): Promise<void>; download(id: string): Promise<{ url: string }> };
 balance: { get(): Promise<{ available: number; reserved: number }>; operations(): Promise<Operation[]> };
 payments: { list(): Promise<Payment[]>; create(packageId: string): Promise<Payment>; paid(id: string): Promise<void> };
};
