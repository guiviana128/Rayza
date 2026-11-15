import {repository} from '../server/repository.js';
import {requireUser,apiError} from '../server/session.js';
import {resolveConfig} from '../server/config.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  try{requireUser(req);if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
    const {data}=await repository.read();
    return res.status(200).json({serverConfigured:resolveConfig().pushConfigured,schedulerActive:Boolean(data.runtime.lastCallback),queuePublished:Boolean(data.runtime.lastQueuePublish),schedulerType:'Vercel Queues',lastSchedulerRun:data.runtime.lastCallback||null});
  }catch(error){return apiError(res,error);}
}
