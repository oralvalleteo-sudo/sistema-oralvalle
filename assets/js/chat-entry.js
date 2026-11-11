/* A central avulsa encaminha para a aba interna, preservando o menu do NexoDent. */
(()=>{'use strict';if(window.top!==window.self)return;
const target=new URL('../index.html',location.href);target.searchParams.set('tab','chat');
const clinic=new URLSearchParams(location.search).get('clinic_id');if(clinic&&/^[0-9a-f-]{36}$/i.test(clinic))target.searchParams.set('clinic_id',clinic);
document.documentElement.hidden=true;location.replace(target.href);
})();
