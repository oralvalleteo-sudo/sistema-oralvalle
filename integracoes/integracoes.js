(()=>{'use strict';
const cloud=window.OralCloud,clinic=document.getElementById('clinic'),status=document.getElementById('connection-status');
const providers=['google_ads','meta_ads','whatsapp_business'];
const setStatus=(message)=>{status.textContent=message};
const setBadge=(provider,state,label)=>{const el=document.querySelector('[data-provider="'+provider+'"]');if(!el)return;el.textContent=label;el.dataset.state=state};
async function refresh(){
 const id=clinic.value;
 providers.forEach(p=>setBadge(p,'','Aguardando conexão'));
 if(!id)return;
 setStatus('Consultando o status das integrações…');
 try{
  const rows=await cloud.request('/rest/v1/nexodent_channel_connections?clinic_id=eq.'+encodeURIComponent(id)+'&select=provider,status,external_account_label,updated_at');
  for(const row of rows||[]){if(!providers.includes(row.provider))continue;
   const labels={connected:'Conectado',pending:'Em configuração',error:'Requer atenção',disconnected:'Não conectado'};
   setBadge(row.provider,row.status,labels[row.status]||'Não conectado');
  }
  setStatus('Status carregado. As conexões reais dependem da ativação do serviço seguro de autorização.');
 }catch(e){
  if(e.code==='42P01'||e.code==='PGRST205'||e.status===404){setStatus('Execute primeiro a migração SQL 202611070001_channel_connections.sql no Supabase.');return}
  setStatus('Não foi possível consultar as integrações: '+e.message);
 }
}
async function init(){
 if(!cloud?.enabled){setStatus('Supabase não configurado.');return}
 try{
  const auth=await cloud.restoreSession();if(!auth){setStatus('Entre no NexoDent para visualizar as integrações da sua clínica.');return}
  const clinics=await cloud.request('/rest/v1/rpc/clinic_list',{method:'POST',body:{}});
  clinic.replaceChildren();
  for(const c of clinics||[]){if(!c.clinic_id)continue;const opt=document.createElement('option');opt.value=c.clinic_id;opt.textContent=c.nome||'Clínica';clinic.append(opt)}
  if(!clinic.options.length){setStatus('Nenhuma clínica autorizada.');return}
  clinic.disabled=false;clinic.addEventListener('change',refresh);await refresh();
 }catch(e){setStatus('Não foi possível validar o acesso: '+e.message)}
}
init();
})();
