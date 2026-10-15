/* NEON SOUND production worker. Financial/auth/admin traffic is never cached. */
const VERSION='neon-sound-v2';
const STATIC=VERSION+'-static';
const PAGES=VERSION+'-pages';
const SHELL=['/offline.html','/offline.js','/covers/1.svg','/covers/2.svg','/covers/3.svg','/covers/4.svg','/icons/icon-192.png','/icons/icon-512.png','/icons/maskable-512.png'];
self.addEventListener('install',event=>{event.waitUntil((async()=>{
 const cache=await caches.open(STATIC);await cache.addAll(SHELL);
 // Precache only the public, server-rendered shell (account state is client-side).
 const response=await fetch('/',{cache:'reload'});if(!response.ok)throw new Error('Shell unavailable');
 const html=await response.clone().text();const pages=await caches.open(PAGES);await pages.put('/',response);
 const assets=[...new Set([...html.matchAll(/(?:src|href)="([^"]*\/_next\/static\/[^"]+)"/g)].map(match=>match[1].replaceAll('&amp;','&')))];
 await cache.addAll(assets.filter(asset=>new URL(asset,self.location.origin).origin===self.location.origin).slice(0,80));
})());});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('neon-sound-')&&!key.startsWith(VERSION+'-')).map(key=>caches.delete(key)))),self.clients.claim()]));});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/v1/')||url.pathname.startsWith('/api/')||request.headers.has('RSC')||url.searchParams.has('_rsc'))return;
 if(request.mode==='navigate'){
  // Do not persist profile, payment or login HTML; public studio shell contains no account data.
  const allowed=['/','/library','/ui-kit'].includes(url.pathname);
  event.respondWith((async()=>{try{const response=await fetch(request);if(response.ok&&allowed){const cache=await caches.open(PAGES);await cache.put(url.pathname,response.clone());}return response;}catch{return (allowed?await caches.match(url.pathname):null)||await caches.match('/offline.html')||Response.error();}})());return;
 }
 const safe=SHELL.includes(url.pathname)||url.pathname.startsWith('/_next/static/')||url.pathname.startsWith('/covers/')||url.pathname.startsWith('/icons/');
 if(!safe)return; // Audio is not silently downloaded or cached.
 event.respondWith((async()=>{const cache=await caches.open(STATIC),hit=await cache.match(request);if(hit)return hit;const response=await fetch(request);if(response.ok){await cache.put(request,response.clone());const keys=await cache.keys();if(keys.length>160)await cache.delete(keys.find(k=>!SHELL.includes(new URL(k.url).pathname))||keys[0]);}return response;})());
});
