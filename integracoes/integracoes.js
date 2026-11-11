(()=>{'use strict';
const cloud=window.OralCloud,clinic=document.getElementById('clinic'),status=document.getElementById('connection-status');
const providers=['google_ads','meta_ads','whatsapp_business'];
const whatsappBtn=document.getElementById('connect-whatsapp'),whatsappMsg=document.getElementById('whatsapp-connect-message');
const metaBtn=document.getElementById('connect-meta'),metaMsg=document.getElementById('meta-connect-message');
const connectBtn=document.getElementById('connect-google'),googleMsg=document.getElementById('google-connect-message');
const picker=document.getElementById('google-account-picker'),loadBtn=document.getElementById('load-google-accounts');
const accountSelect=document.getElementById('google-account-select'),saveBtn=document.getElementById('save-google-account'),accountMsg=document.getElementById('google-account-message');
const googleInfo=message=>{if(googleMsg)googleMsg.textContent=message};
const setStatus=message=>{status.textContent=message};
const setBadge=(provider,state,label)=>{const el=document.querySelector('[data-provider="'+provider+'"]');if(!el)return;el.textContent=label;el.dataset.state=state};
async function refresh(){
 const id=clinic.value;providers.forEach(p=>setBadge(p,'','Aguardando conexão'));if(!id)return;
 setStatus('Consultando o status das integrações…');
 try{
  const rows=await cloud.request('/rest/v1/nexodent_channel_connections?clinic_id=eq.'+encodeURIComponent(id)+'&select=provider,status,external_account_label,external_account_id,updated_at');
  let googleState='disconnected',whatsappState='disconnected',metaState='disconnected';
  for(const row of rows||[]){if(!providers.includes(row.provider))continue;const labels={connected:'Conectado',pending:'Em configuração',error:'Requer atenção',disconnected:'Não conectado'};setBadge(row.provider,row.status,labels[row.status]||'Não conectado');if(row.provider==='whatsapp_business'){whatsappState=row.status;if(row.status==='connected'&&whatsappMsg)whatsappMsg.textContent='Número conectado: '+(row.external_account_label||'WhatsApp Business')+'.';}
  if(row.provider==='meta_ads'){metaState=row.status;if(row.status==='connected')metaMsg.textContent='Página conectada: '+(row.external_account_label||'Meta')+'. Leads entram automaticamente no CRM.';}
  if(row.provider==='google_ads'){googleState=row.status;if(row.status==='connected'&&row.external_account_label)googleInfo('Conta vinculada: '+row.external_account_label+'.');}}
  if(whatsappBtn){whatsappBtn.textContent=whatsappState==='connected'?'Reconectar WhatsApp':'Conectar WhatsApp';whatsappBtn.disabled=false;if(whatsappState!=='connected'&&whatsappMsg)whatsappMsg.textContent='Conexão oficial disponível após configurar a autorização Meta no servidor.';}
  if(picker)picker.hidden=googleState!=='pending';
  if(googleState==='connected')await refreshDelivery();
  if(googleState==='pending'){googleInfo('Autorização Google concluída. Selecione a conta de anúncios da clínica.');await loadAccounts();}
  if(metaState==='pending')await channelAssets('meta_ads');
  if(whatsappState==='pending')await channelAssets('whatsapp_business');
  setStatus('Status carregado.');
 }catch(e){
  if(e.code==='42P01'||e.code==='PGRST205'||e.status===404){setStatus('Execute primeiro a migração SQL 202611070001_channel_connections.sql no Supabase.');return}
  setStatus('Não foi possível consultar as integrações: '+e.message);
 }
}
async function refreshDelivery(){
 const panel=document.getElementById('google-delivery'),message=document.getElementById('google-delivery-status');panel.hidden=false;
 try{const result=await cloud.request('/functions/v1/nexodent-google-leads-setup',{method:'POST',body:{clinic_id:clinic.value,action:'status'}});
 panel.dataset.configured=String(result.configured);
 message.textContent=result.tested?'Teste recebido. Novos leads dos formulários configurados entrarão no CRM. Recebidos: '+result.lead_count:result.configured?'Aguardando envio de teste pelo Google Ads.':'Ative a captação e configure a entrega no formulário Google Ads.';
 }catch(e){message.textContent='Captação indisponível: '+e.message;}
}
document.getElementById('google-delivery-activate').addEventListener('click',async e=>{
 const values=document.getElementById('google-delivery-values'),message=document.getElementById('google-delivery-status');
 if(document.getElementById('google-delivery').dataset.configured==='true'&&!confirm('Gerar nova chave invalida a anterior. Continuar?'))return;
 e.target.disabled=true;
 try{const result=await cloud.request('/functions/v1/nexodent-google-leads-setup',{method:'POST',body:{clinic_id:clinic.value,action:'activate'}});
 document.getElementById('google-delivery-url').value=result.webhook_url;document.getElementById('google-delivery-key').value=result.google_key;values.hidden=false;document.getElementById('google-delivery').dataset.configured='true';
 message.textContent='Copie estes dados para a entrega de leads do formulário no Google Ads. A chave só é exibida agora. Gerar outra invalida a anterior.';
 }catch(error){message.textContent=error.message;}finally{e.target.disabled=false;}
});
document.getElementById('google-delivery-check').addEventListener('click',refreshDelivery);
async function connectGoogle(){
 if(!clinic.value)return googleInfo('Selecione uma clínica.');
 if(location.protocol!=='https:')return googleInfo('Abra o NexoDent em HTTPS para conectar sua conta.');
 connectBtn.disabled=true;googleInfo('Preparando autorização segura…');
 try{
  const response=await cloud.request('/functions/v1/nexodent-google-ads-start',{method:'POST',body:{clinic_id:clinic.value}});
  if(!response?.authorization_url||!/^https:\/\/accounts\.google\.com\//.test(response.authorization_url))throw new Error('Resposta inválida do serviço de autorização.');
  sessionStorage.setItem('nexodent_google_clinic',clinic.value);
  window.top.location.assign(response.authorization_url);
 }catch(e){googleInfo('Não foi possível iniciar: '+e.message);connectBtn.disabled=false}
}
async function loadAccounts(){
 loadBtn.disabled=true;accountMsg.textContent='Consultando contas acessíveis…';accountSelect.hidden=true;saveBtn.hidden=true;
 try{
  const result=await cloud.request('/functions/v1/nexodent-google-ads-accounts',{method:'POST',body:{clinic_id:clinic.value,action:'list'}});
  const accounts=(Array.isArray(result?.accounts)?result.accounts:[]).filter(a=>!a.manager);accountSelect.replaceChildren();
  const first=document.createElement('option');first.value='';first.textContent='Selecione uma conta';accountSelect.append(first);
  for(const account of accounts){const option=document.createElement('option');option.value=account.customer_id;option.textContent=account.descriptive_name+' — '+account.customer_id+(account.manager?' (conta de administrador)':'');accountSelect.append(option)}
  if(!accounts.length){accountMsg.textContent='Nenhuma conta foi retornada para este usuário Google. Confirme se ele tem acesso à conta do Google Ads.';return}
  accountSelect.hidden=false;saveBtn.hidden=false;
  if(accounts.length===1){accountSelect.value=accounts[0].customer_id;await saveAccount();return;}accountMsg.textContent=accounts.length+' conta(s) encontrada(s). Escolha a conta desta clínica.';
 }catch(e){accountMsg.textContent='Não foi possível listar as contas: '+e.message}
 finally{loadBtn.disabled=false}
}
async function saveAccount(){
 if(!accountSelect.value){accountMsg.textContent='Selecione uma conta antes de continuar.';return}
 saveBtn.disabled=true;accountMsg.textContent='Validando e vinculando a conta…';
 try{
  const result=await cloud.request('/functions/v1/nexodent-google-ads-accounts',{method:'POST',body:{clinic_id:clinic.value,action:'select',customer_id:accountSelect.value}});
  googleInfo('Conta vinculada: '+(result?.account?.descriptive_name||accountSelect.value)+'.');accountMsg.textContent='Conta vinculada com sucesso.';picker.hidden=true;await refresh();
 }catch(e){accountMsg.textContent='Não foi possível vincular a conta: '+e.message}
 finally{saveBtn.disabled=false}
}
async function connectChannel(provider){
 const button=provider==='meta_ads'?metaBtn:whatsappBtn,message=provider==='meta_ads'?metaMsg:whatsappMsg;
 if(!clinic.value){message.textContent='Selecione uma clínica.';return;}
 if(location.protocol!=='https:'){message.textContent='Abra o NexoDent em HTTPS.';return;}
 button.disabled=true;message.textContent='Preparando autorização segura…';
 try{
 const result=await cloud.request('/functions/v1/nexodent-meta-connect-start',{method:'POST',body:{clinic_id:clinic.value,provider}});
 const url=new URL(result.authorization_url);if(url.protocol!=='https:'||url.hostname!=='www.facebook.com')throw Error('Autorização inválida');
 sessionStorage.setItem('nexodent_google_clinic',clinic.value);window.top.location.assign(url.href);
 }catch(error){message.textContent=error.message;button.disabled=false;}
}
async function channelAssets(provider){
 const container=document.getElementById(provider+'-picker');container.hidden=false;container.replaceChildren();
 const message=document.createElement('p');message.textContent='Buscando ativos autorizados…';container.append(message);
 try{
 const result=await cloud.request('/functions/v1/nexodent-meta-connect-assets',{method:'POST',body:{clinic_id:clinic.value,provider,action:'list'}}),assets=result.assets||[];
 if(!assets.length){message.textContent=provider==='meta_ads'?'Nenhuma página autorizada. Confira o acesso à página e aos formulários.':'Nenhum número da API oficial encontrado. A conta WhatsApp Business deve estar habilitada na plataforma Meta; o aplicativo de celular sozinho não fornece essa integração.';return;}
 const choose=async(id)=>{
 message.textContent='Ativando recebimento automático…';
 try{await cloud.request('/functions/v1/nexodent-meta-connect-assets',{method:'POST',body:{clinic_id:clinic.value,provider,action:'select',external_id:id}});container.hidden=true;setBadge(provider,'connected','Conectado');(provider==='meta_ads'?metaMsg:whatsappMsg).textContent='Conectado: '+(assets.find(a=>a.id===id)?.label||'Ativo autorizado')+'. Envie um contato de teste para confirmar a captação.';}
 catch(error){message.textContent=error.message;}
 };
 if(assets.length===1){await choose(assets[0].id);return;}
 message.textContent=provider==='meta_ads'?'Escolha a página desta clínica.':'Escolha o número desta clínica.';
 const select=document.createElement('select');select.setAttribute('aria-label',provider==='meta_ads'?'Página Meta':'Número WhatsApp');
 for(const asset of assets){const option=document.createElement('option');option.value=asset.id;option.textContent=asset.label;select.append(option);}
 const button=document.createElement('button');button.type='button';button.className='cta';button.textContent='Ativar captação';button.onclick=async()=>{button.disabled=true;try{await choose(select.value)}finally{button.disabled=false}};container.append(select,button);
 }catch(error){message.textContent='Não foi possível listar: '+error.message;}
}
async function connectMeta(){return connectChannel('meta_ads')}
async function connectWhatsapp(){return connectChannel('whatsapp_business')}
async function init(){
 if(!cloud?.enabled){setStatus('Supabase não configurado.');return}
 try{
  const auth=await cloud.restoreSession();if(!auth){setStatus('Entre no NexoDent para visualizar as integrações da sua clínica.');return}
  const clinics=await cloud.request('/rest/v1/rpc/clinic_list',{method:'POST',body:{}});clinic.replaceChildren();
  for(const c of clinics||[]){if(!c.clinic_id)continue;const option=document.createElement('option');option.value=c.clinic_id;option.textContent=c.nome||'Clínica';clinic.append(option)}
  if(!clinic.options.length){setStatus('Nenhuma clínica autorizada.');return}
  const remembered=sessionStorage.getItem('nexodent_google_clinic');if(remembered&&Array.from(clinic.options).some(o=>o.value===remembered))clinic.value=remembered;
  clinic.disabled=false;clinic.addEventListener('change',()=>{document.getElementById('meta_ads-picker').hidden=true;document.getElementById('whatsapp_business-picker').hidden=true;document.getElementById('google-delivery').hidden=true;document.getElementById('google-delivery-values').hidden=true;document.getElementById('google-delivery-key').value='';refresh()});
  connectBtn.disabled=false;connectBtn.addEventListener('click',connectGoogle);
  if(metaBtn){metaBtn.disabled=false;metaBtn.addEventListener('click',connectMeta);}
  if(whatsappBtn){whatsappBtn.disabled=false;whatsappBtn.addEventListener('click',connectWhatsapp);}
  loadBtn.addEventListener('click',loadAccounts);saveBtn.addEventListener('click',saveAccount);
  const query=new URLSearchParams(location.search);if(query.has('google_ads')){googleInfo(query.get('google_ads')==='authorized'?'Autorização Google recebida. Agora vamos selecionar a conta de anúncios.':'Autorização não concluída. Confira o acesso e tente novamente.');history.replaceState(null,'',location.pathname)}
  await refresh();
  if(query.get('meta_connection')==='error'){metaMsg.textContent='Autorização Meta não concluída. Conecte novamente e confirme as permissões.';whatsappMsg.textContent='Autorização não concluída. Confira se sua conta possui um número da API oficial.';history.replaceState(null,'',location.pathname);}
  else if(query.has('meta_connection'))history.replaceState(null,'',location.pathname);
 }catch(e){setStatus('Não foi possível validar o acesso: '+e.message)}
}
init();
})();
