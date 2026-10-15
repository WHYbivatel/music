import type { Metadata, Viewport } from 'next';
import './globals.css';
import './admin.css';
import { versionedAsset } from '@/lib/version';
import { MOTION, PRODUCT } from '@/lib/config';
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#09090F'};
export const metadata:Metadata={manifest:'/manifest.webmanifest',applicationName:PRODUCT.name,appleWebApp:{capable:true,statusBarStyle:'black-translucent',title:PRODUCT.name},icons:{icon:versionedAsset('/icons/icon-192.png'),apple:versionedAsset('/icons/apple-touch-icon.png')},title:PRODUCT.name+' — студия генерации музыки',description:'От первой идеи до нового звучания. Интерактивная музыкальная студия в деморежиме.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ru" data-scroll-behavior="smooth" style={{'--duration-press':`${MOTION.press*1000}ms`,'--duration-switch':`${MOTION.switch*1000}ms`,'--duration-reveal':`${MOTION.reveal*1000}ms`,'--ease':`cubic-bezier(${MOTION.ease.join(',')})`} as React.CSSProperties}><body>{children}</body></html>;}
