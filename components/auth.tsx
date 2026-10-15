'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AudioLines, ArrowRight, ShieldCheck } from 'lucide-react';
import { PRODUCT } from '@/lib/config';
import { adapter } from '@/lib/adapters';
import { update } from '@/lib/store';
import { Button, Panel, useUI } from './ui';
export default function Auth({register}:{register:boolean}){const router=useRouter();const {notify}=useUI();return <div className="auth-wrap"><Panel className="auth-card"><div className="auth-icon"><AudioLines size={32}/></div><div className="eyebrow">{PRODUCT.name}</div><h1>{register?'Начни свою историю':'С возвращением'}<span className="pink-text">.</span></h1><p>{register?'Твоему следующему треку нужен только первый шаг.':'Твои идеи уже ждут своего звучания.'}</p><div className="notice"><ShieldCheck size={22}/>Авторизация пока не подключена. Можно войти в локальный демопрофиль без пароля и реальных личных данных.</div><Button variant="primary" className="full-width" onClick={async()=>{const user=await adapter.auth.login();update(s=>({...s,user}));notify('Вы вошли в деморежим');router.push('/');}}>Войти в деморежим<ArrowRight size={17}/></Button><p className="centered">{register?'Уже есть аккаунт?':'Первый раз здесь?'} <Link className="pink-text" href={register?'/login':'/register'}>{register?'Войти':'Создать аккаунт'}</Link></p><span className="field-hint">Реальная регистрация появится после подключения backend.</span></Panel></div>;}
