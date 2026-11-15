import {createClient} from '@supabase/supabase-js';
import webpush from 'web-push';
import {authorized,deliverToDevices,ownsClaim} from '../server/push.js';
import {resolveConfig,getSupabaseServerKey} from '../server/config.js';

const must=async query=>{const {data,error}=await query;if(error) throw error;return data;};

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(!['POST','GET'].includes(req.method)) return res.status(405).json({error:'Method not allowed'});
  if(!authorized(req.headers.authorization,process.env.CRON_SECRET)) return res.status(401).json({error:'Unauthorized'});
  const config=resolveConfig();
  if(!config.pushConfigured) return res.status(503).json({error:'Configure database and push environment variables.'});
  const db=createClient(config.supabaseUrl,getSupabaseServerKey(),{auth:{persistSession:false}});
  const deadline=Date.now()+45000;
  let processed=0,failed=0;
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT,config.vapidPublicKey,process.env.VAPID_PRIVATE_KEY);
    // Pequenos lotes: evitar que o último job fique sem tempo em funções serverless.
    const jobs=await must(db.rpc('claim_reminder_jobs',{batch_size:5}));
    // O diagnóstico só indica agendador ativo depois de uma consulta válida à fila.
    await db.from('reminder_runtime').upsert({id:'scheduler',last_run_at:new Date().toISOString()});
    for(const job of jobs) {
      if(Date.now()>deadline) break; // lease expira e o próximo tick recupera o job.
      // Fencing: um worker antigo nunca altera um lease que já foi recuperado.
      const updateJob=values=>must(db.from('reminder_jobs').update(values).eq('id',job.id).eq('status','processing').eq('attempts',job.attempts).eq('locked_until',job.locked_until));
      const stillOwnsClaim=async()=>Date.now()<deadline && ownsClaim(await must(db.from('reminder_jobs').select('status,attempts,locked_until').eq('id',job.id).maybeSingle()),job);
      try {
        if(!await stillOwnsClaim()) continue;
        const appointment=await must(db.from('appointments').select('*').eq('id',job.appointment_id).maybeSingle());
        if(!appointment || appointment.completed) {
          await updateJob({status:'cancelled'}); continue;
        }
        const devices=await must(db.from('push_subscriptions').select('*').eq('user_id',job.user_id));
        const delivered=await must(db.from('reminder_deliveries').select('subscription_id').eq('job_id',job.id));
        if(!devices.length) {
          await updateJob({status:'pending',available_at:new Date(Date.now()+60000).toISOString(),locked_until:null});
          continue;
        }
        const payload={title:`É hora de lembrar 💜`,body:appointment.title,tag:`rayza-${job.id}`,url:'/#compromissos'};
        const result=await deliverToDevices({devices,delivered:new Set(delivered.map(d=>d.subscription_id)),payload,canSend:stillOwnsClaim,
          send:async(d,p)=>webpush.sendNotification({endpoint:d.endpoint,keys:{p256dh:d.p256dh,auth:d.auth}},JSON.stringify(p),{TTL:3600,urgency:'high',timeout:4000}),
          record:async id=>must(db.from('reminder_deliveries').upsert({job_id:job.id,subscription_id:id})),
          remove:async id=>must(db.from('push_subscriptions').delete().eq('id',id))
        });
        const failures=job.failures+(result.failed?1:0);
        const status=result.failed ? (failures>=5?'failed':'pending') : 'sent';
        await updateJob({status,failures,locked_until:null,available_at:new Date(Date.now()+60000*Math.min(failures||1,5)).toISOString(),last_error:result.failed?'Temporary push failure':null});
        processed++; failed+=result.failed;
      } catch {
        failed++;
        await updateJob({status:job.failures+1>=5?'failed':'pending',failures:job.failures+1,locked_until:null,available_at:new Date(Date.now()+60000).toISOString(),last_error:'Delivery failed; check server configuration'});
      }
    }
    return res.status(200).json({processed,failed});
  } catch {
    // Nunca retornar credenciais, endpoints privados ou dados pessoais em logs/resposta.
    return res.status(500).json({error:'Could not process reminders. Check database schema and server configuration.'});
  }
}
