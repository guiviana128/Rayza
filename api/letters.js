import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {repository} from '../server/repository.js';
import {apiError,jsonBody,requireOrigin,requireUser} from '../server/session.js';
import {fail,saveRecord} from '../server/records.js';

const digest = code => createHash('sha256').update(code).digest();

export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try {
    requireOrigin(req);
    const body=jsonBody(req);
    if(body.action==='issue-code'){
      requireUser(req);
      const code=randomBytes(24).toString('base64url');
      await repository.mutate(data=>{
        data.runtime??={};
        data.runtime.letterSenderDigest=digest(code).toString('hex');
      });
      return res.status(200).json({code});
    }
    if(body.action!=='send')throw fail('Ação inválida.');
    if(typeof body.code!=='string'||!/^[a-zA-Z0-9_-]{32}$/.test(body.code))throw fail('Código de envio inválido.',401);
    const supplied=digest(body.code);
    const {data}=await repository.read();
    const authorize=snapshot=>{
      const expected=Buffer.from(snapshot.runtime?.letterSenderDigest||'','hex');
      if(expected.length!==supplied.length||!timingSafeEqual(expected,supplied))throw fail('Código de envio inválido.',401);
    };
    authorize(data);
    const {id,title,body:message,link}=body;
    await repository.mutate(snapshot=>{
      authorize(snapshot);
      saveRecord(snapshot,'letters',{title,body:message,link},id,true);
    });
    return res.status(200).json({sent:true});
  }catch(error){return apiError(res,error);}
}
