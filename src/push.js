import {db,checked} from './store.js';

function keyBytes(base64) {
  const value=base64.replace(/-/g,'+').replace(/_/g,'/');
  return Uint8Array.from(atob(value+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));
}
export async function enablePush(user) {
  if(!user) throw Error('Entre na sua conta para receber seus lembretes.');
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  if(ios && !matchMedia('(display-mode: standalone)').matches && !navigator.standalone) throw Error('No iPhone: abra no Safari, toque em Compartilhar → Adicionar à Tela de Início. Depois abra pelo ícone e ative os lembretes.');
  if(!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw Error('Este navegador não oferece notificações push. Experimente um navegador atualizado.');
  const publicKey=import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if(!publicKey || publicKey.includes('SUA_CHAVE')) throw Error('As notificações ainda precisam ser configuradas pelo responsável pelo site.');
  const permission=await Notification.requestPermission();
  if(permission!=='granted') throw Error('Permita as notificações nas configurações do navegador para ativar os lembretes.');
  await navigator.serviceWorker.register('/sw.js');
  const registration=await navigator.serviceWorker.ready;
  const existing=await registration.pushManager.getSubscription();
  const subscription=existing || await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(publicKey)});
  const json=subscription.toJSON();
  try {
    await checked(db.from('push_subscriptions').upsert({user_id:user.id,endpoint:json.endpoint,p256dh:json.keys.p256dh,auth:json.keys.auth},{onConflict:'endpoint'}));
  } catch(error) {if(!existing) await subscription.unsubscribe(); throw error;}
  return true;
}
export async function disablePush(user) {
  if(!('serviceWorker' in navigator)) return;
  const registration=await navigator.serviceWorker.getRegistration();
  const subscription=await registration?.pushManager.getSubscription();
  if(!subscription) return;
  if(user) await checked(db.from('push_subscriptions').delete().eq('user_id',user.id).eq('endpoint',subscription.endpoint));
  await subscription.unsubscribe();
}
export async function pushEnabled(user) {
  if(!user || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const registration=await navigator.serviceWorker.getRegistration();
  const subscription=await registration?.pushManager.getSubscription();
  if(!subscription) return false;
  const rows=await checked(db.from('push_subscriptions').select('id').eq('user_id',user.id).eq('endpoint',subscription.endpoint));
  return rows.length>0;
}
export async function testPush() {
  const registration=await navigator.serviceWorker.ready;
  await registration.showNotification('Seu cantinho está pertinho 💜',{body:'Permissão e exibição funcionando neste aparelho. Os compromissos serão enviados pelo servidor.',icon:'/icon-192.png',tag:'rayza-test'});
}
