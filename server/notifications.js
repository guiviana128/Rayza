import {QueueClient} from '@vercel/queue';
import webpush from 'web-push';
import {randomUUID} from 'node:crypto';
import {repository} from './repository.js';
import {isAllowedPushEndpoint} from './push.js';
export const queue=new QueueClient({region:'iad1'});
export const TOPIC='rayza-reminders';
const MAX_DELAY=6*86400;
export const dueTime=a=>Date.parse(a.starts_at)-a.reminder_minutes*60000;
async function enqueue(a,hop=0,dispatch=a._dispatch||0) {
  if(a.completed||a._sent||Date.parse(a.starts_at)+3600000<Date.now())return;
  const seconds=Math.max(0,Math.ceil((dueTime(a)-Date.now())/1000));
  await queue.send(TOPIC,{id:a.id,revision:a._revision,hop,dispatch},{delaySeconds:Math.min(seconds,MAX_DELAY),retentionSeconds:604800,idempotencyKey:`${a.id}:${a._revision}:${dispatch}:${hop}`});
}
export async function scheduleAppointment(id) {
  const token=randomUUID();
  const a=await repository.mutate(d=>{const a=d.appointments.find(a=>a.id===id);if(!a||a.completed||a._sent||a._queued===a._revision||a._scheduleLease?.until>Date.now())return null;a._dispatch=(a._dispatch||0)+1;a._scheduleLease={id:token,until:Date.now()+60000};return structuredClone(a);});
  if(!a)return;
  try{await enqueue(a);await repository.mutate(d=>{const current=d.appointments.find(x=>x.id===id);if(current?._revision===a._revision&&current._scheduleLease?.id===token){current._queued=a._revision;current._queuedAt=Date.now();d.runtime.lastQueuePublish=new Date().toISOString();}});}
  finally{await repository.mutate(d=>{const current=d.appointments.find(x=>x.id===id);if(current?._scheduleLease?.id===token)current._scheduleLease=null;});}
}
export async function processReminder(message) {
  await repository.mutate(d=>{d.runtime.lastCallback=new Date().toISOString();});
  let {data}=await repository.read();let a=data.appointments.find(a=>a.id===message.id);
  if(!a||a._revision!==message.revision||a.completed||a._sent||Date.parse(a.starts_at)+3600000<Date.now())return;
  if(dueTime(a)>Date.now()+1000){await enqueue(a,message.hop+1,message.dispatch);return;}
  const lease=randomUUID();
  const acquired=await repository.mutate(d=>{
    const row=d.appointments.find(x=>x.id===a.id);
    if(!row||row._revision!==message.revision||row.completed||row._sent)return false;
    if(row._lease?.until>Date.now())throw Error('Reminder is already being delivered');
    row._lease={id:lease,until:Date.now()+120000};return true;
  });
  if(!acquired)return;
  try{
    ({data}=await repository.read());a=data.appointments.find(x=>x.id===message.id);
    if(!data.subscriptions.length)throw Error('No subscribed devices');
    webpush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
    let delivered=0;
    for(const device of data.subscriptions){
      const key=`${a.id}:${a._revision}:${device.id}`;
      const snapshot=(await repository.read()).data,current=snapshot.appointments.find(x=>x.id===a.id);
      if(!current||current._revision!==message.revision||current.completed||current._lease?.id!==lease)return;
      if(snapshot.deliveries[key]){delivered++;continue;}
      if(!isAllowedPushEndpoint(device.endpoint))continue;
      try{
        await webpush.sendNotification({endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth}},JSON.stringify({title:'Um lembrete com carinho 💜',body:a.title,tag:`rayza-${a.id}-${a._revision}`,url:'/#compromissos'}),{TTL:3600,urgency:'high',timeout:5000});
        await repository.mutate(d=>{d.deliveries[key]=Date.now();});
        delivered++;
      }catch(error){
        if([404,410].includes(error.statusCode))await repository.mutate(d=>{d.subscriptions=d.subscriptions.filter(s=>s.id!==device.id);});
        else throw error;
      }
    }
    if(!delivered)throw Error('No active devices received this reminder');
    await repository.mutate(d=>{const current=d.appointments.find(x=>x.id===a.id);if(current?._revision===message.revision&&current._lease?.id===lease){current._sent=true;current._lease=null;}d.runtime.lastDelivery=new Date().toISOString();});
  }catch(error){await repository.mutate(d=>{const current=d.appointments.find(x=>x.id===message.id);if(current?._revision===message.revision&&!current._sent)current._queued=null;d.runtime.lastQueueError=new Date().toISOString();});throw error;}
  finally{await repository.mutate(d=>{const current=d.appointments.find(x=>x.id===message.id);if(current?._lease?.id===lease)current._lease=null;});}
}
