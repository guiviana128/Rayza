import {createClient} from '@supabase/supabase-js';
import webpush from 'web-push';
import {resolveConfig} from '../server/config.js';
import {isAllowedPushEndpoint} from '../server/push.js';

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const config=resolveConfig();
  if(!config.configured||!config.vapidPublicKey||!process.env.VAPID_PRIVATE_KEY||!process.env.VAPID_SUBJECT)return res.status(503).json({error:'As notificações ainda precisam da configuração do servidor.'});
  const authorization=req.headers.authorization||'';
  if(!authorization.startsWith('Bearer '))return res.status(401).json({error:'Entre na sua conta para testar.'});
  try {
    const db=createClient(config.supabaseUrl,config.supabaseKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:authError}=await db.auth.getUser(authorization.slice(7));
    if(authError||!user)return res.status(401).json({error:'Sua sessão expirou. Entre novamente.'});
    let body=req.body;if(typeof body==='string')body=JSON.parse(body);
    if(!isAllowedPushEndpoint(body?.endpoint))return res.status(400).json({error:'Dispositivo de notificações inválido.'});
    const {data:device,error}=await db.from('push_subscriptions').select('*').eq('user_id',user.id).eq('endpoint',body.endpoint).maybeSingle();
    if(error||!device)return res.status(409).json({error:'Ative as notificações neste aparelho antes de testar.'});
    webpush.setVapidDetails(process.env.VAPID_SUBJECT,config.vapidPublicKey,process.env.VAPID_PRIVATE_KEY);
    await webpush.sendNotification({endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth}},JSON.stringify({title:'Seu cantinho está pertinho 💜',body:'Este aviso veio do servidor e chegou às notificações do seu aparelho.',tag:'rayza-server-test',url:'/#compromissos'}),{TTL:300,urgency:'high',timeout:8000});
    return res.status(200).json({sent:true});
  }catch(error){
    if([404,410].includes(error.statusCode))return res.status(409).json({error:'A inscrição deste aparelho expirou. Desative e ative as notificações novamente.'});
    return res.status(502).json({error:'O serviço não conseguiu entregar o aviso. Confira a conexão e a configuração de notificações.'});
  }
}
