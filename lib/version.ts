export type BuildInfo={id:string;version:string;revision:string;sourceHash:string;builtAt:string};
export const BUILD:BuildInfo={
 id:process.env.NEXT_PUBLIC_BUILD_ID||'development',
 version:process.env.NEXT_PUBLIC_APP_VERSION||'1.1.0',
 revision:process.env.NEXT_PUBLIC_BUILD_REVISION||'development',
 sourceHash:process.env.NEXT_PUBLIC_SOURCE_HASH||'development',
 builtAt:process.env.NEXT_PUBLIC_BUILT_AT||''
};
export const RELEASE_CHECK_MS=30_000;
export const RELOAD_COOLDOWN_MS=30_000;
export const NO_STORE={'Cache-Control':'no-store, no-cache, max-age=0, must-revalidate','CDN-Cache-Control':'no-store','Surrogate-Control':'no-store'};
export function parseBuild(value:unknown):BuildInfo|null{
 if(!value||typeof value!=='object')return null;
 const v=value as Record<string,unknown>;
 if(typeof v.id!=='string'||!/^[-a-zA-Z0-9_.]{1,150}$/.test(v.id)||typeof v.version!=='string'||typeof v.builtAt!=='string'||!Number.isFinite(Date.parse(v.builtAt)))return null;
 return {id:v.id,version:v.version,builtAt:v.builtAt,revision:typeof v.revision==='string'?v.revision:'',sourceHash:typeof v.sourceHash==='string'?v.sourceHash:''};
}
export type ReloadGuard={id:string;time:number}|null;
export function mayReload(target:string,guard:ReloadGuard,now=Date.now()){return !guard||now-guard.time>=RELOAD_COOLDOWN_MS;}

export const versionedAsset=(path:string)=>BUILD.id==='development'?path:`${path}${path.includes('?')?'&':'?'}v=${BUILD.id}`;
