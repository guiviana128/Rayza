import {createClient} from '@supabase/supabase-js';
import {sanitizeWorkout} from './domain.js';

export let configured=false;
export let db=null;
export let publicConfig={configured:false,vapidPublicKey:'',pushConfigured:false};
export async function initializeStore() {
  const fallback={supabaseUrl:import.meta.env.VITE_SUPABASE_URL?.trim(),supabaseKey:(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim(),vapidPublicKey:import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim()||''};
  try {
    const response=await fetch('/api/config',{cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('Configuration unavailable');
    publicConfig=await response.json();
  } catch {
    // Permite desenvolvimento Vite local, onde as funções /api não são executadas.
    publicConfig={...fallback,accountUsername:'rayza.huang',accountEmail:'rayza.huang@rayza-five.vercel.app',configured:Boolean(fallback.supabaseUrl?.startsWith('https://')&&fallback.supabaseKey&&!fallback.supabaseUrl.includes('SEU-PROJETO')&&!fallback.supabaseKey.includes('SUA_CHAVE')),pushConfigured:false};
  }
  configured=publicConfig.configured===true;
  db=configured?createClient(publicConfig.supabaseUrl,publicConfig.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
  return publicConfig;
}
export async function checked(promise) {const {data,error}=await promise;if(error) throw error;return data;}
export async function loadData(user) {
  const [appointments,memories,workouts,logs]=await Promise.all(['appointments','memories','workouts','workout_logs'].map(t=>checked(db.from(t).select('*').eq('user_id',user.id).abortSignal(AbortSignal.timeout(15000)))));
  const signed=memories.length?await checked(db.storage.from('memories').createSignedUrls(memories.map(m=>m.photo_path),3600)):[];
  for(const m of memories) {const match=signed.find(s=>s.path===m.photo_path);m.url=match?.signedUrl||'';}
  return {appointments,memories,workouts:workouts.map(sanitizeWorkout),logs};
}
export async function saveRow(table,row,user,id) {
  if(!user) throw Error('Entre na sua conta para salvar.');
  const query=id?db.from(table).update(row).eq('id',id).eq('user_id',user.id):db.from(table).upsert({...row,id:row.id||crypto.randomUUID(),user_id:user.id},{onConflict:'id'});
  return checked(query.select().single().abortSignal(AbortSignal.timeout(20000)));
}
export async function deleteRow(table,id,user) {
  if(!user)throw Error('Entre na sua conta para excluir.');
  return checked(db.from(table).delete().eq('id',id).eq('user_id',user.id).select('id').single().abortSignal(AbortSignal.timeout(20000)));
}

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
