'use client';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { t, userError, getActiveLocale } from '@/lib/i18n';
import { LocaleLink as Link, useI18n } from './i18n';
import { SoundMark } from './atmosphere';
import { PRODUCT } from '@/lib/config';
import { adapter, DATA_MODE } from '@/lib/adapters';
import { forgetAccount, update } from '@/lib/store';
import { Button, Panel, useUI } from './ui';

function finish(router: ReturnType<typeof useRouter>, href: (path: string) => string, notify: (message: string) => void, onRefresh?: () => Promise<void>) {
  notify(t('Добро пожаловать в студию'));
  router.push(href('/studio'));
  onRefresh?.();
}

export default function Auth({ register, onRefresh }: { register: boolean; onRefresh?: () => Promise<void> }) {
  const router = useRouter();
  const { notify } = useUI();
  const { href } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const api = DATA_MODE === 'api';
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!api) {
      const user = await adapter.auth.login();
      update(s => ({ ...s, user }));
      finish(router, href, notify, onRefresh);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const user = register ? await adapter.auth.register({ name, email, password }) : await adapter.auth.login({ email, password });
      update(s => ({ ...s, user }));
      const raw = localStorage.getItem('neon-sound-demo-v1');
      if (raw) sessionStorage.setItem('neon-import-offer', raw);
      finish(router, href, notify, onRefresh);
    } catch (e) {
      setError(userError(getActiveLocale(), e));
    } finally {
      setBusy(false);
    }
  }
  return <div className="auth-wrap"><Panel className="auth-card"><form onSubmit={submit}><div className="auth-icon"><SoundMark/></div><div className="eyebrow">{PRODUCT.name}</div><h1>{register ? t('Начни свою историю') : t('С возвращением')}<span className="pink-text">.</span></h1><p>{register ? t('Твоему следующему треку нужен только первый шаг.') : t('Твои идеи уже ждут своего звучания.')}</p>{api ? <div className="notice">{t('wallet.test.banner')}</div> : <div className="notice">{t('Серверная авторизация пока не подключена. Доступен локальный профиль без пароля и личных данных.')}</div>}{api && register && <label className="field"><span>{t('Имя')}</span><input value={name} autoComplete="name" onChange={e => setName(e.target.value)} required/></label>}{api && <label className="field"><span>{t('Email')}</span><input type="email" value={email} autoComplete="email" onChange={e => setEmail(e.target.value)} required/></label>}{api && <label className="field"><span>{t('Пароль')}</span><input type="password" value={password} autoComplete={register ? 'new-password' : 'current-password'} minLength={10} onChange={e => setPassword(e.target.value)} required/></label>}{error && <p className="error-message" role="alert">{error}</p>}<Button variant="primary" className="full-width" loading={busy} type="submit">{api ? (register ? t('Создать аккаунт') : t('Войти')) : t('Открыть студию')}<ArrowRight size={17}/></Button><p className="centered">{register ? t('Уже есть аккаунт?') : t('Первый раз здесь?')} <Link className="pink-text" href={register ? '/login' : '/register'}>{register ? t('Войти') : t('Создать аккаунт')}</Link></p>{api && !register && <p className="centered"><Link href="/forgot">{t('Забыли пароль?')}</Link></p>}{!api && <span className="field-hint">{t('Реальная регистрация появится после подключения backend.')}</span>}</form></Panel></div>;
}

export function Forgot() {
  const { notify } = useUI();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const result = await adapter.auth.requestReset(email);
      setMessage(t(result.code));
      notify(t(result.code));
    } catch (e) {
      setMessage(userError(getActiveLocale(), e));
    } finally {
      setBusy(false);
    }
  }
  return <div className="auth-wrap"><Panel className="auth-card"><form onSubmit={submit}><div className="auth-icon"><SoundMark/></div><h1>{t('Забыли пароль?')}</h1><p>{t('error.mail')}</p><label className="field"><span>{t('Email')}</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} required/></label>{message && <p className="notice" role="status">{message}</p>}<Button variant="primary" className="full-width" loading={busy} type="submit">{t('Отправить')}</Button><p className="centered"><Link href="/login">{t('Войти')}</Link></p></form></Panel></div>;
}

export function Reset() {
  const params = useSearchParams();
  const router = useRouter();
  const { href } = useI18n();
  const { notify } = useUI();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== again) { setError(t('Пароли не совпадают')); return; }
    setBusy(true);
    setError('');
    try {
      await adapter.auth.resetPassword(params.get('token') || '', password);
      notify(t('Пароль обновлён'));
      router.push(href('/login'));
    } catch (e) {
      setError(userError(getActiveLocale(), e));
    } finally {
      setBusy(false);
    }
  }
  return <div className="auth-wrap"><Panel className="auth-card"><form onSubmit={submit}><div className="auth-icon"><SoundMark/></div><h1>{t('Новый пароль')}</h1><label className="field"><span>{t('Новый пароль')}</span><input type="password" value={password} minLength={10} autoComplete="new-password" onChange={e => setPassword(e.target.value)} required/></label><label className="field"><span>{t('Повторите пароль')}</span><input type="password" value={again} minLength={10} autoComplete="new-password" onChange={e => setAgain(e.target.value)} required/></label>{error && <p className="error-message" role="alert">{error}</p>}<Button variant="primary" className="full-width" loading={busy} type="submit">{t('Сохранить пароль')}</Button></form></Panel></div>;
}

export function PasswordForm() {
  const { notify } = useUI();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  if (DATA_MODE !== 'api') return null;
  return <form className="stack-form" onSubmit={async event => { event.preventDefault(); setBusy(true); try { await adapter.auth.changePassword(current, password); setCurrent(''); setPassword(''); notify(t('Пароль обновлён')); } catch (e) { notify(userError(getActiveLocale(), e)); } finally { setBusy(false); } }}><h3>{t('Новый пароль')}</h3><label className="field"><span>{t('Текущий пароль')}</span><input type="password" value={current} autoComplete="current-password" onChange={e => setCurrent(e.target.value)} required/></label><label className="field"><span>{t('Новый пароль')}</span><input type="password" value={password} minLength={10} autoComplete="new-password" onChange={e => setPassword(e.target.value)} required/></label><Button loading={busy} type="submit">{t('Сохранить пароль')}</Button></form>;
}

export function logoutAccount(notify: (message: string) => void) {
  return adapter.auth.logout().finally(() => { forgetAccount(); window.dispatchEvent(new Event('neon-account-changed')); notify(t('Вы вышли из профиля')); });
}
