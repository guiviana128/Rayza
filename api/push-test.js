import webpush from 'web-push';
import {repository} from '../server/repository.js';
import {requireUser,requireOrigin,jsonBody,apiError} from '../server/session.js';
import {isAllowedPushEndpoint} from '../server/push.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  try{
    requireUser(req);requireOrigin(req);if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
    const body=jsonBody(req),{data}=await repository.read(),device=data.subscriptions.find(s=>s.endpoint===body.endpoint);
    if(!device||!isAllowedPushEndpoint(device.endpoint))return res.status(409).json({error:'Ative as notificações neste aparelho.'});
    webpush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
    await webpush.sendNotification({endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth}},JSON.stringify({title:'Seu cantinho está pertinho 💜',body:'Este aviso veio do servidor e chegou às notificações do seu aparelho.',tag:'rayza-server-test'}),{TTL:300,urgency:'high',timeout:8000});
    return res.status(200).json({sent:true});
  }catch(error){if([404,410].includes(error.statusCode))return res.status(409).json({error:'A inscrição expirou. Desative e ative as notificações novamente.'});return apiError(res,error);}
}
