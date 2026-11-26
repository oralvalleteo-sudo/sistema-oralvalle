/* ===== comissões ===== */
function dtCommissionDetails(sales){
  const entries = sales.filter(sale => num(sale.rep) !== 0)
    .sort((a,b) => String(b.data||'').localeCompare(String(a.data||'')));
  return `<details class="dt-commission-details"><summary>Comissões por atendimento (${entries.length})</summary>
    ${entries.length ? entries.map(sale => {
      const released = liberada(sale);
      const patient = pmSee('pac') && sale.pid ? db.p.find(p => p.id === sale.pid)?.nome : '';
      return `<div class="pg" style="flex-wrap:wrap">
        <span><strong>${esc(sale.proc||'Atendimento')}</strong><br>${esc(fd(sale.data)||'Data não informada')}${patient?' · '+esc(patient):''}</span>
        <span>Gerada: ${brl(num(sale.rep))} · Liberada: ${brl(released)} · A liberar: ${brl(Math.max(0,r2(num(sale.rep)-released)))}</span>
      </div>`;
    }).join('') : '<p class="note">Nenhuma comissão por atendimento registrada.</p>'}
  </details>`;
}
function comHtml(){
  const m=view.cm||tdy().slice(0,7);
  const ds=db.dt.filter(d=>d.ativo!==false||dtMoves(d.id));
  let h=`<div class="tabs" style="margin-bottom:16px">${pmSee('dt')?'<button type="button" data-act="nav" data-t="dt">Dentistas</button>':''}<button type="button" class="on" data-act="nav" data-t="cm">Comissões</button></div><div class="card"><label for="cmm" style="margin:0 0 4px">Mês</label><input id="cmm" type="month" value="${m}"></div>`;
  if(!ds.length)return h+'<div class="empty">Cadastre um dentista na aba Dentistas para acompanhar comissões.</div>';

  const accounting=salesForAccounting();
  const monthly=accounting.filter(v=>String(v.data||'').slice(0,7)===m);
  h+=commissionReview(m,monthly);
  const selected=view.cmDent||'';
  if(!selected){
    h+=`<div class="card commission-list"><h2 style="margin-top:0">Comissões por dentista</h2><p class="note">Clique no nome do dentista para visualizar todos os comissionamentos registrados para ele.</p>`;
    h+=ds.map(d=>{
      const vm=monthly.filter(v=>v.dt===d.id);
      const total=sum(vm,'rep');
      const production=sum(vm,'valor');
      const patients=new Set(vm.map(v=>v.pid)).size;
      return `<button class="card" data-act="cmdent" data-id="${esc(d.id)}" type="button" style="width:100%;text-align:left;margin:0 0 8px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px"><span><strong>${esc(d.nome)}</strong>${d.ativo===false?' <span class="badge">arquivado</span>':''}<br><span class="note" style="margin:2px 0 0">${vm.length} procedimento(s) · ${patients} paciente(s) · produção ${brl(production)}</span></span><span style="text-align:right"><strong class="commission-amount">${brl(total)}</strong><br><span class="note" style="margin:2px 0 0">Comissão gerada</span></span></button>`;
    }).join('');
    h+=`</div>`;
    return h+`<div class="commission-totals" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">${stat('A pagar agora (todos)',brl(ds.reduce((a,d)=>a+dtTot(d.id,accounting).apagar,0)))}${stat('Prevista, aguardando pacientes',brl(ds.reduce((a,d)=>a+dtTot(d.id,accounting).prev,0)))}</div>`;
  }

  const d=ds.find(x=>x.id===selected);
  if(!d){view.cmDent='';return comHtml()}
  const sales = accounting.filter(sale => sale.dt === d.id);
  const t = dtTot(d.id,sales);
  const previous = document.querySelector('[data-commission-dentist]');
  const historyOpen = previous?.dataset.commissionDentist === String(d.id) && previous.querySelector('.dt-pay-history[open]');
  const vm=monthly.filter(v=>v.dt===d.id);
  const pm=db.cp.filter(c=>c.dt===d.id&&c.data.slice(0,7)===m);
  const liberado=vm.reduce((a,x)=>a+liberada(x),0);
  h+=`<div class="card"><div class="row" style="justify-content:space-between;align-items:center"><div><h2 style="margin:0">${esc(d.nome)}</h2>${d.ativo===false?' <span class="badge">arquivado</span>':''}</div><button class="ghost sm" data-act="cmback">Voltar aos dentistas</button></div>
  ${rw('Procedimentos no mês',String(vm.length))}${rw('Pacientes atendidos no mês',String(new Set(vm.map(v=>v.pid)).size))}${rw('Produção do mês',brl(sum(vm,'valor')))}${rw('Comissão gerada no mês',brl(sum(vm,'rep')))}${rw('Já liberada (paciente pagou)',brl(liberado))}${rw('Paga no mês',brl(sum(pm,'valor')))}
    <div class="dt-pay commission-repasse" data-commission-dentist="${esc(d.id)}"><h3>Pagamento ao dentista</h3>${window.NexoPayeePix?.button('dentist',d.id,d.nome)||''}${rw('Comissão gerada',brl(t.g))}${rw('Liberada (paciente já pagou)',brl(t.l))}${rw('A liberar (aguardando recebimento)',brl(t.prev))}
    ${rw('Acréscimos ao saldo',brl(t.extra))}
    ${rw('Já pago ao dentista',brl(t.p))}${t.exc>0?rw('Pago adiantado',brl(t.exc)):''}
    <div class="tot dt-pay-balance commission-amount"><span>A pagar agora (geral)</span><span>${brl(t.apagar)}</span></div>
    <p class="note">O saldo usa a comissão liberada, soma os acréscimos e desconta os repasses já pagos.</p>
    ${dtCommissionDetails(sales)}
    ${t.apagar>0?`<div class="row" style="margin-top:10px;align-items:flex-end"><div><label style="margin-top:0" for="cpv_${d.id}">Valor pago (R$)</label><input id="cpv_${d.id}" data-cpv="${esc(d.id)}" inputmode="decimal" value="${t.apagar.toFixed(2)}"></div><div><label style="margin-top:0" for="cpd_${d.id}">Data</label><input id="cpd_${d.id}" type="date" data-cpd="${esc(d.id)}" value="${tdy()}"></div></div>
    <input data-cpo="${esc(d.id)}" placeholder="Observação (opcional): Pix, dinheiro, referente a…" style="margin-top:8px" aria-label="Observação do pagamento">
    <button data-act="cpay" data-id="${esc(d.id)}" style="width:100%;margin-top:8px">Dar baixa no pagamento</button><p class="note" style="margin:6px 0 0">O valor vem preenchido com o saldo; mude se pagou só uma parte.</p>`:'<p class="note" style="margin:8px 0 0">Nada a pagar agora.</p>'}
    ${pmLvl('cm')>=2&&pmLvl('dt')>=2?`<button type="button" class="ghost sm" data-act="cpayextra" data-id="${esc(d.id)}">Adicionar valor extra</button>` : ''}
    ${t.extra>0?`<details class="dt-extra-history"><summary>Histórico de valores extras</summary>${dtRepasseExtras(d.id).map(extra=>rw(fd(extra.data)+' · '+esc(extra.obs),brl(extra.valor))).join('')}</details>`:''}
    ${pmLvl('cm')>=2?`<button type="button" class="ghost sm" data-act="cpayretro" data-id="${esc(d.id)}">Registrar repasse retroativo</button>`:''}
    ${(()=>{const pg=db.cp.filter(c=>c.dt===d.id).sort((a,b)=>String(b.data).localeCompare(String(a.data)));return pg.length?`<details class="dt-pay-history"${historyOpen?' open':''}><summary>Pagamentos registrados (${pg.length}) · ${brl(t.p)}</summary>${pg.map(c=>`<div class="pg"><span>${fd(c.data)}${c.obs?' · '+esc(c.obs):''}</span><span>${brl(c.valor)} <button class="danger sm" data-act="rmcp" data-id="${esc(c.id)}" aria-label="Remover pagamento">${delArm===c.id?'Confirmar':'×'}</button></span></div>`).join('')}</details>`:''})()}</div>
  <details class="commission-month-details" open><summary>Comissionamentos do mês (${vm.length})</summary>${vm.length?vm.map(v=>`<div class="pg"><span>${fd(v.data)} · ${esc(pName(v.pid))}<br>${esc(v.proc||'Atendimento')} · ${brl(v.valor)} · ${esc(dName(v.dt))}</span><span style="text-align:right"><strong>${brl(v.rep)}</strong><br>${Math.round(Math.min(1,recebido(v)/(num(v.valor)||1))*100)}% recebido</span></div>`).join(''):'<p class="note" style="margin:0">Nenhum comissionamento neste mês.</p>'}</details></div>`;
  return h;
}


function commissionReview(m,moves){
  // 253: conferência somente leitura; não modifica comissões nem pagamentos.
  const missing=moves.filter(v=>!v.dt||!db.dt.some(d=>String(d.id)===String(v.dt)));
  const duplicateKeys=new Map();
  moves.forEach(v=>{const k=String(v.pid)+'|'+String(v.trid||v.tid||v.tratId||v.proc||'')+'|'+String(v.data||'');duplicateKeys.set(k,(duplicateKeys.get(k)||0)+1)});
  const suspects=[...duplicateKeys.values()].filter(n=>n>1).length;
  const paid=db.cp.filter(c=>String(c.data||'').slice(0,7)===m).reduce((n,c)=>n+num(c.valor),0);
  return `<details class="card nexo-data-fold" style="margin-bottom:12px"><summary style="cursor:pointer;font-weight:700">Conferência mensal de comissões</summary><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;margin-top:12px">${stat('Produção baixada',brl(sum(moves,'valor')))}${stat('Comissões geradas',brl(sum(moves,'rep')))}${stat('Pagamentos no mês',brl(paid))}${stat('Sem dentista válido',String(missing.length))}${stat('Possíveis repetições',String(suspects))}</div><p class="note">Pagamentos do mês podem quitar comissões de meses anteriores. Repetições são alertas para conferência, não confirmação de duplicidade. Nenhum registro é alterado.</p></details>`;
}
