'use client';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MOTION } from '@/lib/config';
import { t } from '@/lib/i18n';
import { addTag, removeTag, suggestTags, tagConflict } from '@/lib/tags';
import type { Settings } from '@/lib/types';
import { useUI } from './ui';

export function PromptTags({ settings, onChange }: { settings: Settings; onChange: (patch: Partial<Settings>) => void }) {
  const { theme } = useUI();
  const [ideas, setIdeas] = useState(() => suggestTags(settings.prompt, settings));
  useEffect(() => {
    const timer = window.setTimeout(() => setIdeas(suggestTags(settings.prompt, settings)), 400);
    return () => window.clearTimeout(timer);
  }, [settings.prompt, settings.genre, settings.vocal, settings.tempo]);
  const selected = settings.tags ?? [];
  const offered = ideas.filter(id => !selected.includes(id));
  const duration = theme.mode === 'off' ? 0 : theme.mode === 'reduced' ? 0.12 : 0.18;
  return <div className="prompt-tags">
    <div className="tag-block">
      <div className="tag-heading"><h3>{t('tags.suggest')}</h3><span>{t('tags.hint')}</span></div>
      <div className="tag-row" aria-label={t('tags.suggest')}>
        <AnimatePresence initial={false}>
          {offered.map(id => <motion.button type="button" className="tag-add" key={id} aria-label={t('tags.add', { name: t('tag.' + id) })} onClick={() => onChange({ tags: addTag(selected, id) })} initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96 }} transition={{ duration, ease: MOTION.ease }}><Plus size={13}/>{t('tag.' + id)}</motion.button>)}
        </AnimatePresence>
      </div>
    </div>
    <AnimatePresence initial={false}>
      {selected.length > 0 && <motion.div className="tag-block" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration }}>
        <div className="tag-heading"><h3>{t('tags.selected')}</h3><button type="button" className="tag-clear" onClick={() => onChange({ tags: [] })}>{t('tags.clear')}</button></div>
        <div className="tag-row" aria-label={t('tags.selected')}>
          <AnimatePresence initial={false}>
            {selected.map(id => {
              const name = t('tag.' + id);
              const conflict = tagConflict(id, settings);
              return <motion.span className={`tag-chip ${conflict ? 'is-conflict' : ''}`} key={id} initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96 }} transition={{ duration, ease: MOTION.ease }}>
                <span>{name}</span>
                {conflict && <small>{t('tags.conflict')}</small>}
                <button type="button" className="tag-remove" aria-label={t('tags.remove', { name })} onClick={() => onChange({ tags: removeTag(selected, id) })}><X size={13}/></button>
              </motion.span>;
            })}
          </AnimatePresence>
        </div>
      </motion.div>}
    </AnimatePresence>
  </div>;
}
