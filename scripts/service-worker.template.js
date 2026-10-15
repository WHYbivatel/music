/* NEON SOUND production worker. Financial/auth/admin traffic is never cached. */
const BUILD_ID='__BUILD_ID__';
const VERSION='neon-sound-'+BUILD_ID;
const STATIC=VERSION+'-static';
const PAGES=VERSION+'-pages';
const SHELL=['/offline.html','/offline.js','/covers/1.svg','/covers/2.svg','/covers/3.svg','/covers/4.svg','/icons/icon-192.png','/icons/icon-512.png','/icons/maskable-512.png'];
self.addEventListener('install',event=>{event.waitUntil((async()=>{
 const latest=await fetch('/api/version',{cache:'no-store'});if(!latest.ok||(await latest.json()).id!==BUILD_ID)throw new Error('Deployment changed during install');
 const cache=await caches.open(STATIC);await cache.addAll(SHELL.map(url=>new Request(url,{cache:'reload'})));
 // Precache only the public, server-rendered shell (account state is client-side).
 const response=await fetch('/',{cache:'no-store'});if(!response.ok)throw new Error('Shell unavailable');
 const html=await response.clone().text();if(!html.includes(`data-dpl-id="${BUILD_ID}"`))throw new Error('Mixed deployment shell');const pages=await caches.open(PAGES);await pages.put('/',response);
 const assets=[...new Set([...html.matchAll(/(?:src|href)="([^"]*\/_next\/static\/[^"]+)"/g)].map(match=>match[1].replaceAll('&amp;','&')))];
 await cache.addAll(assets.filter(asset=>new URL(asset,self.location.origin).origin===self.location.origin).slice(0,80));
})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
 // Keep two earlier releases for tabs completing work under the old controller.
 const keys=await caches.keys();const versions=[...new Set(keys.filter(k=>k.startsWith('neon-sound-')).map(k=>k.replace(/-(static|pages)$/,'')))];
 const keep=new Set([VERSION,...versions.filter(v=>v!==VERSION).slice(-2)]);
 await Promise.all(keys.filter(k=>k.startsWith('neon-sound-')&&!keep.has(k.replace(/-(static|pages)$/, ''))).map(k=>caches.delete(k)));
 await self.clients.claim();
 for(const client of await self.clients.matchAll({type:'window'}))client.postMessage({type:'APP_VERSION',id:BUILD_ID});
})());});
self.addEventListener('message',event=>{
 if(event.data?.type==='GET_VERSION')event.ports?.[0]?.postMessage({id:BUILD_ID});
 if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/v1/')||url.pathname.startsWith('/api/')||url.pathname==='/sw.js'||request.headers.has('RSC')||url.searchParams.has('_rsc'))return;
 if(request.mode==='navigate'){
  // Do not persist profile, payment or login HTML; public studio shell contains no account data.
  const allowed=['/','/library','/ui-kit'].includes(url.pathname);
  event.respondWith((async()=>{try{const response=await fetch(request,{cache:'no-store'});if(response.ok&&allowed){const cache=await caches.open(PAGES);await cache.put(url.pathname,response.clone());}return response;}catch{return (allowed?await (await caches.open(PAGES)).match(url.pathname):null)||await (await caches.open(STATIC)).match('/offline.html')||Response.error();}})());return;
 }
 const safe=SHELL.includes(url.pathname)||url.pathname.startsWith('/_next/static/')||url.pathname.startsWith('/covers/')||url.pathname.startsWith('/icons/');
 if(!safe)return; // Audio is not silently downloaded or cached.
 event.respondWith((async()=>{const cache=await caches.open(STATIC),hit=await cache.match(request);if(hit)return hit;if(url.pathname.startsWith('/_next/static/')){const older=await caches.match(request);if(older)return older;}const response=await fetch(request);if(response.ok){await cache.put(request,response.clone());const keys=await cache.keys();if(keys.length>160)await cache.delete(keys.find(k=>!SHELL.includes(new URL(k.url).pathname))||keys[0]);}return response;})());
});
