'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Download, RefreshCw, Share, Smartphone, WifiOff } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { ADMIN_ACTOR } from '@/lib/audit';
import { DATA_MODE } from '@/lib/adapters';
import { initStore, recordAudit } from '@/lib/store';
import ReleaseUpdater from './release-updater';
import { Button, Modal } from './ui';
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
const PWAContext=createContext({installed:false,installable:false,offline:false,install:()=>{}});
export function PWAProvider({children}:{children:ReactNode}){
 const [installed,setInstalled]=useState(false),[prompt,setPrompt]=useState<InstallEvent|null>(null),[offline,setOffline]=useState(false),[help,setHelp]=useState(false),[ios,setIos]=useState(false);const path=usePathname();const previous=useRef('');
 useEffect(()=>{initStore();if(DATA_MODE==='mock'&&previous.current!==path){previous.current=path;recordAudit('session.visit',`Открыта страница ${path}`,{entity:path},path.startsWith('/admin')?(sessionStorage.getItem('neon-admin-session')==='demo'?ADMIN_ACTOR:{name:'Посетитель админки',email:'—',role:'guest'}):undefined);}},[path]);
 useEffect(()=>{
  const media=window.matchMedia('(display-mode: standalone)');const standalone=()=>setInstalled(media.matches||!!(navigator as Navigator&{standalone?:boolean}).standalone);standalone();media.addEventListener('change',standalone);
  setIos(/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const network=()=>setOffline(!navigator.onLine);network();window.addEventListener('online',network);window.addEventListener('offline',network);
  const before=(e:Event)=>{e.preventDefault();setPrompt(e as InstallEvent);};const done=()=>{setInstalled(true);setPrompt(null);};window.addEventListener('beforeinstallprompt',before);window.addEventListener('appinstalled',done);
  return()=>{media.removeEventListener('change',standalone);window.removeEventListener('online',network);window.removeEventListener('offline',network);window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',done);};
 },[]);
 async function install(){if(prompt){await prompt.prompt();const result=await prompt.userChoice;if(result.outcome==='accepted')setPrompt(null);}else setHelp(true);}
 return <PWAContext.Provider value={{installed,installable:!!prompt,offline,install}}>{children}{offline&&<div className="pwa-network" role="status"><WifiOff size={15}/>{DATA_MODE==='mock'?'Нет сети · студия доступна':'Нет сети · серверные действия недоступны'}</div>}<ReleaseUpdater/><Modal title="Установить NEON SOUND" open={help} onClose={()=>setHelp(false)}><div className="pwa-install-intro"><img src="/icons/icon-192.png" alt=""/><div><h3>Студия всегда под рукой</h3><p>Открывайте музыку как отдельное приложение с домашнего экрана.</p></div></div>{installed?<p className="notice">Приложение уже открыто в отдельном режиме.</p>:ios?<ol className="pwa-instructions"><li>Откройте сайт в Safari.</li><li>Нажмите «Поделиться» <Share size={15}/>.</li><li>Выберите «На экран Домой» и нажмите «Добавить».</li></ol>:<ol className="pwa-instructions"><li>Откройте сайт в Chrome, Edge или другом браузере с поддержкой установки.</li><li>В меню браузера выберите «Установить приложение» или «Добавить на главный экран».</li><li>Подтвердите установку в браузере.</li></ol>}<p className="field-hint">Установка доступна на HTTPS и localhost, если её поддерживает браузер. При открытии с телефона адрес 127.0.0.1 указывает на сам телефон. Офлайн-режим работает в production после первого посещения; в режиме разработки кэширование отключено.</p><Button className="full-width" onClick={()=>setHelp(false)}>Понятно</Button></Modal></PWAContext.Provider>;
}
export function InstallAppButton(){const pwa=useContext(PWAContext);return <button className="install-app-button" onClick={pwa.install}><Smartphone size={15}/><span>{pwa.installed?'Приложение установлено':'Установить приложение'}</span>{!pwa.installed&&<Download size={13}/>}</button>;}
