'use client';
import { Component, createContext, useContext, useRef, type ReactNode } from 'react';
import { motion, useInView } from 'motion/react';
import { MOTION, revealDelay } from '@/lib/config';
import { useUI } from './ui';

type Mode = 'full' | 'reduced' | 'off';
type Spec = { mode: Mode; y: number; duration: number };
const RevealIndex = createContext<(() => number) | null>(null);

function readSpec(mode: Mode): Spec {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = window.matchMedia('(max-width: 700px)').matches;
  const resolved: Mode = mode === 'off' ? 'off' : reduce || mode === 'reduced' ? 'reduced' : 'full';
  return {
    mode: resolved,
    y: resolved === 'full' ? (mobile ? MOTION.revealOffsetMobile : MOTION.revealOffset) : 0,
    duration: resolved === 'off' ? 0 : resolved === 'reduced' ? MOTION.revealReduced : mobile ? MOTION.revealDurationMobile : MOTION.revealDuration
  };
}

function useSpec() {
  const { theme, themeReady } = useUI();
  const locked = useRef<Spec | null>(null);
  if (themeReady && !locked.current) locked.current = readSpec(theme.mode);
  return { ready: themeReady, spec: locked.current };
}

export function RevealGroup({ children }: { children: ReactNode }) {
  const counter = useRef(0);
  counter.current = 0;
  return <RevealIndex.Provider value={() => counter.current++}>{children}</RevealIndex.Provider>;
}

class RevealBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="reveal-fallback">{this.props.children}</div> : this.props.children; }
}

export function PageReveal({ route, children }: { route: string; children: ReactNode }) {
  return <RevealBoundary><RevealGroup key={route}>{children}</RevealGroup></RevealBoundary>;
}

function useIndex() {
  const take = useContext(RevealIndex);
  const index = useRef<number | null>(null);
  if (index.current === null) index.current = take ? take() : 0;
  return index.current;
}

export function RevealItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  const index = useIndex();
  const { ready, spec } = useSpec();
  if (!ready || !spec) return <div className={`reveal-pending ${className}`}>{children}</div>;
  if (spec.mode === 'off') return <div className={className}>{children}</div>;
  return <motion.div className={className} initial={{ opacity: 0, y: spec.y }} animate={{ opacity: 1, y: 0 }} transition={{ duration: spec.duration, delay: revealDelay(index), ease: MOTION.ease }}>{children}</motion.div>;
}

export function ScrollReveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.15, margin: '0px 0px -40px 0px' });
  const { ready, spec } = useSpec();
  if (!ready || !spec) return <div ref={ref} className={`reveal-pending ${className}`}>{children}</div>;
  if (spec.mode === 'off') return <div ref={ref} className={className}>{children}</div>;
  return <motion.div ref={ref} className={className} initial={{ opacity: 0, y: spec.y }} animate={seen ? { opacity: 1, y: 0 } : { opacity: 0, y: spec.y }} transition={{ duration: seen ? spec.duration : 0, ease: MOTION.ease }}>{children}</motion.div>;
}

export function ResultsFade({ signature, children }: { signature: string; children: ReactNode }) {
  const { ready, spec } = useSpec();
  if (!ready || !spec || spec.mode === 'off') return <div key={signature}>{children}</div>;
  return <motion.div key={signature} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: Math.min(spec.duration, .22), ease: MOTION.ease }}>{children}</motion.div>;
}
