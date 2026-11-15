// Sem cache de fotos privadas ou respostas autenticadas.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=> {
  let data={};
  try {data=event.data?.json()||{};} catch {data={body:'Você tem um lembrete no seu cantinho.'};}
  event.waitUntil(self.registration.showNotification(data.title||'Rayza 💜',{
    body:data.body||'Você tem um compromisso para lembrar.',
    icon:'/icon-192.png',badge:'/icon-192.png',tag:data.tag||'rayza',
    data:{url:'/#compromissos'}
  }));
});
self.addEventListener('notificationclick',event=> {
  event.notification.close();
  event.waitUntil((async()=> {
    const target=new URL('/#compromissos',self.location.origin).href;
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows) {if(new URL(client.url).origin===self.location.origin){await client.navigate(target);return client.focus();}}
    return self.clients.openWindow(target);
  })());
});
