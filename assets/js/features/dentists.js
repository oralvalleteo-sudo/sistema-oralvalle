/* ===== dentistas ===== */
function dtHtml(){
  const openCards = new Set([...document.querySelectorAll('.dt-collapsible[data-dentist-id][open]')]
    .map(card => card.dataset.dentistId));
  const novo=`<details class="dt-new-collapsible"><summary class="dt-new-toggle">+ Adicionar dentista <span aria-hidden="true">⌄</span></summary><div class="card dt-novo"><h2>Novo dentista</h2><label for="dn">Nome</label><input id="dn" autocomplete="off"><label for="dm">Como é a comissão</label><select id="dm">${selOpts(MODOS,'pct')}</select><div class="row" style="align-items:flex-start"><div><label for="dp">Percentual (%)</label><input id="dp" inputmode="decimal" value="40"></div></div><label for="dbs">Base de cálculo do percentual</label><select id="dbs">${selOpts(BASES,'bruto')}</select><div style="margin-top:12px"><button data-act="adddt" style="width:100%">Cadastrar dentista</button></div></div></details>`;
  const subnav=pmSee('cm')?`<div class="tabs" style="margin-bottom:16px"><button type="button" class="on" data-act="nav" data-t="dt">Dentistas</button><button type="button" data-act="nav" data-t="cm">Comissões</button></div>`:'';
  return subnav+novo+(db.dt.length?`<h2 class="dt-title">Dentistas cadastrados (${db.dt.length})</h2>`+db.dt.map(d=>{
    const mv=dtMoves(d.id);
    return `<details class="dt-card dt-collapsible${d.ativo===false?' off':''}" data-dentist-id="${esc(d.id)}"${openCards.has(String(d.id))?' open':''}><summary class="dt-head"><div class="dt-nm">${esc(d.nome||'Sem nome')}<small>${d.cro?esc(d.cro):'CRO não informado'}</small></div><span class="badge ${d.ativo===false?'':'stt-ok'}">${d.ativo===false?'Arquivado':'Ativo'}</span><span class="ov-patient-arrow dt-chevron" aria-hidden="true">›</span></summary>
    <div class="row" style="align-items:flex-start"><div><label style="margin-top:8px">Nome</label><input data-d="${esc(d.id)}" data-f="nome" value="${esc(d.nome)}"></div><div><label style="margin-top:8px">Percentual (%)</label><input data-d="${esc(d.id)}" data-f="pct" inputmode="decimal" value="${esc(d.pct)}"></div></div>
    <label>CRO (aparece no receituário)</label><input data-d="${esc(d.id)}" data-f="cro" value="${esc(d.cro||'')}" placeholder="Ex.: CRO-MG 12345" autocomplete="off"><label>Como é a comissão</label><select data-d="${esc(d.id)}" data-f="modo">${selOpts(MODOS,d.modo)}</select><label>Base de cálculo do percentual</label><select data-d="${esc(d.id)}" data-f="base">${selOpts(BASES,d.base)}</select>
    ${ME?.admin && window.OralCloud?.enabled && window.OralCloud?.clinicId && d.ativo!==false ? `<div class="card" style="margin-top:12px;border:1px solid var(--ac);padding:12px"><strong>🔐 Vínculo profissional</strong><p class="note">Vincule este dentista à sua própria conta autenticada. Não altera evoluções existentes.</p><button type="button" class="sm" data-nexo-link-self="${esc(d.id)}">Vincular à minha conta</button></div>` : ''}
    <div class="row dt-act"><button class="ghost sm" data-act="dtarq" data-id="${esc(d.id)}">${d.ativo===false?'Reativar':'Arquivar'}</button>${mv?'':`<button class="danger sm" data-act="rmdt" data-id="${esc(d.id)}">${delArm===d.id?'Toque de novo para excluir':'Excluir'}</button>`}</div>${mv?'<p class="note" style="margin:8px 0 0">Tem movimento registrado: só pode ser arquivado.</p>':''}</details>`}).join(''):'<div class="empty">Nenhum dentista cadastrado.</div>')+
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
