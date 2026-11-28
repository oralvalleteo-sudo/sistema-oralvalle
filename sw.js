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

// O shell contém apenas arquivos públicos. Respostas clínicas nunca entram no Cache Storage.
const STATIC_CACHE = 'nexodent-public-static-435';
const SHELL_CACHE = 'nexodent-public-shell-435';
const publicPath = /^(?:assets\/|legal\/)[a-zA-Z0-9_./-]+\.(?:js|css|woff2?|png|webp|svg|ico|mp3|wav)$|^(?:favicon[^/]*|apple-touch-icon\.png|icon-(?:192|512)\.png|manifest\.webmanifest)$/;
function shellAsset(value, base) {
  const url = new URL(value, base);
  return url.origin === base.origin && url.pathname.startsWith(base.pathname) &&
    publicPath.test(url.pathname.slice(base.pathname.length)) && !url.username && !url.password &&
    [...url.searchParams].every(([key, value]) => ['build', 'v'].includes(key) && /^\d+$/.test(value));
}
async function installShell() {
  const base = new URL(self.registration.scope);
  const index = new URL('index.html', base).href;
  const request = { cache: 'reload', credentials: 'omit', redirect: 'error' };
  const html = await fetch(index, request);
  if (!html.ok || !html.headers.get('content-type')?.includes('text/html')) throw new Error('Shell indisponível.');
  const markup = await html.clone().text();
  const assets = new Set();
  for (const match of markup.matchAll(/(?:src|href)=["']([^"'\s]+)["']/g)) {
    if (shellAsset(match[1], base)) assets.add(new URL(match[1], base).href);
  }
  const cache = await caches.open(SHELL_CACHE);
  for (const url of assets) {
    const response = await fetch(url, request);
    if (!response.ok || /private|no-store/i.test(response.headers.get('cache-control') || ''))
      throw new Error('Recurso público indisponível para abrir offline.');
    await cache.put(url, response);
  }
  await cache.put(index, html);
}
self.addEventListener('install', event => event.waitUntil(installShell().then(() => self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if((name.startsWith('nexodent-public-static-')&&name!==STATIC_CACHE)||(name.startsWith('nexodent-public-shell-')&&name!==SHELL_CACHE))await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request = event.request;
 const url = new URL(request.url);
 const scope = new URL(self.registration.scope);
 if (request.method !== 'GET' || url.origin !== scope.origin ||
     request.headers.has('authorization') || request.headers.has('range')) return;
 if (request.mode === 'navigate' && [scope.pathname, scope.pathname + 'index.html'].includes(url.pathname)) {
   event.respondWith((async () => {
     try {
       const response = await fetch(request);
       if (response.status < 500) return response;
     } catch (_) {}
     const shell = await caches.open(SHELL_CACHE);
     return await shell.match(new URL('index.html', scope).href) || Response.error();
   })());
   return;
 }
 if (!shellAsset(url.href, scope)) return;
 const versioned = url.searchParams.has('build') || url.searchParams.has('v');
 const asset = url.pathname.startsWith(scope.pathname + 'assets/');
 // Non-asset and unversioned URLs are served only if they were part of the installed shell.
 if (!asset || !versioned) {
   if (request.destination === '') return;
   event.respondWith((async () => {
     const cache = await caches.open(SHELL_CACHE);
     return await cache.match(request) || fetch(request);
   })());
   return;
 }
 event.respondWith((async () => {
   const cache = await caches.open(STATIC_CACHE);
   const hit = await cache.match(request);
   if (hit) return hit;
   const shell = await caches.open(SHELL_CACHE);
   const installed = await shell.match(request);
   if (installed) return installed;
   const response = await fetch(request, { credentials: 'omit' });
   if (response.ok && response.type !== 'opaque' && !response.redirected &&
       !/no-store|private/i.test(response.headers.get('cache-control') || '')) {
     await cache.put(request, response.clone());
   }
   return response;
 })());
});
