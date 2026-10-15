import { mayReload, type BuildInfo, type ReloadGuard } from './version';

export type ReleaseState={target:BuildInfo|null;stage:'current'|'ready'|'deferred'|'installing'|'reloading'|'retry'};
export type WorkerSnapshot={activeId:string|null;waiting:null|{id:string|null;activate:()=>void};installing:boolean}|null;
export type ReleaseDependencies={
 currentId:string;latest:()=>Promise<BuildInfo>;checkWorker:()=>Promise<void>;worker:()=>Promise<WorkerSnapshot>;
 safe:()=>boolean;visible:()=>boolean;guard:()=>ReloadGuard;remember:(guard:NonNullable<ReloadGuard>)=>void;
 reload:(id:string)=>void;changed:(state:ReleaseState)=>void;now?:()=>number;
};
/** The same coordinator is exercised in tests and used by all tabs, with or without SW. */
export function createReleaseManager(deps:ReleaseDependencies){
 let state:ReleaseState={target:null,stage:'current'},foundAt=0,disposed=false,checking:Promise<void>|null=null,applying:Promise<void>|null=null,activated='';
 const now=()=>deps.now?.()??Date.now();
 const publish=(stage:ReleaseState['stage'])=>{if(disposed||stage===state.stage)return;state={...state,stage};deps.changed(state);};
 function check(){
  if(checking||disposed)return checking||Promise.resolve();
  checking=(async()=>{try{
   const latest=await deps.latest();if(disposed)return;
   if(latest.id===deps.currentId){if(state.target){state={target:null,stage:'current'};deps.changed(state);}return;}
   if(state.target?.id!==latest.id){state={target:latest,stage:'ready'};foundAt=now();activated='';deps.changed(state);}
   await deps.checkWorker().catch(()=>{});
  }catch{/* Network loss is not a release. Keep the current, working app. */}})().finally(()=>{checking=null;});
  return checking;
 }
 function apply(force=false){
  if(applying||disposed||!state.target||state.stage==='reloading')return applying||Promise.resolve();
  applying=(async()=>{
   const target=state.target!;
   if(!deps.visible()||(!force&&!deps.safe())){publish('deferred');return;}
   if(!force&&now()-foundAt<3000)return;
   if(!mayReload(target.id,deps.guard(),now())){publish('retry');return;}
   const worker=await deps.worker().catch(()=>null);
   if(disposed||state.target?.id!==target.id)return;
   // Check again after async worker messaging: the user may have started typing meanwhile.
   if(!deps.visible()||(!force&&!deps.safe())){publish('deferred');return;}
   if(worker?.waiting?.id===target.id&&worker.activeId!==target.id){
    if(activated!==target.id){activated=target.id;worker.waiting.activate();}
    if(now()-foundAt<15000){publish('installing');return;}
   }
   if(worker&&worker.activeId!==target.id&&now()-foundAt<15000){publish('installing');return;}
   // A broken/unsupported worker must not pin an online tab to an old release forever.
   // HTML is network-first + no-store; the release query also bypasses stale navigation caches.
   deps.remember({id:target.id,time:now()});publish('reloading');deps.reload(target.id);
  })().finally(()=>{applying=null;});
  return applying;
 }
 return {check,apply,getState:()=>state,dispose:()=>{disposed=true;}};
}
