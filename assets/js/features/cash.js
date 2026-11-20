/* Financeiro: leitura das fontes originais e cadastro compartilhado de despesas. */
(function(){'use strict';
 const model=window.NexoCashModel,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
 const money=c=>currency.format(c/100);
 const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
 const categories=['Aluguel','Energia','Água','Salários','Internet','Materiais','Impostos','Contabilidade','Manutenção','Marketing','Outros'];
 let clinic=null,epoch=0,loading=false,busy=false,loaded=false,expenses=[],lab=[],warnings=[],error='',draft=null,draftId=null,notice='',editOriginal=null;
 let draftRetroactive=false;
 let expensesReady=false,expenseFilter='all',expenseListOpen=true;
 let sourceClinic=window.OralCloud?.clinicId||null;
 const monthEnd=m=>new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5,7)),0)).toISOString().slice(0,10);
 let from=today().slice(0,7)+'-01',to=monthEnd(today().slice(0,7));
 const id=()=>window.OralCloud?.clinicId;
 const allowed=()=>!!window.OralCloud?.enabled&&!!id()&&typeof pmLvl==='function'&&pmLvl('vd')>=1&&window.NexoModules?.isAllowed('finance')===true;
 const writable=()=>allowed()&&pmLvl('vd')>=2;
 const active=()=>typeof view!=='undefined'&&view.h==='cash'&&!view.id;
 const redraw=()=>{if(active()&&typeof render==='function')render()};
 function clear(){epoch++;clinic=null;loading=false;loaded=false;expenses=[];lab=[];warnings=[];error='';draft=null;draftId=null;notice='';editOriginal=null;expensesReady=false;expenseFilter='all';expenseListOpen=true;draftRetroactive=false;}
 async function pages(table,fields,c){const rows=[];for(let offset=0;offset<20000;offset+=500){if(id()!==c||!allowed())throw Error('Clínica ou acesso alterado.');const page=await OralCloud.request('/rest/v1/'+table+'?select='+fields+'&clinic_id=eq.'+encodeURIComponent(c)+'&order=id.asc&limit=500&offset='+offset);if(!Array.isArray(page))throw Error('Resposta inválida.');rows.push(...page);if(page.length<500)return rows;}throw Error('Limite de consulta atingido. Totais incompletos.');}
 async function load(){
  if(!allowed()||loading)return;
  const c=id(),current=++epoch;
  clinic=c;loading=true;error='';warnings=[];redraw();
  const stillCurrent=()=>epoch===current&&id()===c&&allowed();
  const manual=pages('nexodent_general_expenses','*',c).then(rows=>{
   if(!stillCurrent())return;
   expenses=rows.filter(e=>!e.voided_at);
   expensesReady=true;
   redraw();
  },failure=>{
   if(!stillCurrent())return;
   expenses=[];expensesReady=false;
   warnings.push('Despesas manuais indisponíveis: '+failure.message);
   redraw();
  });
  const hasLabAccess=pmLvl('lab')>=1&&pmLvl('pac')>=1;
  const laboratory=(hasLabAccess?pages('nexodent_lab_payment_events','id,source_order_id,amount,paid_at,kind',c):
   Promise.reject(Error('Acesso a Laboratório e Pacientes necessário para consultar pagamentos laboratoriais.'))).then(rows=>{
   if(stillCurrent())lab=rows;
  },failure=>{
   if(!stillCurrent())return;
   lab=[];
   warnings.push('Pagamentos laboratoriais indisponíveis: '+failure.message);
  });
  await Promise.all([manual,laboratory]);
  if(!stillCurrent())return;
  loaded=true;loading=false;redraw();
 }
 async function refreshAfterWrite(){epoch++;loading=false;window.dispatchEvent(new Event('nexodent:expenses-updated'));await load();}
 function report(labels){const alerts=[...warnings],sourceReady=sourceClinic===id(),commissionsAllowed=pmLvl('cm')>=1&&window.NexoModules?.isAllowed('commissions')===true;if(!sourceReady)alerts.push('Recebimentos e repasses aguardam o carregamento dos dados desta clínica.');if(!commissionsAllowed)alerts.push('Repasses aos dentistas não estão incluídos: acesso a Comissões e módulo ativo necessários.');const result=model.calculate({sales:sourceReady&&typeof db!=='undefined'?salesForAccounting():[],commissions:sourceReady&&commissionsAllowed?(db.cp||[]):[],lab,expenses,from,to,labelForCategory:name=>labels.get(model.categoryKey(name))||model.categoryLabel(name),today:today()});return {...result,warnings:[...alerts,...result.warnings],partial:!!alerts.length||!!result.warnings.length};}
 function categoryLabels(){
  const labels=new Map();
  for(const name of [...categories,'Laboratório','Dentista',...expenses.map(e=>e.category)]){
   const key=model.categoryKey(name);
   if(!labels.has(key))labels.set(key,model.categoryLabel(name));
  }
  return labels;
 }
 function categoryNames(){return [...categoryLabels().values()].sort((a,b)=>a.localeCompare(b,'pt-BR'));}
 function categoryOptions(){return categoryNames().map(c=>`<option value="${esc(c)}">`).join('');}
 function openExpense(category='Aluguel',retroactive=false){
  if(!writable()||busy||window.NexoCashImport?.running)return;
  if(clinic!==id()){clear();clinic=id();}
  if(draft&&!confirm('Substituir o formulário de despesa que está aberto?'))return;
  draft={category,due_date:'',reference_month:retroactive?'':from.slice(0,7)};
  draftId=crypto.randomUUID();editOriginal=null;draftRetroactive=retroactive;
  if(!active()){view.h='cash';view.id=null;}
  redraw();document.getElementById('nx-cash-form')?.scrollIntoView({block:'center'});
 }
 function form(){if(!draft||!writable())return '';const v=k=>esc(draft[k]||''),names=categoryNames(),selected=names.find(name=>model.categoryKey(name)===model.categoryKey(draft.category)),custom=draft._categoryMode===true||!selected;return `<section class="card"><h2>${editOriginal?'Editar despesa':draftRetroactive?'Pagamento retroativo ao laboratório':'Nova despesa'}</h2><form id="nx-cash-form" class="nx-cash-grid"><label>Descrição<input name="description" required minlength="2" maxlength="200" value="${v('description')}" placeholder="Ex.: conta de luz de novembro"></label><label>Categoria<select name="category" id="nx-cash-category-choice">${names.map(c=>`<option value="${esc(c)}"${!custom&&selected===c?' selected':''}>${esc(c)}</option>`).join('')}<option value="__new__"${custom?' selected':''}>+ Nova categoria</option></select></label><label id="nx-cash-custom-category-field"${custom?'':' hidden'}>Nome da nova categoria<input name="custom_category" maxlength="100" value="${esc(draft._categoryCustom|| (custom?draft.category:''))}"${custom?' required':' disabled'}></label><label>Mês de referência<input name="reference_month" type="month" required value="${v('reference_month')}"></label><label>Valor (R$)<input name="amount" type="number" step="0.01" min="0.01" max="999999999999.99" required value="${v('amount')}"></label><label>Vencimento (opcional)<input name="due_date" type="date" value="${v('due_date')}"></label><label>Pagamento previsto (opcional)<input name="planned_paid_at" type="date" value="${v('planned_paid_at')}"></label><label>${draftRetroactive?'Data em que foi pago':'Pagamento registrado (aceita data futura)'}<input name="paid_at" type="date" value="${v('paid_at')}"${draftRetroactive?` required max="${today()}"`:''}></label><label>Forma de pagamento<input name="payment_method" maxlength="100" value="${v('payment_method')}"${draftRetroactive?' required':''} placeholder="Pix, boleto, transferência…"></label><div><button type="submit"${busy?' disabled':''}>Salvar despesa</button> <button type="button" class="ghost" data-cash="cancel"${busy?' disabled':''}>Cancelar</button></div></form><p class="note">O mês de referência organiza a despesa, mesmo se o pagamento for atrasado. Sem pagamento realizado, ela continua a pagar. Pagamento registrado, inclusive com data futura, marca a conta como paga. Apenas a previsão mantém a conta a pagar.</p></section>`;}
 const dBR=d=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(d||''));return m?m[3]+'/'+m[2]+'/'+m[1].slice(2):'—'};
 const mBR=m=>{const x=/^(\d{4})-(\d{2})/.exec(String(m||''));return x?x[2]+'/'+x[1].slice(2):'—'};
 const rowDate=e=>String(e.paid_at||e.due_date||e.planned_paid_at||'').slice(0,10);
 function monthExpenses(report,labels){
  const t=today(), matched=new Set([...report.matchedManual.values()].map(e=>e.id));
  const rows=expenses.filter(e=>!matched.has(e.id)&&model.inReference(e,from,to,t)).map(e=>({
   id:e.id,expense:e,paid:Boolean(e.paid_at),month:model.referenceMonth(e,t),date:rowDate(e),due:e.due_date,
   description:e.description,category:labels.get(model.categoryKey(e.category)),cents:model.cents(e.amount),
   status:e.paid_at?'Paga em '+dBR(e.paid_at):(e.due_date&&e.due_date<t?'Vencida':'A pagar')+
     (e.planned_paid_at?' · previsto em '+dBR(e.planned_paid_at):'')
  }));
  for(const paid of report.rows){
   if(paid.direction>=0||paid.source==='Despesa manual')continue;
   rows.push({id:paid.id,expense:report.matchedManual.get(paid.id),paid:true,month:paid.date.slice(0,7),date:paid.date,
    description:paid.description,category:labels.get(model.categoryKey(paid.source))||paid.source,
    cents:paid.cents,status:'Paga em '+dBR(paid.date)});
  }
  return rows.sort((a,b)=>(a.date||a.month+'-01').localeCompare(b.date||b.month+'-01')||
    String(a.description).localeCompare(String(b.description),'pt-BR')||String(a.id).localeCompare(String(b.id)));
 }
 function expenseActions(expense){
  if(!expense||!writable())return '—';
  const id=esc(expense.id),disabled=busy?' disabled':'';
  return `${!expense.paid_at?`<button class="ghost sm" data-cash="pay" data-id="${id}"${disabled}>Registrar pagamento</button> `:''}
   <button class="ghost sm" data-cash="edit" data-id="${id}"${disabled}>Editar</button>
   <button class="ghost sm" data-cash="delete" data-id="${id}"${disabled}>Excluir</button>`;
 }
 function categoryDashboard(r,ready,labels){const maximum=Math.max(1,...r.categories.map(c=>c.total));return `<section class="card"><h2>Despesas por categoria</h2><p>Total de gastos e contas a pagar do mês: <strong>${ready?money(r.registered):'—'}</strong></p><p class="note">Barra escura: valores pagos. Barra clara: valores a pagar. Categorias com o mesmo nome são agrupadas no painel.</p><div aria-label="Gráfico de despesas por categoria">${(ready?r.categories:[]).map(c=>`<div style="margin:12px 0"><div style="display:flex;justify-content:space-between;gap:12px"><span>${esc(c.label)}</span><strong>${money(c.total)}</strong></div><div role="img" aria-label="${esc(c.label)}: ${esc(money(c.paid))} pagos e ${esc(money(c.pending))} a pagar" style="height:16px;background:#eef0f3;border-radius:6px;overflow:hidden"><div style="width:${(100*c.total/maximum).toFixed(2)}%;height:100%;background:#c9d0da"><div style="width:${c.total?(100*c.paid/c.total).toFixed(2):0}%;height:100%;background:#64748b"></div></div></div></div>`).join('')}</div>${ready&&!r.categories.length?'<p class="note">Nenhum gasto cadastrado neste mês.</p>':''}${writable()?`<details style="margin-top:16px"><summary style="cursor:pointer;color:#243247">Unir ou renomear categorias</summary><form id="nx-cash-merge" class="nx-cash-grid"><label>Categorias atuais — selecione uma ou mais<select name="sources" multiple required size="5">${[...new Set(expenses.map(e=>model.categoryKey(e.category)))].map(key=>labels.get(key)).sort((a,b)=>a.localeCompare(b,'pt-BR')).map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('')}</select></label><label>Nome da categoria final<input name="target" list="nx-merge-categories" maxlength="100" required><datalist id="nx-merge-categories">${categoryOptions()}</datalist></label><button type="submit" class="ghost"${busy?' disabled':''}>Unir categorias selecionadas</button></form><p class="note">Atualiza as categorias escolhidas em todas as despesas manuais da clínica, inclusive meses anteriores. Valores e pagamentos são preservados.</p></details>`:''}</section>`;}

 function html(){if(!allowed())return '<section class="card">Conecte-se à clínica e confira o acesso à aba Controle.</section>';if(clinic!==id()){clear();clinic=id();setTimeout(load,0);}else if(!loaded&&!loading)setTimeout(load,0);
  const labels=categoryLabels(),r=report(labels),ready=loaded,known=ready?r.partial?' (parcial)':'':'';
  const pendingOnly=expenseFilter==='pending',paidOnly=expenseFilter==='paid';
  const entries=(ready||expensesReady?monthExpenses(r,labels):[]).filter(row=>expenseFilter==='all'||row.paid===paidOnly);
  const pendingLabel='Contas a pagar do mês',paidLabel='Contas pagas do mês';
  const listTitle=pendingOnly?pendingLabel:paidOnly?paidLabel:'Despesas do mês';
  const listReady=pendingOnly?expensesReady:ready;
  const emptyMessage=pendingOnly
   ? expensesReady?'Nenhuma conta a pagar neste mês.':loaded&&!loading?'Contas a pagar indisponíveis.':'Carregando contas a pagar…'
   : !ready?'Aguardando carregamento.':paidOnly?'Nenhuma conta paga nos dados disponíveis deste mês.':'Nenhuma despesa cadastrada neste mês.';
  const filterButton=(action,label,value,available,caption)=>`<button type="button" class="card nx-cash-filter" data-cash="${action}" aria-controls="nx-cash-expenses" aria-pressed="${expenseFilter===action}"><span>${label}</span><strong>${available?money(value):'—'}</strong><small>${caption} →</small></button>`;
  const box=(label,value)=>`<div class="card"><span>${label}</span><strong>${ready?money(value):'—'}</strong></div>`;
  return `<style>.nx-cash-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;align-items:end}.nx-cash-grid label{display:grid;gap:6px}.nx-cash-grid [hidden]{display:none!important}.nx-cash-grid input,.nx-cash-grid select{width:100%;min-width:0}.nx-cash-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:18px 0}.nx-cash-metrics .card{display:grid;gap:8px;margin:0}.nx-cash-metrics .nx-cash-filter{cursor:pointer;text-align:left;color:inherit;font:inherit}.nx-cash-filter small{color:#334155;text-decoration:underline}.nx-cash-filter[aria-pressed=true]{border-color:var(--ac)}.nx-cash-metrics strong{font-size:24px;font-weight:600;color:#243247}.nx-cash-scroll{overflow:auto}.nx-cash-scroll table{width:100%;border-collapse:collapse}.nx-cash-scroll th,.nx-cash-scroll td{padding:12px;text-align:left;border-bottom:1px solid #e1e5eb}.nx-cash-scroll th{font-weight:600;background:#f5f6f8}.nx-cash-scroll tbody tr:nth-child(even) td{background:rgba(127,127,127,.12)}.nx-cash-scroll tbody tr:hover td{background:rgba(194,65,12,.12)}.nx-cash-warning{padding:12px;background:#fff8e8;border:1px solid #ecd9a9;border-radius:10px;color:#584211;margin:12px 0}</style>
  <div class="ov-page-head"><div><h1>Controle</h1><p class="sub">Entradas, saídas e despesas da clínica.</p></div><div>${writable()?'<button class="ghost" data-cash="import">Importar despesas</button> <button class="ghost" data-cash="new">Nova despesa</button> ':''}<button class="ghost" data-cash="refresh"${loading||busy?' disabled':''}>${loading?'Carregando…':'Atualizar'}</button></div></div>
  <section class="card nx-cash-grid" data-ro-ok><label>Mês de referência<input id="nx-cash-month" type="month" value="${esc(from.slice(0,7))}"></label><div><button class="ghost" data-cash="csv"${!ready||loading?' disabled':''}>Exportar CSV</button></div></section>
  ${notice?`<p class="note" role="status">${esc(notice)}</p>`:''}${error?`<p class="nx-cash-warning" role="alert">${esc(error)}</p>`:''}${loading?'<p class="note" role="status">Atualizando os totais de Despesas…</p>':''}${(ready||expensesReady)&&r.warnings.length?`<div class="nx-cash-warning" role="status"><strong>Conferência necessária — valores parciais</strong>${r.warnings.map(w=>`<p>${esc(w)}</p>`).join('')}</div>`:''}
  <div class="nx-cash-metrics">${box('Entradas recebidas'+known,r.income)}${filterButton('paid','Saídas pagas'+known,r.outcome,ready,'Ver contas pagas')}${box('Saldo após gastos do mês'+known,r.balance)}${filterButton('pending',pendingLabel,r.pending,expensesReady,'Ver contas a pagar')}</div>
  <p class="note">Entradas: recebimentos registrados dos pacientes. Pagamentos de laboratório e dentistas entram automaticamente quando registrados nas respectivas áreas. Despesas manuais são agrupadas pelo mês de referência, independentemente do dia em que foram pagas. Valores previstos, comissões apenas geradas e saldos de abertura não movimentam este fluxo. Recebimentos são brutos; registre taxas bancárias como despesas quando necessário. O saldo é um resumo mensal, não o saldo bancário. Não inclui saldo inicial.</p>
  ${writable()?`<section class="card"><h2>Lançar despesas</h2><div class="row">
   ${[['Salários','Salários da equipe'],['Impostos','Impostos'],['Contabilidade','Contabilidade']].map(([category,label])=>`<button type="button" class="ghost sm" data-cash="new-category" data-category="${category}">${label}</button>`).join('')}
  </div></section>`:''}
  ${window.NexoCashImport?.html()||''}${reviewHtml()}${form()}
  <details class="card" id="nx-cash-expenses"${expenseListOpen?' open':''}><summary style="color:#243247;font-weight:600;cursor:pointer">${listTitle}</summary>
  ${expenseFilter!=='all'?'<button type="button" class="ghost sm" data-cash="all">Ver todas as despesas</button>':''}
  <div class="nx-cash-scroll"><table><thead><tr><th>Mês ref.</th><th>Data</th><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th>Situação</th><th>Ação</th></tr></thead>
  <tbody>${entries.map(e=>`<tr><td>${esc(mBR(e.month))}</td><td>${esc(dBR(e.date))}</td><td>${esc(dBR(e.due))}</td><td>${esc(e.description)}</td><td>${esc(e.category)}</td><td>${money(e.cents)}</td><td>${esc(e.status)}</td><td>${expenseActions(e.expense)}</td></tr>`).join('')||
   '<tr><td colspan="8">'+emptyMessage+'</td></tr>'}</tbody>
  <tfoot><tr><th colspan="5">${pendingOnly?'Total a pagar':paidOnly?'Total pago':'Total da lista'}</th><th>${listReady?money(entries.reduce((sum,e)=>sum+e.cents,0)):'—'}</th><th colspan="2"></th></tr></tfoot></table></div></details>
  ${categoryDashboard(r,ready,labels)}`;
 }
 function reviewHtml(){const groups=model.reviews(expenses,today());if(!loaded||!groups.length)return '';return `<section class="card"><h2>Contas para revisar</h2><p class="note">Compras iguais podem ser legítimas. Use esta revisão somente quando confirmar que os registros são cópias da mesma compra.</p>${groups.map(g=>`<div style="padding:12px 0;border-top:1px solid #e1e5eb"><strong>${esc(g[0].description)}</strong> · ${money(model.cents(g[0].amount))} · ${g.length} registro(s)${g[0].paid_at>today()?' · pagamento previsto em '+esc(g[0].paid_at):''}${writable()?` <button class="ghost sm" data-cash="review" data-id="${esc(g[0].id)}"${busy?' disabled':''}>${g.length>1?'Manter uma conta e corrigir cópias':'Corrigir para a pagar'}</button>`:''}</div>`).join('')}</section>`;}
 async function review(expenseId){if(!writable()||busy)return;const group=model.reviews(expenses,today()).find(g=>String(g[0].id)===String(expenseId));if(!group)return;const keep=group[0],planned=keep.paid_at||keep.planned_paid_at||null;
  if(!confirm('Confirmar revisão de '+keep.description+' — '+money(model.cents(keep.amount))+'?\nManter uma conta a pagar'+(planned?', prevista para '+planned:'')+'.\n'+(group.length-1)+' cópia(s) ficarão fora dos totais, preservadas na auditoria. Nenhum pagamento será realizado.'))return;
  const c=id();busy=true;error='';notice='';redraw();try{const result=await OralCloud.request('/rest/v1/rpc/nexodent_review_expense',{method:'POST',body:{p_clinic:c,p_keep:keep.id,p_copies:group.slice(1).map(e=>e.id),p_planned:planned}});if(id()!==c)return;if(String(result?.kept)!==String(keep.id)||Number(result?.voided)!==group.length-1)throw Error('Revisão não confirmada. Atualize para conferir.');notice='Revisão confirmada: uma conta a pagar, sem pagamento realizado. Histórico preservado na auditoria.';await refreshAfterWrite();}catch(e){if(id()===c)error='Não foi possível confirmar a revisão. Confira se o SQL 202611170020_expense_duplicates_and_schedule.sql foi executado. '+e.message;}finally{busy=false;redraw();}
 }
 function sameExpense(row,data){return row&&String(row.id)===String(data.id)&&Number(row.amount)===Number(data.amount)&&['description','category','supplier','due_date','paid_at','planned_paid_at','payment_method','reference_month'].every(k=>String(row[k]||'')===String(data[k]||''));}
 async function confirmedWrite(data){
  const c=data.clinic_id;
  const read=async()=>{const rows=await OralCloud.request('/rest/v1/nexodent_general_expenses?select=*&id=eq.'+encodeURIComponent(data.id)+'&clinic_id=eq.'+encodeURIComponent(c));if(id()!==c)throw Error('Clínica alterada.');if(!Array.isArray(rows))throw Error('Resposta de conferência inválida.');const row=rows.find(r=>String(r.id)===String(data.id));if(row&&!sameExpense(row,data))throw Error('Já existe uma despesa com este identificador e dados diferentes. Atualize e confira antes de alterar.');return row;};
  if(await read())return;
  if(id()!==c||!writable())throw Error('Clínica ou acesso alterado.');
  let failure;
  try{const rows=await OralCloud.request('/rest/v1/nexodent_general_expenses',{method:'POST',headers:{Prefer:'return=representation'},body:data});if(id()!==c)throw Error('Clínica alterada.');if(Array.isArray(rows)&&rows.length===1&&sameExpense(rows[0],data))return;failure=Error('O servidor não devolveu a confirmação.');}catch(e){failure=e;}
  if(await read())return;

  throw failure;
 }
 async function save(f){if(!writable()||busy)return;draft=readExpenseForm(f);const c=id(),original=editOriginal,data={...draft,id:original?.id||draftId,clinic_id:c,description:draft.description.trim(),category:draft.category?categoryLabels().get(model.categoryKey(draft.category))||model.categoryLabel(draft.category):'',supplier:original?.supplier||'',reference_month:draft.reference_month+'-01',amount:Number(draft.amount),due_date:draft.due_date||null,paid_at:draft.paid_at||null,planned_paid_at:draft.planned_paid_at||null,payment_method:draft.payment_method.trim()||null};delete data._categoryMode;delete data._categoryCustom;
  if(draftRetroactive&&(!model.validDate(data.paid_at)||data.paid_at>today()))return alert('Informe a data em que o laboratório foi pago.');
  if(!data.description||!data.category||data.category.length>100||!Number.isFinite(data.amount)||data.amount<=0||!model.validDate(data.reference_month)||(data.due_date&&!model.validDate(data.due_date))||(data.paid_at&&!model.validDate(data.paid_at)))return alert('Confira descrição, categoria, valor, mês e datas.');if(data.planned_paid_at&&!model.validDate(data.planned_paid_at))return alert('Confira a data prevista.');if(data.paid_at&&!data.payment_method)return alert('Informe a forma de pagamento.');
  busy=true;error='';notice='';f.querySelector('button[type="submit"]').disabled=true;
  try{if(original){if(!confirm('Salvar as alterações desta despesa? O histórico anterior será preservado.'))return;const body={...data};delete body.id;delete body.clinic_id;const result=await OralCloud.request('/rest/v1/nexodent_general_expenses?id=eq.'+encodeURIComponent(original.id)+'&clinic_id=eq.'+encodeURIComponent(c)+'&revision=eq.'+Number(original.revision||0),{method:'PATCH',headers:{Prefer:'return=representation'},body});if(!Array.isArray(result)||result.length!==1||!sameExpense(result[0],data))throw Error('A despesa mudou ou a alteração não foi confirmada. Atualize antes de tentar novamente.');}else await confirmedWrite(data);if(id()!==c)return;draft=null;draftId=null;editOriginal=null;notice='Despesa confirmada no Supabase. Contas pagas estão nos gastos; contas sem pagamento realizado permanecem a pagar.';await refreshAfterWrite();}
  catch(e){if(id()===c)error='Não foi possível confirmar a despesa: '+e.message+' O formulário foi mantido.';}
  finally{busy=false;redraw();}
 }
 async function remove(expenseId){if(!writable()||busy||!expensesReady||clinic!==id())return;const row=expenses.find(e=>String(e.id)===String(expenseId));if(!row)return;if(!confirm('Retirar '+row.description+' — '+money(model.cents(row.amount))+' dos totais? O registro será preservado na auditoria.'))return;const c=id();busy=true;error='';try{const result=await OralCloud.request('/rest/v1/rpc/nexodent_void_expense',{method:'POST',body:{p_clinic:c,p_id:row.id,p_revision:Number(row.revision||0)}});if(id()!==c)return;if(String(result?.voided)!==String(row.id))throw Error('Exclusão não confirmada. Atualize.');if(editOriginal?.id===row.id){editOriginal=null;draft=null;draftId=null;}notice='Lançamento retirado dos totais e preservado na auditoria.';await refreshAfterWrite();}catch(e){if(id()===c)error='Não foi possível excluir: '+e.message;}finally{busy=false;redraw();}}
 async function mergeCategories(f){if(!writable()||busy)return;const data=new FormData(f),keys=new Set(data.getAll('sources').map(model.categoryKey)),sources=[...new Set(expenses.map(e=>e.category).filter(name=>keys.has(model.categoryKey(name))))],target=String(data.get('target')||'').trim();if(!sources.length||!target||target.length>100)return alert('Escolha as categorias e o nome final.');const labels=categoryLabels();if(!confirm('Unir '+[...keys].map(key=>labels.get(key)).join(', ')+' na categoria "'+target+'" em todas as despesas manuais da clínica? Valores e pagamentos serão preservados.'))return;const c=id();busy=true;error='';try{const result=await OralCloud.request('/rest/v1/rpc/nexodent_merge_expense_categories',{method:'POST',body:{p_clinic:c,p_sources:sources,p_target:target}});if(id()!==c)return;if(result?.category!==target||!Number.isInteger(Number(result.updated)))throw Error('Alteração não confirmada.');notice='Categorias unidas: '+result.updated+' lançamento(s) atualizado(s), com histórico preservado.';await refreshAfterWrite();}catch(e){if(id()===c)error='Não foi possível unir categorias: '+e.message;}finally{busy=false;redraw();}}

 async function pay(expenseId){if(!writable()||busy||!expensesReady||clinic!==id())return;const row=expenses.find(e=>String(e.id)===String(expenseId));if(!row||row.paid_at)return;const date=prompt('Data do pagamento (AAAA-MM-DD):',today());if(date===null)return;if(!model.validDate(date))return alert('Informe uma data válida para o pagamento.');const method=prompt('Forma de pagamento:','Pix');if(!method?.trim())return;if(!confirm('Confirmar pagamento de '+money(model.cents(row.amount))+' — '+row.description+'?'))return;
  const c=id();busy=true;error='';redraw();try{const result=await OralCloud.request('/rest/v1/nexodent_general_expenses?id=eq.'+encodeURIComponent(row.id)+'&clinic_id=eq.'+encodeURIComponent(c)+'&paid_at=is.null&amount=eq.'+encodeURIComponent(row.amount),{method:'PATCH',headers:{Prefer:'return=representation'},body:{paid_at:date,payment_method:method.trim().slice(0,100)}});if(id()!==c)return;if(!Array.isArray(result)||result.length!==1)throw Error('Pagamento não confirmado ou despesa já alterada. Atualize os dados.');notice='Pagamento confirmado. A conta saiu das pendentes e está nos gastos do mês de referência.';await refreshAfterWrite();}catch(e){if(id()===c)error='Não foi possível confirmar o pagamento: '+e.message;}finally{busy=false;redraw();}
 }
 function csv(){if(!loaded||loading||!allowed())return;const r=report(categoryLabels()),cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,x=>"'"+x).replace(/"/g,'""')+'"';const lines=[['Situação',r.partial?'PARCIAL — conferir avisos':'Consultado'],...r.warnings.map(w=>['Aviso',w]),['Entradas recebidas',(r.income/100).toFixed(2)],['Saídas pagas',(r.outcome/100).toFixed(2)],['Saldo do período',(r.balance/100).toFixed(2)],['Data do pagamento','Mês de referência','Origem','Descrição','Valor pago','Referência'],...r.rows.filter(x=>x.direction<0).map(x=>[x.date,x.reference_month||x.date.slice(0,7),x.source,x.description,(x.cents/100).toFixed(2),x.id])];const a=document.createElement('a'),url=URL.createObjectURL(new Blob(['\ufeff'+lines.map(row=>row.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));a.href=url;a.download='financeiro-'+from+'-'+to+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function readExpenseForm(f){const raw=Object.fromEntries(new FormData(f)),custom=raw.category==='__new__',name=String(raw.custom_category||'').trim();delete raw.custom_category;return {...raw,category:custom?name:raw.category,_categoryMode:custom,_categoryCustom:custom?name:''};}
 document.addEventListener('input',e=>{const f=e.target.closest?.('#nx-cash-form');if(f&&draft)draft=readExpenseForm(f);});
 document.addEventListener('change',e=>{if(draftRetroactive&&e.target.name==='paid_at'&&e.target.form?.id==='nx-cash-form'&&model.validDate(e.target.value))e.target.form.elements.reference_month.value=e.target.value.slice(0,7);
  if(e.target.id==='nx-cash-category-choice'){const custom=e.target.value==='__new__',field=document.getElementById('nx-cash-custom-category-field'),input=field.querySelector('input');field.hidden=!custom;input.disabled=!custom;input.required=custom;if(custom)input.focus();}if(e.target.id==='nx-cash-month'){
  if(!active()||!allowed())return;
  const month=e.target.value;
  if(!model.validDate(month+'-01')){e.target.value=from.slice(0,7);return;}
  from=month+'-01';to=monthEnd(month);
  redraw();
  document.getElementById('nx-cash-month')?.focus({preventScroll:true});
  return;
 }const f=e.target.closest?.('#nx-cash-form');if(f&&draft)draft=readExpenseForm(f);});
 document.addEventListener('submit',e=>{if(e.target.id==='nx-cash-merge'){e.preventDefault();mergeCategories(e.target);return;}if(e.target.id==='nx-cash-form'){e.preventDefault();save(e.target)}});
 document.addEventListener('click',e=>{const b=e.target.closest('[data-cash]');if(!b||!active()||!allowed())return;const action=b.dataset.cash;if(window.NexoCashImport?.running&&['new','edit','pay','delete','review','import'].includes(action))return;if(action==='import'&&writable()&&!busy){window.NexoCashImport?.open();return;}if(['pending','paid','all'].includes(action)){expenseFilter=action;expenseListOpen=true;redraw();const list=document.getElementById('nx-cash-expenses');list?.querySelector('summary')?.focus({preventScroll:true});list?.scrollIntoView({block:'start'});return;}if(action==='new-category'){openExpense(b.dataset.category);return;}if(action==='refresh'&&!busy)load();if(action==='new'&&writable()&&!busy){if(!draft||editOriginal){draftRetroactive=false;draft={category:'Aluguel',due_date:'',reference_month:from.slice(0,7)};draftId=crypto.randomUUID();editOriginal=null;}redraw();document.getElementById('nx-cash-form')?.scrollIntoView({block:'center'});}if(action==='cancel'&&!busy){draft=null;draftId=null;editOriginal=null;redraw();}if(action==='edit'&&writable()&&!busy){const row=expenses.find(e=>String(e.id)===String(b.dataset.id));if(row){editOriginal={...row};draftId=null;draftRetroactive=false;draft={...row,reference_month:model.referenceMonth(row,today()),amount:String(row.amount),due_date:row.due_date||'',paid_at:row.paid_at||'',planned_paid_at:row.planned_paid_at||'',payment_method:row.payment_method||''};redraw();document.getElementById('nx-cash-form')?.scrollIntoView({block:'center'});}}if(action==='delete')remove(b.dataset.id);if(action==='review')review(b.dataset.id);if(action==='pay')pay(b.dataset.id);if(action==='csv')csv();});
 window.addEventListener('nexodent:signed-out',()=>{sourceClinic=null;clear()});
 window.addEventListener('nexodent:clinic-data-loaded',()=>{sourceClinic=id();if(clinic!==id())clear();if(active())redraw()});
 window.addEventListener('nexodent:modules-updated',()=>{if(!allowed())clear();redraw()});
 function invalidate(){epoch++;loaded=false;loading=false;if(active()&&!busy)load();}
 window.addEventListener('nexodent:lab-payments-updated',invalidate);
 document.addEventListener('toggle',e=>{if(e.target.id==='nx-cash-expenses'&&e.target.isConnected)expenseListOpen=e.target.open;},true);
 document.addEventListener('click',e=>{if(e.target.closest?.('[data-act="nav"][data-t="cash"]')&&active()&&loaded&&!draft&&!busy&&!window.NexoCashImport?.running)load();});
 window.addEventListener('focus',()=>{if(active()&&!busy&&!draft&&!window.NexoCashImport?.running)load()});
 window.NexoCash={html,load,openExpense,refreshForImport:refreshAfterWrite,importCompleted(count,total){notice='Importação concluída: '+count+' despesa(s) confirmada(s), total '+money(total)+'. Os lançamentos estão na aba Controle.';redraw();},importContext(){if(!writable()||!loaded||loading||clinic!==id()||warnings.some(w=>w.startsWith('Despesas manuais indisponíveis')))return null;return {clinicId:id(),epoch,expenses:expenses.map(e=>({...e})),automatic:[...lab.filter(e=>e.kind!=='opening').map(e=>({id:'LABPAY-'+e.id,amount:model.cents(e.amount),date:e.paid_at})),...(sourceClinic===id()&&pmLvl('cm')>=1&&window.NexoModules?.isAllowed('commissions')===true?(db.cp||[]).map(e=>({id:'CP-'+e.id,amount:model.cents(e.valor),date:e.data})):[])],warnings:[...warnings]};}};
})();
