import {randomUUID} from 'node:crypto';
import {validateAppointment,validateWorkout} from '../src/domain.js';
const fields={appointments:['title','starts_at','category','location','notes','reminder_minutes','completed'],memories:['title','taken_on','caption','photo_path','favorite'],workouts:['title','focus','days','duration','notes','exercises'],workout_logs:['workout_id','done_on']};
const idPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const fail=(message,status=400)=>Object.assign(Error(message),{status});
export function tableKey(table){if(!Object.hasOwn(fields,table))throw fail('Tipo de registro inválido.');return table==='workout_logs'?'logs':table;}
export function publicRow(row){return Object.fromEntries(Object.entries(row).filter(([k])=>!k.startsWith('_')));}
export function saveRecord(database,table,patch,id,create=false) {
  const key=tableKey(table);if(!idPattern.test(id||''))throw fail('Identificador inválido.');
  let old=database[key].find(r=>r.id===id);
  if(!create&&!old)throw fail('Esse registro foi excluído em outro aparelho. Atualize a página.',409);
  const selected=Object.fromEntries(fields[table].filter(k=>k in patch).map(k=>[k,patch[k]]));
  const defaults=table==='appointments'?{category:'pessoal',location:'',notes:'',reminder_minutes:15,completed:false}:table==='memories'?{caption:'',favorite:false}:table==='workouts'?{focus:'',notes:'',days:[],duration:45}:{};
  const row={...defaults,...old,...selected,id,user_id:'rayza',created_at:old?.created_at||new Date().toISOString()};
  if(table==='appointments') {
    try{validateAppointment(row);}catch(error){throw fail(error.message);}
    if(!['pessoal','saude','estudo','encontro','outro'].includes(row.category)||typeof row.completed!=='boolean'||typeof row.location!=='string'||row.location.length>200||typeof row.notes!=='string'||row.notes.length>2000)throw fail('Confira os detalhes do compromisso.');
    row.starts_at=new Date(row.starts_at).toISOString();
    const changed=!old||['title','starts_at','reminder_minutes','completed','location'].some(k=>old[k]!==row[k]);
    if(changed){row._revision=randomUUID();row._queued=null;row._sent=false;row._lease=null;}
  } else if(table==='workouts') {
    try{validateWorkout(row);}catch(error){throw fail(error.message);}if(!Number.isInteger(row.duration)||row.duration<1||row.duration>360||typeof row.focus!=='string'||row.focus.length>100||typeof row.notes!=='string'||row.notes.length>2000)throw fail('Confira a duração e as notas do treino.');
  } else if(table==='memories') {
    if(typeof row.title!=='string'||!row.title.trim()||row.title.length>120||typeof row.caption!=='string'||row.caption.length>1000||!/^\d{4}-\d{2}-\d{2}$/.test(row.taken_on)||!/^rayza\/photos\/[a-f0-9-]+\.jpg$/.test(row.photo_path||'')||typeof row.favorite!=='boolean')throw fail('Confira a foto, o título e a data da lembrança.');
  } else {
    if(!database.workouts.some(w=>w.id===row.workout_id)||!/^\d{4}-\d{2}-\d{2}$/.test(row.done_on))throw fail('Treino ou data inválidos.');
    const existing=database.logs.find(l=>l.workout_id===row.workout_id&&l.done_on===row.done_on);if(existing)return publicRow(existing);
  }
  if(old)database[key][database[key].findIndex(r=>r.id===id)]=row;else{if(database[key].length>=3000)throw fail('Limite de registros atingido.');database[key].push(row);}
  return publicRow(row);
}
export function deleteRecord(database,table,id) {
  const key=tableKey(table);database[key]=database[key].filter(r=>r.id!==id);
  if(table==='workouts')database.logs=database.logs.filter(r=>r.workout_id!==id);
  return {id};
}
