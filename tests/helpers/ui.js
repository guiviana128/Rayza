import assert from 'node:assert/strict';
import {build} from 'vite';
import {JSDOM} from 'jsdom';
import {webcrypto} from 'node:crypto';
const bundle=await build({logLevel:'silent',configFile:false,plugins:[{name:'test-supabase',enforce:'pre',resolveId(id){if(id==='@supabase/supabase-js')return '\0test-supabase';},load(id){if(id==='\0test-supabase')return 'export const createClient = () => window.__testClient;';}}],define:{'import.meta.env.VITE_SUPABASE_URL':'""','import.meta.env.VITE_SUPABASE_ANON_KEY':'""','import.meta.env.VITE_VAPID_PUBLIC_KEY':'""'},build:{write:false}});
const script=bundle.output.find(f=>f.type==='chunk'&&f.isEntry).code;
export const tick=()=>new Promise(r=>setTimeout(r,30));
export function backend(){return {session:null,tables:{appointments:[],memories:[],workouts:[],workout_logs:[],push_subscriptions:[]},failWrites:false,failPushRead:false,delayWrite:null};}
function fakeClient(b) {
  return {auth:{getSession:async()=>({data:{session:b.session},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signInWithPassword:async()=>{b.session={user:{id:'user-one',user_metadata:{name:'Rayza'}},access_token:'test-token'};return {data:{session:b.session},error:null};},signOut:async()=>{b.session=null;return {error:null};}},
    from(table){let mode='select',value,filters=[],single=false,limit=Infinity;
      const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},update(v){mode='update';value=v;return q;},insert(v){mode='insert';value=v;return q;},upsert(v){mode='upsert';value=v;return q;},delete(){mode='delete';return q;},single(){single=true;return q;},maybeSingle(){single=true;return q;},limit(v){limit=v;return q;},abortSignal(){return q;},then(resolve,reject){return (async()=>{
        if(table==='push_subscriptions'&&b.failPushRead)return {data:null,error:{message:'push table unavailable'}};
        if(mode==='select'&&b.failRefreshAfterPhoto&&b.tables.memories.length)return {data:null,error:{message:'Network unavailable during refresh'}};
        if(mode!=='select'&&b.delayWrite)await b.delayWrite;
        if(mode!=='select'&&b.failWrites)return {data:null,error:{message:'Network unavailable'}};
        const rows=b.tables[table];const match=row=>filters.every(([k,v])=>row[k]===v);let result=rows.filter(match);
        if(mode==='insert'||mode==='upsert'){const values=Array.isArray(value)?value:[value];result=values.map(v=>{const old=rows.find(r=>r.id===v.id);if(old&&mode==='upsert'){Object.assign(old,v);return old;}const row={id:webcrypto.randomUUID(),completed:false,favorite:false,...v};rows.push(row);return row;});}
        if(mode==='update')result.forEach(row=>Object.assign(row,value));
        if(mode==='delete')b.tables[table]=rows.filter(row=>!match(row));
        if(mode!=='select'&&b.failAfterWrite)return {data:null,error:{message:'Network response lost after commit'}};
        return {data:JSON.parse(JSON.stringify(single?result[0]??null:result.slice(0,limit))),error:single&&!result.length?{message:'Row not found'}:null};
      })().then(resolve,reject);}};return q;},
    storage:{from(){return {createSignedUrls:async paths=>({data:paths.map(path=>({path,signedUrl:'/demo-flowers.svg'})),error:null}),upload:async path=>{(b.uploads??=[]).push(path);return {data:{path},error:null};},remove:async paths=>{(b.removedPhotos??=[]).push(...paths);return {data:paths,error:null};}};}}};
}
export async function page(b,{configured=true}={}) {
  const dom=new JSDOM('<div id="app"></div><div id="toast"></div><dialog id="editor"></dialog>',{url:'https://rayza.test/',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;
  w.crypto=webcrypto;w.AbortSignal=globalThis.AbortSignal;w.__testClient=fakeClient(b);
  const OriginalFormData=w.FormData;
  w.FormData=class extends OriginalFormData{constructor(form){super(form);if(w.__testPhoto&&form?.querySelector('[name="photo"]'))this.set('photo',w.__testPhoto);}};
  w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
  w.Image=class{naturalWidth=800;naturalHeight=600;async decode(){}};
  w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});
  w.HTMLCanvasElement.prototype.toBlob=function(callback){callback(new w.Blob(['photo'],{type:'image/jpeg'}));};
  if(b.failPushRead){w.PushManager=function(){};Object.defineProperty(w.navigator,'serviceWorker',{value:{register:async()=>({}),getRegistration:async()=>({pushManager:{getSubscription:async()=>({endpoint:'https://fcm.googleapis.com/test'})}})}});}
  w.fetch=async()=>({ok:true,json:async()=>({configured,supabaseUrl:configured?'https://test.supabase.co':'',supabaseKey:configured?'sb_publishable_example':'',vapidPublicKey:''})});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.eval(script);await tick();return dom;
}
