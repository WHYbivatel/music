import type { MetadataRoute } from 'next';
import { cookies } from 'next/headers';
import { versionedAsset } from '@/lib/version';
import { PRODUCT } from '@/lib/config';
import { isLocale, translate, type Locale } from '@/lib/i18n';
export default async function manifest():Promise<MetadataRoute.Manifest>{let locale:Locale='ru';try{const saved=(await cookies()).get('neon-locale')?.value;if(isLocale(saved))locale=saved;}catch{}return {id:'/',name:PRODUCT.name,short_name:PRODUCT.name,description:translate(locale,'Музыкальная студия: от первой идеи до нового звучания.'),lang:locale,start_url:'/',scope:'/',display:'standalone',background_color:'#09090F',theme_color:'#09090F',orientation:'any',categories:['music','entertainment','productivity'],icons:[{src:versionedAsset('/icons/icon-192.png'),sizes:'192x192',type:'image/png',purpose:'any'},{src:versionedAsset('/icons/icon-512.png'),sizes:'512x512',type:'image/png',purpose:'any'},{src:versionedAsset('/icons/maskable-512.png'),sizes:'512x512',type:'image/png',purpose:'maskable'}],shortcuts:[{name:translate(locale,'Создать музыку'),url:'/'},{name:translate(locale,'Моя библиотека'),url:'/library'}]};}
