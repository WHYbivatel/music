'use client';
import { t } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getState } from '@/lib/store';
import { BUILD, RELEASE_CHECK_MS, parseBuild, type ReloadGuard } from '@/lib/version';
import { createReleaseManager, type ReleaseState } from '@/lib/release-manager';
import { Button } from './ui';

const GUARD='neon-release-reload';
function workerVersion(worker:ServiceWorker|null):Promise<string|null>{
 if(!worker)return Promise.resolve(null);
 return new Promise(resolve=>{const channel=new MessageChannel();const finish=(value:string|null)=>{clearTimeout(timer);channel.port1.close();channel.port2.close();resolve(value);};const timer=setTimeout(()=>finish(null),600);channel.port1.onmessage=e=>finish(typeof e.data?.id==='string'?e.data.id:null);try{worker.postMessage({type:'GET_VERSION'},[channel.port2]);}catch{finish(null);}});
}
function safeToReload(){
 const focused=document.activeElement;
 const editing=focused instanceof HTMLElement&&(focused.matches('input:not([readonly]),textarea,select')||focused.isContentEditable);
 const working=getState().jobs.some(j=>j.status==='queued'||j.status==='generating');
 const audio=[...document.querySelectorAll('audio')].some(a=>!a.paused&&!a.ended);
 return !editing&&!working&&!audio&&!document.querySelector('dialog[open],[aria-busy="true"]');
}
export default function ReleaseUpdater(){
 const [state,setState]=useState<ReleaseState>({target:null,stage:'current'}),[apply,setApply]=useState<(()=>void)|null>(null);
 useEffect(()=>{
  if(process.env.NODE_ENV!=='production')return;
  let disposed=false,registration:ServiceWorkerRegistration|undefined;const removers:(()=>void)[]=[];
  const savedGuard=():ReloadGuard=>{try{const v=JSON.parse(sessionStorage.getItem(GUARD)||'null');return v&&typeof v.id==='string'&&typeof v.time==='number'?v:null;}catch{return null;}};
  const manager=createReleaseManager({
   currentId:BUILD.id,
   async latest(){const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),7000);try{const response=await fetch(`/api/version?check=${Date.now()}`,{cache:'no-store',credentials:'omit',signal:controller.signal});if(!response.ok)throw new Error('Version unavailable');const value=parseBuild(await response.json());if(!value||value.id==='development')throw new Error('Invalid release');return value;}finally{clearTimeout(timeout);}},
   async checkWorker(){await registration?.update();},
   async worker(){if(!registration)return null;const [activeId,waitingId]=await Promise.all([workerVersion(navigator.serviceWorker.controller||registration.active),workerVersion(registration.waiting)]);const waiting=registration.waiting;return {activeId,waiting:waiting?{id:waitingId,activate:()=>waiting.postMessage({type:'SKIP_WAITING'})}:null,installing:!!registration.installing};},
   safe:safeToReload,visible:()=>document.visibilityState==='visible'&&navigator.onLine,
   guard:savedGuard,remember:guard=>{try{sessionStorage.setItem(GUARD,JSON.stringify(guard));}catch{}},
   reload:id=>{const url=new URL(location.href);url.searchParams.set('__release',id);location.replace(url.href);},changed:s=>{if(!disposed)setState(s);}
  });
  setApply(()=>()=>{void manager.apply(true);});
  // Remove the navigation cache-buster only after the matching bundle has loaded.
  const url=new URL(location.href);if(url.searchParams.get('__release')===BUILD.id){url.searchParams.delete('__release');history.replaceState(history.state,'',url.href);}
  const check=()=>{if(document.visibilityState==='visible'&&navigator.onLine)void manager.check();};
  const add=(target:Window|Document|ServiceWorkerContainer,name:string,callback:EventListener)=>{target.addEventListener(name,callback);removers.push(()=>target.removeEventListener(name,callback));};
  add(document,'visibilitychange',check);add(window,'focus',check);add(window,'pageshow',check);add(window,'online',check);
  if('serviceWorker'in navigator){
   add(navigator.serviceWorker,'controllerchange',check);
   add(navigator.serviceWorker,'message',e=>{if((e as MessageEvent).data?.type==='APP_VERSION')check();});
   navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(reg=>{
    if(disposed)return;registration=reg;
    const found=()=>{const worker=reg.installing;if(!worker)return;const installed=()=>{if(worker.state==='installed')check();};worker.addEventListener('statechange',installed);removers.push(()=>worker.removeEventListener('statechange',installed));};
    reg.addEventListener('updatefound',found);removers.push(()=>reg.removeEventListener('updatefound',found));if(reg.installing)found();check();
   }).catch(()=>{/* The independent version endpoint still updates browsers without SW support. */});
  }
  const poll=setInterval(check,RELEASE_CHECK_MS);const tick=setInterval(()=>{void manager.apply();},1000);check();
  return()=>{disposed=true;manager.dispose();clearInterval(poll);clearInterval(tick);removers.forEach(remove=>remove());};
 },[]);
 if(!state.target)return null;
 const label=state.stage==='deferred'?t("Новая версия готова. Обновим после завершения текущего действия."):state.stage==='installing'?t("Загружаем новую версию приложения…"):state.stage==='reloading'?t("Обновляем приложение…"):state.stage==='retry'?t("Проверяем, что новая версия доступна. Повторим автоматически."):t("Новая версия готова. Страница обновится автоматически.");
 return <div className="pwa-update" role="status"><RefreshCw size={17}/><span>{label}<small className="release-target">v{state.target.version} · {state.target.id.slice(0,8)}</small></span><Button disabled={state.stage==='reloading'||state.stage==='installing'} onClick={()=>apply?.()}>{t("Обновить сейчас")}</Button></div>;
}
export function BuildVersion(){return <span className="build-version" title={`${t('build.label',{id:BUILD.id})}\n${t('build.date',{date:BUILD.builtAt||t("режим разработки")})}\nCommit: ${BUILD.revision}`}>v{BUILD.version}<span> · {BUILD.id==='development'?'DEV':BUILD.id.slice(-8)}</span></span>;}
