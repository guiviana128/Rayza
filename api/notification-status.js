import {createClient} from '@supabase/supabase-js';
import {resolveConfig,getSupabaseServerKey} from '../server/config.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const config=resolveConfig(),authorization=req.headers.authorization||'';
  if(!config.configured)return res.status(503).json({error:'Banco não configurado.'});
  if(!authorization.startsWith('Bearer '))return res.status(401).json({error:'Entre na sua conta.'});
  try {
    const db=createClient(config.supabaseUrl,config.supabaseKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error}=await db.auth.getUser(authorization.slice(7));
    if(error||!user)return res.status(401).json({error:'Sua sessão expirou.'});
    let lastRun=null;
    if(getSupabaseServerKey()){
      const admin=createClient(config.supabaseUrl,getSupabaseServerKey(),{auth:{persistSession:false,autoRefreshToken:false}});
      const {data}=await admin.from('reminder_runtime').select('last_run_at').eq('id','scheduler').maybeSingle();
      lastRun=data?.last_run_at||null;
    }
    return res.status(200).json({serverConfigured:config.pushConfigured,lastSchedulerRun:lastRun,schedulerActive:Boolean(lastRun&&Date.now()-Date.parse(lastRun)<180000)});
  }catch{return res.status(502).json({error:'Não foi possível consultar as notificações.'});}
}
