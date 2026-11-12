/* Oral Valle — recebimento de notificações Web Push. */
self.addEventListener('push', (event) => {
  // Não exibir no sistema operacional o texto clínico recebido no payload.
  const title = 'NexoDent — Aviso de agenda';
  const options = {
    body: 'Há uma atualização na agenda. Abra o sistema para consultar os detalhes.',
    tag: 'nexodent-agenda',
    data: { url: self.registration.scope },
    icon: new URL('apple-touch-icon.png',self.registration.scope).href,
    silent: false,
    vibrate: [200,100,200],
  };
  event.waitUntil((async()=>{await self.registration.showNotification(title,options);const windows=await clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows)if(client.url.startsWith(self.registration.scope))client.postMessage({type:'nexodent:push-received'});})());
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if (client.url.startsWith(self.registration.scope)) {
        await client.focus();
        return;
      }
    }
    await clients.openWindow(self.registration.scope);
  })());
});

// Somente arquivos públicos versionados. Nunca interceptar HTML, API ou anexos.
const STATIC_CACHE='nexodent-public-static-285';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith('nexodent-public-static-')&&name!==STATIC_CACHE)await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url),scope=new URL(self.registration.scope);
 if(request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname+'assets/')||!(/\.(?:js|css|woff2?|png|webp|svg|ico)$/.test(url.pathname))||!(url.searchParams.has('build')||url.searchParams.has('v'))||request.headers.has('authorization')||request.headers.has('range'))return;
 event.respondWith((async()=>{
  const cache=await caches.open(STATIC_CACHE),hit=await cache.match(request);
  if(hit)return hit;
  const response=await fetch(request);
  if(response.ok&&response.type!=='opaque'&&!response.redirected){
   const control=response.headers.get('cache-control')||'';
   if(!/no-store|private/i.test(control))await cache.put(request,response.clone());
  }
  return response;
 })());
});
