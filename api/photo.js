import {get,put,del} from '@vercel/blob';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {randomUUID} from 'node:crypto';
import {requireUser,requireOrigin,jsonBody,apiError} from '../server/session.js';
import {repository} from '../server/repository.js';
const valid=path=>typeof path==='string'&&/^rayza\/photos\/[a-f0-9-]{36}\.jpg$/.test(path);
export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
  try{
    requireUser(req);requireOrigin(req);
    if(req.method==='GET'){
      const path=req.query.path;if(!valid(path))return res.status(400).json({error:'Foto inválida.'});
      const file=await get(path,{access:'private',useCache:false});if(!file)return res.status(404).json({error:'Foto não encontrada.'});
      res.setHeader('Content-Type','image/jpeg');return await pipeline(Readable.fromWeb(file.stream),res);
    }
    const body=jsonBody(req);
    if(req.method==='POST'){
      if(typeof body.photo!=='string'||body.photo.length>4000000)return res.status(400).json({error:'A foto é muito grande.'});
      const buffer=Buffer.from(body.photo,'base64');
      if(buffer.length>2900000||buffer[0]!==255||buffer[1]!==216||buffer[2]!==255)return res.status(400).json({error:'Escolha uma foto JPG válida.'});
      const path=`rayza/photos/${randomUUID()}.jpg`;
      await put(path,buffer,{access:'private',addRandomSuffix:false,contentType:'image/jpeg'});
      return res.status(200).json({path});
    }
    if(req.method==='DELETE'){
      if(!valid(body.path))return res.status(400).json({error:'Foto inválida.'});
      const {data}=await repository.read();
      if(data.memories.some(m=>m.photo_path===body.path))return res.status(200).json({retained:true});
      await del(body.path);return res.status(200).json({removed:true});
    }
    return res.status(405).json({error:'Method not allowed'});
  }catch(error){if(!res.headersSent)return apiError(res,error);res.end();}
}
