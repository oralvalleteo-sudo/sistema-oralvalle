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
  let googleState='disconnected',whatsappState='disconnected';
  for(const row of rows||[]){if(!providers.includes(row.provider))continue;const labels={connected:'Conectado',pending:'Em configuração',error:'Requer atenção',disconnected:'Não conectado'};setBadge(row.provider,row.status,labels[row.status]||'Não conectado');if(row.provider==='whatsapp_business'){whatsappState=row.status;if(row.status==='connected'&&whatsappMsg)whatsappMsg.textContent='Número conectado: '+(row.external_account_label||'WhatsApp Business')+'.';}
  if(row.provider==='google_ads'){googleState=row.status;if(row.status==='connected'&&row.external_account_label)googleInfo('Conta vinculada: '+row.external_account_label+'.');}}
  if(whatsappBtn){whatsappBtn.textContent=whatsappState==='connected'?'WhatsApp conectado':'Conectar WhatsApp';whatsappBtn.disabled=whatsappState==='connected';if(whatsappState!=='connected'&&whatsappMsg)whatsappMsg.textContent=whatsappState==='pending'?'Autorização recebida. Falta vincular o número e validar o webhook; o recebimento de mensagens ainda não está ativo.':'Conecte sua conta empresarial para iniciar a autorização oficial.';}
  if(picker)picker.hidden=googleState!=='pending';
  if(googleState==='pending')googleInfo('Autorização Google concluída. Falta selecionar a conta de anúncios da clínica.');
  setStatus('Status carregado.');
 }catch(e){
  if(e.code==='42P01'||e.code==='PGRST205'||e.status===404){setStatus('Execute primeiro a migração SQL 202611070001_channel_connections.sql no Supabase.');return}
  setStatus('Não foi possível consultar as integrações: '+e.message);
 }
}
async function connectGoogle(){
 if(!clinic.value)return googleInfo('Selecione uma clínica.');
 if(location.protocol!=='https:')return googleInfo('Abra o NexoDent em HTTPS para conectar sua conta.');
 connectBtn.disabled=true;googleInfo('Preparando autorização segura…');
 try{
  const response=await cloud.request('/functions/v1/nexodent-google-ads-start',{method:'POST',body:{clinic_id:clinic.value}});
  if(!response?.authorization_url||!/^https:\/\/accounts\.google\.com\//.test(response.authorization_url))throw new Error('Resposta inválida do serviço de autorização.');
  window.top.location.assign(response.authorization_url);
 }catch(e){googleInfo('Não foi possível iniciar: '+e.message);connectBtn.disabled=false}
}
async function loadAccounts(){
 loadBtn.disabled=true;accountMsg.textContent='Consultando contas acessíveis…';accountSelect.hidden=true;saveBtn.hidden=true;
 try{
  const result=await cloud.request('/functions/v1/nexodent-google-ads-accounts',{method:'POST',body:{clinic_id:clinic.value,action:'list'}});
  const accounts=Array.isArray(result?.accounts)?result.accounts:[];accountSelect.replaceChildren();
  const first=document.createElement('option');first.value='';first.textContent='Selecione uma conta';accountSelect.append(first);
  for(const account of accounts){const option=document.createElement('option');option.value=account.customer_id;option.textContent=account.descriptive_name+' — '+account.customer_id+(account.manager?' (conta de administrador)':'');accountSelect.append(option)}
  if(!accounts.length){accountMsg.textContent='Nenhuma conta foi retornada para este usuário Google. Confirme se ele tem acesso à conta do Google Ads.';return}
  accountSelect.hidden=false;saveBtn.hidden=false;accountMsg.textContent=accounts.length+' conta(s) encontrada(s). Escolha a conta desta clínica.';
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
async function connectMeta(){
 if(!clinic.value){metaMsg.textContent='Selecione uma clínica.';return}
 if(location.protocol!=='https:'){metaMsg.textContent='Abra o NexoDent em HTTPS.';return}
 metaBtn.disabled=true;metaMsg.textContent='Preparando autorização Meta…';
 try{
  const response=await cloud.request('/functions/v1/nexodent-meta-ads-start',{method:'POST',body:{clinic_id:clinic.value}});
  const url=response?.authorization_url;
  if(!url){throw new Error('A função não retornou authorization_url.')}
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||!['www.facebook.com','facebook.com'].includes(parsed.hostname))throw new Error('URL de autorização Meta inválida.');
  window.top.location.assign(parsed.href);
 }catch(e){metaMsg.textContent='Não foi possível conectar: '+(e.status===404?'função nexodent-meta-ads-start não encontrada.':e.message);metaBtn.disabled=false}
}
async function connectWhatsapp(){
 if(!clinic.value)return whatsappMsg.textContent='Selecione uma clínica.';
 if(location.protocol!=='https:')return whatsappMsg.textContent='Abra o NexoDent em HTTPS.';
 const selectedClinic=clinic.value;
 const mode=document.getElementById('whatsapp-mode')?.value||'coexistence';
 whatsappBtn.disabled=true;whatsappMsg.textContent='Verificando a integração oficial…';
 try{
  const response=await cloud.request('/functions/v1/nexodent-whatsapp-connect-start',{method:'POST',body:{clinic_id:selectedClinic,flow:'embedded'}});
  if(clinic.value!==selectedClinic)throw new Error('A clínica mudou. Inicie a conexão novamente.');
  if(!window.NexoWhatsAppEmbedded?.connect)throw new Error('Atualize a página para carregar a conexão WhatsApp.');
  if(mode==='coexistence'&&!window.NexoWhatsAppEmbedded.supportsCoexistence)throw new Error('Atualize a página para carregar a conexão com o WhatsApp do celular.');
  whatsappMsg.textContent='Preparando a janela de autorização da Meta…';
  const result=await window.NexoWhatsAppEmbedded.connect(response,cloud,selectedClinic,()=>clinic.value,mode);
  await refresh();whatsappMsg.textContent=(result.phone_number?'Número '+result.phone_number+' autorizado. ':'')+'Falta validar o webhook para receber mensagens.';
  whatsappBtn.disabled=false;

 }catch(e){whatsappMsg.textContent='Conexão ainda indisponível: '+(e.status===404?'publique a função nexodent-whatsapp-connect-start no Supabase.':e instanceof TypeError||/failed to fetch|networkerror|load failed/i.test(e.message||'')?'O navegador não conseguiu alcançar o serviço WhatsApp. É necessário conferir a publicação da função e a origem HTTPS permitida no Supabase; se estiver sem internet, tente novamente após reconectar.':e.message);whatsappBtn.disabled=false;}
}
async function init(){
 if(!cloud?.enabled){setStatus('Supabase não configurado.');return}
 try{
  const auth=await cloud.restoreSession();if(!auth){setStatus('Entre no NexoDent para visualizar as integrações da sua clínica.');return}
  const clinics=await cloud.request('/rest/v1/rpc/clinic_list',{method:'POST',body:{}});clinic.replaceChildren();
  for(const c of clinics||[]){if(!c.clinic_id)continue;const option=document.createElement('option');option.value=c.clinic_id;option.textContent=c.nome||'Clínica';clinic.append(option)}
  if(!clinic.options.length){setStatus('Nenhuma clínica autorizada.');return}
  clinic.disabled=false;clinic.addEventListener('change',refresh);
  connectBtn.disabled=false;connectBtn.addEventListener('click',connectGoogle);
  if(metaBtn){metaBtn.disabled=false;metaBtn.addEventListener('click',connectMeta);}
  if(whatsappBtn){whatsappBtn.disabled=false;whatsappBtn.addEventListener('click',connectWhatsapp);}
  loadBtn.addEventListener('click',loadAccounts);saveBtn.addEventListener('click',saveAccount);
  const query=new URLSearchParams(location.search);if(query.has('google_ads')){googleInfo(query.get('google_ads')==='authorized'?'Autorização Google recebida. Agora vamos selecionar a conta de anúncios.':'Autorização não concluída. Confira o acesso e tente novamente.');history.replaceState(null,'',location.pathname)}
  await refresh();
  const whatsappResult=new URLSearchParams(location.search).get('whatsapp');
  if(whatsappResult&&whatsappMsg){const messages={authorized:'Autorização Meta recebida. Falta vincular o número e validar o webhook para receber mensagens.',cancelled:'Autorização cancelada. Você pode tentar novamente.',configuration_required:'O administrador precisa concluir a configuração Meta no servidor.',error:'Não foi possível validar a autorização Meta. Tente novamente.'};whatsappMsg.textContent=messages[whatsappResult]||messages.error;history.replaceState(null,'',location.pathname);}
 }catch(e){setStatus('Não foi possível validar o acesso: '+e.message)}
}
init();
})();
