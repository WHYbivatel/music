'use client';
import { stripLocale, t } from '@/lib/i18n';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Download, RefreshCw, Share, Smartphone, WifiOff } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { isHandheldDevice } from '@/lib/device';
import { ADMIN_ACTOR } from '@/lib/audit';
import { DATA_MODE } from '@/lib/adapters';
import { initStore, recordAudit } from '@/lib/store';
import ReleaseUpdater from './release-updater';
import { Button, Modal } from './ui';
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
const PWAContext=createContext({installed:false,installable:false,offline:false,handheld:null as boolean|null,install:()=>{}});
export function PWAProvider({children}:{children:ReactNode}){
 const [installed,setInstalled]=useState(false),[prompt,setPrompt]=useState<InstallEvent|null>(null),[offline,setOffline]=useState(false),[help,setHelp]=useState(false),[ios,setIos]=useState(false),[handheld,setHandheld]=useState<boolean|null>(null);const path=usePathname();const previous=useRef('');
 useEffect(()=>{initStore();if(DATA_MODE==='mock'&&previous.current!==path){previous.current=path;recordAudit('session.visit',`Открыта страница ${path}`,{entity:path},stripLocale(path).startsWith('/admin')?(sessionStorage.getItem('neon-admin-session')==='demo'?ADMIN_ACTOR:{name:'Посетитель админки',email:'—',role:'guest'}):undefined);}},[path]);
 useEffect(()=>{
  const media=window.matchMedia('(display-mode: standalone)');const standalone=()=>setInstalled(media.matches||!!(navigator as Navigator&{standalone?:boolean}).standalone);standalone();media.addEventListener('change',standalone);
  const phone=isHandheldDevice(navigator.userAgent,navigator.platform,navigator.maxTouchPoints);setHandheld(phone);setIos(phone&&(/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1));
  const network=()=>setOffline(!navigator.onLine);network();window.addEventListener('online',network);window.addEventListener('offline',network);
  const before=(e:Event)=>{if(!isHandheldDevice(navigator.userAgent,navigator.platform,navigator.maxTouchPoints))return;e.preventDefault();setPrompt(e as InstallEvent);};const done=()=>{setInstalled(true);setPrompt(null);};window.addEventListener('beforeinstallprompt',before);window.addEventListener('appinstalled',done);
  return()=>{media.removeEventListener('change',standalone);window.removeEventListener('online',network);window.removeEventListener('offline',network);window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',done);};
 },[]);
 async function install(){if(prompt){await prompt.prompt();const result=await prompt.userChoice;if(result.outcome==='accepted')setPrompt(null);}else setHelp(true);}
 return <PWAContext.Provider value={{installed,installable:!!prompt,offline,handheld,install}}>{children}{offline&&<div className="pwa-network" role="status"><WifiOff size={15}/>{DATA_MODE==='mock'?t("Нет сети · студия доступна"):t("Нет сети · серверные действия недоступны")}</div>}<ReleaseUpdater/><Modal title={t("Установить NEON SOUND")} open={help} onClose={()=>setHelp(false)}><div className="pwa-install-intro"><img src="/icons/icon-192.png" alt=""/><div><h3>{t("Установить NEON SOUND")}</h3><p>{t("Добавьте студию на телефон и открывайте её в отдельном окне.")}</p></div></div>{ios?<ol className="pwa-instructions"><li>{t("Откройте сайт в Safari.")}</li><li>{t("Нажмите «Поделиться»")}<Share size={15}/>.</li><li>{t("Выберите «На экран Домой» и нажмите «Добавить».")}</li></ol>:<ol className="pwa-instructions"><li>{t("Откройте меню браузера.")}</li><li>{t("Выберите «Установить приложение» или «Добавить на главный экран».")}</li><li>{t("Подтвердите установку.")}</li></ol>}<p className="field-hint">{t("Для создания музыки понадобится интернет.")}</p><Button className="full-width" onClick={()=>setHelp(false)}>{t("Понятно")}</Button></Modal></PWAContext.Provider>;
}
export function InstallAppButton(){const pwa=useContext(PWAContext);if(pwa.handheld!==true||pwa.installed)return null;return <button className="install-app-button" onClick={pwa.install}><Smartphone size={15}/><span>{t("Установить приложение")}</span><Download size={13}/></button>;}
