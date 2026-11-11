/* Cobranças preparadas: nenhum pagamento é emitido ou baixado sem integração. */
(function(root){
 'use strict';
 const methods=['pix','credit_card','debit_card'];
 const labels={pix:'Pix',credit_card:'Cartão de crédito',debit_card:'Cartão de débito'};
 function prepare({amountCents,method,dueDate,installments=1,id}){
  if(!Number.isSafeInteger(amountCents)||amountCents<=0)throw Error('Informe um valor maior que zero.');
  if(!methods.includes(method))throw Error('Selecione Pix, crédito ou débito.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)||!Number.isFinite(Date.parse(dueDate))||new Date(dueDate+'T12:00:00Z').toISOString().slice(0,10)!==dueDate)throw Error('Informe um vencimento válido.');
  if(!Number.isInteger(installments)||installments<1||installments>60||installments>amountCents)throw Error('Informe de 1 a 60 parcelas, de pelo menos um centavo.');
  if(method!=='credit_card'&&installments!==1)throw Error('O parcelamento está disponível apenas para cartão de crédito.');
  const [year,month,day]=dueDate.split('-').map(Number),base=Math.floor(amountCents/installments),extra=amountCents%installments;
  const schedule=Array.from({length:installments},(_,i)=>{
   const date=new Date(Date.UTC(year,month-1+i,1,12));
   const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
   date.setUTCDate(Math.min(day,last));
   return {number:i+1,amountCents:base+(i<extra?1:0),dueDate:date.toISOString().slice(0,10)};
  });
  return {id,version:1,status:'awaiting_integration',currency:'BRL',amountCents,method,dueDate,installments,schedule,createdAt:new Date().toISOString(),provider:null,providerChargeId:null,pix:null,checkoutUrl:null};
 }
 const model={prepare,labels};
 if(typeof module==='object'&&module.exports){module.exports=model;return;}
 root.NexoBudgetBilling=model;
 root.budgetBillingHtml=function(o){
  const rows=(o.billingDrafts||[]).map(x=>`<li><strong>${esc(labels[x.method]||x.method)} · ${brl(x.amountCents/100)}</strong> · ${esc(fd(x.dueDate))} · ${x.installments}x <span class="badge">Aguardando integração</span><details><summary>Ver parcelas</summary>${x.schedule.map(s=>`<div>${s.number} · ${esc(fd(s.dueDate))} · ${brl(s.amountCents/100)}</div>`).join('')}</details><button type="button" class="ghost sm" data-act="billingRemove" data-o="${esc(o.id)}" data-billing="${esc(x.id)}">Remover preparação</button></li>`).join('');
  return `<section class="card" style="margin-top:12px"><h3>Cobrança por Pix ou cartão</h3><p class="note">Prepare os dados da cobrança. Para emitir QR Code Pix, copia e cola ou link de cartão, conecte um serviço de pagamento. Nenhum recebimento será registrado nesta etapa.</p>
  <div class="row"><div><label>Valor a cobrar (R$)</label><input data-billing-amount inputmode="decimal" placeholder="Valor da entrada ou do saldo"></div><div><label>Primeiro vencimento</label><input data-billing-due type="date" value="${tdy()}"></div></div>
  <div class="row"><div><label>Forma de cobrança</label><select data-billing-method>${methods.map(m=>`<option value="${m}">${labels[m]}</option>`).join('')}</select></div><div><label>Parcelas (somente crédito)</label><input data-billing-installments type="number" min="1" max="60" value="1"></div></div>
  <button type="button" data-act="billingPrepare" data-o="${esc(o.id)}" style="margin-top:10px">Preparar cobrança</button><p class="note" role="status">Integração de pagamentos não configurada.</p>${rows?`<ul>${rows}</ul>`:''}</section>`;
 };
 A.billingPrepare=(button,data,patient)=>{
  const budget=patient&&getO(patient,data.o);if(!budget)return;
  const card=button.closest('section'),read=s=>card.querySelector(s).value;
  try{
   const amountCents=Math.round(num(read('[data-billing-amount]'))*100);
   const allocated=(budget.billingDrafts||[]).reduce((sum,d)=>sum+d.amountCents,0);
   if(amountCents+allocated>Math.round(total(budget)*100))throw Error('As cobranças preparadas não podem ultrapassar o total do orçamento.');
   const draft=prepare({id:uid(),amountCents,method:read('[data-billing-method]'),dueDate:read('[data-billing-due]'),installments:Number(read('[data-billing-installments]'))});
   (budget.billingDrafts=budget.billingDrafts||[]).push(draft);save();render();toast('Cobrança preparada. Emissão aguardando integração.');
  }catch(error){toast(error.message,4000);}
 };
 A.billingRemove=(button,data,patient)=>{
  const budget=patient&&getO(patient,data.o);if(!budget)return;
  budget.billingDrafts=(budget.billingDrafts||[]).filter(d=>d.id!==data.billing||d.status!=='awaiting_integration');save();render();
 };
})(typeof window==='object'?window:globalThis);
