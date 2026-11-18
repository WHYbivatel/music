import { changePayment, createJob, createPayment, settleJobs } from './engine';
import { getState, update, transaction, recordAudit } from './store';
import type { AppAdapter, Job, Operation, Payment, Settings, Track } from './types';

export const DATA_MODE = process.env.NEXT_PUBLIC_DATA_MODE || 'mock';
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
let csrfToken = '';

export class ApiError extends Error {
  code: string;
  params: Record<string, string | number>;
  status: number;
  constructor(code: string, params: Record<string, string | number> | undefined, status: number) {
    super(code);
    this.code = code;
    this.params = params || {};
    this.status = status;
  }
}

export function setCsrf(token: string) { csrfToken = token; }

const UI_STATUS: Record<string, Job['status']> = { queued: 'queued', running: 'generating', generating: 'generating', succeeded: 'ready', ready: 'ready', failed: 'error', error: 'error' };

export function mapJob(job: Job & { status: string }): Job {
  return { ...job, status: UI_STATUS[job.status] || 'error' };
}

export async function request<T>(path: string, method = 'GET', body?: unknown, key?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (key) headers['Idempotency-Key'] = key;
  if (csrfToken && method !== 'GET' && method !== 'HEAD') headers['X-CSRF-Token'] = csrfToken;
  const res = await fetch(`${BASE}${path}`, { method, credentials: 'include', headers, body: body !== undefined ? JSON.stringify(body) : undefined, cache: 'no-store' });
  if (res.status === 204) return undefined as T;
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const code = payload?.error?.code || 'error.apiStatus';
    const params = payload?.error?.params || (code === 'error.apiStatus' ? { status: res.status } : {});
    throw new ApiError(code, params, res.status);
  }
  if (payload && typeof payload === 'object' && typeof payload.csrfToken === 'string') setCsrf(payload.csrfToken);
  return payload as T;
}

async function pages<T>(path: string): Promise<T[]> {
  const first = await request<{ items: T[]; nextCursor: string | null }>(`${path}${path.includes('?') ? '&' : '?'}limit=100`);
  return first.items || [];
}

type Me = {
  user: AppAdapter extends never ? never : { name: string; email: string; role?: string } | null;
  csrfToken: string;
  balance: { available: number; reserved: number; realAvailable: number; testAvailable: number; spendable: 'demo' | 'test' | 'real' };
  draft: Settings;
  mail: { resetAvailable: boolean };
  payments: { transfersEnabled: boolean };
};

export async function loadSession() {
  const me = await request<Me>('/v1/auth/me');
  setCsrf(me.csrfToken);
  return me;
}

const mockUser = () => getState().user;
export const mockAdapter: AppAdapter = {
  auth: {
    async current() { return mockUser(); },
    async login() { update(s => ({ ...s, user: { name: 'Алекс', email: 'alex@demo.auen.local' } })); recordAudit('auth.login', 'Вход в локальный профиль'); return mockUser(); },
    async register() { return this.login(); },
    async logout() { recordAudit('auth.logout', 'Выход из аккаунта'); update(s => ({ ...s, user: null })); },
    async updateName(name) { update(s => ({ ...s, user: s.user ? { ...s.user, name } : null })); return mockUser(); },
    async changePassword() { throw new ApiError('error.mail', {}, 503); },
    async requestReset() { throw new ApiError('error.mail', {}, 503); },
    async resetPassword() { throw new ApiError('error.reset', {}, 400); },
    async revokeOthers() { return; },
  },
  generation: {
    async active() { return getState().jobs.find(j => ['queued', 'generating'].includes(j.status)) || null; },
    async create(settings, key, fail) { return transaction(() => { update(s => createJob(s, settings, key, fail)); return getState().jobs.find(j => j.key === key)!; }); },
    async status(id) { await transaction(() => update(s => settleJobs(s))); const j = getState().jobs.find(j => j.id === id); if (!j) throw new ApiError('error.job', {}, 404); return j; },
  },
  library: {
    async list() { return getState().tracks; },
    async update(id, patch) { update(s => ({ ...s, tracks: s.tracks.map(t => t.id === id ? { ...t, ...patch } : t) })); },
    async remove(id) { update(s => ({ ...s, tracks: s.tracks.filter(t => t.id !== id) })); },
    async download(id) { const t = getState().tracks.find(t => t.id === id); if (!t) throw new ApiError('error.track', {}, 404); return { url: t.audioUrl }; },
  },
  balance: {
    async get() { const s = getState(); return { available: s.balance, reserved: s.jobs.filter(j => ['queued', 'generating'].includes(j.status)).reduce((n, j) => n + j.cost, 0) }; },
    async operations() { return getState().operations; },
  },
  payments: {
    async list() { return getState().payments; },
    async create(packageId) { const id = `NS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`; return transaction(() => { update(s => createPayment(s, packageId, id)); return getState().payments.find(p => p.id === id)!; }); },
    async paid(id) { await transaction(() => update(s => changePayment(s, id, 'paid'))); },
  },
};

export const apiAdapter: AppAdapter = {
  auth: {
    async current() { return (await loadSession()).user; },
    async login(input) { const result = await request<{ user: NonNullable<Me['user']>; csrfToken: string }>('/v1/auth/login', 'POST', input); return result.user; },
    async register(input) { const result = await request<{ user: NonNullable<Me['user']>; csrfToken: string }>('/v1/auth/register', 'POST', input); return result.user; },
    async logout() { await request('/v1/auth/logout', 'POST'); csrfToken = ''; },
    async updateName(name) { return (await request<{ user: NonNullable<Me['user']> }>('/v1/auth/name', 'PATCH', { name })).user; },
    async changePassword(current, password) { await request('/v1/auth/password', 'POST', { current, password }); },
    async requestReset(email) { return request('/v1/auth/password/forgot', 'POST', { email }); },
    async resetPassword(token, password) { await request('/v1/auth/password/reset', 'POST', { token, password }); },
    async revokeOthers() { await request('/v1/auth/sessions/revoke-others', 'POST'); },
  },
  generation: {
    async active() { return request<Job | null>('/v1/generations/active').then(job => job ? mapJob(job) : null); },
    async create(settings, key, fail) { return mapJob(await request('/v1/generations', 'POST', { ...settings, scenario: fail ? 'error' : 'success' }, key)); },
    async status(id) { return mapJob(await request(`/v1/generations/${id}`)); },
  },
  library: {
    async list() { return pages<Track>('/v1/tracks?sort=new'); },
    async update(id, patch) { await request(`/v1/tracks/${id}`, 'PATCH', patch); },
    async remove(id) { await request(`/v1/tracks/${id}`, 'DELETE'); },
    async download(id) { return request(`/v1/tracks/${id}/download`); },
  },
  balance: {
    async get() { return request('/v1/balance'); },
    async operations() { return pages<Operation>('/v1/balance/operations'); },
  },
  payments: {
    async list() { return request<Payment[]>('/v1/payments'); },
    async create(packageId) { return request('/v1/payments', 'POST', { packageId }, crypto.randomUUID()); },
    async paid(id) { await request(`/v1/payments/${id}/paid`, 'POST'); },
  },
};

export const adapter = DATA_MODE === 'api' ? apiAdapter : mockAdapter;

export async function demoReview(id: string, action: 'confirm' | 'reject') {
  if (DATA_MODE !== 'mock') throw new ApiError('error.demoPanel', {}, 403);
  await transaction(() => update(s => changePayment(s, id, action)));
}
