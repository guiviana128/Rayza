import {db,checked,publicConfig} from './store.js';

function keyBytes(base64) {
  const value=base64.replace(/-/g,'+').replace(/_/g,'/');
  return Uint8Array.from(atob(value+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));
}
export async function enablePush(user) {
  if(!user) throw Error('Entre na sua conta para receber seus lembretes.');
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  if(ios && !matchMedia('(display-mode: standalone)').matches && !navigator.standalone) throw Error('No iPhone: abra no Safari, toque em Compartilhar → Adicionar à Tela de Início. Depois abra pelo ícone e ative os lembretes.');
  if(!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw Error('Este navegador não oferece notificações push. Experimente um navegador atualizado.');
  const publicKey=publicConfig.vapidPublicKey;
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
  try {
    if(user) await checked(db.from('push_subscriptions').delete().eq('user_id',user.id).eq('endpoint',subscription.endpoint));
  } finally {
    // Mesmo sem resposta do banco, revogar a inscrição local interrompe futuras entregas.
    await subscription.unsubscribe();
  }
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
  const {session}=await checked(db.auth.getSession());
  if(!session)throw Error('Entre na sua conta para testar.');
  const registration=await navigator.serviceWorker.ready;
  const subscription=await registration.pushManager.getSubscription();
  if(!subscription)throw Error('Ative as notificações neste aparelho antes de testar.');
  const response=await fetch('/api/push-test',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint}),signal:AbortSignal.timeout(15000)});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Não foi possível enviar o teste.');
}
