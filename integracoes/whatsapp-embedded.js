(()=>{'use strict';
let sdkPromise=null,active=false,hostPromise=null;
const moduleUrl=document.currentScript?.src||(location.protocol==='https:'?new URL('whatsapp-embedded.js?build=282',location.href).href:'');
async function mainWindow(){
 if(window.top===window)return null;
 let host;try{host=window.top;if(host.location.origin!==location.origin)throw new Error('origin');}catch{throw new Error('Abra as integrações na janela principal do NexoDent para autorizar o WhatsApp.');}
 if(host.NexoWhatsAppEmbedded?.connect)return host;
 if(host.__nexoWhatsAppEmbeddedLoader)return host.__nexoWhatsAppEmbeddedLoader;
 if(!hostPromise)hostPromise=new Promise((resolve,reject)=>{
  const script=host.document.createElement('script');script.src=moduleUrl;script.async=true;
  const timeout=setTimeout(fail,15000);
  function fail(){clearTimeout(timeout);script.remove();delete host.__nexoWhatsAppEmbeddedLoader;hostPromise=null;reject(new Error('Não foi possível preparar a autorização na janela principal. Atualize o NexoDent e tente novamente.'));}
  script.onload=()=>{clearTimeout(timeout);if(host.NexoWhatsAppEmbedded?.connect)resolve(host);else fail();};script.onerror=fail;host.document.head.append(script);
 });
 host.__nexoWhatsAppEmbeddedLoader=hostPromise;
 return hostPromise;
}
let sdkReady=false;
function loadSdk(){
 if(sdkReady&&window.FB?.init&&window.FB?.login)return Promise.resolve(window.FB);
 if(sdkPromise)return sdkPromise;
 sdkPromise=new Promise((resolve,reject)=>{
  let settled=false,fileLoaded=false;
  const previous=window.fbAsyncInit;
  const script=document.createElement('script');script.src='https://connect.facebook.net/pt_BR/sdk.js';script.async=true;script.crossOrigin='anonymous';
  const timeout=setTimeout(()=>fail(fileLoaded?'META_SDK_NOT_READY':'META_SDK_DOWNLOAD_FAILED'),15000);
  function restore(){if(window.fbAsyncInit===initialized)window.fbAsyncInit=previous;}
  function fail(code){if(settled)return;settled=true;clearTimeout(timeout);restore();script.remove();sdkPromise=null;
   const error=new Error(code==='META_SDK_NOT_READY'?'O SDK da Meta foi baixado, mas não concluiu a inicialização. Atualize a página e tente novamente. (META_SDK_NOT_READY)':'Não foi possível baixar o SDK da Meta. Confira a conexão e os bloqueadores do navegador. (META_SDK_DOWNLOAD_FAILED)');error.code=code;reject(error);
  }
  function initialized(){
   if(settled)return;
   if(!window.FB?.init||!window.FB?.login)return fail('META_SDK_NOT_READY');
   settled=true;sdkReady=true;clearTimeout(timeout);restore();
   if(typeof previous==='function'){try{previous();}catch{}}
   resolve(window.FB);
  }
  // The bootstrap already exposes FB.init/login stubs. Only fbAsyncInit signals readiness.
  window.fbAsyncInit=initialized;
  script.onerror=()=>fail('META_SDK_DOWNLOAD_FAILED');script.onload=()=>{fileLoaded=true;};
  document.head.append(script);
 });return sdkPromise;
}

async function connect(config,cloud,clinic,currentClinic){
 const host=await mainWindow();
 if(host){
  const owner=cloud.session?.user?.id;
  return host.NexoWhatsAppEmbedded.connect(config,cloud,clinic,()=>{
   try{let frameWindow=window;while(frameWindow!==host){if(!frameWindow.frameElement?.isConnected)return null;frameWindow=frameWindow.parent;}if(host.OralCloud&&host.OralCloud.session?.user?.id!==owner)return null;return currentClinic();}catch{return null;}
  });
 }
 if(active)throw new Error('Já existe uma autorização em andamento.');
 if(config?.flow!=='embedded'||!/^\d+$/.test(config.app_id||'')||!/^\d+$/.test(config.config_id||'')||!/^v\d+\.\d+$/.test(config.version||'')||! /^[A-Za-z0-9_-]{43}$/.test(config.state||''))throw new Error('Atualize as funções WhatsApp no Supabase para o cadastro incorporado.');
 active=true;
 try{
  const FB=await loadSdk(),user=cloud.session?.user?.id;
  FB.init({appId:config.app_id,version:config.version,cookie:false,xfbml:false,autoLogAppEvents:false});
  return await new Promise((resolve,reject)=>{
   let code='',ids=null,finished=false,sending=false,waitingTimer=null,openingTimer=null;
   const dialog=document.createElement('dialog'),title=document.createElement('h2'),text=document.createElement('p'),proceed=document.createElement('button'),cancel=document.createElement('button');
   title.textContent='Conectar WhatsApp';text.textContent='Continue na Meta para escolher a empresa e o número que deseja autorizar nesta clínica.';
   proceed.textContent='Continuar na Meta';cancel.textContent='Cancelar';proceed.type=cancel.type='button';proceed.className=cancel.className='cta';
   for(const button of [proceed,cancel])Object.assign(button.style,{border:'1px solid #cbd3dc',borderRadius:'8px',padding:'10px 14px',marginRight:'6px',cursor:'pointer',background:'#fff',color:'#23344c'});
   Object.assign(proceed.style,{background:'#e96500',borderColor:'#e96500',color:'#fff'});
   dialog.append(title,text,proceed,cancel);document.body.append(dialog);
   const expires=setTimeout(()=>done(new Error('A autorização expirou. Inicie novamente.')),Math.min(Number(config.expires_in)||600,600)*1000);
   function done(error,result){if(finished)return;finished=true;clearTimeout(expires);clearTimeout(waitingTimer);clearTimeout(openingTimer);window.removeEventListener('message',message);dialog.remove();if(error)reject(error);else resolve(result);}
   async function finish(){
    if(finished||sending||!code||!ids)return;
    if(currentClinic()!==clinic||cloud.session?.user?.id!==user)return done(new Error('A clínica ou a conta mudou. Inicie novamente.'));
    sending=true;clearTimeout(expires);clearTimeout(waitingTimer);clearTimeout(openingTimer);cancel.disabled=true;cancel.style.opacity='.55';text.textContent='Validando a autorização e o número no servidor…';
    try{const result=await cloud.request('/functions/v1/nexodent-whatsapp-connect-callback',{method:'POST',body:{clinic_id:clinic,state:config.state,code,...ids}});if(currentClinic()!==clinic||cloud.session?.user?.id!==user)throw new Error('A clínica ou a conta mudou durante a validação.');if(result?.status!=='pending')throw new Error('O servidor não confirmou o vínculo.');done(null,result);}catch(error){done(error);}
   }
   function message(event){
    if(!['https://www.facebook.com','https://web.facebook.com'].includes(event.origin)||finished)return;
    let data=event.data;try{if(typeof data==='string'){if(data.length>20000)return;data=JSON.parse(data);}}catch{return;}
    if(data?.type!=='WA_EMBEDDED_SIGNUP')return;
    clearTimeout(openingTimer);
    if(data.event==='CANCEL'||data.event==='ERROR')return done(new Error('Cadastro WhatsApp não concluído. Você pode tentar novamente.'));
    if(data.event!=='FINISH')return;
    const waba=data.data?.waba_id,phone=data.data?.phone_number_id;
    if(!/^\d{1,40}$/.test(waba||'')||!/^\d{1,40}$/.test(phone||''))return done(new Error('Conclua a seleção do número no cadastro da Meta.'));
    ids={waba_id:String(waba),phone_number_id:String(phone)};finish();
   }
   window.addEventListener('message',message);
   proceed.onclick=()=>{
    if(currentClinic()!==clinic||cloud.session?.user?.id!==user)return done(new Error('A clínica ou a conta mudou. Inicie novamente.'));
    proceed.disabled=true;proceed.style.opacity='.55';text.textContent='Abrindo a autorização na janela da Meta…';
    openingTimer=setTimeout(()=>{
     if(finished||sending||code||ids)return;
     text.textContent='A Meta ainda não retornou a autorização. Se a janela abriu, conclua nela. Se nenhuma janela apareceu, cancele esta tentativa; não altere suas permissões de administrador.';
    },15000);
    try{FB.login(response=>{
     if(finished)return;
     clearTimeout(openingTimer);
     if(typeof response?.authResponse?.code!=='string'||!response.authResponse.code)return done(new Error('A Meta não concluiu a autorização. Se você não cancelou, confira o acesso ao aplicativo Meta.'));
     code=response.authResponse.code;
     if(!ids)waitingTimer=setTimeout(()=>done(new Error('A Meta não informou o número selecionado. Conclua o cadastro e tente novamente.')),30000);
     finish();
    },{config_id:config.config_id,response_type:'code',override_default_response_type:true,extras:{setup:{},featureType:'',sessionInfoVersion:'3'}});}catch(error){done(new Error('Não foi possível abrir a autorização Meta. Tente novamente.'));}
   };
   cancel.onclick=()=>{if(!sending)done(new Error('Autorização cancelada.'));};dialog.addEventListener('cancel',event=>{event.preventDefault();if(sending)return;done(new Error('Autorização cancelada.'));});
   Object.assign(dialog.style,{maxWidth:'460px',width:'calc(100% - 48px)',border:'1px solid #dfe3e8',borderRadius:'14px',padding:'24px',fontFamily:'system-ui,sans-serif'});
   dialog.showModal();proceed.focus();
  });
 }finally{active=false;}
}
window.NexoWhatsAppEmbedded=Object.freeze({connect});
})();
