/* NexoDent — controle de trabalhos protéticos / laboratório. */
(function(){
'use strict';
const STAGES=['Planejamento','Moldagem / escaneamento','Enviado ao laboratório','Em produção','Prova','Ajustes','Finalização','Recebido na clínica','Entregue ao paciente'];
const STATES=['Pendente','Em andamento','Aguardando laboratório','Em prova','Em observação','Recebido','Entregue','Cancelado'];
const execution=window.NexoLabExecution;
const $id=id=>document.getElementById(id);
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=(arr,selected)=>arr.map(v=>`<option value="${safe(v)}" ${v===selected?'selected':''}>${safe(v)}</option>`).join('');
const date=s=>s?String(s).slice(0,10):'';
const stamp=()=>new Date().toISOString();
let orders=[],loading=false,error='',loadedClinic=null,filter='ativos',search='',editing=null,busy=false,loadAttemptedClinic=null,labSection='work',executionFilter='all',careDraft=null;
let fetchTask=null,fetchTaskClinic=null,orderEpoch=0;
const cloud=()=>!!window.OralCloud?.enabled;
const clinic=()=>window.OralCloud?.clinicId||null;
const key=()=>`nexodent:lab:v1:${clinic()||'local'}:${ME?.id||'local'}`;
const isLab=()=>view.h==='lab'&&!view.id;
function localRead(){try{return JSON.parse(localStorage.getItem(key())||'[]')}catch(_){return []}}
function localWrite(){localStorage.setItem(key(),JSON.stringify(orders));}
// Espelho de consulta para os demais módulos; nenhuma baixa ou lançamento é criado.
function publishOrders(){
 window.NexoLabRead={clinicId:clinic()||'local',loaded:!!loadedClinic,orders:orders.map(o=>({id:o.id,patient_id:o.patient_id,treatment_id:linkFor(o.id).treatment_id||'',laboratory_cost:linkFor(o.id).cost||0,status:o.status,stage:o.stage,laboratory:o.laboratory,execution_location:execution.get(o),work_description:o.work_description,due_at:o.due_at,received_at:o.received_at}))};
 window.dispatchEvent(new CustomEvent('nexodent:lab-orders-updated'));
}
// Consulta sob demanda por outros módulos: carrega apenas os dados da clínica ativa.
// Não cria despesas, pagamentos ou comissões.

// NexoDent 179 — fila automática de orçamento aprovado.
// Não cria lançamentos financeiros, não altera tratamentos e não substitui trabalhos manuais.
const AUTO_LAB_PATTERN=/(\bcoroa\b|\bplaca\s+(?:de\s+)?bruxismo\b|\bplaca\s+miorrelaxante\b|\bplaca\s+miorelaxante\b|\bcer[oô]mero\b|\bprotocolo\b|\bpr[oó]tese\b|\bprotese\b|\bppr\b|\bpt\b|\bfaceta\b|\blente\s+de\s+contato\b|\binlay\b|\bonlay\b)/i;
window.NexoLabSyncApprovedBudget=async function(patient,budget){
 if(!patient||!budget||budget.status!=='Aprovado')return {created:0};
 if(!cloud()||!clinic())throw Error('É necessário estar conectado à clínica no Supabase para sincronizar o Laboratório.');
 if(!canEdit())throw Error('Sem permissão para criar trabalhos laboratoriais.');
 const entries=(Array.isArray(budget.itens)?budget.itens:[]).filter(it=>AUTO_LAB_PATTERN.test(String(it.proc||'')));
 let created=0;
 for(const it of entries){
  if(!it.id||!budget.id)continue;
  const sourceKey=['orcamento',String(budget.id),String(it.id)].join(':');
  const body={id:crypto.randomUUID(),created_at:stamp(),updated_at:stamp(),clinic_id:clinic(),patient_id:String(patient.id),laboratory:'A definir',
   work_description:String(it.proc||'Trabalho laboratorial').slice(0,240),shade:'',teeth:String(it.dente||''),
   stage:'Planejamento',status:'Pendente',observation_reason:'',instructions:'Gerado automaticamente após aprovação da proposta.',
   history:[{at:stamp(),text:'Trabalho criado automaticamente a partir de orçamento aprovado.'}],comments:[],
   treatment_id:it.tid?String(it.tid):null,laboratory_cost:0,auto_source_key:sourceKey};
  // Índice único garante idempotência inclusive entre dispositivos.
  // ignore-duplicates evita sobrescrever etapas já preenchidas pela equipe.
  try{await OralCloud.request('/rest/v1/nexodent_lab_orders',{method:'POST',body});created++;}
  catch(err){if(!/23505|duplicate key|unique constraint/i.test(String(err?.message||err)))throw err;}
 }
 if(created)await fetchOrders(true);
 return {created};
};

window.NexoLabLoad = async function(force=false){
 if(!allowed())throw new Error('Sem permissão para consultar laboratório.');
 await fetchOrders(!!force);
 if(error)throw new Error(error);
 return window.NexoLabRead;
};
function allowed(){return typeof pmSee!=='function'||pmSee('lab')&&pmSee('pac');}
function canEdit(){return typeof pmLvl!=='function'||pmLvl('lab')>=2&&pmLvl('pac')>=2;}
function renderLab(){if(isLab()&&typeof render==='function')render();}
function fetchOrders(force=false){
 const context=clinic()||'local';
 if(fetchTask&&fetchTaskClinic===context)return fetchTask;
 const sequence=++orderEpoch;fetchTaskClinic=context;
 const task=fetchOrdersImpl(force,sequence);fetchTask=task;
 task.finally(()=>{if(fetchTask===task)fetchTask=null;}).catch(()=>{});
 return task;
}
async function fetchOrdersImpl(force=false,sequence){
 if(!allowed())return;
 const id=clinic();
 if(cloud()&&!id){orders=[];loadedClinic=null;error='Selecione uma clínica para consultar os trabalhos.';renderLab();return;}
 if(!force&&(loadedClinic===(id||'local')||loadAttemptedClinic===(id||'local')))return;
 loadAttemptedClinic=id||'local';
 loading=true;error='';renderLab();
 try{
  if(cloud()){
   const data=[];
   for(let offset=0;offset<20000;offset+=500){
    const page=await OralCloud.request('/rest/v1/nexodent_lab_orders?select=*&clinic_id=eq.'+encodeURIComponent(id)+'&order=id.asc&limit=500&offset='+offset);
    if(sequence!==orderEpoch||clinic()!==id)return;
    if(!Array.isArray(page))throw Error('Resposta de trabalhos inválida.');
    data.push(...page);
    if(page.length<500)break;
    if(offset===19500)throw Error('Limite de segurança atingido. Consulta incompleta; totais bloqueados.');
   }
   orders=data.sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||''))||String(a.id).localeCompare(String(b.id)));
  }else orders=localRead();
  loadedClinic=id||'local';publishOrders();
 }catch(e){if(sequence!==orderEpoch)return;orders=[];loadedClinic=null;error='Não foi possível carregar os trabalhos: '+(e.message||'erro de conexão');}
 finally{if(sequence===orderEpoch){loading=false;renderLab();}}
}
function input(label,id,value='',type='text',extra=''){
 return `<label class="nxlab-field"><span>${label}</span><input id="${id}" type="${type}" value="${safe(value)}" ${extra}></label>`;
}
function select(label,id,values,value){return `<label class="nxlab-field"><span>${label}</span><select id="${id}">${options(values,value)}</select></label>`;}
function textarea(label,id,value=''){return `<label class="nxlab-field nxlab-wide"><span>${label}</span><textarea id="${id}" rows="3">${safe(value)}</textarea></label>`;}
function patientName(id){return db.p?.find(p=>String(p.id)===String(id))?.nome||'Paciente não encontrado';}
// Integração de consulta: utiliza tratamentos já cadastrados, sem modificar registros financeiros.
function patientTreatments(pid){
 const patient=(db.p||[]).find(p=>String(p.id)===String(pid));
 return Array.isArray(patient?.trat)?patient.trat:[];
}
// Vínculos auxiliares por instalação: não alteram o esquema Supabase nem os lançamentos.
const linkKey=()=>`nexodent:lab-links:v1:${clinic()||'local'}`;
function linksRead(){try{return JSON.parse(localStorage.getItem(linkKey())||'{}')}catch(_){return {}}}
function linkFor(id){const order=orders.find(o=>String(o.id)===String(id));if(order&&(order.treatment_id!=null||order.laboratory_cost!=null))return {treatment_id:String(order.treatment_id||''),cost:Number(order.laboratory_cost)||0};return linksRead()[String(id)]||{}}
function saveLink(id,tid,cost){const all=linksRead();all[String(id)]={treatment_id:String(tid||''),cost:Number(cost)||0};localStorage.setItem(linkKey(),JSON.stringify(all));}
function missingTreatment(o){
 const tid=String(linkFor(o.id).treatment_id||'');
 const p=(db.p||[]).find(p=>String(p.id)===String(o.patient_id));
 // Só sinaliza órfão quando a lista de tratamentos está efetivamente carregada.
 return !!(tid&&Array.isArray(p?.trat)&&!p.trat.some(t=>String(t.id)===tid));
}
function linkedTreatment(o){const link=linkFor(o.id);return patientTreatments(o.patient_id).find(t=>String(t.id)===link.treatment_id);}
function treatmentLabel(t){return [t.proc||t.nome||t.procedimento||t.descricao||t.tipo||'Procedimento',t.dente?'Dente '+t.dente:'',money(t.valor)].filter(Boolean).join(' · ');}
function money(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function isoToday(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function validateOrder(f,original){
 // Datas de envio, previsão e recebimento são opcionais: nunca bloqueiam o salvamento.
 const duplicate=orders.some(o=>o.id!==original?.id&&String(o.patient_id)===String(f.patient_id)&&String(o.laboratory||'').trim().toLowerCase()===f.laboratory.toLowerCase()&&String(o.work_description||'').trim().toLowerCase()===f.work_description.toLowerCase()&&!['Cancelado','Entregue'].includes(o.status));
 if(duplicate&&!confirm('Já existe um trabalho em aberto com o mesmo paciente, laboratório e descrição. Deseja cadastrar mesmo assim?'))return 'cancel';
 return '';
}

function treatmentSummary(pid){
 const list=patientTreatments(pid);
 if(!list.length)return '<span>Nenhum tratamento cadastrado para este paciente.</span>';
 const completed=list.filter(t=>t.vid||['concluído','concluido','realizado'].includes(String(t.status||'').toLowerCase()));
 const cost=list.reduce((sum,t)=>sum+(Number(t.custo)||0),0);
 return `<span><b>Tratamentos:</b> ${list.length} (${completed.length} concluídos)</span><span><b>Custos cadastrados:</b> ${safe(money(cost))}</span>`;
}
function form(o={}){
 const patients=(db.p||[]).filter(p=>!p.arq),where=execution.get(o)||(!o.id?'laboratory':''),internal=where==='clinic';
 return `<section class="${o.id?'':'card '}nxlab-form" tabindex="-1" style="scroll-margin-top:120px;${o.id?'padding:16px 20px':''}"><h3>${o.id?'Editar trabalho':'Novo trabalho'}</h3>
 <div class="nxlab-grid"><label class="nxlab-field"><span>Paciente *</span><select id="nxlab-patient" aria-label="Selecionar paciente">${labPatientOptions(patients,o.patient_id)}</select><small id="nxlab-patient-count">${o.patient_id?'Paciente selecionado':patients.length+' pacientes disponíveis. Escolha um nome na lista.'}</small></label>

 <label class="nxlab-field"><span>Local de execução *</span><select id="nxlab-execution"><option value=""${!where?' selected':''}>Selecione o local</option><option value="laboratory"${where==='laboratory'?' selected':''}>Laboratório externo</option><option value="clinic"${internal?' selected':''}>Na clínica</option></select><small>A escolha do local não registra nem quita pagamentos.</small></label>
 ${input('Valor a pagar ao laboratório (se houver)','nxlab-cost',linkFor(o.id).cost||0,'number','min="0" step="0.01"')}
 <label class="nxlab-field"><span id="nxlab-responsible-label">${internal?'Responsável pelo trabalho (opcional)':'Laboratório responsável (opcional)'}</span><input id="nxlab-lab" type="text" maxlength="160" value="${safe(o.laboratory==='A definir'?'':o.laboratory||'')}"><small>Para execução interna sem laboratório externo, deixe o valor a pagar em zero.</small></label>
 ${input('Trabalho a realizar *','nxlab-work',o.work_description,'text','maxlength="240" required')}
 ${input('Cor / escala (ex.: A2)','nxlab-shade',o.shade,'text','maxlength="80"')}
 ${input('Dente(s) / região','nxlab-teeth',o.teeth,'text','maxlength="80"')}
 <div id="nxlab-sent-field"${internal?' hidden':''}>${input('Data de envio','nxlab-sent',date(o.sent_at),'date')}</div>
 ${input('Previsão de entrega','nxlab-due',date(o.due_at),'date')}
 <div id="nxlab-received-field"${internal?' hidden':''}>${input('Data de recebimento','nxlab-received',date(o.received_at),'date')}</div>
 ${select('Etapa atual','nxlab-stage',execution.stages(STAGES,where),o.stage||STAGES[0])}
 ${textarea('Motivo da observação (obrigatório se Em observação)','nxlab-observation',o.observation_reason)}
 ${textarea('Instruções para o trabalho','nxlab-instructions',o.instructions)}
 </div><div class="nxlab-actions"><button type="button" data-lab="save">${o.id?'Salvar alterações':'Cadastrar trabalho'}</button><button class="ghost" type="button" data-lab="cancel">Cancelar</button></div></section>`;
}
function card(o){
 const events=Array.isArray(o.history)?o.history:[];
 const comments=Array.isArray(o.comments)?o.comments:[];
 const obs=o.status==='Em observação';
 const expanded=String(view.labExpanded||'')===String(o.id)||String(editing)===String(o.id);
 return `<article class="card nxlab-card ${expanded?'nxlab-expanded':'nxlab-collapsed'}"><button type="button" class="nxlab-summary" data-lab="toggle" data-id="${safe(o.id)}" aria-expanded="${expanded}" aria-label="${expanded?'Recolher':'Mostrar'} detalhes de ${safe(patientName(o.patient_id))}"><span class="nxlab-summary-name"><strong>${safe(patientName(o.patient_id))}</strong><span class="nxlab-sub">${safe(o.work_description)} · ${safe(o.teeth||'Sem região')} · ${safe(execution.label(execution.get(o)))}</span></span><span class="nxlab-summary-stage nxlab-pill">${safe(o.stage||'—')}</span><span class="nxlab-summary-right"><span class="nxlab-chevron" aria-hidden="true">›</span></span></button>${expanded?(String(editing)===String(o.id)?form(o):`
 <div class="nxlab-details"><span><b>Local de execução:</b> ${safe(execution.label(execution.get(o)))}</span><span><b>Responsável:</b> ${safe(o.laboratory)}</span><span><b>Cor:</b> ${safe(o.shade||'—')}</span><span><b>Etapa:</b> ${safe(o.stage)}</span><span><b>Envio:</b> ${safe(date(o.sent_at)||'—')}</span><span><b>Entrega prevista:</b> ${safe(date(o.due_at)||'—')}</span><span><b>Recebido:</b> ${safe(date(o.received_at)||'—')}</span>${treatmentSummary(o.patient_id)}<span><b>Custo laboratório:</b> ${safe(money(linkFor(o.id).cost))}</span></div>
 ${missingTreatment(o)?'<p class="nxlab-note"><b>Atenção:</b> o procedimento vinculado foi excluído do prontuário. Este trabalho não aparece na lista Em aberto; use Excluir para removê-lo definitivamente.</p>':''}
 ${obs?`<p class="nxlab-note"><b>Em observação:</b> ${safe(o.observation_reason||'Motivo não informado')}</p>`:''}
 ${o.instructions?`<p><b>Instruções:</b> ${safe(o.instructions)}</p>`:''}
 ${window.NexoOrthoPhotos&&db.p?.find(p=>String(p.id)===String(o.patient_id))?NexoOrthoPhotos.gallery(db.p.find(p=>String(p.id)===String(o.patient_id)),'lab:'+o.id):''}
 <div class="nxlab-actions"><button class="ghost sm" data-lab="details" data-id="${safe(o.id)}">Histórico e comentários (${events.length+comments.length})</button>${canEdit()?`<button class="ghost sm" data-lab="edit" data-id="${safe(o.id)}">Editar</button><button class="sm" data-lab="advance" data-id="${safe(o.id)}">Avançar etapa →</button><button class="danger sm" data-lab="delete" data-id="${safe(o.id)}">Excluir trabalho</button>`:''}</div>
 ${view.labDetails===o.id?`<div class="nxlab-timeline">${events.slice().reverse().map(h=>`<div><small>${safe(new Date(h.at).toLocaleString('pt-BR'))}</small> · ${safe(h.text)}</div>`).join('')}${comments.map(c=>`<div><small>${safe(new Date(c.at).toLocaleString('pt-BR'))}</small> · 💬 ${safe(c.text)}</div>`).join('')||'<p>Sem comentários.</p>'}${canEdit()?`<label class="nxlab-field"><span>Novo comentário</span><textarea id="nxlab-comment-${safe(o.id)}" maxlength="2000" rows="2" placeholder="Registre orientações, ajustes, ocorrências..."></textarea></label><button class="sm" data-lab="comment" data-id="${safe(o.id)}">Adicionar comentário</button>`:''}</div>`:''}
 `):''}
 </article>`;
}
function style(){return `<style>
 .nxlab-card.nxlab-collapsed{padding:0 !important;overflow:hidden;margin:8px 0;box-shadow:none}.nxlab-card.nxlab-expanded{padding:0 0 18px !important;overflow:hidden}.nxlab-summary{display:flex;align-items:center;gap:20px;width:100%;padding:15px 20px !important;min-height:66px !important;background:transparent !important;color:inherit !important;border:0 !important;text-align:left;cursor:pointer;font:inherit}.nxlab-summary-name{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px}.nxlab-summary-name strong{font-size:14px}.nxlab-summary .nxlab-sub{margin:0;font-size:12px}.nxlab-summary-stage{flex:0 1 auto;font-size:12px;max-width:220px;margin-left:auto;white-space:normal;overflow-wrap:anywhere;text-align:center;border:1px solid #ffd4b2;background:#fff3e8;color:#a65308;border-radius:999px;padding:6px 12px;font-weight:700;line-height:1.25}.nxlab-summary-right{display:flex;align-items:center;gap:18px;margin-left:auto}.nxlab-chevron{font-size:26px;line-height:1;color:#ea7000;transition:transform .2s}.nxlab-expanded .nxlab-chevron{transform:rotate(90deg)}.nxlab-expanded>.nxlab-details,.nxlab-expanded>.nxlab-note,.nxlab-expanded>.nxlab-actions,.nxlab-expanded>.nxlab-timeline,.nxlab-expanded>p{margin-left:20px;margin-right:20px}.nxlab-expanded>.nxlab-actions{margin-top:14px}.nxlab-summary:focus-visible{outline:2px solid #ea7000;outline-offset:-3px}@media(max-width:650px){.nxlab-summary{padding:13px !important;gap:8px;flex-wrap:wrap}.nxlab-summary-stage{flex-basis:auto;order:0;margin-left:auto;max-width:min(100%,220px)}.nxlab-summary-right{gap:8px}.nxlab-expanded>.nxlab-details,.nxlab-expanded>.nxlab-note,.nxlab-expanded>.nxlab-actions,.nxlab-expanded>.nxlab-timeline,.nxlab-expanded>p{margin-left:13px;margin-right:13px}}
 .nxlab-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:0 0 16px}.nxlab-metrics>div{padding:14px;border:1px solid #d9dfe6 !important;background:#ffffff !important;border-radius:12px;display:flex;flex-direction:column;gap:4px}.nxlab-metrics strong{font-size:25px;color:#222222 !important}.nxlab-metrics span{font-size:12px;color:#555555 !important}.nxlab-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px}.nxlab-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.nxlab-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px}.nxlab-field{display:flex;flex-direction:column;gap:5px;font-size:13px;font-weight:600}.nxlab-field input,.nxlab-field select,.nxlab-field textarea{width:100%;padding:10px;border:1px solid #d7d7d7;border-radius:9px;background:#fff;color:#222;font:inherit}.nxlab-wide{grid-column:1/-1}.nxlab-card{margin:12px 0}.nxlab-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.nxlab-sub{color:#666;margin-top:5px}.nxlab-pill{display:inline-flex;align-items:center;justify-content:center;text-align:center;line-height:1.3;min-height:30px;max-width:190px;white-space:normal;flex-shrink:0;padding:6px 12px;border-radius:99px;background:#fff0df;color:#9a4d00;font-size:12px;font-weight:700}.nxlab-alert{background:#ffe1e1;color:#a70000}.nxlab-details{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:9px;margin-top:14px;font-size:13px}.nxlab-note{background:#fff3e2;border-left:3px solid #f80;padding:10px}.nxlab-timeline{border-top:1px solid #ddd;margin-top:14px;padding-top:12px}.nxlab-timeline>div{padding:7px 0;border-bottom:1px solid #eee}.nxlab-form{margin-bottom:20px}.nxlab-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.nxlab-filters input,.nxlab-filters select{padding:10px;border:1px solid #ddd;border-radius:8px;min-width:180px}.nxlab-empty{padding:20px;color:#555}.nxlab-error{background:#fff0f0;padding:12px;border-radius:8px;color:#a00000}

 /* NexoDent 105: escala visual exclusiva da pagina Laboratorio. */
 .nxlab-top{margin-bottom:24px;gap:18px}
 .nxlab-top h2{font-size:clamp(24px,2.2vw,30px);font-weight:800;line-height:1.2;letter-spacing:-.025em;margin:0 0 8px;color:#172338}
 .nxlab-top p{font-size:14px;line-height:1.55;color:#64748b;margin:0}
 .nxlab-actions{margin-top:0;gap:10px;align-items:center}
 .nxlab-actions button{font-size:13px;min-height:40px;padding:10px 15px;border-radius:10px;font-weight:700}
 .nxlab-metrics{gap:12px;margin-bottom:22px}
 .nxlab-metrics>div{padding:18px 16px;min-height:94px;border:1px solid #e5eaf1 !important;border-radius:15px;box-shadow:0 5px 16px rgba(28,39,60,.055);justify-content:center;gap:6px}
 .nxlab-metrics strong{font-size:28px;line-height:1.1;font-weight:800;color:#172338 !important}
 .nxlab-metrics span{font-size:13px;line-height:1.4;color:#526176 !important}
 .nxlab-filters{gap:12px;margin-bottom:18px}
 .nxlab-filters input,.nxlab-filters select{font-size:14px;min-height:43px;padding:11px 14px;border:1px solid #dfe5ed;border-radius:12px;background:#fff;color:#243247}
 .nxlab-filters input{flex:1;min-width:220px}
 .nxlab-card{padding:20px !important;border-radius:16px !important;box-shadow:0 6px 20px rgba(28,39,60,.065);margin:14px 0}
 .nxlab-head{gap:16px;align-items:flex-start}
 .nxlab-head strong{font-size:16px;line-height:1.4}
 .nxlab-sub{font-size:13px;line-height:1.5;margin-top:6px}
 .nxlab-details{font-size:14px;line-height:1.6;gap:12px 16px;margin-top:17px}
 .nxlab-pill{font-size:12px;min-height:34px;padding:7px 13px}
 .nxlab-card button{font-size:13px;min-height:36px;border-radius:9px}
 .nxlab-field{font-size:14px}
 .nxlab-field input,.nxlab-field select,.nxlab-field textarea{font-size:14px;min-height:42px}
 @media(max-width:700px){.nxlab-top{align-items:stretch}.nxlab-actions{width:100%}.nxlab-actions button{flex:1}.nxlab-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.nxlab-metrics>div{padding:14px;min-height:82px}.nxlab-metrics strong{font-size:24px}.nxlab-card{padding:15px !important}.nxlab-filters input,.nxlab-filters select{width:100%;min-width:0}}

 </style>`;}
function carePatients(){
 return (db.p||[]).filter(p=>!p.arq&&(
  (p.protAtivo&&p.protEtapa!=='Tratamento concluído')||
  (p.implAtivo&&p.implEtapa!=='Tratamento concluído')));
}
// Exclusões desta fila são apenas ocultações da lista "A definir"; nunca apagam o paciente ou prontuário.
const careExcludedKey=()=>`nexodent:lab-care-excluded:v1:${clinic()||'local'}`;
function careExcludedRead(){try{const v=JSON.parse(localStorage.getItem(careExcludedKey())||'[]');return Array.isArray(v)?v.map(String):[]}catch(_){return []}}
function careExcludedWrite(ids){localStorage.setItem(careExcludedKey(),JSON.stringify([...new Set(ids.map(String))]));}
function careQueue(){
 if(!loadedClinic||loading||error)return '';
 const excluded=new Set(careExcludedRead());
 const list=carePatients().filter(p=>!excluded.has(String(p.id))&&!orders.some(o=>String(o.patient_id)===String(p.id)&&!['Entregue','Cancelado'].includes(o.status)))
  .filter(p=>!search||labNormalize(p.nome).includes(labNormalize(search)))
  .sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt-BR'));
 if(!list.length)return '';
 return `<details class="card nxlab-care"${view.labCareOpen?' open':''}><summary style="cursor:pointer;font:inherit;font-weight:600;color:var(--text,#243247);padding:4px 0">Prótese e implantes — trabalhos a definir (${list.length})</summary><p class="note">Pacientes em acompanhamento sem trabalho laboratorial em aberto. Defina a peça, o local de execução e o responsável. Esta lista não cria custos nem pagamentos. Remover daqui não exclui o paciente nem o prontuário.</p>${list.map(p=>`<div class="nxlab-actions" style="justify-content:space-between;border-top:1px solid var(--line,#d9dfe6);padding:12px 0"><div><strong>${safe(p.nome)}</strong><p class="note">${[p.protAtivo&&p.protEtapa!=='Tratamento concluído'?'Prótese':'',p.implAtivo&&p.implEtapa!=='Tratamento concluído'?'Implantodontia':''].filter(Boolean).join(' · ')}</p></div>${canEdit()?`<div class="nxlab-actions" style="margin:0;gap:8px"><button type="button" class="ghost sm" data-lab="care-new" data-id="${safe(p.id)}">Cadastrar trabalho</button><button type="button" class="danger sm" data-lab="care-delete" data-id="${safe(p.id)}">Excluir da lista</button></div>`:''}</div>`).join('')}</details>`;
}
window.nexoLabHtml=function(){
 if(!allowed())return '<div class="card">Você não possui permissão para consultar os trabalhos de laboratório.</div>';
 if(loadedClinic!==(clinic()||'local')&&!loading&&loadAttemptedClinic!==(clinic()||'local'))setTimeout(()=>fetchOrders(),0);
 const navigation=`<div class="nxlab-actions nxlab-navigation"><button type="button" data-lab="section-work" aria-pressed="${labSection==='work'}">Trabalhos</button><button type="button" data-lab="section-money" aria-pressed="${labSection==='money'}">Contas dos laboratórios</button></div>`;
 if(labSection==='money')return style()+navigation+(window.NexoLabPayables?.html()||'<p>Carregando contas dos laboratórios…</p>');
 const today=isoToday();
 const active=o=>!missingTreatment(o)&&!['Entregue','Cancelado'].includes(o.status);
 const late=o=>active(o)&&!!o.due_at&&date(o.due_at)<today;
 const soon=o=>active(o)&&!!o.due_at&&date(o.due_at)>=today&&date(o.due_at)<=new Date(Date.now()+7*86400000).toLocaleDateString('en-CA');
 const noDeadline=o=>active(o)&&!o.due_at;
 const totals={open:orders.filter(active).length,late:orders.filter(late).length,observed:orders.filter(o=>o.status==='Em observação').length,delivered:orders.filter(o=>o.status==='Entregue').length,soon:orders.filter(soon).length,noDeadline:orders.filter(noDeadline).length};
 const items=orders.filter(o=>filter==='todos'||(!missingTreatment(o)&&(filter==='observacao'?o.status==='Em observação':filter==='atrasados'?late(o):filter==='proximos'?soon(o):filter==='sem-prazo'?noDeadline(o):active(o)))).filter(o=>executionFilter==='all'||execution.get(o)===executionFilter).filter(o=>!search||[patientName(o.patient_id),o.laboratory,execution.label(execution.get(o)),o.work_description,o.teeth].some(t=>String(t||'').toLowerCase().includes(search.toLowerCase())));

 return `${style()}<div class="nxlab-workspace">${navigation}<div class="nxlab-top"><div><h2>Laboratório</h2><p>Controle de trabalhos, etapas, prazos e comunicação.</p></div><div class="nxlab-actions">${canEdit()?'<button type="button" class="primary" data-lab="new">+ Novo trabalho</button>':''}<button class="ghost" data-lab="export">Exportar CSV (filtro atual)</button><button class="ghost" data-lab="refresh">Atualizar</button></div></div>
 ${error?`<p class="nxlab-error">${safe(error)}</p>`:''}${loading?'<p>Carregando trabalhos...</p>':''}
 <div class="nxlab-metrics"><div><strong>${totals.open}</strong><span>Em aberto</span></div><div><strong>${totals.late}</strong><span>Atrasados</span></div><div><strong>${totals.observed}</strong><span>Em observação</span></div><div><strong>${totals.delivered}</strong><span>Entregues</span></div><div><strong>${totals.soon}</strong><span>Próximos 7 dias</span></div><div><strong>${totals.noDeadline}</strong><span>Sem prazo definido</span></div></div>
 ${editing==='new'?form(careDraft||{}):''}
 <div class="nxlab-filters"><label>Filtrar por<select id="nxlab-filter"><option value="ativos" ${filter==='ativos'?'selected':''}>Em aberto</option><option value="observacao" ${filter==='observacao'?'selected':''}>Em observação</option><option value="atrasados" ${filter==='atrasados'?'selected':''}>Atrasados</option><option value="proximos" ${filter==='proximos'?'selected':''}>Próximos 7 dias</option><option value="sem-prazo" ${filter==='sem-prazo'?'selected':''}>Sem prazo definido</option><option value="todos" ${filter==='todos'?'selected':''}>Todos</option></select></label><label>Local<select id="nxlab-execution-filter"><option value="all"${executionFilter==='all'?' selected':''}>Todos os locais</option><option value="laboratory"${executionFilter==='laboratory'?' selected':''}>Laboratório externo</option><option value="clinic"${executionFilter==='clinic'?' selected':''}>Na clínica</option></select></label><label>Buscar<input id="nxlab-search" type="search" placeholder="Buscar paciente, laboratório ou trabalho" value="${safe(search)}"></label></div>
 ${careQueue()}<div>${items.length?'<div class="ov-work-columns" aria-hidden="true"><span>Paciente e trabalho</span><span>Etapa atual</span></div>'+items.map(card).join(''):'<div class="card nxlab-empty">Nenhum trabalho encontrado.</div>'}</div></div>`;
};
async function persist(o){
 if(cloud()){
  const id=clinic();if(!id)throw Error('Clínica não selecionada.');
  const path='/rest/v1/nexodent_lab_orders'+(o._new?'':'?id=eq.'+encodeURIComponent(o.id)+'&clinic_id=eq.'+encodeURIComponent(id));
  const body={...o,clinic_id:id};delete body._new;
  const method=o._new?'POST':'PATCH';
 await OralCloud.request(path,{method,body});
  const saved={...o};delete saved._new;const ix=orders.findIndex(x=>String(x.id)===String(saved.id));
  if(ix>=0)orders[ix]={...orders[ix],...saved};else orders.unshift({...saved,clinic_id:id});
  publishOrders();
 }else{const ix=orders.findIndex(x=>x.id===o.id);if(ix>=0)orders[ix]=o;else orders.unshift(o);localWrite();}
orderEpoch++;fetchTask=null;
 await fetchOrders(true);
}
function readForm(){const v=id=>($id(id)?.value||'').trim();return {patient_id:v('nxlab-patient'),laboratory:v('nxlab-lab'),work_description:v('nxlab-work'),shade:v('nxlab-shade'),teeth:v('nxlab-teeth'),sent_at:v('nxlab-sent')||null,due_at:v('nxlab-due')||null,received_at:v('nxlab-received')||null,stage:v('nxlab-stage'),status:(orders.find(x=>String(x.id)===String(editing))?.status||'Em andamento'),observation_reason:v('nxlab-observation'),instructions:v('nxlab-instructions')};}
function exportCsv(){
 const fields=['Paciente','Local de execução','Responsável','Trabalho','Dentes','Cor','Etapa','Situação','Envio','Previsão','Recebimento','Observação','Tratamentos cadastrados','Tratamentos concluídos','Custos cadastrados','Tratamento vinculado','Custo laboratório'];
 const today=isoToday();
 const active=o=>!missingTreatment(o)&&!['Entregue','Cancelado'].includes(o.status);
 const filtered=orders.filter(o=>filter==='todos'||(!missingTreatment(o)&&(filter==='observacao'?o.status==='Em observação':filter==='atrasados'?active(o)&&o.due_at&&date(o.due_at)<today:filter==='proximos'?active(o)&&o.due_at&&date(o.due_at)>=today&&date(o.due_at)<=new Date(Date.now()+7*86400000).toLocaleDateString('en-CA'):filter==='sem-prazo'?active(o)&&!o.due_at:active(o)))).filter(o=>executionFilter==='all'||execution.get(o)===executionFilter).filter(o=>!search||[patientName(o.patient_id),o.laboratory,execution.label(execution.get(o)),o.work_description,o.teeth].some(t=>String(t||'').toLowerCase().includes(search.toLowerCase())));
 const rows=filtered.map(o=>[patientName(o.patient_id),execution.label(execution.get(o)),o.laboratory,o.work_description,o.teeth,o.shade,o.stage,o.status,date(o.sent_at),date(o.due_at),date(o.received_at),o.observation_reason,patientTreatments(o.patient_id).length,patientTreatments(o.patient_id).filter(t=>t.vid||['concluído','concluido','realizado'].includes(String(t.status||'').toLowerCase())).length,patientTreatments(o.patient_id).reduce((sum,t)=>sum+(Number(t.custo)||0),0).toFixed(2),linkedTreatment(o)?treatmentLabel(linkedTreatment(o)):'',Number(linkFor(o.id).cost||0).toFixed(2)]);
 const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,v=>"'"+v).replace(/"/g,'""')+'"';
 const csv='\uFEFF'+[fields,...rows].map(row=>row.map(cell).join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='nexodent-laboratorio-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function revealForm(){
 requestAnimationFrame(()=>{const form=document.querySelector('.nxlab-form');if(!form)return;form.focus({preventScroll:true});form.scrollIntoView({block:'start',behavior:'smooth'});});
}
document.addEventListener('toggle',event=>{if(event.target.isConnected&&event.target.matches?.('.nxlab-care'))view.labCareOpen=event.target.open;},true);
async function execute(action,id){
 if(action==='section-work'||action==='section-money'){if(busy)return;labSection=action==='section-money'?'money':'work';renderLab();return;}
 if(action==='export'){if(allowed())exportCsv();return;}
 if(busy)return;
 if(action==='refresh'){loadedClinic=null;loadAttemptedClinic=null;await fetchOrders(true);return;}
 if(action==='toggle'){view.labExpanded=String(view.labExpanded||'')===String(id)?null:id;renderLab();return;}
 if(action==='details'){view.labDetails=view.labDetails===id?null:id;renderLab();return;}
 if(!canEdit())return;
 if(action==='care-delete'){
  const patient=carePatients().find(p=>String(p.id)===String(id));if(!patient)return;
  if(!confirm('Remover '+patient.nome+' da lista “Trabalhos a definir”? O cadastro, o prontuário e os tratamentos do paciente serão preservados.'))return;
  const excluded=careExcludedRead();excluded.push(String(id));careExcludedWrite(excluded);renderLab();
  if(typeof toast==='function')toast('Paciente removido da lista A definir. O prontuário foi preservado.');
  return;
 }
 if(action==='care-new'){const p=carePatients().find(p=>String(p.id)===String(id));if(!p)return;careDraft={patient_id:String(p.id),work_description:p.protAtivo?'Prótese':'Implante',shade:p.protCor||'',instructions:'Paciente em acompanhamento de '+[p.protAtivo?'prótese':'',p.implAtivo?'implantodontia':''].filter(Boolean).join(' e ')+'. Definir a peça e confirmar a necessidade laboratorial.'};editing='new';renderLab();revealForm();return;}
 if(action==='new'){careDraft=null;editing='new';renderLab();revealForm();return;}
 if(action==='cancel'){careDraft=null;editing=null;renderLab();return;}
 if(action==='edit'){editing=id;view.labExpanded=id;renderLab();revealForm();return;}
 if(action==='delete'){
  const target=orders.find(o=>String(o.id)===String(id));if(!target)return;
  if(!confirm('Excluir definitivamente o trabalho de laboratório de '+patientName(target.patient_id)+'? Esta ação não pode ser desfeita.'))return;
  busy=true;try{
   if(cloud()){
    const activeClinic=clinic();
    const removed=await OralCloud.request('/rest/v1/nexodent_lab_orders?id=eq.'+encodeURIComponent(id)+'&clinic_id=eq.'+encodeURIComponent(activeClinic),{method:'DELETE',headers:{'Prefer':'return=representation'}});
    if(!Array.isArray(removed)||removed.length!==1||String(removed[0].id)!==String(id))throw Error('O banco de dados não autorizou a exclusão. Verifique a política DELETE (RLS) da tabela nexodent_lab_orders e as permissões do usuário.');
    await fetchOrders(true);
    if(clinic()!==activeClinic)throw Error('A clínica ativa mudou durante a exclusão. Atualize o Laboratório.');
    if(orders.some(o=>String(o.id)===String(id)))throw Error('O trabalho ainda consta no banco de dados após a exclusão. Atualize e verifique as permissões.');
   }
   else{orders=orders.filter(o=>String(o.id)!==String(id));localWrite();}
   const links=linksRead();delete links[String(id)];localStorage.setItem(linkKey(),JSON.stringify(links));
   if(editing===id)editing=null;publishOrders();renderLab();if(typeof toast==='function')toast('Trabalho excluído.');
  }catch(e){alert('Não foi possível excluir: '+(e.message||'Sem permissão ou erro de conexão'));}
  finally{busy=false;}return;
 }
 const old=orders.find(o=>o.id===id);
 if(action!=='save'&&!old)return;
 let o,pendingLink;
 if(action==='save'){
  const f=readForm(),where=$id('nxlab-execution')?.value;if(!execution.valid(where)){alert('Escolha o local de execução.');return;}if(where==='clinic'&&!f.laboratory)f.laboratory='Na clínica';if(where==='laboratory'&&!f.laboratory)f.laboratory='A definir';if(!f.patient_id||!f.work_description){alert('Informe o paciente e o trabalho a realizar.');return;}
  if(f.status==='Em observação'&&!f.observation_reason){alert('Informe o motivo da observação.');return;}
  const original=editing==='new'?null:orders.find(x=>x.id===editing);
  const invalid=validateOrder(f,original);if(invalid){if(invalid!=='cancel')alert(invalid);return;}
  pendingLink={tid:original&&String(original.patient_id)===String(f.patient_id)?linkFor(original.id).treatment_id||'':'',cost:Number($id('nxlab-cost')?.value||0)};
  if(!Number.isFinite(pendingLink.cost)||pendingLink.cost<0){alert('Informe um custo laboratorial válido.');return;}
  if(where==='clinic'&&pendingLink.cost>0&&f.laboratory==='Na clínica'){alert('Identifique o laboratório responsável pelo valor a pagar ou deixe esse valor em zero para execução somente interna.');return;}
  o={...(original||{}),...f,...(cloud()?{treatment_id:pendingLink.tid||null,laboratory_cost:pendingLink.cost}:{}),id:original?.id||crypto.randomUUID(),history:[...(original?.history||[]),{at:stamp(),text:(original?'Dados e etapa atualizados':'Trabalho cadastrado')+' • Local: '+execution.label(where),execution_location:where}],comments:original?.comments||[],updated_at:stamp(),_new:!original};
 }else if(action==='advance'){
  const stages=execution.stages(STAGES,execution.get(old)),ix=stages.indexOf(old.stage),next=stages[Math.min(ix+1,stages.length-1)];
  if(ix===stages.length-1){alert('O trabalho já está na última etapa.');return;}
  const note=prompt(`Avançar para "${next}". Informe um comentário sobre a etapa (opcional):`);if(note===null)return;
  o={...old,stage:next,status:next==='Recebido na clínica'?'Recebido':next==='Entregue ao paciente'?'Entregue':'Em andamento',received_at:next==='Recebido na clínica'?(old.received_at||new Date().toISOString().slice(0,10)):old.received_at,history:[...(old.history||[]),{at:stamp(),text:`Etapa: ${old.stage} → ${next}${note?' — '+note.slice(0,500):''}`}],updated_at:stamp()};
 }else if(action==='comment'){
  const txt=($id('nxlab-comment-'+id)?.value||'').trim();if(!txt)return;
  o={...old,comments:[...(old.comments||[]),{at:stamp(),text:txt.slice(0,2000)}],updated_at:stamp()};
 }else return;
 busy=true;
 try{await persist(o);if(action==='save'&&!cloud())saveLink(o.id,pendingLink.tid,pendingLink.cost);publishOrders();if(action==='save')editing=null;renderLab();if(typeof toast==='function')toast('Trabalho de laboratório atualizado.');}
 catch(e){alert('Não foi possível salvar: '+(e.message||'Erro de conexão'));}
 finally{busy=false;}
}
function updateExecutionForm(){
 const where=$id('nxlab-execution')?.value,internal=where==='clinic';
 for(const [id,all,get] of [['nxlab-stage',STAGES,execution.stages]]){const el=$id(id);if(!el)continue;const previous=el.value,choices=get(all,where);el.innerHTML=options(choices,choices.includes(previous)?previous:choices[0]);}
 const field=$id('nxlab-lab');if(field)field.required=false;
 const label=$id('nxlab-responsible-label');if(label)label.textContent=internal?'Responsável pelo trabalho (opcional)':'Laboratório responsável (opcional)';
 for(const id of ['nxlab-sent-field','nxlab-received-field'])if($id(id))$id(id).hidden=internal;
}
document.addEventListener('change',e=>{if(e.target.id==='nxlab-execution')updateExecutionForm();});
function labNormalize(t){return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();}
function labPatientOptions(patients,selected){
 const counts={};patients.forEach(p=>{counts[p.nome]=(counts[p.nome]||0)+1});
 return '<option value="">Selecione o paciente</option>'+patients.slice().sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt-BR')).map(p=>`<option value="${safe(p.id)}"${String(p.id)===String(selected)?' selected':''}>${safe(p.nome)}${counts[p.nome]>1?' · '+safe(p.tel||String(p.id)):''}</option>`).join('');
}
document.addEventListener('click',e=>{const btn=e.target.closest('[data-lab]');if(btn){e.preventDefault();execute(btn.dataset.lab,btn.dataset.id);}});
document.addEventListener('change',e=>{if(e.target.id==='nxlab-filter'){filter=e.target.value;renderLab();}if(e.target.id==='nxlab-execution-filter'){executionFilter=e.target.value;renderLab();}if(e.target.id==='nxlab-search'){search=e.target.value;renderLab();}});
document.addEventListener('keydown',e=>{if(e.target.id==='nxlab-search'&&e.key==='Enter'){search=e.target.value;renderLab();}});
window.addEventListener('nexodent:signed-out',()=>{orderEpoch++;fetchTask=null;fetchTaskClinic=null;orders=[];loadedClinic=null;loadAttemptedClinic=null;loading=false;editing=null;careDraft=null;labSection='work';executionFilter='all';window.NexoLabRead=null;});
window.addEventListener('nexodent:clinic-data-loaded',()=>{executionFilter='all';loadedClinic=null;loadAttemptedClinic=null;if(isLab())fetchOrders(true);});
window.addEventListener('focus',()=>{if(isLab())fetchOrders(true);});
})();
