'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Aurora from './react-bits/Aurora';
import Orb from './react-bits/Orb';
import SpotlightCard from './react-bits/SpotlightCard';
import { useUI } from './ui';
export function useGraphics(){const {animated}=useUI();const [capable,setCapable]=useState(false);useEffect(()=>{const weak=(navigator.hardwareConcurrency||4)<4||((navigator as Navigator&{deviceMemory?:number}).deviceMemory ?? 8)<4;let gl:WebGL2RenderingContext|null=null;try{gl=document.createElement('canvas').getContext('webgl2');setCapable(!!gl&&!weak);gl?.getExtension('WEBGL_lose_context')?.loseContext();}catch{}},[]);return animated&&capable;}
export function StudioAurora({paused}:{paused:boolean}){const graphics=useGraphics();const {theme}=useUI();return <div className="studio-aurora" aria-hidden="true">{graphics&&!paused?<Aurora colorStops={[theme.accent,'#9875FF',theme.accent]} speed={.22} brightness={.6} amplitude={.6} opacity={.18*(theme.intensity/50)} mouseInteraction={false} dpr={1}/>:<div className="static-aurora"/>}</div>;}
export function GenerationOrb(){const graphics=useGraphics();const {theme}=useUI();return <div className="generation-orb" aria-hidden="true">{graphics?<Orb colors={[theme.accent,'#9875FF','#d9c4ff']} speed={.25+theme.intensity/200} glow={theme.intensity/100*.7} followCursor={false} clickPulse={false} dpr={1}/>:<div className="static-orb"/>}</div>;}
export function Spotlight({children,className=''}:{children:ReactNode;className?:string}){const {animated,theme}=useUI();return <SpotlightCard className={className} spotlightColor={theme.accent} intensity={animated?.09:0} borderGlow={animated?.15:0} grain={0} style={{'--spotlight-card-surface':'var(--surface)'} as React.CSSProperties}>{children}</SpotlightCard>;}
