/* Oral Valle 062: taxas editáveis e histórico imutável por recebimento. */
const OV_FEE_FORMS=['Pix','Dinheiro','Débito','Crédito à vista',...Array.from({length:11},(_,i)=>`Crédito ${i+2}x`),'Crédito','Crédito parcelado','Boleto','Financiamento','Transferência','Outro'];
function ovFeeRates(){
  // Consultar/calcular uma taxa não deve criar configurações administrativas.
  const rates=db.taxasPagamento;
  return rates&&typeof rates==='object'&&!Array.isArray(rates)?rates:{};
}
function ovFeeMethod(forma){
  const key=String(forma||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  if(/pix/.test(key))return 'Pix';
  if(/debito/.test(key))return 'Débito';
  if(/credito/.test(key)){
    const parcels=key.match(/\b(\d{1,2})\s*(?:x|parcelas?)\b/);
    if(parcels&&Number(parcels[1])>=2&&Number(parcels[1])<=60)return 'Crédito '+Number(parcels[1])+'x';
    if(parcels&&Number(parcels[1])===1)return 'Crédito à vista';
    return /parcelad/.test(key)||parcels?'Crédito parcelado':'Crédito à vista';
  }
  return forma;
}
function ovFeeReadRate(raw){
  if(raw==null||String(raw).trim()==='')return null;
  const value=Number(String(raw).trim().replace(',','.'));
  return Number.isFinite(value)&&value>=0&&value<=100?value:null;
}
function ovFeeConfiguredRate(forma){
  const key=ovFeeMethod(forma),rates=ovFeeRates();
  return ovFeeReadRate(rates[key]??(key==='Crédito à vista'?rates['Crédito']:/^Crédito (?:1[3-9]|[2-5][0-9]|60)x$/.test(key)?rates['Crédito parcelado']:null));
}
function ovFeePct(forma){return ovFeeConfiguredRate(forma)??0}
function ovFeeApplies(forma){return /^(Pix|Débito|Crédito)/.test(ovFeeMethod(forma)||'')}
function ovFeeNeedsReview(p){
  return ovFeeApplies(p.forma)&&ovFeeTax(p)===0&&(p.taxaOrigem==='sem_configuracao'||!p.taxaOrigem&&!(ovFeeReadRate(p.taxaPct)>0));
}
function ovFeeMake(valor,forma,data,id,override){
  const bruto=r2(Number(valor)), manual=ovFeeReadRate(override), configured=ovFeeConfiguredRate(forma);
  const taxaPct=manual??configured??0;
  const taxaValor=r2(bruto*taxaPct/100);
  const taxaOrigem=manual!==null?'manual':configured!==null?'configurada':'sem_configuracao';
  return {id:id||uid(),data,valor:bruto,forma,taxaPct,taxaValor,taxaOrigem,liquido:r2(bruto-taxaValor)};
}
function ovFeeTax(p){
  const raw=p.taxaValor,amount=Number(String(raw??'').trim().replace(',','.'));
  const pct=ovFeeReadRate(p.taxaPct);
  if(raw!=null&&String(raw).trim()!==''&&Number.isFinite(amount)&&amount>=0&&(amount>0||!pct||p.taxaOrigem))return amount;
  return pct===null?0:r2(num(p.valor)*pct/100);
}
function ovFeeNet(p){return r2(num(p.valor)-ovFeeTax(p))}
function ovFeeSummary(p){return `<small class="note" style="display:block;margin:3px 0">Taxa ${brl(ovFeeTax(p))} (${ovFeeReadRate(p.taxaPct)??0}%) · <b>Líquido ${brl(ovFeeNet(p))}</b></small>`}
function ovFeeOptions(sel){const forms=/^Crédito (?:1[3-9]|[2-5][0-9]|60)x$/.test(sel)?[...OV_FEE_FORMS,sel]:OV_FEE_FORMS;return forms.map(f=>`<option${f===sel?' selected':''}>${f}</option>`).join('')}
function ovFeeSettings(){
 const rows=OV_FEE_FORMS.filter(f=>f!=='Crédito'&&f!=='Outro').map(f=>`<label style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin:5px 0"><span>${esc(f)}</span><span style="display:flex;align-items:center;gap:5px"><input type="number" min="0" max="100" step="0.01" inputmode="decimal" data-fee-rate="${esc(f)}" value="${ovFeePct(f)}" style="max-width:100px">%</span></label>`).join('');
 return `<details class="card" style="margin-bottom:12px"><summary style="cursor:pointer;font-weight:700">⚙️ Configurar taxas das formas de pagamento</summary><p class="note">Taxas padrão em %. Edite e salve. Cada recebimento mantém a taxa aplicada na data, mesmo após alterações.</p><div style="max-width:500px">${rows}</div><button class="sm" data-act="ovFeeSave" type="button" style="margin-top:10px">Salvar taxas</button></details>`;
}
function ovFeeSalePreview(valor){const pct=ovFeeConfiguredRate('Pix'), fee=r2(num(valor)*(pct??0)/100);return `<div class="row" style="align-items:flex-end;margin-top:7px"><div><label for="ovFeeOverride">Taxa desta venda (%) — editável</label><input id="ovFeeOverride" type="number" min="0" max="100" step="0.01" inputmode="decimal" placeholder="${pct===null?'Sem taxa configurada':pct+'% (padrão)'}"></div><div id="ovFeePreview" role="status" class="note" style="margin:0">${pct===null?'Pix sem taxa configurada. Informe a taxa desta operação.':'Taxa: '+brl(fee)+' · Líquido da clínica: '+brl(num(valor)-fee)}</div></div>`}
function ovFeeUpdatePreview(reset){const f=document.getElementById('vfm'),a=document.getElementById('vrc'),t=document.getElementById('ovFeeOverride'),box=document.getElementById('ovFeePreview');if(!f||!a||!t||!box)return;
 const configured=ovFeeConfiguredRate(f.value);
 if(reset){t.value='';t.placeholder=configured===null?'Sem taxa configurada':configured+'% (padrão)';}
 const n=t.value===''?configured:ovFeeReadRate(t.value),val=num(a.value);
 if(t.validity.badInput||(t.value!==''&&n===null)){box.textContent='Taxa inválida (0 a 100%)';return}
 if(n===null&&ovFeeApplies(f.value)){box.textContent='Sem taxa configurada. Informe a taxa desta operação.';return}const fee=r2(val*(n??0)/100);box.textContent='Taxa: '+brl(fee)+' · Líquido da clínica: '+brl(val-fee);
}
function ovFeeReceiptPreview(forma,valor){
  const rate=ovFeeConfiguredRate(forma);
  if(rate===null&&ovFeeApplies(forma))return 'Sem taxa configurada para '+forma+'.';
  const fee=r2(num(valor)*(rate??0)/100);
  return 'Taxa: '+brl(fee)+' · Líquido da clínica: '+brl(num(valor)-fee);
}
function ovFeeUpdateReceiptPreview(field){
  const row=field.closest('[data-rcv-row]');
  if(!row)return;
  row.querySelector('[data-rcv-fee]').textContent=ovFeeReceiptPreview(row.querySelector('[data-rcvf]').value,row.querySelector('[data-rcv]').value);
}
document.addEventListener('input',e=>{
  if(e.target.matches('#vrc,#ovFeeOverride'))ovFeeUpdatePreview(false);
  if(e.target.matches('[data-rcv]'))ovFeeUpdateReceiptPreview(e.target);
});
document.addEventListener('change',e=>{
  if(e.target.matches('#vfm'))ovFeeUpdatePreview(true);
  if(e.target.matches('[data-rcvf]'))ovFeeUpdateReceiptPreview(e.target);
});
function ovFeeSaveAction(){if(typeof ME!=='undefined'&&ME&&!ME.admin){toast('Somente administradores podem alterar as taxas da clínica.');return}const r={...ovFeeRates()};for(const el of document.querySelectorAll('[data-fee-rate]')){const n=Number(el.value);if(el.value===''||!Number.isFinite(n)||n<0||n>100){toast('Informe taxas entre 0 e 100%');return}r[el.dataset.feeRate]=n}db.taxasPagamento=r;save();toast('Taxas de pagamento salvas');render()}



/* Configuracoes financeiras: parametros armazenados separadamente das taxas por transacao. */
function ovFinanceSettings(){
 const cfg=db.financeiroConfig||{};
 const selectedTab=window.ovSelectedFinanceTab||'Dinheiro';
 const options=[
  ['Dinheiro','Dinheiro','Confirmação do recebimento'],
  ['Pix','PIX','Taxa por pagamento'],
  ['Boleto','Boleto','Custo, vencimento e prazo'],
  ['Financiamento','Financiamento','Taxa mensal e prazo'],
  ['Débito','Cartão de débito','Taxa e prazo'],
  ['Crédito à vista','Crédito à vista','Taxa e prazo'],
  ['Crédito parcelado','Crédito parcelado','Taxas por parcela e antecipação'],
  ['Conciliacao','Conciliação','Diferença aceita em reais']
 ];
 const grid=body=>`<div class="ov-fin-fields">${body}</div>`;
 const card=(key,title,body)=>`<section class="cfg-card ov-fin-panel" aria-label="${title}" id="fin-${key}" ${key!==selectedTab?'hidden':''}><h2>${title}</h2>${body}</section>`;
 const field=(key,label,defaultValue='0')=>`<label>${label}<input type="number" min="0" step="0.01" inputmode="decimal" data-fin-key="${key}" value="${esc(cfg[key]??defaultValue)}"></label>`;
 const mode=key=>`<label>Baixa no Contas a Receber<select data-fin-key="${key}_baixa"><option value="manual" ${cfg[key+'_baixa']!=='auto'?'selected':''}>Manual — confirmar recebimento</option><option value="auto" ${cfg[key+'_baixa']==='auto'?'selected':''}>Automática — na data prevista</option></select><small>A opção automática é salva para integração futura. A baixa ainda precisa ser confirmada manualmente.</small></label>`;
 const days=(key,label='Prazo de recebimento (dias)')=>field(key+'_dias',label);
 const rate=(key,label='Taxa (%)')=>`<label>${label}<input type="number" min="0" max="100" step="0.01" inputmode="decimal" data-fee-rate="${esc(key)}" value="${ovFeeConfiguredRate(key)??''}" placeholder="Sem taxa configurada"></label>`;
 const methods=options.map(([key,label,description])=>`<button type="button" class="ov-fin-tab${key===selectedTab?' is-active':''}" aria-pressed="${key===selectedTab}" data-fin-tab="${key}"><strong>${label}</strong><small>${description}</small></button>`).join('');
 let panels=card('Dinheiro','Dinheiro',grid(mode('dinheiro')));
 panels+=card('Pix','PIX',grid(rate('Pix')+mode('pix')));
 panels+=card('Boleto','Boleto',grid(field('boleto_custo','Custo por operação (R$)')+days('boleto_vencimento','Vencimento (dias)')+days('boleto')+mode('boleto')));
 panels+=card('Financiamento','Financiamento',grid(field('financiamento_mensal','Taxa ao mês (%)')+days('financiamento')+mode('financiamento')));
 panels+=card('Débito','Cartão de débito',grid(rate('Débito')+days('debito')+mode('debito')));
 panels+=card('Crédito à vista','Crédito à vista',grid(rate('Crédito à vista')+days('credito_vista')+mode('credito_vista')));
 const installmentRates=Array.from({length:11},(_,i)=>rate('Crédito '+(i+2)+'x',(i+2)+' parcelas (%)')).join('');
 panels+=card('Crédito parcelado','Crédito parcelado',
  grid(field('credito_parcelas','Número máximo de parcelas','12')+days('credito_primeira','Prazo da primeira parcela (dias)')+field('credito_antecipacao','Taxa de antecipação (%)')+mode('credito_parcelado'))+
  `<fieldset class="ov-fin-installments"><legend>Taxas por quantidade de parcelas</legend>${grid(installmentRates)}</fieldset>`);
 panels+=card('Conciliacao','Conciliação',grid(field('tolerancia','Diferença máxima aceita (R$)')));
 return `<section class="cfg-financeiro" aria-label="Configurações financeiras">
   <div class="ov-fin-layout">
     <div class="ov-fin-methods"><h3 id="ov-fin-methods-heading">Formas de pagamento e conciliação</h3><div class="ov-fin-tabs" role="group" aria-labelledby="ov-fin-methods-heading">${methods}</div></div>
     <div class="ov-fin-editor">${panels}<footer class="ov-fin-footer"><button type="button" class="primary" data-act="ovFinanceSave">Salvar configurações financeiras</button></footer></div>
   </div>
 </section>`;
}
function ovFinanceSaveAction(){
 if(typeof ME!=='undefined'&&ME&&!ME.admin){toast('Somente administradores podem alterar as configurações financeiras.');return}
 const next={...(db.financeiroConfig||{})};const rates={...ovFeeRates()};
 for(const el of document.querySelectorAll('[data-fin-key]')){let value=el.value;if(el.type==='number'){value=Number(value);if(!Number.isFinite(value)||value<0){toast('Confira os valores financeiros');return}}next[el.dataset.finKey]=value}
 for(const el of document.querySelectorAll('.cfg-financeiro [data-fee-rate]')){
   const n=ovFeeReadRate(el.value);
   if(el.validity.badInput||el.value!==''&&n===null){toast('Taxas devem ficar entre 0% e 100%');return}
   if(el.dataset.feeRate==='Crédito à vista')delete rates['Crédito'];
   if(n===null)delete rates[el.dataset.feeRate];else rates[el.dataset.feeRate]=n;
 }
 db.financeiroConfig=next;db.taxasPagamento=rates;save();toast('Configurações financeiras salvas');render();
}

/* Navegação compacta: uma categoria financeira por vez. */
document.addEventListener('click',function(e){
 const tab=e.target.closest('.ov-fin-tab');if(!tab)return;
 const root=tab.closest('.cfg-financeiro');if(!root)return;
 window.ovSelectedFinanceTab=tab.dataset.finTab;
 root.querySelectorAll('.ov-fin-tab').forEach(b=>{const active=b===tab;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active))});
 root.querySelectorAll('.cfg-card').forEach(card=>{card.hidden=card.id!=='fin-'+tab.dataset.finTab});
});
