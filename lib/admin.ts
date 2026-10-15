import { ADMIN_ACTOR, event, withAudit, type Actor, type AuditEvent } from './audit';
import { PRICING } from './config';
import { changePayment } from './engine';
import { DATA_MODE, request } from './adapters';
import { getState, recordAudit, transaction, update } from './store';
import type { DemoState, Payment, Job } from './types';
export const DEMO_ADMIN={email:ADMIN_ACTOR.email,password:'neon-admin-demo'};
const SESSION='neon-admin-session';
export type AdminUser={id:string;name:string;email:string;balance:number;spent:number;generations:number;lastSeen:number;source:'local'|'example'};
const examplePeople=[['Алия Садыкова','aliya@example.test'],['Даниил Ким','daniil@example.test'],['Мария Волкова','maria@example.test'],['Тимур Асанов','timur@example.test']];
export const exampleActor=(index:number):Actor=>({name:examplePeople[index%4][0],email:examplePeople[index%4][1],role:'user'});
export function examplePayments(now=Date.now()):Payment[]{return ['pending_review','confirmed','pending_review','confirmed','rejected'].map((status,i)=>{const p=PRICING.packages[[1,2,0,1,0][i]];return {id:`EXAMPLE-00${i+1}`,packageId:p.id,status:status as Payment['status'],created:now-(i+1)*3600000,price:p.price,tokens:p.tokens};});}
export function sampleAudit(payments:Payment[]):AuditEvent[]{return payments.flatMap((p,i)=>[
 event('auth.login','Вход в аккаунт',exampleActor(i),{id:`example-login-${p.id}`,created:p.created-180000,source:'example'}),
 event('payment.created','Создана заявка на пополнение',exampleActor(i),{id:`example-created-${p.id}`,created:p.created-120000,entity:p.id,amount:p.price,tokens:p.tokens,source:'example',outcome:'pending'}),
 event(p.status==='confirmed'?'payment.confirmed':p.status==='rejected'?'payment.rejected':'payment.submitted',p.status==='confirmed'?'Пополнение подтверждено':p.status==='rejected'?'Заявка отклонена':'Перевод отправлен на проверку',p.status==='pending_review'?exampleActor(i):ADMIN_ACTOR,{id:`example-status-${p.id}`,created:p.created,entity:p.id,amount:p.price,tokens:p.tokens,source:'example',outcome:p.status==='pending_review'?'pending':p.status==='confirmed'?'success':'error'}),
 ...[1,3].includes(i)?[event('generation.completed','Создан двухминутный трек',exampleActor(i),{id:`example-generation-${p.id}`,created:p.created+300000,entity:`EXAMPLE-GEN-${i}`,tokens:20,source:'example'})]:[]
]).sort((a,b)=>b.created-a.created);}
export function adminUsers(s:DemoState):AdminUser[]{const audit=s.audit||[];const last=audit.find(e=>['auth.login','session.visit'].includes(e.action)&&e.actor.role==='user');return [{id:'local',name:s.user?.name||'Алекс',email:s.user?.email||'alex@demo.neonsound.local',balance:s.balance,spent:s.payments.filter(p=>p.status==='confirmed').reduce((n,p)=>n+p.price,0),generations:s.jobs.filter(j=>j.status==='ready').length,lastSeen:last?.created||0,source:'local'},...examplePeople.map(([name,email],i)=>{const payments=(s.adminExamples||[]).filter((_,k)=>k%4===i);return {id:`example-${i}`,name,email,balance:Math.max(0,payments.filter(p=>p.status==='confirmed').reduce((n,p)=>n+p.tokens,0)-[0,1,0,1][i]*20),spent:payments.filter(p=>p.status==='confirmed').reduce((n,p)=>n+p.price,0),generations:[0,1,0,1][i],lastSeen:payments[0]?.created||0,source:'example' as const};})];}
export function reviewState(s:DemoState,id:string,action:'confirm'|'reject'):DemoState{
 const example=s.adminExamples?.find(p=>p.id===id);
 if(!example)return changePayment(s,id,action);
 if(example.status!=='pending_review')return s;
 const next={...s,adminExamples:s.adminExamples!.map(p=>p.id===id?{...p,status:action==='confirm'?'confirmed' as const:'rejected' as const}:p)};
 return withAudit(next,event(action==='confirm'?'payment.confirmed':'payment.rejected',action==='confirm'?'Пример заявки подтверждён':'Пример заявки отклонён',ADMIN_ACTOR,{entity:id,source:'example',amount:example.price,tokens:example.tokens,outcome:action==='confirm'?'success':'error'}));
}
export type AdminSnapshot={users:AdminUser[];payments:(Payment&{customer:Actor;source:'local'|'example'})[];audit:AuditEvent[];jobs:Job[]};
export function snapshot(s:DemoState):AdminSnapshot{return {users:adminUsers(s),jobs:s.jobs,payments:[...s.payments.map(p=>({...p,customer:s.audit?.find(e=>e.entity===p.id&&e.action==='payment.created')?.actor||{...adminUsers(s)[0],role:'user' as const},source:'local' as const})),...(s.adminExamples||[]).map((p,i)=>({...p,customer:exampleActor(i),source:'example' as const}))].sort((a,b)=>b.created-a.created),audit:[...(s.audit||[]),...(s.adminSeedAudit||sampleAudit(s.adminExamples||[]))].sort((a,b)=>b.created-a.created)};}
export const adminAdapter={
 async session():Promise<Actor|null>{return DATA_MODE==='api'?request('/v1/admin/session'):sessionStorage.getItem(SESSION)==='demo'?ADMIN_ACTOR:null;},
 async login(){if(DATA_MODE==='api')throw new Error('Демовход доступен только в mock-режиме. Для API требуется серверная авторизация администратора.');sessionStorage.setItem(SESSION,'demo');recordAudit('admin.login','Вход в панель управления',{},ADMIN_ACTOR);},
 async logout(){if(DATA_MODE==='api')await request('/v1/admin/logout','POST');else{recordAudit('admin.logout','Выход из панели управления',{},ADMIN_ACTOR);sessionStorage.removeItem(SESSION);}},
 async list():Promise<AdminSnapshot>{if(DATA_MODE==='api')return request('/v1/admin/overview');if(!await this.session())throw new Error('Войдите в админку');if(!getState().adminExamples||!getState().adminSeedAudit)update(s=>{const payments=s.adminExamples||examplePayments();return {...s,adminExamples:payments,adminSeedAudit:sampleAudit(payments)};});return snapshot(getState());},
 async review(id:string,action:'confirm'|'reject'){if(DATA_MODE==='api'){await request(`/v1/admin/payments/${encodeURIComponent(id)}/${action}`,'POST',undefined,crypto.randomUUID());return;}if(!await this.session())throw new Error('Войдите в админку');await transaction(()=>update(s=>reviewState(s,id,action)));}
};
export const ACTION_LABELS:Record<string,string>={'session.visit':'Посещение','auth.login':'Вход пользователя','auth.logout':'Выход пользователя','admin.login':'Вход администратора','admin.logout':'Выход администратора','payment.created':'Заявка создана','payment.submitted':'Проверка перевода','payment.confirmed':'Покупка подтверждена','payment.rejected':'Заявка отклонена','generation.created':'Запуск генерации','generation.completed':'Трек готов','generation.failed':'Возврат токенов','track.renamed':'Переименование','track.favorite':'Избранное','track.deleted':'Удаление трека','track.download':'Скачивание','profile.updated':'Изменение профиля','demo.reset':'Сброс демонстрации'};
