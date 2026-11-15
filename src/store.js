import {createClient} from '@supabase/supabase-js';
import {sanitizeWorkout} from './domain.js';

const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured=Boolean(url?.startsWith('https://') && key && !url.includes('SEU-PROJETO') && !key.includes('SUA_CHAVE'));
export const db=configured?createClient(url,key):null;
export async function checked(promise) {const {data,error}=await promise;if(error) throw error;return data;}
export async function loadData(user) {
  const [appointments,memories,workouts,logs]=await Promise.all(['appointments','memories','workouts','workout_logs'].map(t=>checked(db.from(t).select('*').eq('user_id',user.id))));
  const signed=memories.length?await checked(db.storage.from('memories').createSignedUrls(memories.map(m=>m.photo_path),3600)):[];
  for(const m of memories) {const match=signed.find(s=>s.path===m.photo_path);m.url=match?.signedUrl||'';}
  return {appointments,memories,workouts:workouts.map(sanitizeWorkout),logs};
}
export async function saveRow(table,row,user,id) {
  if(!user) throw Error('Entre na sua conta para salvar.');
  return checked(id?db.from(table).update(row).eq('id',id).eq('user_id',user.id).select().single():db.from(table).insert({...row,user_id:user.id}).select().single());
}
export async function deleteRow(table,id,user) {return checked(db.from(table).delete().eq('id',id).eq('user_id',user.id));}

export async function preparePhoto(file) {
  if(!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) throw Error('Escolha uma foto JPG, PNG ou WebP. Se for HEIC, exporte como JPG.');
  if(file.size>20*1024*1024) throw Error('Escolha uma foto de até 20 MB.');
  const url=URL.createObjectURL(file);
  try {
    const image=new Image();image.src=url;await image.decode();
    const scale=Math.min(1,2000/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.86));
    if(!blob || blob.size>8*1024*1024) throw Error('Não foi possível preparar essa foto. Tente outra imagem.');
    return blob;
  } finally {URL.revokeObjectURL(url);}
}
export async function uploadPhoto(blob,user) {
  const photoPath=`${user.id}/${crypto.randomUUID()}.jpg`;
  await checked(db.storage.from('memories').upload(photoPath,blob,{contentType:'image/jpeg',upsert:false}));
  return photoPath;
}
export function demoData() {
  const at=(days,hour)=> {const d=new Date();d.setDate(d.getDate()+days);d.setHours(hour,0,0,0);return d.toISOString();};
  return {
    appointments:[
      {id:'demo-a',title:'Um tempo para cuidar de mim',starts_at:at(0,18),category:'saude',location:'Meu momento de autocuidado',notes:'Desacelerar também faz parte.',reminder_minutes:15,completed:false},
      {id:'demo-b',title:'Nosso próximo encontro',starts_at:at(1,19),category:'encontro',location:'Um lugar especial',notes:'Escolher um lugar que a gente ama.',reminder_minutes:30,completed:false},
      {id:'demo-c',title:'Colocar os planos em dia',starts_at:at(3,10),category:'pessoal',location:'Em casa, com um café',notes:'Um passo de cada vez.',reminder_minutes:15,completed:false}
    ],
    memories:[
      {id:'demo-m1',title:'Onde a paz mora',caption:'Um céu bonito para guardar no coração. Ilustração de demonstração.',taken_on:new Date().toISOString().slice(0,10),favorite:true,url:'/demo-sunset.svg'},
      {id:'demo-m2',title:'Pequenas felicidades',caption:'Os detalhes deixam a vida mais bonita. Ilustração de demonstração.',taken_on:new Date().toISOString().slice(0,10),favorite:false,url:'/demo-flowers.svg'},
      {id:'demo-m3',title:'Que venham novos caminhos',caption:'Mais dias leves, mais histórias nossas. Ilustração de demonstração.',taken_on:new Date().toISOString().slice(0,10),favorite:true,url:'/demo-mountains.svg'}
    ],
    workouts:[],logs:[]
  };
}
