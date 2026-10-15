import { changePayment, createJob, createPayment, settleJobs } from './engine';
import { getState, update, transaction, recordAudit } from './store';
import type { AppAdapter } from './types';
export const DATA_MODE=process.env.NEXT_PUBLIC_DATA_MODE || 'mock';
const BASE=process.env.NEXT_PUBLIC_API_BASE_URL;
export async function request<T>(path:string,method='GET',body?:unknown,key?:string):Promise<T>{
 if(!BASE)throw new Error('API не настроен. Укажите NEXT_PUBLIC_API_BASE_URL и перезапустите приложение.');
 const res=await fetch(`${BASE}${path}`,{method,credentials:'include',headers:{'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:body?JSON.stringify(body):undefined});
 if(!res.ok)throw new Error(`Ошибка API (${res.status}). Попробуйте позже.`);
 return res.status===204?undefined as T:res.json();
}
export const mockAdapter:AppAdapter={
 auth:{async current(){return getState().user;},async login(){update(s=>({...s,user:{name:'Алекс',email:'alex@demo.neonsound.local'}}));recordAudit('auth.login','Вход в демонстрационный аккаунт');return getState().user;},async logout(){recordAudit('auth.logout','Выход из аккаунта');update(s=>({...s,user:null}));}},
 generation:{async active(){return getState().jobs.find(j=>['queued','generating'].includes(j.status))||null;},async create(settings,key,fail){return transaction(()=>{update(s=>createJob(s,settings,key,fail));return getState().jobs.find(j=>j.key===key)!;});},async status(id){await transaction(()=>update(s=>settleJobs(s)));const j=getState().jobs.find(j=>j.id===id);if(!j)throw new Error('Задание не найдено');return j;}},
 library:{async list(){return getState().tracks;},async update(id,patch){update(s=>({...s,tracks:s.tracks.map(t=>t.id===id?{...t,...patch}:t)}));},async remove(id){update(s=>({...s,tracks:s.tracks.filter(t=>t.id!==id)}));},async download(id){const t=getState().tracks.find(t=>t.id===id);if(!t)throw new Error('Трек не найден');return {url:t.audioUrl};}},
 balance:{async get(){const s=getState();return {available:s.balance,reserved:s.jobs.filter(j=>['queued','generating'].includes(j.status)).reduce((n,j)=>n+j.cost,0)};},async operations(){return getState().operations;}},
 payments:{async list(){return getState().payments;},async create(packageId){const id=`NS-${crypto.randomUUID().slice(0,8).toUpperCase()}`;return transaction(()=>{update(s=>createPayment(s,packageId,id));return getState().payments.find(p=>p.id===id)!;});},async paid(id){await transaction(()=>update(s=>changePayment(s,id,'paid')));}}
};
export const apiAdapter:AppAdapter={auth:{current:()=>request('/v1/auth/me'),login:()=>request('/v1/auth/demo','POST'),logout:()=>request('/v1/auth/logout','POST')},generation:{active:()=>request('/v1/generations/active'),create:(settings,key)=>request('/v1/generations','POST',settings,key),status:id=>request(`/v1/generations/${id}`)},library:{list:()=>request('/v1/tracks'),update:(id,patch)=>request(`/v1/tracks/${id}`,'PATCH',patch),remove:id=>request(`/v1/tracks/${id}`,'DELETE'),download:id=>request(`/v1/tracks/${id}/download`)},balance:{get:()=>request('/v1/balance'),operations:()=>request('/v1/balance/operations')},payments:{list:()=>request('/v1/payments'),create:packageId=>request('/v1/payments','POST',{packageId},crypto.randomUUID()),paid:id=>request(`/v1/payments/${id}/paid`,'POST')}};
export const adapter=DATA_MODE==='api'?apiAdapter:mockAdapter;

export async function demoReview(id:string,action:'confirm'|'reject'){if(DATA_MODE!=='mock')throw new Error('Демопанель недоступна в API-режиме');await transaction(()=>update(s=>changePayment(s,id,action)));}
