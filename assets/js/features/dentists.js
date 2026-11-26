/* ===== dentistas ===== */
function dtCommissionDetails(sales){
  const entries = sales.filter(sale => num(sale.rep) !== 0)
    .sort((a,b) => String(b.data||'').localeCompare(String(a.data||'')));
  return `<details class="dt-pay-history"><summary>Comissões por atendimento (${entries.length})</summary>
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
function dtHtml(){
  const openCards = new Set([...document.querySelectorAll('.dt-collapsible[data-dentist-id][open]')]
    .map(card => card.dataset.dentistId));
  const salesByDentist = new Map();
  for (const sale of salesForAccounting()) {
    if (!salesByDentist.has(sale.dt)) salesByDentist.set(sale.dt, []);
    salesByDentist.get(sale.dt).push(sale);
  }
  const novo=`<details class="dt-new-collapsible"><summary class="dt-new-toggle">+ Adicionar dentista <span aria-hidden="true">⌄</span></summary><div class="card dt-novo"><h2>Novo dentista</h2><label for="dn">Nome</label><input id="dn" autocomplete="off"><label for="dm">Como é a comissão</label><select id="dm">${selOpts(MODOS,'pct')}</select><div class="row" style="align-items:flex-start"><div><label for="dp">Percentual (%)</label><input id="dp" inputmode="decimal" value="40"></div></div><label for="dbs">Base de cálculo do percentual</label><select id="dbs">${selOpts(BASES,'bruto')}</select><div style="margin-top:12px"><button data-act="adddt" style="width:100%">Cadastrar dentista</button></div></div></details>`;
  const subnav=pmSee('cm')?`<div class="tabs" style="margin-bottom:16px"><button type="button" class="on" data-act="nav" data-t="dt">Dentistas</button><button type="button" data-act="nav" data-t="cm">Comissões</button></div>`:'';
  return subnav+novo+(db.dt.length?`<h2 class="dt-title">Dentistas cadastrados (${db.dt.length})</h2>`+db.dt.map(d=>{
    const sales = salesByDentist.get(d.id) || [];
    const t=dtTot(d.id,sales),mv=dtMoves(d.id);
    return `<details class="dt-card dt-collapsible${d.ativo===false?' off':''}" data-dentist-id="${esc(d.id)}"${openCards.has(String(d.id))?' open':''}><summary class="dt-head"><div class="dt-nm">${esc(d.nome||'Sem nome')}<small>${d.cro?esc(d.cro):'CRO não informado'}</small></div><span class="badge ${d.ativo===false?'':'stt-ok'}">${d.ativo===false?'Arquivado':'Ativo'}</span><span class="ov-patient-arrow dt-chevron" aria-hidden="true">›</span></summary>
    <div class="dt-pay"><h3>Pagamento ao dentista</h3>${window.NexoPayeePix?.button('dentist',d.id,d.nome)||''}${rw('Comissão gerada',brl(t.g))}${rw('Liberada (paciente já pagou)',brl(t.l))}${rw('A liberar (aguardando recebimento)',brl(t.prev))}
    ${rw('Acréscimos ao saldo',brl(t.extra))}
    ${rw('Já pago ao dentista',brl(t.p))}${t.exc>0?rw('Pago adiantado',brl(t.exc)):''}
    <div class="tot dt-pay-balance"><span>A pagar agora</span><span>${brl(t.apagar)}</span></div>
    <p class="note">O saldo usa a comissão liberada, soma os acréscimos e desconta os repasses já pagos.</p>
    ${dtCommissionDetails(sales)}
    ${t.apagar>0?`<div class="row" style="margin-top:10px;align-items:flex-end"><div><label style="margin-top:0" for="cpv_${d.id}">Valor pago (R$)</label><input id="cpv_${d.id}" data-cpv="${esc(d.id)}" inputmode="decimal" value="${t.apagar.toFixed(2)}"></div><div><label style="margin-top:0" for="cpd_${d.id}">Data</label><input id="cpd_${d.id}" type="date" data-cpd="${esc(d.id)}" value="${tdy()}"></div></div>
    <input data-cpo="${esc(d.id)}" placeholder="Observação (opcional): Pix, dinheiro, referente a…" style="margin-top:8px" aria-label="Observação do pagamento">
    <button data-act="cpay" data-id="${esc(d.id)}" style="width:100%;margin-top:8px">Dar baixa no pagamento</button><p class="note" style="margin:6px 0 0">O valor vem preenchido com o saldo; mude se pagou só uma parte.</p>`:'<p class="note" style="margin:8px 0 0">Nada a pagar agora.</p>'}
    ${pmLvl('cm')>=2&&pmLvl('dt')>=2?`<button type="button" class="ghost sm" data-act="cpayextra" data-id="${esc(d.id)}">Adicionar valor extra</button>` : ''}
    ${t.extra>0?`<details class="dt-pay-history"><summary>Histórico de valores extras</summary>${dtRepasseExtras(d.id).map(extra=>rw(fd(extra.data)+' · '+esc(extra.obs),brl(extra.valor))).join('')}</details>`:''}
    ${pmLvl('cm')>=2?`<button type="button" class="ghost sm" data-act="cpayretro" data-id="${esc(d.id)}">Registrar repasse retroativo</button>`:''}
    ${(()=>{const pg=db.cp.filter(c=>c.dt===d.id).sort((a,b)=>String(b.data).localeCompare(String(a.data)));return pg.length?`<details class="dt-pay-history"><summary>Pagamentos registrados (${pg.length}) · ${brl(t.p)}</summary>${pg.map(c=>`<div class="pg"><span>${fd(c.data)}${c.obs?' · '+esc(c.obs):''}</span><span>${brl(c.valor)} <button class="danger sm" data-act="rmcp" data-id="${esc(c.id)}" aria-label="Remover pagamento">${delArm===c.id?'Confirmar':'×'}</button></span></div>`).join('')}</details>`:''})()}</div>
    <details class="dt-pay-history"><summary>Dados e configurações do dentista</summary>
    <div class="row" style="align-items:flex-start"><div><label style="margin-top:8px">Nome</label><input data-d="${esc(d.id)}" data-f="nome" value="${esc(d.nome)}"></div><div><label style="margin-top:8px">Percentual (%)</label><input data-d="${esc(d.id)}" data-f="pct" inputmode="decimal" value="${esc(d.pct)}"></div></div>
    <label>CRO (aparece no receituário)</label><input data-d="${esc(d.id)}" data-f="cro" value="${esc(d.cro||'')}" placeholder="Ex.: CRO-MG 12345" autocomplete="off"><label>Como é a comissão</label><select data-d="${esc(d.id)}" data-f="modo">${selOpts(MODOS,d.modo)}</select><label>Base de cálculo do percentual</label><select data-d="${esc(d.id)}" data-f="base">${selOpts(BASES,d.base)}</select>
    ${ME?.admin && window.OralCloud?.enabled && window.OralCloud?.clinicId && d.ativo!==false ? `<div class="card" style="margin-top:12px;border:1px solid var(--ac);padding:12px"><strong>🔐 Vínculo profissional</strong><p class="note">Vincule este dentista à sua própria conta autenticada. Não altera evoluções existentes.</p><button type="button" class="sm" data-nexo-link-self="${esc(d.id)}">Vincular à minha conta</button></div>` : ''}
    <div class="row dt-act"><button class="ghost sm" data-act="dtarq" data-id="${esc(d.id)}">${d.ativo===false?'Reativar':'Arquivar'}</button>${mv?'':`<button class="danger sm" data-act="rmdt" data-id="${esc(d.id)}">${delArm===d.id?'Toque de novo para excluir':'Excluir'}</button>`}</div>${mv?'<p class="note" style="margin:8px 0 0">Tem movimento registrado: só pode ser arquivado.</p>':''}</details></details>`}).join(''):'<div class="empty">Nenhum dentista cadastrado.</div>')+
  '<p class="note">Mudar a regra de um dentista vale só para as próximas vendas. As vendas já lançadas mantêm a comissão que foi calculada na hora.</p>';
}


/* Vinculação segura via RPC, sem chaves de serviço e sem acesso direto à tabela. */
document.addEventListener('click', async function nexodentLinkMyDentist(event) {
  const button = event.target.closest('[data-nexo-link-self]');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  if (!ME?.admin || !ME?.id || !window.OralCloud?.enabled || !OralCloud.clinicId) {
    toast('Entre como administrador para vincular o dentista.'); return;
  }
  const dentistId = button.getAttribute('data-nexo-link-self');
  const dentist = db.dt.find(item => item.id === dentistId && item.ativo !== false);
  if (!dentist) { toast('Dentista ativo não encontrado.'); return; }
  if (!confirm(`Vincular ${dentist.nome} à sua conta (${ME.nome})? Cada conta pode ter apenas um dentista.`)) return;
  button.disabled = true;
  try {
    await OralCloud.request('/rest/v1/rpc/nexodent_link_dentist', {
      method: 'POST', body: { p_clinic: OralCloud.clinicId, p_user_id: ME.id, p_dentist_id: dentistId }
    });
    const mine = await OralCloud.request('/rest/v1/rpc/nexodent_my_dentist', {
      method: 'POST', body: { p_clinic: OralCloud.clinicId }
    });
    if (!Array.isArray(mine) || !mine.some(item => item.dentist_id === dentistId || String(item.dentist_id).includes('\"' + dentistId + '\"'))) {
      throw new Error('Vínculo não confirmado pela consulta ao Supabase.');
    }
    toast('Dentista vinculado à sua conta com sucesso.');
  } catch (error) {
    toast('Vínculo não realizado: ' + (error?.message || 'erro desconhecido'));
  } finally { button.disabled = false; }
}, true);
