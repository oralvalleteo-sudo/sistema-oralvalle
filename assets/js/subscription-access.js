(()=>{'use strict';
window.addEventListener('nexodent:subscription-required',()=>{
 if(document.getElementById('subscription-required'))return;
 const banner=document.createElement('div');banner.id='subscription-required';banner.setAttribute('role','alert');banner.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:#fff0d6;color:#49300a;padding:16px;text-align:center;border-bottom:2px solid #e87822';
 banner.append(document.createTextNode('Sua assinatura precisa ser regularizada ou o recurso exige outro plano. '));
 const link=document.createElement('a');const inSubdir=/\/(crm|integracoes|comunicacao)\//.test(location.pathname);link.href=(inSubdir?'../':'./')+'assinatura/index.html';link.textContent='Gerenciar assinatura';link.target='_blank';link.rel='noopener';banner.append(link);document.body.prepend(banner);
});
})();
