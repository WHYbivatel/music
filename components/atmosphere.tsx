'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useUI } from './ui';

/** One shared, code-native mark: a cut through a stack of sound waves. */
export function SoundMark({className=''}:{className?:string}) {
 return <span className={`sound-mark ${className}`} aria-hidden="true">{Array.from({length:7},(_,i)=><i key={i} style={{'--i':i} as CSSProperties}/>)}</span>;
}

export function ControlSculpture() {
 const {animated}=useUI();
 return <div className="control-sculpture" aria-hidden="true"><div className="control-lens" style={{animationPlayState:animated?'running':'paused'}}>{Array.from({length:15},(_,i)=><i key={i} style={{'--i':i} as CSSProperties}/>)}</div><span className="lens-axis axis-x"/><span className="lens-axis axis-y"/><span className="lens-coordinate">NS / WAVEFORM 001</span><span className="lens-point"/></div>;
}

/** No polling or rendering loop while idle. The native pointer remains usable. */
export function CursorAtmosphere({admin=false}:{admin?:boolean}) {
 const {animated,theme}=useUI();
 const host=useRef<HTMLDivElement>(null);
 const [fine,setFine]=useState(false);
 useEffect(()=>{
  const query=matchMedia('(hover: hover) and (pointer: fine) and (min-width: 761px)');
  const change=()=>setFine(query.matches&&(navigator.hardwareConcurrency||4)>=4&&((navigator as Navigator&{deviceMemory?:number}).deviceMemory??8)>=4);
  change();query.addEventListener('change',change);
  return()=>query.removeEventListener('change',change);
 },[]);
 useEffect(()=>{
  const el=host.current;if(!animated||!fine||!el)return;
  const rings=Array.from(el.children) as HTMLElement[];
  let x=0,y=0,initialized=false,raf=0,last=0;
  const positions=rings.map(()=>({x:0,y:0}));
  function frame(now:number){
   const dt=Math.min(40,last?now-last:16.7);last=now;
   let moving=false;
   positions.forEach((p,i)=>{
    const amount=1-Math.exp(-dt/(110+i*90));
    p.x+=(x-p.x)*amount;p.y+=(y-p.y)*amount;
    const distance=Math.hypot(x-p.x,y-p.y);
    rings[i].style.transform=`translate3d(${p.x}px,${p.y}px,0) translate(-50%,-50%) scale(${1+Math.min(distance,180)*.0007})`;
    if(distance>.12)moving=true;
   });
   raf=moving?requestAnimationFrame(frame):0;
  }
  function move(e:PointerEvent){
   if(e.pointerType==='touch'||document.hidden)return;
   x=e.clientX;y=e.clientY;
   if(!initialized){positions.forEach(p=>{p.x=x;p.y=y;});initialized=true;}
   el!.dataset.visible='true';
   if(!raf){last=0;raf=requestAnimationFrame(frame);}
  }
  function hide(){el!.dataset.visible='false';cancelAnimationFrame(raf);raf=0;initialized=false;}
  function visibility(){if(document.hidden)hide();}
  window.addEventListener('pointermove',move,{passive:true});
  document.documentElement.addEventListener('pointerleave',hide);
  window.addEventListener('blur',hide);document.addEventListener('visibilitychange',visibility);
  return()=>{hide();window.removeEventListener('pointermove',move);document.documentElement.removeEventListener('pointerleave',hide);window.removeEventListener('blur',hide);document.removeEventListener('visibilitychange',visibility);};
 },[animated,fine]);
 if(!animated||!fine)return null;
 return <div ref={host} className={`cursor-atmosphere ${admin?'admin-cursor':''}`} data-visible="false" aria-hidden="true" style={{'--cursor-strength':theme.intensity/100} as CSSProperties}><i/><i/><i/></div>;
}

/** Decorative breathing follows playback; it does not pretend to be an audio analyser. */
export function SoundAtmosphere({playing}:{playing:boolean}) {
 const {animated,theme}=useUI();const [visible,setVisible]=useState(true);
 useEffect(()=>{const change=()=>setVisible(!document.hidden);change();document.addEventListener('visibilitychange',change);return()=>document.removeEventListener('visibilitychange',change);},[]);
 if(!animated)return null;
 return <div className="sound-atmosphere" data-playing={playing&&visible} aria-hidden="true" style={{'--sound-strength':theme.intensity/100} as CSSProperties}><div className="sound-bloom bloom-one"/><div className="sound-bloom bloom-two"/><div className="sound-contour contour-one"/><div className="sound-contour contour-two"/></div>;
}
