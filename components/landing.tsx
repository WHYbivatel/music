'use client';

import { useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, ArrowUpRight, AudioLines, Headphones, LibraryBig, Pause, Play, SlidersHorizontal, WandSparkles } from 'lucide-react';
import { PRODUCT } from '@/lib/config';
import { landingCopy } from '@/lib/landing-copy';
import { SoundMark } from './atmosphere';
import { ThemeSwitch } from './ui';
import { LocaleLink, LocaleSwitch, useI18n } from './i18n';

const samples = [
  { file: 'night-drive', cover: 1, color: '#e176ec' },
  { file: 'soft-focus', cover: 2, color: '#9bd6c8' },
  { file: 'afterlight', cover: 3, color: '#f4af89' },
];
const stepIcons = [WandSparkles, SlidersHorizontal, LibraryBig];
const formatTime = (time: number) => `0:${String(Math.floor(time)).padStart(2, '0')}`;

export default function Landing() {
  const { locale } = useI18n();
  const copy = landingCopy[locale];
  const audio = useRef<HTMLAudioElement>(null);
  const selection = useRef<number | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);

  function toggleSample(index: number) {
    const player = audio.current;
    if (!player) return;
    if (selection.current === index && !player.paused) {
      player.pause();
      return;
    }
    setFailed(false);
    if (selection.current !== index || player.error) {
      selection.current = index;
      setActive(index);
      setPosition(0);
      setDuration(0);
      player.src = `/landing/${samples[index].file}.mp3`;
    }
    player.play().catch((error: unknown) => {
      if (selection.current === index && !(error instanceof DOMException && error.name === 'AbortError')) setFailed(true);
    });
  }

  return <div className="neon-landing">
    <a className="landing-skip" href="#landing-main">{copy.skip}</a>
    <header className="landing-header landing-width">
      <LocaleLink href="/" aria-label={copy.home} className="landing-brand">
        <span className="landing-mark"><SoundMark/></span>
        <strong>{PRODUCT.name}</strong>
      </LocaleLink>
      <div className="landing-header-actions">
        <LocaleSwitch/>
        <ThemeSwitch/>
        <LocaleLink className="landing-header-link" href="/studio">{copy.studio}<ArrowUpRight size={16}/></LocaleLink>
      </div>
    </header>

    <main id="landing-main">
      <section className="landing-hero landing-width">
        <div className="landing-hero-copy">
          <h1>{copy.title}<br/><span>{copy.accent}</span></h1>
          <p>{copy.intro}</p>
          <div className="landing-actions">
            <LocaleLink className="landing-primary" href="/studio">{copy.studio}<ArrowRight size={19}/></LocaleLink>
            <a className="landing-secondary" href="#samples"><Headphones size={17}/>{copy.listen}</a>
          </div>
          <p className="landing-demo"><span aria-hidden="true"/>{copy.demo}</p>
        </div>

        <div className="landing-visual" aria-hidden="true">
          <div className="landing-orbit landing-orbit-outer"/>
          <div className="landing-orbit landing-orbit-inner"/>
          <div className="landing-axis landing-axis-x"/>
          <div className="landing-axis landing-axis-y"/>
          <div className="landing-wave">
            {/* The existing brand illustration is served as a static asset. */}
            <img src="/landing/wave.webp" width={1050} height={703} fetchPriority="high" alt=""/>
          </div>
          <div className="landing-visual-meter">
            {Array.from({length: 13}, (_, index) => <i key={index} style={{'--bar': 6 + (index * 17 % 23), '--delay': `${index * -0.12}s`} as CSSProperties}/>)}
          </div>
        </div>
      </section>

      <section id="samples" className="landing-samples landing-width" aria-labelledby="landing-samples-title">
        <div className="landing-section-head">
          <div><h2 id="landing-samples-title">{copy.samples}</h2><p>{copy.samplesIntro}</p></div>
          <AudioLines size={26} aria-hidden="true"/>
        </div>
        <div className="landing-track-grid">
          {samples.map((sample, index) => {
            const [title, genre] = copy.tracks[index];
            const selected = active === index;
            const running = selected && playing;
            return <div className="landing-track" data-active={selected} key={sample.file} style={{'--track-color': sample.color} as CSSProperties}>
              <button type="button" className="landing-track-button" aria-label={`${running ? copy.pause : copy.play}: ${title}`} onClick={() => toggleSample(index)}>
                <span className="landing-cover" style={{backgroundImage: `url(/covers/${sample.cover}.svg)`}}>
                  {running ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}
                </span>
                <span className="landing-track-info"><strong>{title}</strong><span>{genre}</span></span>
                <span className="landing-track-time">{selected && position > 0 ? formatTime(position) : '0:16'}</span>
              </button>
              {selected && duration > 0 && <input className="landing-seek" type="range" min={0} max={duration} step={0.1} value={Math.min(position, duration)} aria-label={`${copy.seek}: ${title}`} onChange={event => {
                if (audio.current) audio.current.currentTime = Number(event.target.value);
              }}/>}
            </div>;
          })}
        </div>
        {failed && <p className="landing-audio-error" role="alert">{copy.error}</p>}
        <audio ref={audio} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
          onLoadedMetadata={event => setDuration(event.currentTarget.duration)}
          onTimeUpdate={event => setPosition(event.currentTarget.currentTime)}
          onError={() => { setFailed(true); setPlaying(false); }}/>
      </section>

      <section className="landing-flow landing-width" aria-labelledby="landing-flow-title">
        <div className="landing-section-head"><div><h2 id="landing-flow-title">{copy.flow}</h2><p>{copy.flowIntro}</p></div></div>
        <div className="landing-step-grid">
          {copy.steps.map(([title, description], index) => {
            const Icon = stepIcons[index];
            return <article className="landing-step" key={title}><Icon size={23} aria-hidden="true"/><h3>{title}</h3><p>{description}</p></article>;
          })}
        </div>
      </section>

      <section className="landing-closing landing-width">
        <div className="landing-closing-inner"><h2>{copy.closing}</h2><LocaleLink className="landing-primary" href="/studio">{copy.studio}<ArrowRight size={19}/></LocaleLink></div>
      </section>
    </main>

    <footer className="landing-footer landing-width">
      <span>{PRODUCT.name}</span>
      <LocaleLink href="/library">{copy.library}<ArrowUpRight size={14}/></LocaleLink>
    </footer>
  </div>;
}
