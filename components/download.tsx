'use client';
import { getActiveLocale, t, userError } from '@/lib/i18n';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { recordAudit } from '@/lib/store';
import { adapter } from '@/lib/adapters';
import type { Track } from '@/lib/types';
import { Button, useUI } from './ui';
export function DownloadButton({track,compact=false}:{track:Track;compact?:boolean}){
 const [loading,setLoading]=useState(false);const {notify}=useUI();
 async function download(){if(loading)return;setLoading(true);try{const {url}=await adapter.library.download(track.id);const response=await fetch(url);if(!response.ok)throw new Error(t("Аудиофайл недоступен"));const blob=await response.blob();const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`${track.title.replace(/[\\/:*?"<>|]/g,'_')}.wav`;link.click();recordAudit('track.download',t("Скачан трек"),{entity:track.title});setTimeout(()=>URL.revokeObjectURL(link.href),10000);}catch(e){notify(userError(getActiveLocale(), e));}finally{setLoading(false);}}
 return <Button variant={compact?'ghost':'secondary'} className={compact?'download-audio':''} loading={loading} aria-label={compact?t("Скачать трек"):undefined} onClick={download}><Download size={compact?17:15}/>{!compact&&t("Скачать WAV")}</Button>;
}
