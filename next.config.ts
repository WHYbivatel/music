import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_SERVER } from 'next/constants';
import { readFileSync } from 'node:fs';
import { NO_STORE } from './lib/version';
const headers=(values:Record<string,string>)=>Object.entries(values).map(([key,value])=>({key,value}));
export default function config(phase:string):NextConfig{
 let build:{id:string;version:string;revision:string;sourceHash:string;builtAt:string}|null=null;
 if(phase!==PHASE_DEVELOPMENT_SERVER){try{build=JSON.parse(readFileSync('.release/build.json','utf8'));}catch{throw new Error('Release metadata is missing. Use npm run build before npm start.');}}
 if(phase===PHASE_PRODUCTION_SERVER&&readFileSync('.next/BUILD_ID','utf8').trim()!==build?.id)throw new Error('Build metadata does not match .next. Deploy one complete build and restart.');
 return {
  devIndicators:false,
  deploymentId:build?.id,
  generateBuildId:build?async()=>build!.id:undefined,
  env:{NEXT_PUBLIC_BUILD_ID:build?.id||'development',NEXT_PUBLIC_APP_VERSION:build?.version||'1.1.0',NEXT_PUBLIC_BUILD_REVISION:build?.revision||'development',NEXT_PUBLIC_SOURCE_HASH:build?.sourceHash||'development',NEXT_PUBLIC_BUILT_AT:build?.builtAt||''},
  async headers(){return [
   ...['/','/library','/balance','/profile','/ui-kit','/login','/register','/admin/:path*','/api/version','/sw.js','/manifest.webmanifest'].map(source=>({source,headers:headers(NO_STORE)})),
   ...['/offline.html','/offline.js','/covers/:path*','/icons/:path*'].map(source=>({source,headers:[{key:'Cache-Control',value:'no-cache, max-age=0, must-revalidate'}]})),
   {source:'/sw.js',headers:[{key:'Service-Worker-Allowed',value:'/'}]},
   {source:'/admin/:path*',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]}
  ];}
 };
}
