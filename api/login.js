import {createHash} from 'node:crypto';
import {verifyAccountPassword,accountSettings} from '../server/single-account.js';
import {createSessionToken,sessionCookie,requireOrigin} from '../server/session.js';
import {repository} from '../server/repository.js';
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
    requireOrigin(req);
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>2048)return res.status(400).json({error:'Preencha seu usuário e senha.'});
    if(!process.env.BLOB_READ_WRITE_TOKEN||!process.env.RAYZA_SESSION_SECRET)return res.status(503).json({error:'O armazenamento ainda está sendo ativado. Aguarde alguns instantes e tente novamente.'});
    await repository.mutate(d=>{
      const entries=Object.fromEntries(Object.entries(d.runtime.loginAttempts||{}).filter(([,v])=>v.until>Date.now()));
      const item=entries[key]||{count:0,until:Date.now()+60000};
      if(item.count>=10)throw Object.assign(Error('Muitas tentativas. Aguarde um minuto.'),{status:429});
      item.count++;entries[key]=item;d.runtime.loginAttempts=entries;
    });
    const settings=accountSettings();
    if(body.username?.trim()!==settings.username||!verifyAccountPassword(body.password,process.env.RAYZA_PASSWORD_HASH))return res.status(401).json({error:'Usuário ou senha incorretos.'});
    await repository.read();
    const token=createSessionToken();
    const session={user:{id:'rayza',username:settings.username,user_metadata:{name:'Rayza'}}};
    res.setHeader('Set-Cookie',sessionCookie(token));
    attempts.delete(key);
    await repository.mutate(d=>{if(d.runtime.loginAttempts)delete d.runtime.loginAttempts[key];});
    return res.status(200).json({session});
  }catch(error){return res.status(error.status||503).json({error:error.status?error.message:'Não foi possível acessar o armazenamento. Tente novamente.'});}
}
