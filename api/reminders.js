import {repository} from '../server/repository.js';
import {authorized} from '../server/push.js';
import {scheduleAppointment} from '../server/notifications.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!authorized(req.headers.authorization,process.env.CRON_SECRET))return res.status(401).json({error:'Unauthorized'});
  try{const {data}=await repository.read();let scheduled=0;
    for(const a of data.appointments){if(!a.completed&&!a._sent&&a._queued!==a._revision&&Date.parse(a.starts_at)+3600000>Date.now()){await scheduleAppointment(a.id);scheduled++;}}
    await repository.mutate(d=>{d.runtime.lastRecovery=new Date().toISOString();});return res.status(200).json({scheduled});
  }catch{return res.status(503).json({error:'Não foi possível recuperar os agendamentos.'});}
}
