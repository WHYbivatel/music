'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { SoundMark } from './atmosphere';
import { PRODUCT } from '@/lib/config';
import { adapter } from '@/lib/adapters';
import { update } from '@/lib/store';
import { Button, Panel, useUI } from './ui';
export default function Auth({register}:{register:boolean}){const router=useRouter();const {notify}=useUI();return <div className="auth-wrap"><Panel className="auth-card"><div className="auth-icon"><SoundMark/></div><div className="eyebrow">{PRODUCT.name}</div><h1>{register?'Начни свою историю':'С возвращением'}<span className="pink-text">.</span></h1><p>{register?'Твоему следующему треку нужен только первый шаг.':'Твои идеи уже ждут своего звучания.'}</p><div className="notice">Серверная авторизация пока не подключена. Доступен локальный профиль без пароля и личных данных.</div><Button variant="primary" className="full-width" onClick={async()=>{const user=await adapter.auth.login();update(s=>({...s,user}));notify('Добро пожаловать в студию');router.push('/');}}>Открыть студию<ArrowRight size={17}/></Button><p className="centered">{register?'Уже есть аккаунт?':'Первый раз здесь?'} <Link className="pink-text" href={register?'/login':'/register'}>{register?'Войти':'Создать аккаунт'}</Link></p><span className="field-hint">Реальная регистрация появится после подключения backend.</span></Panel></div>;}
