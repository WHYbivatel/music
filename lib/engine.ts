import { cost, PRICING, EXAMPLES } from './config';
import { normalizeTags, prepareRequest } from './tags';
import { defaults, type DemoState, type Settings, type Track } from './types';
export function initialState(): DemoState {
 return { version: 1, balance: PRICING.initialBalance, tracks: ['Midnight in Tokyo', 'Тихие орбиты', 'Beyond the horizon'].map((title,i) => ({ id: `seed-${i}`, title, created: Date.now() - (i+1)*86400000, settings: {...defaults, prompt: EXAMPLES[i].prompt, genre: EXAMPLES[i].genre}, cover: i+1, favorite: i === 1, audioUrl: '/audio/demo-120.wav', demo: true })), jobs: [], payments: [], operations: [], draft: {...defaults}, user: {name:'Алекс', email:'alex@demo.neonsound.local'} };
}
export function createJob(state: DemoState, settings: Settings, key: string, fail = false, now = Date.now()): DemoState {
 if (state.jobs.some(j => j.key === key)) return state;
 if (state.jobs.some(j => ['queued','generating'].includes(j.status))) throw new Error('Дождитесь завершения текущего трека');
 if (!settings.prompt.trim()) throw new Error('Опишите музыку, которую хотите создать');
 if (settings.prompt.length > 1500 || ![30,60,120,180].includes(settings.duration)) throw new Error('Проверьте описание и длительность');
 prepareRequest(settings);
 const price = cost(settings.duration);
 if (state.balance < price) throw new Error('Недостаточно токенов. Пополните баланс');
 const id = `gen-${key}`;
 return {...state, balance: state.balance-price, jobs:[{id,key,settings:{...settings,tags:normalizeTags(settings.tags)},status:'queued',created:now,cost:price,fail},...state.jobs], operations:[{id,kind:'reserve',amount:-price,label:'Резерв на создание трека',created:now},...state.operations]};
}
export function settleJobs(state: DemoState, now = Date.now()): DemoState {
 let next = state;
 for (const job of state.jobs) {
  if (!['queued','generating'].includes(job.status)) continue;
  const elapsed = now-job.created;
  if (elapsed < 2000) continue;
  if (elapsed < 6500) {
   if(job.status === 'queued') next={...next,jobs:next.jobs.map(j=>j.id===job.id?{...j,status:'generating'}:j)};
   continue;
  }
  const success = !job.fail;
  const track: Track = {id:job.id,title:job.settings.title.trim() || 'Новая волна',created:now,settings:job.settings,cover:(state.tracks.length%4)+1,favorite:false,audioUrl:`/audio/demo-${job.settings.duration}.wav`,demo:true};
  next={...next,balance:next.balance+(success?0:job.cost),jobs:next.jobs.map(j=>j.id===job.id?{...j,status:success?'ready':'error',trackId:success?track.id:undefined}:j),tracks:success?[track,...next.tracks]:next.tracks,operations:[...(!success?[{id:`refund-${job.id}`,kind:'refund' as const,amount:job.cost,label:'Возврат: ошибка генерации',created:now}]:[]),...next.operations.map(op=>op.id===job.id?{...op,kind:success?'generation' as const:'reserve' as const,label:success?'Создание трека':'Резерв освобождён'}:op)]};
 }
 return next;
}
export function createPayment(state:DemoState, packageId:string, id:string):DemoState {
 const p=PRICING.packages.find(p=>p.id===packageId);if(!p) throw new Error('Пакет не найден');
 if(state.payments.some(p=>p.id===id))return state;
 return {...state,payments:[{id,packageId,status:'awaiting_payment',created:Date.now(),price:p.price,tokens:p.tokens},...state.payments]};
}
export function changePayment(state: DemoState,id:string,action:'paid'|'confirm'|'reject'): DemoState {
 const p=state.payments.find(p=>p.id===id);if(!p)throw new Error('Заявка не найдена');
 if(action==='paid' && p.status!=='awaiting_payment')return state;
 if(action!=='paid' && p.status!=='pending_review')return state;
 const status=action==='paid'?'pending_review':action==='confirm'?'confirmed':'rejected';
 return {...state,payments:state.payments.map(p=>p.id===id?{...p,status}:p),balance:state.balance+(action==='confirm'?p.tokens:0),operations:action==='confirm'?[{id:`payment-${id}`,kind:'topup',amount:p.tokens,label:'Пополнение баланса',created:Date.now()},...state.operations]:state.operations};
}
