(()=>{'use strict';
let sdkPromise=null,active=false;
function loadSdk(){
 if(window.FB?.init&&window.FB?.login)return Promise.resolve(window.FB);
 if(sdkPromise)return sdkPromise;
 sdkPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://connect.facebook.net/pt_BR/sdk.js';script.async=true;script.crossOrigin='anonymous';
  const timeout=setTimeout(()=>fail(),15000);
  function fail(){clearTimeout(timeout);script.remove();sdkPromise=null;reject(new Error('Não foi possível abrir o serviço Meta. Confira a conexão e bloqueadores do navegador.'));}
  script.onerror=fail;script.onload=()=>{clearTimeout(timeout);if(window.FB?.init&&window.FB?.login)resolve(window.FB);else fail();};
  document.head.append(script);
 });return sdkPromise;
}
async function connect(config,cloud,clinic,currentClinic){
 if(active)throw new Error('Já existe uma autorização em andamento.');
 if(config?.flow!=='embedded'||!/^\d+$/.test(config.app_id||'')||!/^\d+$/.test(config.config_id||'')||!/^v\d+\.\d+$/.test(config.version||'')||! /^[A-Za-z0-9_-]{43}$/.test(config.state||''))throw new Error('Atualize as funções WhatsApp no Supabase para o cadastro incorporado.');
 active=true;
 try{
  const FB=await loadSdk(),user=cloud.session?.user?.id;
  FB.init({appId:config.app_id,version:config.version,cookie:false,xfbml:false,autoLogAppEvents:false});
  return await new Promise((resolve,reject)=>{
   let code='',ids=null,finished=false,sending=false,waitingTimer=null;
   const dialog=document.createElement('dialog'),title=document.createElement('h2'),text=document.createElement('p'),proceed=document.createElement('button'),cancel=document.createElement('button');
   title.textContent='Conectar WhatsApp';text.textContent='Continue na Meta para escolher a empresa e o número que deseja autorizar nesta clínica.';
   proceed.textContent='Continuar na Meta';cancel.textContent='Cancelar';proceed.type=cancel.type='button';proceed.className=cancel.className='cta';
   dialog.append(title,text,proceed,cancel);document.body.append(dialog);
   const expires=setTimeout(()=>done(new Error('A autorização expirou. Inicie novamente.')),Math.min(Number(config.expires_in)||600,600)*1000);
   function done(error,result){if(finished)return;finished=true;clearTimeout(expires);clearTimeout(waitingTimer);window.removeEventListener('message',message);dialog.remove();if(error)reject(error);else resolve(result);}
   async function finish(){
    if(finished||sending||!code||!ids)return;
    if(currentClinic()!==clinic||cloud.session?.user?.id!==user)return done(new Error('A clínica ou a conta mudou. Inicie novamente.'));
    sending=true;clearTimeout(expires);clearTimeout(waitingTimer);cancel.disabled=true;text.textContent='Validando a autorização e o número no servidor…';
    try{const result=await cloud.request('/functions/v1/nexodent-whatsapp-connect-callback',{method:'POST',body:{clinic_id:clinic,state:config.state,code,...ids}});if(currentClinic()!==clinic||cloud.session?.user?.id!==user)throw new Error('A clínica ou a conta mudou durante a validação.');if(result?.status!=='pending')throw new Error('O servidor não confirmou o vínculo.');done(null,result);}catch(error){done(error);}
   }
   function message(event){
    if(!['https://www.facebook.com','https://web.facebook.com'].includes(event.origin)||finished)return;
    let data=event.data;try{if(typeof data==='string'){if(data.length>20000)return;data=JSON.parse(data);}}catch{return;}
    if(data?.type!=='WA_EMBEDDED_SIGNUP')return;
    if(data.event==='CANCEL'||data.event==='ERROR')return done(new Error('Cadastro WhatsApp não concluído. Você pode tentar novamente.'));
    if(data.event!=='FINISH')return;
    const waba=data.data?.waba_id,phone=data.data?.phone_number_id;
    if(!/^\d{1,40}$/.test(waba||'')||!/^\d{1,40}$/.test(phone||''))return done(new Error('Conclua a seleção do número no cadastro da Meta.'));
    ids={waba_id:String(waba),phone_number_id:String(phone)};finish();
   }
   window.addEventListener('message',message);
   proceed.onclick=()=>{
    if(currentClinic()!==clinic||cloud.session?.user?.id!==user)return done(new Error('A clínica ou a conta mudou. Inicie novamente.'));
    proceed.disabled=true;text.textContent='Conclua a autorização na janela da Meta.';
    try{FB.login(response=>{
     if(finished)return;
     if(typeof response?.authResponse?.code!=='string'||!response.authResponse.code)return done(new Error('Autorização cancelada ou bloqueada. Permita a janela da Meta e tente novamente.'));
     code=response.authResponse.code;
     if(!ids)waitingTimer=setTimeout(()=>done(new Error('A Meta não informou o número selecionado. Conclua o cadastro e tente novamente.')),30000);
     finish();
    },{config_id:config.config_id,response_type:'code',override_default_response_type:true,extras:{setup:{},featureType:'',sessionInfoVersion:'3'}});}catch(error){done(new Error('Não foi possível abrir a autorização Meta. Tente novamente.'));}
   };
   cancel.onclick=()=>{if(!sending)done(new Error('Autorização cancelada.'));};dialog.addEventListener('cancel',event=>{event.preventDefault();if(sending)return;done(new Error('Autorização cancelada.'));});
   dialog.showModal();proceed.focus();
  });
 }finally{active=false;}
}
window.NexoWhatsAppEmbedded=Object.freeze({connect});
})();
