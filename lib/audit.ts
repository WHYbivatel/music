import type { DemoState } from './types';
export type Actor = { name: string; email: string; role: 'user' | 'admin' | 'system' | 'guest' };
export type AuditEvent = { id: string; created: number; action: string; actor: Actor; summary: string; entity?: string; outcome: 'success' | 'pending' | 'error'; amount?: number; tokens?: number; source: 'local' | 'example' };
export const ADMIN_ACTOR:Actor={name:'Администратор',email:'admin@demo.neonsound.local',role:'admin'};
export const actorOf=(s:DemoState):Actor=>s.user?{...s.user,role:'user'}:{name:'Гость',email:'—',role:'guest'};
export function event(action:string,summary:string,actor:Actor,extra:Partial<AuditEvent>={}):AuditEvent{return {id:crypto.randomUUID(),created:Date.now(),action,summary,actor,outcome:'success',source:'local',...extra};}
export function withAudit(state:DemoState,entry:AuditEvent):DemoState{return {...state,audit:[entry,...(state.audit||[])].slice(0,2000)};}
// Capture accepted state changes centrally, so every entry agrees with the committed balance.
export function auditTransition(previous:DemoState,next:DemoState):DemoState {
 const entries:AuditEvent[]=[];const actor=actorOf(previous);
 for(const p of next.payments){const old=previous.payments.find(v=>v.id===p.id);
  if(!old)entries.push(event('payment.created','Создана заявка на пополнение',actor,{entity:p.id,amount:p.price,tokens:p.tokens,outcome:'pending'}));
  else if(old.status!==p.status){const paid=p.status==='pending_review';entries.push(event(paid?'payment.submitted':p.status==='confirmed'?'payment.confirmed':'payment.rejected',paid?'Перевод отправлен на проверку':p.status==='confirmed'?'Пополнение подтверждено':'Заявка отклонена',paid?actor:ADMIN_ACTOR,{entity:p.id,amount:p.price,tokens:p.tokens,outcome:paid?'pending':p.status==='confirmed'?'success':'error'}));}
 }
 for(const j of next.jobs){const old=previous.jobs.find(v=>v.id===j.id);
  if(!old)entries.push(event('generation.created','Запущена генерация, токены зарезервированы',actor,{entity:j.id,tokens:j.cost,outcome:'pending'}));
  else if(old.status!==j.status&&['ready','error'].includes(j.status))entries.push(event(j.status==='ready'?'generation.completed':'generation.failed',j.status==='ready'?'Трек создан, резерв списан':'Ошибка генерации, резерв возвращён',{name:'Система',email:'—',role:'system'},{entity:j.id,tokens:j.cost,outcome:j.status==='ready'?'success':'error'}));
 }
 for(const t of previous.tracks){const changed=next.tracks.find(v=>v.id===t.id);if(!changed)entries.push(event('track.deleted','Трек удалён',actor,{entity:t.title}));else if(changed.title!==t.title)entries.push(event('track.renamed',`Трек переименован: ${changed.title}`,actor,{entity:t.id}));else if(changed.favorite!==t.favorite)entries.push(event('track.favorite',changed.favorite?'Трек добавлен в избранное':'Трек убран из избранного',actor,{entity:t.id}));}
 if(previous.user&&next.user&&previous.user.name!==next.user.name)entries.push(event('profile.updated','Изменено имя профиля',actor));
 return entries.length?{...next,audit:[...entries.reverse(),...(next.audit||[])].slice(0,2000)}:next;
}
