'use client';
import { event, withAudit, actorOf, auditTransition, type Actor } from './audit';
import { useSyncExternalStore } from 'react';
import { initialState, settleJobs } from './engine';
import type { DemoState } from './types';
const IS_API=process.env.NEXT_PUBLIC_DATA_MODE==='api';
const KEY=IS_API?'neon-sound-api-cache-v1':'neon-sound-demo-v1';
function fresh():DemoState { const s=initialState();return IS_API?{...s,balance:0,tracks:[],jobs:[],payments:[],operations:[],user:null}:s; }
let state:DemoState|undefined;
let hydrated=false;
const listeners=new Set<()=>void>();
export function getState():DemoState {if(!state)state=fresh();return state;}
export function initStore() {
 if(hydrated)return;hydrated=true;
 try {const raw=localStorage.getItem(KEY);if(raw){const value=JSON.parse(raw);if(value.version===1 && Array.isArray(value.tracks) && typeof value.balance==='number')state=value;}}catch{}
 if(!IS_API)update(s=>settleJobs(s)); listeners.forEach(l=>l());
 window.addEventListener('storage',event=>{if(event.key===KEY && event.newValue){try{state=JSON.parse(event.newValue);listeners.forEach(l=>l());}catch{}}});
}
export function update(fn:(s:DemoState)=>DemoState) {
 // Read the latest snapshot before every synchronous local transaction, including other tabs.
 if(typeof window!=='undefined' && hydrated){try{const raw=localStorage.getItem(KEY);if(raw){const latest=JSON.parse(raw);if(latest.version===1)state=latest;}}catch{}}
 const current=getState(),candidate=fn(current);if(candidate===current)return;const next=IS_API?candidate:auditTransition(current,candidate);
 if(typeof window!=='undefined'){try{localStorage.setItem(KEY,JSON.stringify(next));}catch{throw new Error('Не удалось сохранить данные. Освободите место в браузере.');}}state=next;
 listeners.forEach(l=>l());
}
export function resetDemo(){update(s=>({...initialState(),audit:[event('demo.reset','Данные студии сброшены',actorOf(s))]}));}
export function useDemo(){return useSyncExternalStore(l=>{listeners.add(l);return()=>{listeners.delete(l);};},getState,()=>undefined);}

let pending=Promise.resolve();
export async function transaction<T>(work:()=>T|Promise<T>):Promise<T>{
 if(typeof navigator!=='undefined'&&navigator.locks)return navigator.locks.request('neon-sound-demo-transaction',work);
 const result=pending.then(work);pending=result.then(()=>undefined,()=>undefined);return result;
}

export function recordAudit(action:string,summary:string,extra:Parameters<typeof event>[3]={},actor?:Actor){if(IS_API)return;update(s=>withAudit(s,event(action,summary,actor||actorOf(s),extra)));}
