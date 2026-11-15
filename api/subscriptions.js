import {createHash} from 'node:crypto';
import {repository} from '../server/repository.js';
import {requireUser,requireOrigin,jsonBody,apiError} from '../server/session.js';
import {isAllowedPushEndpoint} from '../server/push.js';
import {scheduleAppointment} from '../server/notifications.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  try{
    requireUser(req);requireOrigin(req);
    if(!['POST','DELETE'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
    const body=jsonBody(req);if(!isAllowedPushEndpoint(body.endpoint))return res.status(400).json({error:'Dispositivo de notificações inválido.'});
    const id=createHash('sha256').update(body.endpoint).digest('hex');
    if(body.action==='status'){const {data}=await repository.read();return res.status(200).json({enabled:data.subscriptions.some(s=>s.id===id)});}
    if(req.method==='DELETE'){await repository.mutate(d=>{d.subscriptions=d.subscriptions.filter(s=>s.id!==id);});return res.status(200).json({removed:true});}
    if(typeof body.p256dh!=='string'||body.p256dh.length>256||typeof body.auth!=='string'||body.auth.length>128)return res.status(400).json({error:'Inscrição inválida.'});
    await repository.mutate(d=>{d.subscriptions=d.subscriptions.filter(s=>s.id!==id);if(d.subscriptions.length>=20)throw Object.assign(Error('Limite de aparelhos atingido.'),{status:400});d.subscriptions.push({id,endpoint:body.endpoint,p256dh:body.p256dh,auth:body.auth});});
    const {data}=await repository.read();for(const a of data.appointments)if(!a.completed&&!a._sent&&a._queued!==a._revision&&Date.parse(a.starts_at)+3600000>Date.now())await scheduleAppointment(a.id).catch(()=>{});
    return res.status(200).json({enabled:true});
  }catch(error){return apiError(res,error);}
}
