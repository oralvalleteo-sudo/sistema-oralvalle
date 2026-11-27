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
const STATIC_CACHE='nexodent-public-static-409';
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


// Fase 1: abertura segura sem rede. Não inicia o banco legado nem autenticação
// local quando o servidor está indisponível; nenhum prontuário é armazenado.
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  const scope = new URL(self.registration.scope);
  if (req.method !== 'GET' || req.mode !== 'navigate' ||
      url.origin !== scope.origin ||
      ![scope.pathname, scope.pathname + 'index.html'].includes(url.pathname)) return;
  event.respondWith((async () => {
    try { return await fetch(req); }
    catch (_) {
      return new Response(`<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#ffffff"><title>NexoDent — Sem conexão</title>
<style>body{margin:0;background:#fff;color:#26343c;font:16px system-ui,sans-serif;min-height:100vh;display:grid;place-items:center}main{max-width:360px;padding:28px;text-align:center}h1{font-size:30px;margin:0}h2{font-size:20px}p{line-height:1.6;color:#536169}button{background:#e66b18;color:white;border:0;border-radius:10px;padding:13px 24px;font:inherit;cursor:pointer}</style></head>
<body><main><h1>NexoDent</h1><h2>Sem conexão com a internet</h2><p>O sistema está disponível para abertura, mas o acesso aos dados da clínica precisa de conexão nesta versão. Nenhum dado foi alterado.</p><button id="retry">Tentar novamente</button><p id="status" role="status"></p></main>
<script>document.getElementById('retry').onclick=()=>location.reload();window.addEventListener('online',()=>{document.getElementById('status').textContent='Conexão detectada. Toque em Tentar novamente.'});</script></body></html>`, {
        status: 200,
        headers: {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
      });
    }
  })());
});
