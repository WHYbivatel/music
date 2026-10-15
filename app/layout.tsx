import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import './admin.css';
import './atmosphere.css';
import { versionedAsset } from '@/lib/version';
import { MOTION, PRODUCT } from '@/lib/config';
import { isLocale } from '@/lib/i18n';
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#09090F'};
export const metadata:Metadata={manifest:'/manifest.webmanifest',applicationName:PRODUCT.name,appleWebApp:{capable:true,statusBarStyle:'black-translucent',title:PRODUCT.name},icons:{icon:versionedAsset('/icons/icon-192.png'),apple:versionedAsset('/icons/apple-touch-icon.png')}};
export default async function RootLayout({children}:{children:React.ReactNode}){const locale=(await headers()).get('x-locale');return <html lang={isLocale(locale)?locale:'ru'} data-scroll-behavior="smooth" style={{'--duration-press':`${MOTION.press*1000}ms`,'--duration-switch':`${MOTION.switch*1000}ms`,'--duration-reveal':`${MOTION.reveal*1000}ms`,'--ease':`cubic-bezier(${MOTION.ease.join(',')})`} as React.CSSProperties}><body>{children}</body></html>;}
