import {sanitizeWorkout} from './domain.js';
export let configured=false,db=null,publicConfig={configured:false,vapidPublicKey:''},lastSaveWarning=null;
export async function request(url,{method='GET',body,signal}={}) {
  const response=await fetch(url,{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:signal||AbortSignal.timeout(25000)});
  const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error||'Não foi possível concluir. Tente novamente.'),{status:response.status});return result;
}
export async function initializeStore() {
  try{publicConfig=await request('/api/config');}catch{publicConfig={configured:false,accountUsername:'rayza.huang'};}
  configured=publicConfig.configured===true;
  db=configured?{auth:{getSession:async()=>({data:await request('/api/session'),error:null}),signOut:async()=>({data:await request('/api/session',{method:'DELETE'}),error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}}:null;
  return publicConfig;
}
export async function checked(promise){const {data,error}=await promise;if(error)throw error;return data;}
export async function loadData(){const data=await request('/api/data');data.workouts=data.workouts.map(sanitizeWorkout);data.finances=data.finances||[];return data;}
export async function saveRow(table,row,user,id){
  if(!user)throw Error('Entre na sua conta para salvar.');
  const result=await request('/api/data',{method:id?'PATCH':'POST',body:{table,id:id||row.id||crypto.randomUUID(),row}});lastSaveWarning=result.warning||null;return result.row;
}
export async function deleteRow(table,id,user){if(!user)throw Error('Entre na sua conta para excluir.');return request('/api/data',{method:'DELETE',body:{table,id}});}
export async function preparePhoto(file){
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Escolha uma foto JPG, PNG ou WebP.');
  if(file.size>20*1024*1024)throw Error('Escolha uma foto de até 20 MB.');
  const url=URL.createObjectURL(file);
  try{const image=new Image();image.src=url;await image.decode();const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.82));if(!blob||blob.size>2800000)throw Error('Não foi possível reduzir essa foto. Escolha outra imagem.');return blob;
  }finally{URL.revokeObjectURL(url);}
}
export async function uploadPhoto(blob){const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});return (await request('/api/photo',{method:'POST',body:{photo:encoded}})).path;}
export const removePhoto=path=>request('/api/photo',{method:'DELETE',body:{path}});
