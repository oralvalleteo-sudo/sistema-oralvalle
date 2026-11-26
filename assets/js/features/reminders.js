/* ===== Retorno de pacientes (sem agendamento há X meses) ===== */
const isoL=d=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
function retMeses(){const n=parseInt((db.cl||{}).retMeses,10);return n>0?n:6}
function retCorte(){const d=new Date();d.setMonth(d.getMonth()-retMeses());return isoL(d)}
function retRecente(p){if(!p.retCont)return false;const d=new Date();d.setDate(d.getDate()-30);return p.retCont>=isoL(d)}
function retLast(p){
  const hoje=tdy();let last='';
  db.ag.forEach(a=>{if(a.pid===p.id&&a.st!=='Cancelado'&&a.st!=='Faltou'&&a.data&&a.data<=hoje&&a.data>last)last=a.data});
  db.vd.forEach(v=>{if(v.pid===p.id&&v.data&&v.data<=hoje&&v.data>last)last=v.data});
  return last;
}
function retLista(){
  const hoje=tdy(),corte=retCorte(),out=[],never=[];
  db.p.forEach(p=>{
    if(p.arq)return;
    if(db.ag.some(a=>a.pid===p.id&&a.st!=='Cancelado'&&a.st!=='Faltou'&&a.data>hoje))return;
    const last=retLast(p);
    if(!last){never.push(p);return}
    if(last<=corte)out.push({p,last});
  });
  out.sort((a,b)=>(retRecente(a.p)-retRecente(b.p))||a.last.localeCompare(b.last));
  never.sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt-BR'));
  return {out,never};
}
/* Retornos ortodônticos: prazo de um mês de calendário após atendimento realizado. */
function orthoPrazo(iso){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(iso||'')))return '';
  const [y,m,d]=iso.split('-').map(Number),next=new Date(y,m,1,12);
  const lastDay=new Date(next.getFullYear(),next.getMonth()+1,0).getDate();
  next.setDate(Math.min(d,lastDay));return isoL(next);
}
function orthoUltima(p){
  const hoje=tdy();let last='';
  (db.ag||[]).forEach(a=>{if(a.pid===p.id&&a.st==='Compareceu'&&a.data&&a.data<=hoje&&a.data>last)last=a.data});
  (db.vd||[]).forEach(v=>{if(v.pid===p.id&&v.data&&v.data<=hoje&&v.data>last)last=v.data});
  return last;
}
function orthoLista(){
  const hoje=tdy(),out=[];
  (db.p||[]).forEach(p=>{
    if(p.arq||!p.orthoMensal)return;
    const last=orthoUltima(p),prazo=last?orthoPrazo(last):'';
    const futuras=(db.ag||[]).filter(a=>a.pid===p.id&&a.data>=hoje&&a.st!=='Cancelado'&&a.st!=='Faltou').sort((a,b)=>(a.data+' '+(a.hora||'')).localeCompare(b.data+' '+(b.hora||'')));
    out.push({p,last,prazo,proxima:futuras[0]||null});
  });
  return out.sort((a,b)=>Number(!!a.proxima)-Number(!!b.proxima)||(a.prazo||'9999').localeCompare(b.prazo||'9999')||String(a.p.nome).localeCompare(String(b.p.nome),'pt-BR'));
}
function ovCareRow(p,kind,stages){
 const stageKey=kind==='impl'?'implEtapa':'protEtapa',dateKey=kind==='impl'?'implUltimaData':'protUltimaData';
 const stage=p[stageKey]||stages[0],idx=stages.indexOf(stage),done=kind==='impl'?'Tratamento concluído':'Tratamento concluído';
 const last=p[dateKey]||(kind==='impl'?implUltimo(p):'');
 return `<details class="ret-it ov-care-collapse ov-modern-row" style="display:block"><summary class="ov-modern-summary"><span class="ov-modern-name"><strong>${esc(p.nome)}</strong><small>${kind==='impl'?'Implantodontia':'Prótese'}</small></span><span class="ov-modern-date">Último procedimento: ${last?esc(fd(last)):'Não registrado'}</span><span class="ov-modern-status ov-modern-status-stage" aria-label="Etapa atual: ${esc(stage)}">${esc(stage)}</span><span class="ov-care-arrow" aria-hidden="true">›</span></summary><div class="ret-i" style="margin-top:12px;min-width:0"><small>Último procedimento: ${last?esc(fd(last)):'Não registrado'}</small>
 <label>Etapa atual<select data-${kind}-etapa="${esc(p.id)}">${stages.map(t=>`<option value="${esc(t)}"${stage===t?' selected':''}>${esc(t)}</option>`).join('')}</select></label>
 ${kind==='prot'?`<label>Cor dos dentes<input data-prot-cor="${esc(p.id)}" maxlength="60" value="${esc(p.protCor||'')}" placeholder="Ex.: A2, B1"></label>`:''}
 <label style="display:block;width:100%;max-width:720px">Descrição breve do tratamento<textarea data-${kind}-resumo="${esc(p.id)}" rows="3" maxlength="1000" style="display:block;width:100%;min-height:78px;resize:vertical" placeholder="Ex.: Prótese total superior em confecção; implantes nas regiões 36 e 46, aguardando osseointegração.">${esc(kind==='impl'?(p.implResumo||''):(p.protResumo||''))}</textarea><small>Resumo individual do paciente. Salvo ao sair do campo.</small></label>
 <label>Data do procedimento<input type="date" data-${kind}-data="${esc(p.id)}" value="${esc(p[dateKey]||'')}"></label>
 <small>${idx>=stages.length-1?'Última etapa — finalize quando houver alta.':'Próxima etapa: '+esc(stages[Math.min(idx+1,stages.length-1)])}</small></div>
 ${window.NexoOrthoPhotos?NexoOrthoPhotos.gallery(p,kind):''}<div class="ret-act"><button class="sm" data-act="carebaixa" data-id="${esc(p.id)}" data-kind="${kind}">Dar baixa e evoluir</button><button class="ghost sm" data-act="carealta" data-id="${esc(p.id)}" data-kind="${kind}">Finalizar tratamento</button><button class="ghost sm" data-act="open" data-id="${esc(p.id)}">Ver ficha</button></div></details>`;
}
function ovModernHead(title,subtitle,total,second,third,fourth){
 return `<div class="ov-modern-head">${title?`<div class="ov-modern-title"><div><h1>${title}</h1><p class="sub">${subtitle}</p></div></div>`: ''}<div class="ov-modern-stats"><div><strong>${total}</strong><span>Pacientes em acompanhamento</span></div><div><strong>${second[0]}</strong><span>${second[1]}</span></div><div><strong>${third[0]}</strong><span>${third[1]}</span></div><div><strong>${fourth[0]}</strong><span>${fourth[1]}</span></div></div></div>`;
}
function ovSpecialtyColumns(dateLabel,statusLabel){
 return `<div class="ov-work-columns" aria-hidden="true"><span>Paciente</span><span>${dateLabel}</span><span>${statusLabel}</span></div>`;
}
function orthoHtml(showHeading=true){
 const list=orthoLista(),mes=tdy().slice(0,7),emDia=list.filter(x=>(x.p.orthoBaixas||[]).includes(mes)).length;
 return `<div class="ov-modern-page ov-specialty-page">${ovModernHead(showHeading?'Ortodontia':'','Manutenções e retornos mensais.',list.length,[emDia,'Em dia neste mês'],[list.length-emDia,'Manutenções pendentes'],[list.filter(x=>!!x.proxima).length,'Retornos agendados'])}<section class="card ret-card ov-modern-list"><h2>Pacientes em tratamento</h2>
 ${list.length?ovSpecialtyColumns('Última manutenção','Status')+list.map(({p,last,proxima})=>{const baixa=(p.orthoBaixas||[]).includes(mes),ret=p.orthoProximo||proxima?.data||'',ultima=p.orthoUltimaData||last;return `<details class="ret-it ov-care-collapse ov-modern-row" style="display:block"><summary class="ov-modern-summary"><span class="ov-modern-name"><strong>${esc(p.nome)}</strong><small>Ortodontia</small></span><span class="ov-modern-date">Última manutenção: ${ultima?esc(fd(ultima)):'Não registrada'}</span><span class="ov-modern-status ${baixa?'ov-modern-ok':''}">${baixa?'Em dia':'Pendente'}</span><span class="ov-care-arrow" aria-hidden="true">›</span></summary><div class="ret-i" style="margin-top:12px;min-width:0"><small>Última manutenção: ${ultima?esc(fd(ultima)):'Não registrada'}</small><small>${baixa?'✓ Baixa registrada neste mês':'Manutenção pendente neste mês'}</small><label>Próximo retorno<input type="date" data-ortho-retorno="${esc(p.id)}" value="${esc(ret)}"></label><small>Data de controle; não cria agendamento na agenda.</small></div>${window.NexoOrthoPhotos?NexoOrthoPhotos.gallery(p):''}<div class="ret-act"><button class="sm" data-act="carebaixa" data-id="${esc(p.id)}" data-kind="ortho">Registrar manutenção</button><button class="ghost sm" data-act="carealta" data-id="${esc(p.id)}" data-kind="ortho">Dar alta</button><button class="ghost sm" data-act="open" data-id="${esc(p.id)}">Ver ficha</button></div></details>`}).join(''):'<p class="note">Nenhum paciente em tratamento ortodôntico.</p>'}</section></div>`;
}
const IMPL_ETAPAS=['Avaliação e planejamento','Exames e planejamento cirúrgico','Cirurgia de implante','Osseointegração','Reabertura / cicatrizador','Moldagem / escaneamento','Prova da prótese','Instalação da prótese','Acompanhamento','Tratamento concluído'];
function implUltimo(p){const hoje=tdy(),datas=[];(p.evol||[]).forEach(e=>{if(e.data&&e.data<=hoje)datas.push(e.data)});return datas.sort().pop()||''}
function implHtml(){const list=(db.p||[]).filter(p=>!p.arq&&p.implAtivo).sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt-BR'));const done=list.filter(p=>p.implEtapa==='Tratamento concluído').length;return `<div class="ov-modern-page ov-specialty-page">${ovModernHead('Implantodontia','Etapas e evolução dos tratamentos.',list.length,[list.length-done,'Em andamento'],[list.filter(p=>!!p.implUltimaData).length,'Com procedimento registrado'],[done,'Concluídos'])}<section class="card ret-card ov-modern-list"><h2>Tratamentos ativos</h2>${list.length?ovSpecialtyColumns('Último procedimento','Etapa')+list.map(p=>ovCareRow(p,'impl',IMPL_ETAPAS)).join(''):'<p class="note">Nenhum paciente em tratamento.</p>'}</section></div>`}
const PROT_ETAPAS=['Avaliação e planejamento','Moldagem','Prova com cera','Prova com dentes','Acrilização','Entrega','Ajustes e acompanhamento','Tratamento concluído'];
function protHtml(){const list=(db.p||[]).filter(p=>!p.arq&&p.protAtivo).sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt-BR'));const done=list.filter(p=>p.protEtapa==='Tratamento concluído').length;return `<div class="ov-modern-page ov-specialty-page">${ovModernHead('Prótese','Etapas, cor e evolução do tratamento.',list.length,[list.length-done,'Em andamento'],[list.filter(p=>!!p.protUltimaData).length,'Com procedimento registrado'],[done,'Concluídos'])}<section class="card ret-card ov-modern-list"><h2>Tratamentos ativos</h2>${list.length?ovSpecialtyColumns('Último procedimento','Etapa')+list.map(p=>ovCareRow(p,'prot',PROT_ETAPAS)).join(''):'<p class="note">Nenhum paciente em tratamento.</p>'}</section></div>`}
function retPend(){return retLista().out.filter(x=>!retRecente(x.p)).length}
function retMsg(p,last){
  const cl=Object.assign({},CL_DEF,db.cl||{}),pn=String(p.nome||'').trim().split(/\s+/)[0]||'paciente',u=last?last.slice(5,7)+'/'+last.slice(0,4):'';
  return String(cl.retMsg||RET_MSG_DEF).replace(/\s*\(\{ultima\}\)/g,u?' ('+u+')':'').replace(/\{nome\}/g,pn).replace(/\{clinica\}/g,cl.nome||'clínica').replace(/\{ultima\}/g,u);
}
function mesesDesde(iso){const n=new Date(),t=new Date(iso+'T12:00:00');let m=(n.getFullYear()-t.getFullYear())*12+n.getMonth()-t.getMonth();if(n.getDate()<t.getDate())m--;return Math.max(m,0)}
function pendingRescheduleHtml(appointments,canEdit){
  const rows=appointments.map(appointment=>`<div class="ret-it">
    <div class="ret-i"><strong>${esc(pName(appointment.pid))}</strong>
      <small>Consulta anterior: ${esc(fd(appointment.data))} · ${esc(appointment.hora||'')} ${esc(db.p.find(p=>String(p.id)===String(appointment.pid))?.tel||'')}</small></div>
    ${canEdit?`<div class="ret-act"><button type="button" class="sm" data-act="agreagpend" data-id="${esc(appointment.id)}">Reagendar</button></div>`:''}
  </div>`);
  return `<section class="card ret-card"><h2>Aguardando reagendamento</h2>${rows.join('')||'<p class="note">Nenhum paciente aguardando nova data.</p>'}</section>`;
}
function retHtml(){
  const {out,never}=retLista(),pend=out.filter(x=>!retRecente(x.p)).length,N=retMeses(),lim=view.retAll?out.length:8;
  const row=(p,last)=>{
    const tel=String(p.tel||'').replace(/\D/g,''),rec=retRecente(p);
    return `<div class="ret-it"><div class="ret-i"><strong>${esc(p.nome)}</strong><small>${last?'Última visita: '+esc(fd(last))+' · há '+mesesDesde(last)+' meses':'Nenhuma consulta registrada'}${tel?' · '+esc(p.tel):' · sem telefone'}</small>${rec?`<span class="badge stt-ok" style="margin-top:4px">Contatado em ${esc(fd(p.retCont))}</span>`:''}</div>
    <div class="ret-act">${tel?`<button class="sm" data-act="retwa" data-id="${esc(p.id)}">WhatsApp</button>`:''}<button class="ghost sm" data-act="retok" data-id="${esc(p.id)}">${rec?'Contatar de novo':'Marcar contatado'}</button><button class="ghost sm" data-act="open" data-id="${esc(p.id)}">Ver ficha</button></div></div>`;
  };
  return `<section class="card ret-card"><h2>Pacientes sem retorno há mais de ${N} meses${out.length?` (${out.length})`:''}</h2>
  <p class="sub" style="margin:0 0 6px">Pacientes sem consulta marcada para o futuro e com a última visita há ${N} meses ou mais. Quem foi contatado nos últimos 30 dias vai para o fim da lista. O prazo e a mensagem ficam em Configurações > Empresa.</p>
  ${pend?`<span class="badge stt-wr">${pend} para contatar</span>`:''}
  ${out.length?out.slice(0,lim).map(x=>row(x.p,x.last)).join(''):'<p class="note" style="margin:8px 0 0">Nenhum paciente nessa situação. Tudo em dia!</p>'}
  ${out.length>8?`<button class="ghost sm" data-act="retall" style="margin-top:10px">${view.retAll?'Mostrar menos':'Mostrar todos ('+out.length+')'}</button>`:''}
  ${never.length?`<details style="margin-top:12px"><summary>Sem nenhuma consulta registrada (${never.length})</summary><p class="note" style="margin:6px 0 0">Cadastrados que nunca foram agendados. Não dá para saber há quanto tempo estão assim.</p>${never.map(p=>row(p,'')).join('')}</details>`:''}</section>`;
}
/* Aniversários: gerados diretamente do cadastro, sem criar lembretes duplicados. */
function ovBirthdayToday(){
  const md=tdy().slice(5);
  return (db.p||[]).filter(p=>!p.arq&&/^\d{4}-\d{2}-\d{2}$/.test(String(p.nasc||''))&&p.nasc.slice(5)===md)
    .sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
}
function ovBirthdayHtml(){
  const hoje=ovBirthdayToday();
  return `<section class="card ov-reminder-birthdays"><h2>Aniversariantes de hoje (${hoje.length})</h2>
  ${hoje.length?hoje.map(p=>`<div class="ret-it"><div class="ret-i"><strong>🎉 ${esc(p.nome||'Paciente')}</strong><small>Aniversário hoje · ${esc(fd(p.nasc))}${p.tel?' · '+esc(p.tel):''}</small></div><div class="ret-act"><button class="ghost sm" data-act="open" data-id="${esc(p.id)}">Ver ficha</button></div></div>`).join(''):'<p class="note">Nenhum paciente faz aniversário hoje.</p>'}</section>`;
}
function lembretesHtml(){
  const list=(db.lem||[]).slice().sort((a,b)=>{
    const da=(a.data||'9999-12-31')+' '+(a.hora||'23:59');
    const dbb=(b.data||'9999-12-31')+' '+(b.hora||'23:59');
    return Number(a.feito)-Number(b.feito)||da.localeCompare(dbb);
  });
  const hoje=tdy();
  const pend=list.filter(x=>!x.feito).length;
  const TIPOS=['Geral','Paciente','Financeiro','Agenda','Administrativo','Retorno'],rp=retPend(),op=orthoLista().length,birthdays=ovBirthdayToday().length;
  const agendaAccess=pmLvl('ag');
  const reschedule=agendaAccess>0?(db.ag||[]).filter(a=>a.tipoRegistro!=='aluguel'&&a.reagendamentoPendente===true&&a.st==='Reagendou'):[];
  const tabs=[['todos','Todos',pend],['aniversarios','Aniversários',birthdays],
    ...(agendaAccess>0?[['reag','Aguardando reagendamento',reschedule.length]]:[]),
    ['ret','Pacientes sem retorno',rp],['ortho','Ortodontia',op]].concat(TIPOS.map(t=>[t,t,list.filter(x=>!x.feito&&(x.tipo||'Geral')===t).length]));
  const T=tabs.some(x=>x[0]===view.lemTab)?view.lemTab:'todos';
  const shown=T==='todos'?list:list.filter(x=>(x.tipo||'Geral')===T),tipoSel=TIPOS.includes(T)?T:'Geral';
  const tabsHtml=`<nav class="lem-tabs" aria-label="Assuntos dos lembretes">${tabs.map(([key,label,count])=>`<button type="button"${T===key?' aria-current="page"':''} data-act="lemtab" data-t="${key}"><strong>${label}</strong>${count?`<span class="lem-n">${count}</span>`:''}</button>`).join('')}</nav>`;
  const alerts=T==='todos'&&(rp||birthdays)?`<div class="ov-reminder-alerts">
    ${rp?`<button type="button" class="ghost" data-act="lemtab" data-t="ret">${rp} sem retorno há mais de ${retMeses()} meses <span aria-hidden="true">→</span></button>`:''}
    ${birthdays?`<button type="button" class="ghost" data-act="lemtab" data-t="aniversarios">${birthdays} aniversariante${birthdays===1?'':'s'} hoje <span aria-hidden="true">→</span></button>`:''}
  </div>`:'';
  return `<div class="ov-reminders-page"><div class="ov-page-head"><h1>Lembretes</h1><span class="ov-reminder-count">${pend} pendente${pend===1?'':'s'}</span></div>
  ${tabsHtml}<div class="ov-reminders-content">${T==='aniversarios'?ovBirthdayHtml():T==='ret'?retHtml():T==='reag'?pendingRescheduleHtml(reschedule,agendaAccess>=2):T==='ortho'?orthoHtml(false):`
  <div class="ov-reminder-grid">
    <section class="ov-reminder-form ov-reminder-toolbar">
      <details class="nd-lem-create">
        <summary><span aria-hidden="true">+</span> Adicionar lembrete</summary>
        <div>
      <label for="lemTitulo">O que você precisa lembrar?</label>
      <input id="lemTitulo" placeholder="Ex.: Ligar para paciente sobre retorno" autocomplete="off">
      <div class="row">
        <div><label for="lemData">Data</label><input id="lemData" type="date" value="${hoje}"></div>
        <div><label for="lemHora">Hora</label><input id="lemHora" type="time"></div>
      </div>
      <label for="lemTipo">Tipo</label>
      <select id="lemTipo">${TIPOS.map(t=>`<option${t===tipoSel?' selected':''}>${t}</option>`).join('')}</select>
      <label for="lemObs">Observação</label>
      <textarea id="lemObs" placeholder="Detalhes do lembrete..."></textarea>
      <div class="row" style="margin-top:12px;gap:8px">
        <button type="button" class="primary" data-act="addlem" style="flex:1">Salvar lembrete</button>
        <button type="button" class="ghost" style="flex:1" onclick="this.closest('details').open=false">Cancelar</button>
      </div>
        </div>
      </details>
      ${alerts}
    </section>
    <section aria-label="Lista de lembretes">
      ${shown.length?`<div class="ov-reminder-list">${shown.map(x=>{
        const when=x.data?(fd(x.data)+(x.hora?' · '+x.hora:'')): 'Sem data';
        const cls=x.feito?' done':'';
        return `<article class="ov-reminder-item${cls}">
          <div class="ov-reminder-top">
            <input class="ov-reminder-check" type="checkbox" data-lem-check="${esc(x.id)}" ${x.feito?'checked':''} aria-label="Concluir lembrete">
            <div>
            <div class="ov-reminder-title">${esc(x.titulo||'Lembrete sem título')}</div>
          <div class="ov-reminder-meta"><span class="ov-reminder-pill">${esc(x.tipo||'Geral')}</span><span class="ov-reminder-pill">${esc(when)}</span></div>
          ${x.obs?`<div class="ov-reminder-note">${esc(x.obs)}</div>`:''}
            </div>
          </div>
          <div class="ov-reminder-actions"><button class="ghost sm" data-act="togglelem" data-id="${esc(x.id)}">${x.feito?'Reabrir':'Concluir'}</button><button class="danger sm" data-act="rmlem" data-id="${esc(x.id)}">${delArm===x.id?'Confirmar exclusão':'Excluir'}</button></div>
        </article>`;}).join('')}</div>`:
      `<div class="ov-reminder-empty"><strong>${T==='todos'?'Nenhum lembrete cadastrado':'Nenhum lembrete em '+T}</strong></div>`}
    </section>
  </div>`}</div></div>`;
}
function home(){
  const n=view.h||'ag',fn={ortho:orthoHtml,impl:implHtml,prot:protHtml,inicio:agHtml,pac:homePac,pf:pfListHtml,ag:agHtml,lab:()=>typeof window.nexoLabHtml==='function'?window.nexoLabHtml():'<div class="card">Módulo Laboratório indisponível. Atualize a página.</div>',lem:lembretesHtml,vd:vdHtml,dt:dtHtml,cm:comHtml,pr:prHtml,mt:mtHtml,hc:hcHtml,bk:bkHtml,cfg:cfgHtml,cash:()=>window.NexoCash?.html()||'<section class="card">Atualize para carregar a aba Controle.</section>',wa:nexoWaSettingsHtml,sigdoc:nexoSignHtml,conta:pmContaHtml,reports:nexoReportsHtml,privacy:()=>`<div class="nexo-crm-embed"><iframe title="Privacidade e dados" src="./legal/direitos.html?embedded=1" loading="eager"></iframe></div>`,chat:()=>`<div class="nexo-crm-embed nexo-chat-page"><iframe title="Comunicação da equipe" src="./comunicacao/index.html?embedded=1&clinic_id=${encodeURIComponent(window.OralCloud?.clinicId||'')}" loading="eager"></iframe></div>`,crm:()=>`<div class="nexo-crm-embed nexo-crm-page"><iframe title="CRM" src="./crm/index.html?embedded=1&amp;build=426&amp;clinic_id=${encodeURIComponent(window.OralCloud?.clinicId||'')}" loading="eager"></iframe></div>`}[n]||homePac;
  const content=fn();
  return `<div class="ov-content-inner">${content}</div>`;
}
function ovShell(content,active){
  return `<div class="ov-shell">${ovTop()}${ovSidebar(active)}<div id="oral-mobile-nav" class="ov-mobile-nav">${ovSidebar(active)}</div><main class="ov-content"><div id="valAlert">${valAlertHtml()}</div>${content}</main></div>`;
}

function listHtml(){
  const l=db.p.filter(p=>!p.arq&&p.nome.toLowerCase().indexOf(q.toLowerCase())>-1).sort((a,b)=>a.nome.localeCompare(b.nome));
  const tot=db.p.filter(p=>!p.arq).length;
  if(!tot)return '<div class="empty">Nenhum paciente cadastrado ainda.</div>';
  if(!l.length)return '<div class="empty">Nenhum paciente encontrado.</div>';
  return l.map(p=>`<button class="pt" data-act="open" data-id="${esc(p.id)}"><span>${esc(p.nome)}<small>${esc(pvFmtTel(p.tel)||'Sem telefone')}</small></span><span class="badge">${p.orcs.length} orç.</span></button>`).join('');
}
// Pacientes com procedimentos clínicos ainda não concluídos (independente de pagamentos).
function nexoTratamentoPendente(p){
  // Uma única avaliação por paciente; não consulta a rede nem altera prontuários.
  const encerrado=s=>['concluido','finalizado','cancelado','recusado','encerrado'].includes(String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase());
  if(p.implAtivo&&!encerrado(p.implEtapa))return true;
  if(p.protAtivo&&!encerrado(p.protEtapa))return true;
  if(p.orthoMensal)return true;
  if((Array.isArray(p.trat)?p.trat:[]).some(t=>!t.vid&&!encerrado(t.status)))return true;
  // Orçamento aprovado só é pendente quando ainda há itens sem baixa.
  return (Array.isArray(p.orcs)?p.orcs:[]).some(o=>
    String(o.status||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()==='aprovado'&&
    Array.isArray(o.itens)&&o.itens.some(it=>!it.vid&&!encerrado(it.status))
  );
}

function homePac(){
  const archivedMode=Boolean(view.arq);
  const active=db.p.filter(p=>Boolean(p.arq)===archivedMode);
  const pending=salesForAccounting().filter(v=>saldoV(v)>0.005);
  const pendingIds=new Set(pending.map(v=>v.pid));
  const treatmentIds=new Set(active.filter(nexoTratamentoPendente).map(p=>String(p.id)));
  const filtered=active.filter(p=>{
    const match=p.nome.toLowerCase().includes(String(q||'').toLowerCase().trim());
    const pend=archivedMode||!view.pendOnly||pendingIds.has(p.id);
    return match&&pend&&(!view.tratOnly||treatmentIds.has(String(p.id)));
  }).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  const novo=view.novoPac?`<div class="card ov-patient-form"><h2>Adicionar novo paciente</h2><label for="nn">Nome completo</label><input id="nn" autocomplete="off" placeholder="Digite o nome para buscar ou cadastrar"><div class="row" style="align-items:flex-start"><div style="min-width:0"><label for="nc">CPF (opcional)</label><input id="nc" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" maxlength="14"></div><div style="min-width:0"><label for="nt">Telefone</label><input id="nt" type="tel" inputmode="tel" autocomplete="off" placeholder="(00) 00000-0000" maxlength="15"></div></div><div id="pvBox"></div><div class="row" style="margin-top:12px"><button id="pvAdd" data-act="add" style="flex:1" disabled>Cadastrar paciente</button><button class="ghost" data-act="cancelNovoPac" style="flex:1">Cancelar</button></div></div>`:'';
  const pageSize=50, pages=Math.max(1,Math.ceil(filtered.length/pageSize));
  view.pPage=Math.min(Math.max(0,Number(view.pPage)||0),pages-1);
  const pageRows=filtered.slice(view.pPage*pageSize,(view.pPage+1)*pageSize);
  const rows=pageRows.length?pageRows.map(p=>`<button class="ov-patient-row" data-act="open" data-id="${esc(p.id)}"><span class="nd-patient-identity"><span class="ov-patient-row-name">${esc(p.nome)}</span><small>☎ ${esc(pvFmtTel(p.tel)||'Sem telefone')}</small></span><span class="nd-patient-info"><span>Orçamentos</span><strong>${Array.isArray(p.orcs)?p.orcs.length:0}</strong></span><span class="nd-patient-info"><span>Financeiro</span><strong class="${pendingIds.has(p.id)?'nd-status-pending':'nd-status-clear'}">${pendingIds.has(p.id)?'Pagamento pendente':'Sem pendência registrada'}</strong></span><span class="ov-patient-arrow">›</span></button>`).join(''):`<div class="ov-patient-empty">${active.length?'Nenhum paciente encontrado.':(archivedMode?'Nenhum paciente arquivado.':'Nenhum paciente cadastrado ainda.')}</div>`;
  const pager=filtered.length>pageSize?`<div class="row ov-patient-pager" style="justify-content:space-between;margin-top:12px"><span class="note" style="margin:0">Página ${view.pPage+1} de ${pages} · ${filtered.length} pacientes</span><span class="row" style="flex:none;gap:6px"><button class="ghost sm" data-act="pPage" data-p="${view.pPage-1}"${view.pPage===0?' disabled':''}>Anterior</button><button class="ghost sm" data-act="pPage" data-p="${view.pPage+1}"${view.pPage>=pages-1?' disabled':''}>Próxima</button></span></div>`:'';
  return `<div class="ov-patients-page">
    <div class="ov-page-head nd-patient-hero"><span class="nd-patient-hero-icon" aria-hidden="true">♧</span><div><h1>Pacientes</h1><p class="sub">Cadastro, histórico e acompanhamento de tratamentos.</p></div><span class="nd-patient-hero-decoration" aria-hidden="true">✧</span></div>
    <div class="nd-patient-stats" aria-label="Resumo dos pacientes"><div class="nd-patient-stat nd-patient-stat-main"><span class="nd-stat-icon" aria-label="Pessoas"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2"/><path d="M17 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1"/></svg></span><div><strong>${db.p.filter(p=>!p.arq).length}</strong><span>Pacientes ativos</span></div></div><div class="nd-patient-stat"><span class="nd-stat-icon" aria-label="Arquivo"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M10 14h4"/></svg></span><div><strong>${db.p.filter(p=>p.arq).length}</strong><span>Arquivados</span></div></div><div class="nd-patient-stat"><span class="nd-stat-icon" aria-label="Pagamento pendente"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><circle cx="17" cy="16" r="4" fill="white"/><path d="M17 13.5V16l1.5 1"/></svg></span><div><strong>${active.filter(p=>pendingIds.has(p.id)).length}</strong><span>Com pagamento pendente</span></div></div><div class="nd-patient-stat"><span class="nd-stat-icon" aria-label="Pesquisa"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></span><div><strong>${filtered.length}</strong><span>Resultados da pesquisa</span></div></div></div>
    ${novo}
    <section class="ov-patients-panel">
      <div class="ov-patients-head">
        <div class="ov-patients-count">${active.length} ${active.length===1?'paciente':'pacientes'}${archivedMode?' arquivados':''}</div>
        <div class="ov-patients-actions"><button type="button" class="ov-archived-patients" data-act="arqt" aria-pressed="${archivedMode}" title="${archivedMode?'Voltar aos pacientes ativos':'Ver pacientes arquivados'}">${archivedMode?'← Pacientes ativos':'▤ Arquivados'}</button><button class="ov-new-patient" data-act="novoPac">Novo Paciente <b>+</b></button></div>
      </div>
      <div class="ov-patient-search"><input id="q" type="search" name="nexodent-patient-filter" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="Pesquisar pelo nome" value="${esc(q)}" aria-label="Pesquisar pelo nome"></div>
      <div class="ov-patient-filter" ${archivedMode?'style="display:none"':''}><span>Filtrar:</span><label><input id="pendOnly" type="checkbox" ${view.pendOnly?'checked':''}> Pacientes com pagamento pendente</label><label><input id="tratOnly" type="checkbox" ${view.tratOnly?'checked':''}> Pacientes com tratamento pendente</label></div>
    </section>
    <div class="ov-patient-list" id="list">${rows}</div>${pager}
  </div>`;
}

