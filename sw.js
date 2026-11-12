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
