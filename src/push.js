import {request,publicConfig} from './store.js';
function keyBytes(base64){const value=base64.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(value+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));}
export async function enablePush(user){
  if(!user)throw Error('Entre na sua conta para receber lembretes.');
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(ios&&!matchMedia('(display-mode: standalone)').matches&&!navigator.standalone)throw Error('No iPhone: Safari → Compartilhar → Adicionar à Tela de Início. Abra pelo ícone e ative os lembretes.');
  if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw Error('Este navegador não oferece notificações push. Use um navegador atualizado.');
  if(!publicConfig.vapidPublicKey)throw Error('As notificações ainda estão sendo ativadas no servidor.');
  if(await Notification.requestPermission()!=='granted')throw Error('Permita notificações nas configurações do navegador.');
  await navigator.serviceWorker.register('/sw.js');const registration=await navigator.serviceWorker.ready;
  const existing=await registration.pushManager.getSubscription();const subscription=existing||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(publicConfig.vapidPublicKey)});const json=subscription.toJSON();
  try{await request('/api/subscriptions',{method:'POST',body:{endpoint:json.endpoint,p256dh:json.keys.p256dh,auth:json.keys.auth}});}catch(error){if(!existing)await subscription.unsubscribe();throw error;}
  return true;
}
export async function disablePush(){
  if(!('serviceWorker'in navigator))return;const registration=await navigator.serviceWorker.getRegistration();const subscription=await registration?.pushManager.getSubscription();if(!subscription)return;
  try{await request('/api/subscriptions',{method:'DELETE',body:{endpoint:subscription.endpoint}});}finally{await subscription.unsubscribe();}
}
export async function pushEnabled(user){
  if(!user||!('serviceWorker'in navigator)||!('PushManager'in window))return false;
  const registration=await navigator.serviceWorker.getRegistration(),subscription=await registration?.pushManager.getSubscription();if(!subscription)return false;
  return (await request('/api/subscriptions',{method:'POST',body:{action:'status',endpoint:subscription.endpoint}})).enabled;
}
export async function testPush(){const registration=await navigator.serviceWorker.ready,subscription=await registration.pushManager.getSubscription();if(!subscription)throw Error('Ative as notificações neste aparelho.');await request('/api/push-test',{method:'POST',body:{endpoint:subscription.endpoint}});}
