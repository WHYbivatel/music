'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown, LoaderCircle, X } from 'lucide-react';
import { MOTION } from '@/lib/config';
import CountUp from './react-bits/CountUp';
export type Theme={accent:string;radius:number;mode:'full'|'reduced'|'off';intensity:number};
const defaultTheme:Theme={accent:'#F34BA5',radius:14,mode:'full',intensity:50};
const UIContext=createContext({theme:defaultTheme,setTheme:(_theme:Theme)=>{},animated:false,notify:(_message:string)=>{}});
export const useUI=()=>useContext(UIContext);
export function UIProvider({children}:{children:ReactNode}){
 const [theme,setTheme]=useState(defaultTheme),[toast,setToast]=useState('');
 const reduce=useReducedMotion();const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{try{const v=localStorage.getItem('neon-theme');if(v)setTheme({...defaultTheme,...JSON.parse(v)});}catch{}},[]);
 useEffect(()=>{const root=document.documentElement;root.style.setProperty('--accent',theme.accent);root.style.setProperty('--radius',`${theme.radius}px`);root.style.setProperty('--effect-intensity',`${theme.intensity/100}`);root.dataset.motion=reduce&&theme.mode==='full'?'reduced':theme.mode;try{localStorage.setItem('neon-theme',JSON.stringify(theme));}catch{}},[theme,reduce]);
 const animated=!reduce&&theme.mode==='full'&&theme.intensity>0;
 function notify(message:string){setToast(message);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setToast(''),4200);}
 return <UIContext.Provider value={{theme,setTheme,animated,notify}}><MotionConfig reducedMotion={animated?'user':'always'} transition={{duration:theme.mode==='off'?0:MOTION.switch,ease:MOTION.ease}}>{children}<div className="toast-region" aria-live="polite"><AnimatePresence>{toast&&<motion.div className="toast" key={toast} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:8}}><Check size={17}/>{toast}<button className="icon-button" aria-label="Закрыть уведомление" onClick={()=>setToast('')}><X size={16}/></button></motion.div>}</AnimatePresence></div></MotionConfig></UIContext.Provider>;
}
export function Button({children,variant='secondary',loading=false,className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'ghost'|'destructive';loading?:boolean}){
 const {animated}=useUI();return <motion.button type="button" className={`button ${variant} ${className}`} disabled={props.disabled||loading} aria-busy={loading||undefined} whileTap={animated&&!props.disabled?{scale:.97}:undefined} transition={{duration:MOTION.press}} {...props as any}>{loading?<LoaderCircle size={17} className="spin"/>:null}{children}</motion.button>;
}
export function IconButton({label,children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{label:string}){return <button type="button" className="icon-button" aria-label={label} title={label} {...props}>{children}</button>;}
export function Badge({children,tone='neutral'}:{children:ReactNode;tone?:string}){return <span className={`badge ${tone}`}>{children}</span>;}
export function Panel({children,className=''}:{children:ReactNode;className?:string}){return <section className={`panel ${className}`}>{children}</section>;}
export function Select({label,children,...props}:SelectHTMLAttributes<HTMLSelectElement>&{label:string}){return <label className="field"><span>{label}</span><span className="select-wrap"><select {...props}>{children}</select><ChevronDown size={15}/></span></label>;}
export function Chips({values,value,onChange,label}:{values:string[];value:string;onChange:(v:string)=>void;label?:string}){return <div role="group" aria-label={label} className="chips">{values.map(v=><button type="button" className={`chip ${v===value?'selected':''}`} aria-pressed={v===value} key={v} onClick={()=>onChange(v)}>{v}</button>)}</div>;}
export function Switch({label,checked,onChange}:{label:string;checked:boolean;onChange:(v:boolean)=>void}){return <label className="switch-label"><span>{label}</span><input type="checkbox" role="switch" checked={checked} onChange={e=>onChange(e.target.checked)}/><span className="switch"/></label>;}
export function Modal({title,children,open,onClose}:{title:string;children:ReactNode;open:boolean;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);const {theme}=useUI();
 useEffect(()=>{const d=ref.current;if(open&&!d?.open)d?.showModal();if(!open&&d?.open)d.close();},[open]);
 return <dialog className="modal" ref={ref} aria-label={title} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><motion.div initial={false} animate={{opacity:open?1:0,y:open?0:10}} transition={{duration:theme.mode==='off'?0:MOTION.switch}}><div className="modal-head"><h2>{title}</h2><IconButton label="Закрыть" onClick={onClose}><X size={19}/></IconButton></div>{children}</motion.div></dialog>;
}
export function BalanceNumber({value}:{value:number}){const {animated}=useUI();const old=useRef(value);useEffect(()=>{old.current=value;},[value]);return <span aria-label={`${value} токенов`}>{animated?<CountUp key={value} from={old.current} to={value} duration={.5}/>:value}</span>;}
export function Empty({title,description,children}:{title:string;description:string;children?:ReactNode}){return <div className="empty-state"><div className="empty-note">♫</div><h3>{title}</h3><p>{description}</p>{children}</div>;}
export function Skeleton(){return <div className="skeleton-row" aria-label="Загрузка треков" role="status"><div className="skeleton square"/><div className="skeleton-lines"><div className="skeleton"/><div className="skeleton short"/></div></div>;}
