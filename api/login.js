import {createClient} from '@supabase/supabase-js';
import {createHash} from 'node:crypto';
import {createFixedSession} from '../server/single-account.js';
const attempts=new Map();
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const address=req.headers['x-vercel-forwarded-for']||req.headers['x-real-ip']||req.socket?.remoteAddress||'unknown';
  const key=createHash('sha256').update(String(address)).digest('hex');
  const now=Date.now(),previous=attempts.get(key),bucket=previous?.until>now?previous:{count:0,until:now+60000};
  if(bucket.count>=10){res.setHeader('Retry-After','60');return res.status(429).json({error:'Muitas tentativas. Aguarde um minuto antes de tentar novamente.'});}
  bucket.count++;attempts.set(key,bucket);
  if(attempts.size>1000)for(const [id,item]of attempts)if(item.until<=now)attempts.delete(id);
  try {
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>2048)return res.status(400).json({error:'Preencha seu usuário e senha.'});
    const session=await createFixedSession(body,process.env,createClient);
    attempts.delete(key);
    return res.status(200).json({session});
  }catch(error){return res.status(error.status||503).json({error:error.status?error.message:'Não foi possível conectar ao banco. Confira a configuração do Supabase.'});}
}
