import { spawnSync, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(`${dir}/${entry.name}`):[`${dir}/${entry.name}`]);}
export function createBuildInfo({version,revision,sourceHash,now=new Date(),nonce=String(randomUUID())}){
 const builtAt=now.toISOString();
 return {id:`${builtAt.replace(/[-:.TZ]/g,'').slice(0,14)}-${sourceHash.slice(0,8)}-${nonce.replaceAll('-','').slice(0,8)}`,version,revision,sourceHash,builtAt};
}
export function calculateSourceHash(directory=root){
 const sources=[...['app','components','lib','public','scripts'].flatMap(dir=>files(resolve(directory,dir)).map(path=>relative(directory,path))),'package.json','package-lock.json','next.config.ts','tsconfig.json','postcss.config.mjs'].filter(path=>path!=='public/sw.js').sort();
 const hash=createHash('sha256');for(const path of sources){hash.update(path+'\0');hash.update(readFileSync(resolve(directory,path)));hash.update('\0');}
 return hash.digest('hex');
}
export function prepareBuild(){
 let revision='uncommitted';try{revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
 const info=createBuildInfo({version:JSON.parse(readFileSync('package.json','utf8')).version,revision,sourceHash:calculateSourceHash()});
 mkdirSync('.release',{recursive:true});writeFileSync('.release/build.json',JSON.stringify(info,null,2)+'\n');
 const worker=readFileSync('scripts/service-worker.template.js','utf8').replaceAll('__BUILD_ID__',info.id);
 writeFileSync('public/sw.js',worker);console.log(`Release ${info.version} / ${info.id}`);return info;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 prepareBuild();
 const result=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build',...process.argv.slice(2)],{stdio:'inherit',env:process.env});
 process.exit(result.status??1);
}
