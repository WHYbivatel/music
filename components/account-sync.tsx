'use client';
import { useEffect, useState } from 'react';
import { adapter, DATA_MODE, request } from '@/lib/adapters';
import { t } from '@/lib/i18n';
import { update } from '@/lib/store';
import type { DemoState, Settings } from '@/lib/types';
import { Button, Modal } from './ui';

export function AccountSync({ state, onRefresh }: { state: DemoState; onRefresh: () => Promise<void> }) {
  const [offer, setOffer] = useState<Settings | null>(null);
  useEffect(() => {
    const onChange = () => { onRefresh(); };
    window.addEventListener('neon-account-changed', onChange);
    return () => window.removeEventListener('neon-account-changed', onChange);
  }, [onRefresh]);
  useEffect(() => {
    if (DATA_MODE !== 'api' || !state.user) return;
    const raw = sessionStorage.getItem('neon-import-offer');
    if (!raw || state.draft.prompt) return;
    try {
      const saved = JSON.parse(raw);
      if (saved?.draft?.prompt) setOffer(saved.draft);
    } catch { /* ignore unreadable local demo */ }
  }, [state.user, state.draft.prompt]);
  useEffect(() => {
    if (DATA_MODE !== 'api' || !state.user) return;
    if (!state.draft.prompt && !state.draft.title && !state.draft.tags.length && !state.draft.lyrics) return;
    const timer = window.setTimeout(() => { request('/v1/draft', 'PUT', state.draft).catch(() => undefined); }, 800);
    return () => window.clearTimeout(timer);
  }, [state.user, state.draft]);
  if (!offer) return null;
  return <Modal title={t('Импортировать черновик')} open onClose={() => { setOffer(null); sessionStorage.removeItem('neon-import-offer'); }}><p>{t('Черновик этого браузера можно перенести в аккаунт. Баланс и права не переносятся.')}</p><div className="modal-actions"><Button onClick={() => { setOffer(null); sessionStorage.removeItem('neon-import-offer'); }}>{t('Не сейчас')}</Button><Button variant="primary" onClick={async () => { const draft = await adapter ? await request<{ draft: Settings }>('/v1/draft/import', 'POST', offer) : null; if (draft) update(s => ({ ...s, draft: draft.draft })); setOffer(null); sessionStorage.removeItem('neon-import-offer'); }}>{t('Импортировать черновик')}</Button></div></Modal>;
}
