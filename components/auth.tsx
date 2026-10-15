'use client';
import { t } from '@/lib/i18n';
import { LocaleLink as Link, useI18n } from './i18n';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { SoundMark } from './atmosphere';
import { PRODUCT } from '@/lib/config';
import { adapter } from '@/lib/adapters';
import { update } from '@/lib/store';
import { Button, Panel, useUI } from './ui';
export default function Auth({register}:{register:boolean}){const router=useRouter();const {notify}=useUI();const {href}=useI18n();return <div className="auth-wrap"><Panel className="auth-card"><div className="auth-icon"><SoundMark/></div><div className="eyebrow">{PRODUCT.name}</div><h1>{register?t("Начни свою историю"):t("С возвращением")}<span className="pink-text">.</span></h1><p>{register?t("Твоему следующему треку нужен только первый шаг."):t("Твои идеи уже ждут своего звучания.")}</p><div className="notice">{t("Серверная авторизация пока не подключена. Доступен локальный профиль без пароля и личных данных.")}</div><Button variant="primary" className="full-width" onClick={async()=>{const user=await adapter.auth.login();update(s=>({...s,user}));notify(t("Добро пожаловать в студию"));router.push(href('/'));}}>{t("Открыть студию")}<ArrowRight size={17}/></Button><p className="centered">{register?t("Уже есть аккаунт?"):t("Первый раз здесь?")} <Link className="pink-text" href={register?'/login':'/register'}>{register?t("Войти"):t("Создать аккаунт")}</Link></p><span className="field-hint">{t("Реальная регистрация появится после подключения backend.")}</span></Panel></div>;}
