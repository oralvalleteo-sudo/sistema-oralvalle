(()=>{'use strict';
const $=id=>document.getElementById(id),cloud=window.OralCloud,money=c=>(c/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
let catalog=[],busy=false,discount=0;const requests=new Map();
function requestKey(key){let value=requests.get(key);try{value=value||sessionStorage.getItem(key)}catch{}if(!value)value=crypto.randomUUID();requests.set(key,value);try{sessionStorage.setItem(key,value)}catch{}return value;}
function forgetRequest(key){requests.delete(key);try{sessionStorage.removeItem(key)}catch{}}
const featureLabels={agenda:'Agenda',patients:'Pacientes',records:'Prontuários e documentos',budgets:'Orçamentos',finance:'Financeiro',crm:'CRM',team:'Equipe e comissões',integrations:'Integrações'};
const invoiceLabels={PENDING:'Aguardando pagamento',CONFIRMED:'Confirmado',RECEIVED:'Pago',RECEIVED_IN_CASH:'Pago',OVERDUE:'Vencido',REFUNDED:'Estornado',CHARGEBACK_REQUESTED:'Em contestação',CHARGEBACK_DISPUTE:'Em contestação',DELETED:'Cancelado'};const selected=new URLSearchParams(location.search),statuses={trial:'Em teste',active:'Ativa',past_due:'Em atraso',canceled:'Cancelada',expired:'Expirada',exempt:'Isenta'};
const message=t=>{$('message').textContent=t};
const api=(action,extra={})=>cloud.request('/functions/v1/nexodent-billing',{method:'POST',body:{action,clinic_id:$('clinic').value,...extra}});
function price(){const p=catalog.find(p=>p.code===$('plan').value);if(!p)return;const annual=$('cycle').value==='annual';const canSplit=annual&&$('method').value==='CREDIT_CARD';$('installments').options[1].disabled=!canSplit;if(!canSplit)$('installments').value='1';const value=Math.round((annual?p.annual_cents:p.monthly_cents)*(100-discount)/100);$('price').textContent=$('installments').value==='12'?'12 parcelas · total '+money(value)+' (ajuste de centavos pelo provedor)':money(value)+(annual?' por ano':' por mês');$('features').textContent=p.max_users+' usuário(s) ativo(s) · '+Object.keys(p.features).filter(k=>p.features[k]&&k!=='core').map(k=>featureLabels[k]||'Recurso do plano').join(', ');}
function safeLink(url){try{const u=new URL(url);return u.protocol==='https:'&&['asaas.com','www.asaas.com','sandbox.asaas.com'].includes(u.hostname)?u.href:null;}catch{return null}}
async function refresh(){
 message('Consultando assinatura…');
 try{
 const result=await cloud.request('/rest/v1/rpc/nexodent_subscription_portal',{method:'POST',body:{p_clinic:$('clinic').value}}),s=result.subscription||{};
 discount=Number(s.discount_percent||0);catalog=result.plans||[];$('plan').replaceChildren();for(const p of catalog.filter(p=>p.monthly_cents>0)){const option=document.createElement('option');option.value=p.code;option.textContent=p.name;$('plan').append(option)}
 const desired=selected.get('plano')||s.plan_code;if(catalog.some(p=>p.code===desired&&p.monthly_cents>0))$('plan').value=desired;
 $('cycle').value=selected.get('ciclo')||s.billing_cycle||'monthly';price();
 $('summary').textContent=(catalog.find(p=>p.code===s.plan_code)?.name||'Plano anterior')+' · '+(!result.allowed?'Acesso suspenso':statuses[s.status]||'Gerenciado pela plataforma')+((s.status==='trial'?s.trial_ends_at:s.paid_until||s.current_period_ends_at)?' · até '+new Date(s.status==='trial'?s.trial_ends_at:s.paid_until||s.current_period_ends_at).toLocaleDateString('pt-BR'):'');
 $('access').textContent=result.allowed?'Acesso liberado.'+(s.cancel_at_period_end?' Renovação cancelada; período pago preservado.':''):'Acesso aos módulos suspenso. Seus dados foram preservados; regularize o pagamento ou fale com o suporte.';
 $('management').hidden=!result.can_manage;
 if(result.can_manage){
 const state=await api('status');$('gateway-status').textContent=state.configured?(state.mode==='sandbox'?'Ambiente de testes: não é uma contratação real.':'Pagamentos habilitados.'):'Pagamento ainda não configurado pela plataforma.';$('checkout').disabled=!state.configured;
 const history=await cloud.request('/rest/v1/rpc/nexodent_billing_history',{method:'POST',body:{p_clinic:$('clinic').value}});$('invoices').replaceChildren();
 for(const invoice of history.invoices||[]){const row=document.createElement('p');row.textContent=invoice.due_date+' · '+money(invoice.amount_cents)+' · '+(invoiceLabels[invoice.status]||'Em análise')+' ';const link=safeLink(invoice.payment_url);if(link){const a=document.createElement('a');a.href=link;a.textContent='Ver fatura';a.target='_blank';a.rel='noopener';row.append(a)}$('invoices').append(row)}
 if(!history.invoices?.length)$('invoices').textContent='Nenhuma fatura registrada.';
 $('pending').replaceChildren();$('pending').hidden=!history.pending;
 if(history.pending){$('pending').textContent='Contratação em processamento. Consulte antes de tentar novamente. ';const url=safeLink(history.pending.checkout_url);if(url){const a=document.createElement('a');a.href=url;a.textContent='Continuar pagamento';a.target='_blank';a.rel='noopener';$('pending').append(a)}}
 }else $('invoices').textContent='Somente o administrador da clínica pode consultar faturas.';
 message('Situação atualizada. A confirmação de pagamento pode levar alguns instantes.');
 }catch(error){message(error.message)}
}
async function init(){
 const session=await cloud.restoreSession();if(!session){$('login').hidden=false;message('Entre para consultar ou regularizar sua assinatura.');return;}
 const clinics=await cloud.request('/rest/v1/rpc/clinic_list',{method:'POST',body:{}});$('clinic').replaceChildren();for(const c of clinics){const o=document.createElement('option');o.value=c.clinic_id;o.textContent=c.nome;$('clinic').append(o)}
 if(!clinics.length){message('Sua conta ainda não possui uma clínica. Conclua o cadastro no site.');return;}
 if(clinics.some(c=>c.clinic_id===selected.get('clinic_id')))$('clinic').value=selected.get('clinic_id');
 $('login').hidden=true;$('portal').hidden=false;await refresh();
}
$('login-form').onsubmit=async e=>{e.preventDefault();try{await cloud.login($('email').value,$('password').value,false);$('password').value='';await init()}catch(error){message(error.message)}};
$('clinic').onchange=refresh;$('refresh').onclick=refresh;for(const id of ['plan','cycle','method','installments'])$(id).onchange=price;
$('checkout-form').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;$('checkout').disabled=true;
 const fingerprint=[$('clinic').value,$('plan').value,$('cycle').value,$('method').value,$('installments').value].join(':');
 const key='nexodent_checkout:'+fingerprint;const request=requestKey(key);
 try{const result=await api('checkout',{request_key:request,plan:$('plan').value,cycle:$('cycle').value,method:$('method').value,installments:Number($('installments').value),billing_name:$('billing-name').value,cpf_cnpj:$('cpf').value,consent:$('consent').checked});const url=safeLink(result.checkout_url);if(!url)throw Error('Aguardando link de pagamento. Atualize a situação.');location.assign(url);}catch(error){if(['CHECKOUT_FAILED','CHECKOUT_RETRY_ALLOWED'].includes(error.code))forgetRequest(key);await refresh();message(error.message);}finally{busy=false;$('checkout').disabled=false;}
};
for(const action of ['cancel','free'])$(action).onclick=async()=>{if(busy||!confirm(action==='free'?'Mudar para o grátis limita os recursos agora. Continuar?':'Cancelar as próximas cobranças e manter o período já pago?'))return;busy=true;try{await api(action);await refresh()}catch(error){message(error.message)}finally{busy=false}};
init().catch(error=>message(error.message));
})();
