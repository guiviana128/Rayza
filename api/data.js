import {repository} from '../server/repository.js';
import {requireUser,requireOrigin,jsonBody,apiError} from '../server/session.js';
import {saveRecord,deleteRecord,publicRow,fail} from '../server/records.js';
import {scheduleAppointment} from '../server/notifications.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  try{
    requireUser(req);requireOrigin(req);
    if(req.method==='GET'){
      const {data}=await repository.read();
      return res.status(200).json(Object.fromEntries(['appointments','memories','workouts','logs'].map(k=>[k,data[k].map(row=>({...publicRow(row),...(k==='memories'?{url:`/api/photo?path=${encodeURIComponent(row.photo_path)}`}:{})}))])));
    }
    if(!['POST','PATCH','DELETE'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
    const body=jsonBody(req);if(JSON.stringify(body).length>100000)throw fail('Registro muito grande.');
    const row=await repository.mutate(data=>req.method==='DELETE'?deleteRecord(data,body.table,body.id):saveRecord(data,body.table,body.row||{},body.id,req.method==='POST'));
    let warning=null;
    if(body.table==='appointments'&&req.method!=='DELETE')try{await scheduleAppointment(row.id);}catch{warning='Compromisso salvo. O agendamento do aviso será tentado novamente.';}
    return res.status(200).json({row,warning});
  }catch(error){return apiError(res,error);}
}
