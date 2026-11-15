import {build} from 'vite';import {JSDOM} from 'jsdom';import {webcrypto} from 'node:crypto';
const bundle=await build({logLevel:'silent',configFile:false,build:{write:false}});
const script=bundle.output.find(f=>f.type==='chunk'&&f.isEntry).code;
export const tick=()=>new Promise(r=>setTimeout(r,30));
export const backend=()=>({session:null,tables:{appointments:[],memories:[],workouts:[],workout_logs:[],push_subscriptions:[]},failWrites:false,failPushRead:false,delayWrite:null});
export async function page(b,{configured=true}={}) {
  const dom=new JSDOM('<div id="app"></div><div id="toast"></div><dialog id="editor"></dialog>',{url:'https://rayza.test/',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;
  if(b.session)b.session.user.username='rayza.huang';w.crypto=webcrypto;w.AbortSignal=globalThis.AbortSignal;
  const OriginalFormData=w.FormData;w.FormData=class extends OriginalFormData{constructor(form){super(form);if(w.__testPhoto&&form?.querySelector('[name="photo"]'))this.set('photo',w.__testPhoto);}};
  w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.Image=class{naturalWidth=800;naturalHeight=600;async decode(){}};
  w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});w.HTMLCanvasElement.prototype.toBlob=function(callback){callback(new w.Blob(['photo'],{type:'image/jpeg'}));};
  if(b.failPushRead){w.PushManager=function(){};Object.defineProperty(w.navigator,'serviceWorker',{value:{register:async()=>({}),getRegistration:async()=>({pushManager:{getSubscription:async()=>({endpoint:'https://fcm.googleapis.com/test',unsubscribe:async()=>true})}})}});}
  const reply=(data,status=200)=>({ok:status<400,status,json:async()=>JSON.parse(JSON.stringify(data))});
  w.fetch=async(url,options={})=>{
    const method=options.method||'GET',body=options.body?JSON.parse(options.body):{};
    if(url==='/api/config')return reply({configured,accountUsername:'rayza.huang',vapidPublicKey:''});
    if(url==='/api/login'){b.session={user:{id:'rayza',username:'rayza.huang',user_metadata:{name:'Rayza'}}};return reply({session:b.session});}
    if(url==='/api/session'){if(method==='DELETE')b.session=null;return reply({session:b.session});}
    if(url==='/api/subscriptions')return b.failPushRead?reply({error:'Push unavailable'},503):reply({enabled:false});
    if(url==='/api/photo'){
      if(method==='POST'){const path=`rayza/photos/${webcrypto.randomUUID()}.jpg`;(b.uploads??=[]).push(path);return reply({path});}
      (b.removedPhotos??=[]).push(body.path);return reply({removed:true});
    }
    if(url==='/api/data'){
      if(method==='GET'){
        if(b.failRefreshAfterPhoto&&b.tables.memories.length)return reply({error:'Network unavailable during refresh'},503);
        return reply({appointments:b.tables.appointments,memories:b.tables.memories.map(m=>({...m,url:'/demo-flowers.svg'})),workouts:b.tables.workouts,logs:b.tables.workout_logs});
      }
      if(b.delayWrite)await b.delayWrite;if(b.failWrites)return reply({error:'Network unavailable'},503);
      let row;const rows=b.tables[body.table];const old=rows.find(r=>r.id===body.id);
      if(method==='DELETE'){b.tables[body.table]=rows.filter(r=>r.id!==body.id);row={id:body.id};}
      else if(old){Object.assign(old,body.row);row=old;}
      else{row={id:body.id,user_id:'rayza',completed:false,favorite:false,...body.row};rows.push(row);}
      if(b.failAfterWrite)return reply({error:'Network response lost after commit'},503);
      return reply({row});
    }
    return reply({schedulerActive:true,serverConfigured:true});
  };
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.eval(script);await tick();return dom;
}
