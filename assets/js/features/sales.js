/* ===== vendas ===== */
function stat(l,v,n){return `<div class="card" style="margin:0"><div class="note" style="margin:0">${l}</div><strong style="font-size:20px">${esc(v)}</strong>${n?`<div class="note" style="margin:0">${n}</div>`:''}</div>`}
/* Detalhamento financeiro: as seis métricas usam exatamente os dados do painel. */
function ovFinCard(label,value,sub,type){
  return `<button type="button" data-act="ovFinDetail" data-t="${type}" aria-haspopup="dialog" title="Ver detalhes: ${esc(label)}" class="card" style="margin:0;display:block;text-align:left;width:100%;color:inherit;font:inherit;cursor:pointer"><span class="note" style="display:block;margin:0">${esc(label)} ↗</span><strong style="font-size:20px">${brl(value)}</strong>${sub?`<span class="note" style="display:block;margin:0">${esc(sub)}</span>`:''}</button>`;
}
function salesPeriod() {
  const today=tdy(), current=today.slice(0,7), month=view.salesMonth||current;
  const all=salesForAccounting();
  const monthly=all.filter(v=>String(v.data||'').slice(0,7)===month);
  const todaySales=all.filter(v=>v.data===today);
  const payments=all.flatMap(v=>(v.pg||[]).filter(p=>String(p.data||'').slice(0,7)===month).map(p=>({v,p})));
  const historical=month<current;
  const pending=all.flatMap(v=>{
    if(historical&&(!v.data||v.data.slice(0,7)>month))return [];
    const paid=historical?(v.pg||[]).filter(p=>p.data&&p.data.slice(0,7)<=month).reduce((sum,p)=>sum+num(p.valor),0):recebido(v);
    const balance=historical?Math.max(0,r2(num(v.valor)-paid)):saldoV(v);
    return balance>0?[{v,paid,balance}]:[];
  });
  return {today,month,monthly,todaySales,payments,pending,historical};
}
function ovBudgetReceiptGroups(payments){
  const budgets=new Map();
  for(const patient of db.p||[]){
    for(const budget of patient.orcs||[]){
      for(const item of budget.itens||[]){
        for(const id of [item.paymentSaleId,item.vid]){
          if(id)budgets.set(JSON.stringify([String(patient.id),String(id)]),String(budget.id));
        }
      }
    }
  }
  const groups=new Map();
  payments.forEach(({v,p},index)=>{
    const budget=budgets.get(JSON.stringify([String(v.pid),String(v.id)]));
    const method=ovFeeMethod(p.forma)||'—';
    const key=budget?JSON.stringify([v.pid,budget,p.data,method]):index;
    if(!groups.has(key))groups.set(key,{method,indices:[],gross:0,fee:0});
    const group=groups.get(key);
    group.indices.push(index);
    group.gross=r2(group.gross+num(p.valor));
    group.fee=r2(group.fee+ovFeeTax(p));
  });
  return [...groups.values()];
}
function ovFinDetail(type){
  const {month,monthly,todaySales,payments,pending,historical}=salesPeriod();
  const types={today:['Vendas de hoje',todaySales,'sale'],month:['Vendas do mês',monthly,'sale'],received:['Recebido no mês',payments,'payment'],pending:[historical?'A receber no fim do mês':'A receber de pacientes',pending,'pending'],commission:['Comissões do mês',monthly,'commission'],net:['Sobra após comissões (mês)',monthly,'net']};
  const selected=types[type];if(!selected)return;
  const [title,items,kind]=selected;
  const amount=kind==='payment'?payments.reduce((s,x)=>s+num(x.p.valor),0):kind==='pending'?pending.reduce((s,item)=>s+item.balance,0):kind==='commission'?sum(monthly,'rep'):kind==='net'?sum(monthly,'valor')-sum(monthly,'rep'):sum(items,'valor');
  const headers=kind==='payment'?['Data do recebimento','Paciente','Procedimento','Forma','Recebido','Taxa','Líquido']:kind==='pending'?['Data da venda','Paciente','Procedimento','Recebido','Pendente']:kind==='commission'?['Data','Paciente','Dentista','Procedimento','Comissão']:kind==='net'?['Data','Paciente','Venda','Comissão','Sobra']:['Data','Paciente','Procedimento','Valor'];
  // A exportação reutiliza exatamente os dados apresentados na janela.
  const reportRows=items.map(item=>{
    const v=kind==='payment'||kind==='pending'?item.v:item;
    if(kind==='payment')return [fd(item.p.data),pName(v.pid),v.proc||'Atendimento',item.p.forma||'—',brl(item.p.valor),brl(ovFeeTax(item.p)),brl(ovFeeNet(item.p))];
    if(kind==='pending')return [fd(v.data),pName(v.pid),v.proc||'Atendimento',brl(item.paid),brl(item.balance)];
    if(kind==='commission')return [fd(v.data),pName(v.pid),dName(v.dt),v.proc||'Atendimento',brl(v.rep)];
    if(kind==='net')return [fd(v.data),pName(v.pid),brl(v.valor),brl(v.rep),brl(num(v.valor)-num(v.rep))];
    return [fd(v.data),pName(v.pid),v.proc||'Atendimento',brl(v.valor)];
  });
  const canEditFees=kind==='payment'&&ME?.admin;
  const cells=row=>row.map((value,i)=>`<td data-label="${esc(headers[i])}">${esc(value)}</td>`).join('');
  const rows=reportRows.map((row,index)=>{
    const payment=canEditFees?payments[index]:null;
    const action=payment&&ovFeeApplies(payment.p.forma)?`<button type="button" class="ghost sm" data-act="ovFeeEdit" data-id="${esc(payment.v.id)}" data-pg="${esc(payment.p.id)}">Corrigir taxa</button>`:'';
    return `<tr>${cells(row)}${canEditFees?`<td>${payment?`<button type="button" class="ghost sm" data-act="ovPaymentMethodEdit" data-id="${esc(payment.v.id)}" data-pg="${esc(payment.p.id)}">Corrigir forma</button> `:''}${action}</td>`:''}</tr>`;
  });
  let exportRows=reportRows;
  let visibleRows=rows;
  if(kind==='payment'){
    const groups=ovBudgetReceiptGroups(payments);
    exportRows=groups.map(group=>{
      const original=reportRows[group.indices[0]];
      return group.indices.length===1?original:[original[0],original[1],'Orçamento · total por forma',group.method,brl(group.gross),brl(group.fee),brl(r2(group.gross-group.fee))];
    });
    visibleRows=groups.map((group,index)=>{
      if(group.indices.length===1)return rows[group.indices[0]];
      const anchor=payments[group.indices[0]];
      const columns=headers.length+Number(Boolean(canEditFees));
      const parts=group.indices.map(i=>rows[i]).join('');
      const edit=canEditFees?`<td><button type="button" class="ghost sm" data-act="ovPaymentMethodEdit" data-id="${esc(anchor.v.id)}" data-pg="${esc(anchor.p.id)}" data-group="1">Editar recebimento</button></td>`:'';
      return `<tr class="ov-fin-group">${cells(exportRows[index])}${edit}</tr>
        <tr class="ov-fin-parts"><td colspan="${columns}"><details><summary>${group.indices.length} lançamentos por procedimento</summary><table class="ov-fin-detail-table" aria-label="Lançamentos por procedimento"><tbody>${parts}</tbody></table></details></td></tr>`;
    });
  }
  window.ovFinCurrentReport={title,headers,rows:exportRows,total:brl(amount),count:exportRows.length,period:type==='today'?tdy():month};
  const dialog=document.getElementById('ov-fin-detail-dialog');if(!dialog)return;
  dialog.innerHTML=`<div class="ov-fin-detail-heading"><h2 id="ov-fin-detail-title" style="margin:0">${esc(title)}</h2><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="sm" data-act="ovFinPdf">⬇ Gerar PDF</button><form method="dialog"><button type="submit" class="ghost sm">✕ Fechar</button></form></div></div><p class="note" style="margin:12px 0">${exportRows.length} registro(s) · Total: <strong>${brl(amount)}</strong></p><div class="ov-fin-detail-scroll"><table class="ov-fin-detail-table"><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}${canEditFees?'<th scope="col">Ação</th>':''}</tr></thead><tbody>${visibleRows.join('')||`<tr><td colspan="${headers.length+Number(Boolean(canEditFees))}" style="padding:16px">Nenhum registro encontrado.</td></tr>`}</tbody></table></div><p style="text-align:right"><strong>Total: ${brl(amount)}</strong></p>`;
  if(!dialog.open)dialog.showModal();
}
function ovEditReceiptMethod(saleId,receiptId,wholeGroup=false){
  if(!ME?.admin||view.h!=='vd')return;
  const sale=db.vd.find(v=>v.id===saleId), receipt=sale?.pg.find(p=>p.id===receiptId);
  if(!receipt||document.getElementById('ov-payment-method-dialog'))return;
  let parts=[{v:sale,p:receipt}];
  if(wholeGroup){
    const {payments}=salesPeriod();
    const anchor=payments.findIndex(part=>part.v===sale&&part.p===receipt);
    const group=ovBudgetReceiptGroups(payments).find(group=>group.indices.includes(anchor));
    if(!group||group.indices.length<2)return;
    parts=group.indices.map(index=>payments[index]);
  }
  const gross=r2(parts.reduce((sum,{p})=>sum+num(p.valor),0));
  const previousFee=r2(parts.reduce((sum,{p})=>sum+ovFeeTax(p),0));
  const linked=wholeGroup||sale.plano?.some(part=>part.pgid===receipt.id);
  const dialog=document.createElement('dialog');
  dialog.id='ov-payment-method-dialog';
  dialog.setAttribute('aria-labelledby','ov-payment-method-title');
  dialog.className='ov-fin-detail-dialog';
  dialog.innerHTML=`<form><h2 id="ov-payment-method-title">Corrigir forma do recebimento</h2>
    <p>${esc(pName(sale.pid))} · ${esc(fd(receipt.data))} · ${brl(gross)}${wholeGroup?` · ${parts.length} lançamentos por procedimento`:''}</p>
    <label>Forma de pagamento<select name="first" required><option value="">Selecione</option>${ovFeeOptions(ovFeeMethod(receipt.forma))}</select></label>
    ${linked?'':`<details><summary>Dividir em duas formas</summary>
      <label>Valor na segunda forma (R$)<input name="split" inputmode="decimal" placeholder="0,00"></label>
      <label>Segunda forma<select name="second">${ovFeeOptions('Crédito à vista')}</select></label>
    </details>`}
    <label>Taxa efetiva (%) <input name="rate" type="number" min="0" max="100" step="0.01" placeholder="Opcional"></label>
    <p class="note">A correção mantém a data e o total pago. Ao trocar a forma, a taxa configurada é aplicada ao recebimento e ao total do mês.</p>
    <p data-fee-preview aria-live="polite"></p><p role="alert" class="note"></p><button type="submit">Salvar correção</button> <button type="button" class="ghost" data-cancel>Cancelar</button></form>`;
  const form=dialog.querySelector('form'), feedback=form.querySelector('[role="alert"]');
  form.querySelector('[data-cancel]').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  const preview=form.querySelector('[data-fee-preview]');
  function calculate(){
    const secondValue=r2(num(form.elements.split?.value));
    const first=form.elements.first.value, second=form.elements.second?.value;
    if(secondValue<0||secondValue>=gross)return {error:'Informe um valor menor que o total na segunda forma.'};
    if(secondValue>0&&first===second)return {error:'Selecione duas formas diferentes.'};
    const rawRate=form.elements.rate.value;
    const rate=ovFeeReadRate(rawRate);
    if(rawRate&&rate===null)return {error:'Informe uma taxa entre 0% e 100%.'};
    const firstReceipt=ovFeeMake(r2(gross-secondValue),first,receipt.data,receipt.id,rate);
    const keepsRate=rate===null&&first===ovFeeMethod(receipt.forma)&&(!secondValue||!ovFeeNeedsReview(receipt));
    if(keepsRate){
      const fee=r2(previousFee*firstReceipt.valor/gross);
      Object.assign(firstReceipt,{taxaPct:ovFeeReadRate(receipt.taxaPct)??0,taxaValor:fee,
        taxaOrigem:receipt.taxaOrigem||'manual',liquido:r2(firstReceipt.valor-fee)});
    }
    const secondReceipt=secondValue>0?ovFeeMake(secondValue,second,receipt.data,receipt.id):null;
    return {firstReceipt,secondReceipt,keepsRate};
  }
  function showFeePreview(){
    const {error,firstReceipt,secondReceipt}=calculate();
    feedback.textContent=error||'';
    if(error){preview.textContent='';return}
    const fee=r2(firstReceipt.taxaValor+(secondReceipt?.taxaValor||0));
    const missingRate=[firstReceipt,secondReceipt].some(part=>part&&ovFeeNeedsReview(part));
    preview.textContent='Taxa: '+brl(previousFee)+' → '+brl(fee)+' · Líquido após correção: '+brl(r2(gross-fee))
      +(missingRate?' · Confira a taxa da operadora para a forma selecionada.':'');
  }
  form.addEventListener('input',showFeePreview);
  showFeePreview();
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(LOCKED||!ME?.admin||parts.some(({v,p})=>!db.vd.includes(v)||!v.pg.includes(p)))return;
    const {error,firstReceipt,secondReceipt,keepsRate}=calculate();
    if(error){feedback.textContent=error;return}
    if(!secondReceipt&&keepsRate){dialog.close();return}
    if(secondReceipt)secondReceipt.id=uid();
    const em=new Date().toISOString();
    let allocated=0;
    for(const {v,p} of parts){
      const before={forma:p.forma,valor:p.valor,taxaPct:p.taxaPct,taxaValor:p.taxaValor,taxaOrigem:p.taxaOrigem};
      (p.taxaAjustes??=[]).push({em,por:ME.id,anterior:before,divididoEm:secondReceipt?.id});
      if(wholeGroup){
        const value=num(p.valor);
        const next=r2(allocated+value);
        const fee=r2(r2(firstReceipt.taxaValor*next/gross)-r2(firstReceipt.taxaValor*allocated/gross));
        Object.assign(p,{forma:firstReceipt.forma,taxaPct:firstReceipt.taxaPct,taxaOrigem:firstReceipt.taxaOrigem,taxaValor:fee,liquido:r2(value-fee)});
        allocated=next;
      }else{
        Object.assign(p,firstReceipt);
        if(secondReceipt)v.pg.splice(v.pg.indexOf(p)+1,0,secondReceipt);
      }
    }
    save();dialog.close();render();ovFinDetail('received');
    try{
      await window.OralCloudSync?.flush();
      toast('Forma, taxa e valor líquido atualizados.');
    }catch{
      toast('A correção ainda está pendente de gravação. Confira o status de sincronização.');
    }
  });
  document.body.append(dialog);
  dialog.showModal();
}
async function ovFinPdf(){
  const report=window.ovFinCurrentReport;
  if(!report){toast('Abra um cartão financeiro antes de gerar o PDF.',3000);return;}
  if(!(await ensureJsPDF())){toast('Não foi possível carregar o gerador de PDF. Verifique sua conexão.',3500);return;}
  try{
    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const clean=x=>String(x==null?'':x).replace(/[−–—]/g,'-').replace(/[^\u0000-\u00FF]/g,'?');
    const widths=report.headers.length===7?[28,49,65,36,32,30,33]:report.headers.length===4?[31,77,126,39]:[31,65,74,58,39];
    const left=12,right=285;
    let y=15,page=1;
    function heading(){
      doc.setFillColor(201,99,0);doc.rect(0,0,297,9,'F');
      doc.setFont('helvetica','bold');doc.setTextColor(35,35,35);doc.setFontSize(15);
      doc.text('ORAL VALLE - '+clean(report.title),left,18);
      doc.setFont('helvetica','normal');doc.setFontSize(9);
      doc.text('Periodo: '+clean(report.period)+'   |   Registros: '+report.count+'   |   Total: '+clean(report.total),left,25);
      y=32;doc.setFillColor(235,235,235);doc.rect(left,y-5,right-left,9,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(9);
      let x=left;report.headers.forEach((h,i)=>{doc.text(clean(h),x+2,y,{maxWidth:widths[i]-4});x+=widths[i]});
      y+=8;
    }
    heading();
    for(let idx=0;idx<report.rows.length;idx++){
      const row=report.rows[idx];
      doc.setFont('helvetica','normal');doc.setFontSize(9);
      const lines=row.map((cell,i)=>doc.splitTextToSize(clean(cell),widths[i]-4));
      const height=Math.max(9,...lines.map(l=>l.length*4+4));
      if(y+height>190){doc.setFontSize(8);doc.text('Pagina '+page,270,204);doc.addPage();page++;heading()}
      if(idx%2===0){doc.setFillColor(247,247,247);doc.rect(left,y-5,right-left,height,'F')}
      doc.setTextColor(30,30,30);
      let x=left;lines.forEach((l,i)=>{doc.text(l,x+2,y);x+=widths[i]});
      y+=height;
    }
    if(!report.rows.length){doc.setFontSize(10);doc.text('Nenhum registro encontrado.',left+2,y+3)}
    doc.setFont('helvetica','bold');doc.setFontSize(10);
    if(y+12>190){doc.addPage();page++;heading()}
    doc.text('TOTAL: '+clean(report.total),right,y+7,{align:'right'});
    doc.setFontSize(8);doc.text('Pagina '+page,270,204);
    const filename='oralvalle_'+report.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_')+'_'+report.period+'.pdf';
    doc.save(filename);
  }catch(e){console.error(e);toast('Não foi possível gerar o PDF.',3500)}
}
function fillRep(src){
  const pn=$('vpr').value.trim();
  if(src==='vpr'){const m=procBy(pn);if(m&&m.preco&&!$('vv').value)$('vv').value=m.preco}
  const vv=num($('vv').value),c=comCalc($('vdn').value,pn,vv,(view.pre&&view.pre.qtd)||1);
  $('vr').value=c.rep?c.rep.toFixed(2):'';
  const rc=$('vrc');if(!rc.dataset.touched)rc.value=vv?vv.toFixed(2):'';
  fmtMoney(document);
  ovFeeUpdatePreview(false);
}
function vdCard(x,snapshot){
  const rc=snapshot?snapshot.paid:recebido(x),sd=snapshot?snapshot.balance:saldoV(x),st=sd<=0?['Pago','stt-ok']:rc>0?['Parcial','']:['A receber','stt-wr'];
  return `<div class="card"><div class="ag"><span><strong>${fd(x.data)} · ${esc(pName(x.pid))}</strong><br>${esc(x.proc||'Atendimento')} · ${esc(dName(x.dt))}</span><span style="text-align:right"><strong>${brl(x.valor)}</strong><br><span class="note" style="margin:0">Comissão ${brl(x.rep)}</span></span></div>
  <div class="row" style="margin:8px 0 4px;flex-wrap:wrap"><span class="badge ${st[1]}" style="flex:none">${st[0]}</span><span class="note" style="margin:0">Recebido ${brl(rc)} de ${brl(x.valor)}</span></div>
  ${snapshot?'':x.pg.map(p=>`<div class="pg"><span>${fd(p.data)} · ${esc(p.forma)}${ovFeeSummary(p)}</span><span>${brl(p.valor)} <button class="danger sm" data-act="rmpg" data-id="${esc(x.id)}" data-pg="${esc(p.id)}" aria-label="Remover recebimento">${delArm===p.id?'Confirmar':'×'}</button></span></div>`).join('')}
  ${!snapshot&&sd>0?`<div data-rcv-row style="margin-top:8px"><div class="row"><input data-rcv="${esc(x.id)}" inputmode="decimal" value="${sd.toFixed(2)}" aria-label="Valor recebido"><select data-rcvf="${esc(x.id)}" aria-label="Forma de pagamento">${ovFeeOptions()}</select><button class="sm" data-act="rcv" data-id="${esc(x.id)}">Receber</button></div><p class="note" role="status" data-rcv-fee style="margin:4px 0 0">${esc(ovFeeReceiptPreview('Pix',sd))}</p></div>`:''}
  ${snapshot?'':`<button class="danger sm" data-act="rmvd" data-id="${esc(x.id)}" style="margin-top:8px">${delArm===x.id?'Toque de novo para excluir':'Excluir venda'}</button>`}</div>`;
}
function vdHtml(){
  const {today:t,month:m,todaySales:dia,monthly:mes,payments,pending,historical}=salesPeriod(), sv=view.sv||'dia';
  let pre={};
  if(view.pre){pre=view.pre;view.pre=null;view.link=(pre.oid||pre.ag)?{oid:pre.oid,ii:pre.ii,ag:pre.ag,pid:pre.pid}:null}
  const recMes=payments.reduce((total,{p})=>total+num(p.valor),0);
  const aRec=pending.reduce((total,item)=>total+item.balance,0);
  const taxasMes=payments.reduce((total,{p})=>total+ovFeeTax(p),0);
  const feesToReview=payments.filter(({p})=>ovFeeNeedsReview(p)).length;
  let h=`<div class="card" data-ro-ok style="margin:0 0 12px"><label for="sales-month">Mês de referência</label><input id="sales-month" type="month" max="${t.slice(0,7)}" value="${esc(m)}"></div>`+
    '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px">'+ovFinCard('Vendas de hoje',sum(dia,'valor'),dia.length+' atendimento(s)','today')+ovFinCard('Vendas do mês',sum(mes,'valor'),mes.length+' atendimento(s)','month')+ovFinCard('Recebido no mês',recMes,'','received')+ovFinCard(historical?'A receber no fim do mês':'A receber de pacientes',aRec,'','pending')+ovFinCard('Comissões do mês',sum(mes,'rep'),'','commission')+ovFinCard('Sobra após comissões (mês)',sum(mes,'valor')-sum(mes,'rep'),'','net')+'</div>';
  h+=`<div class="card" style="margin:10px 0"><b>Taxas da operadora no mês: ${brl(taxasMes)}</b><br><b>Recebimento líquido do mês: ${brl(r2(recMes-taxasMes))}</b><p class="note" style="margin:4px 0 0">Recebido bruto menos taxas registradas.</p>
    ${feesToReview?`<p class="note">${feesToReview} recebimento(s) de Pix ou cartão com taxa zero ou sem taxa confirmada.</p>`:''}
    ${payments.length?'<button type="button" class="ghost sm" data-act="ovFinDetail" data-t="received">Conferir taxas dos recebimentos</button> ':''}
    ${ME?.admin?'<button type="button" class="ghost sm" data-act="cfgFinanceRates">Configurar taxas</button>':''}</div>`;
  h+='<dialog id="ov-fin-detail-dialog" aria-labelledby="ov-fin-detail-title" class="ov-fin-detail-dialog"></dialog>';
  const pts=db.p.filter(p=>!p.arq||p.id===pre.pid),dts=db.dt.filter(d=>d.ativo!==false||d.id===pre.dt);
  if(!pts.length||!dts.length)h+='<div class="empty">Cadastre ao menos um paciente e um dentista ativo para lançar vendas.</div>';
  else{
    const dsel=pre.dt||'',val=pre.valor?String(pre.valor):'',cr=(dsel&&val)?comCalc(dsel,pre.proc||'',num(val),pre.qtd).rep:0;
    h+=`<details class="card nexo-data-fold" style="margin:10px 0" ${pre.ag||pre.oid?'open':''}><summary style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;list-style:none;font-weight:700;font-size:15px;user-select:none">Dar baixa no atendimento</summary><div style="margin-top:14px">${pre.ag||pre.oid?'<p class="note" style="margin:0 0 4px">Dados preenchidos a partir da '+(pre.ag?'agenda':'aprovação do orçamento')+'. Confira antes de lançar.</p>':''}<label for="vp">Paciente</label><select id="vp" onchange="var b=document.querySelector('[data-act=addvd]');if(b)b.disabled=!this.value"><option value="">Selecione o paciente</option>${pts.map(p=>`<option value="${esc(p.id)}"${p.id===pre.pid?' selected':''}>${esc(p.nome)}</option>`).join('')}</select><label for="vdn">Dentista que executou</label><select id="vdn">${dentOpts(dsel,'Selecione o dentista')}</select><label for="vpr">Procedimento</label><input id="vpr" list="prl" placeholder="Escolha ou digite" value="${esc(pre.proc||'')}" autocomplete="off">${prList()}
    <div class="row"><div><label for="vv">Valor (R$)</label><input id="vv" inputmode="decimal" value="${esc(val)}"></div><div><label for="vr">Comissão (R$)</label><input id="vr" inputmode="decimal" value="${cr?cr.toFixed(2):''}"></div></div>
    <p class="note" style="margin:6px 0 0">A comissão percentual é calculada somente após descontar hora clínica, materiais e laboratório. Você pode ajustar o valor.</p>
    <div class="row"><div><label for="vrc">Recebido agora (R$)</label><input id="vrc" inputmode="decimal" value="${val}"></div><div><label for="vfm">Forma</label><select id="vfm">${ovFeeOptions()}</select></div></div>
    ${ovFeeSalePreview(val)}
    <p class="note" style="margin:6px 0 0">O paciente quita o valor bruto pago; a taxa da operadora é descontada apenas do líquido da clínica. Se ainda não pagou, coloque 0.</p>
    <label for="vdt">Data</label><input id="vdt" type="date" value="${t}"><div style="margin-top:12px"><button data-act="addvd" style="width:100%"${pre.pid?'':' disabled'}>Dar baixa e lançar venda</button></div></div></details>`;
  }
  if(pmSee('cm'))h+=commissionReview(m,mes);
  h+=`<div class="row" style="margin-bottom:10px"><button class="sm${sv==='dia'?'':' ghost'}" data-act="svw" data-t="dia">Hoje</button><button class="sm${sv==='mes'?'':' ghost'}" data-act="svw" data-t="mes">Mês</button><button class="sm${sv==='rec'?'':' ghost'}" data-act="svw" data-t="rec">A receber</button></div>`;
  const l=(sv==='dia'?dia:sv==='mes'?mes:pending.map(item=>item.v)).slice().reverse();
  const pageSize=50,pages=Math.max(1,Math.ceil(l.length/pageSize));
  view.vPage=Math.min(Math.max(0,Number(view.vPage)||0),pages-1);
  const visible=l.slice(view.vPage*pageSize,(view.vPage+1)*pageSize);
  const pager=l.length>pageSize?`<div class="row" style="justify-content:space-between;margin-top:12px"><span class="note" style="margin:0">Página ${view.vPage+1} de ${pages} · ${l.length} lançamentos</span><span class="row" style="flex:none;gap:6px"><button class="ghost sm" data-act="vPage" data-p="${view.vPage-1}"${view.vPage===0?' disabled':''}>Anterior</button><button class="ghost sm" data-act="vPage" data-p="${view.vPage+1}"${view.vPage>=pages-1?' disabled':''}>Próxima</button></span></div>`:'';
  return h+(visible.length?visible.map(v=>vdCard(v,historical&&sv==='rec'?pending.find(item=>item.v===v):null)).join(''):'<div class="empty">'+(sv==='rec'?'Nenhum valor a receber.':'Nenhuma venda '+(sv==='dia'?'hoje.':'neste mês.'))+'</div>')+pager;
}
