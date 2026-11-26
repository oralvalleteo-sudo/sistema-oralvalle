/* ===== ações ===== */
/* Janelas próprias da agenda, compatíveis com celular e desktop. */
function ovAgDialog(title, content, onSubmit) {
  document.querySelector('.ov-ag-modal-backdrop')?.remove();
  const backdrop=document.createElement('div');
  backdrop.className='ov-ag-modal-backdrop';
  backdrop.innerHTML=`<section class="ov-ag-modal" role="dialog" aria-modal="true" aria-labelledby="ovAgTitle"><div class="ov-ag-modal-head"><h3 id="ovAgTitle">${title}</h3><button type="button" class="ov-ag-modal-close" aria-label="Fechar">✕</button></div><form class="ov-ag-modal-form">${content}<div class="ov-ag-modal-footer"><button type="button" class="ghost ov-ag-cancel">Cancelar</button><button type="submit">Salvar</button></div></form></section>`;
  document.body.appendChild(backdrop);
  const close=()=>{document.removeEventListener('keydown',onKey);backdrop.remove()};
  const onKey=e=>{if(e.key==='Escape')close()};
  document.addEventListener('keydown',onKey);
  backdrop.addEventListener('click',e=>{if(e.target===backdrop||e.target.closest('.ov-ag-modal-close,.ov-ag-cancel'))close()});
  backdrop.querySelector('form').addEventListener('submit',e=>{e.preventDefault();if(onSubmit(new FormData(e.currentTarget))!==false)close()});
  backdrop.querySelector('input,select,button')?.focus();
  return backdrop;
}

async function ovOrthoMaintenance(button, patient){
  const canEdit=()=>pmLvl('ortho')>=2&&pmTabLvl('odo')>=2;
  const canCharge=()=>pmLvl('vd')>=2&&window.NexoModules?.isAllowed('finance')!==false;
  if(!canEdit()){toast('Para registrar a manutenção, é necessário acesso de edição em Ortodontia e Evolução.');return;}
  const clinic=window.OralCloud?.clinicId;
  const screen=view.h;
  const current=()=>view.h===screen&&window.OralCloud?.clinicId===clinic&&db.p.includes(patient)&&patient.orthoMensal&&!patient.arq;
  if(window.OralCloud?.enabled&&window.OralCloudData?.loadPatient&&!OralCloudData.patientLoaded(patient.id)){
    button.disabled=true;
    try{
      const details=await OralCloudData.loadPatient(patient.id);
      if(!current()||!button.isConnected)return;
      if(!details)throw Error('Prontuário indisponível');
      Object.assign(patient,details);
      OralCloudData.prepareDefaults(db);
    }catch(error){
      if(current())toast('Não foi possível carregar a evolução. Atualize e tente novamente.',5000);
      return;
    }finally{button.disabled=false;}
  }
  const today=tdy();
  const next=patient.orthoProximo>today?patient.orthoProximo:orthoPrazo(today);
  const lastDentist=db.dt.find(d=>d.id===patient.orthoDentista&&d.ativo!==false);
  const financial=canCharge()? `<label>Valor da manutenção (R$)<input type="number" name="amount" min="0.01" max="999999999.99" step="0.01" inputmode="decimal"></label>
    <label>Forma de pagamento<select name="method">${ovFeeOptions('Pix')}</select></label>
    <p class="note">O valor informado será registrado como recebido integralmente em Vendas. Deixe em branco para registrar apenas a evolução.</p>`:'';
  ovAgDialog('Registrar manutenção ortodôntica',`<p class="ov-ag-modal-note">${esc(patient.nome)} · ${esc(fd(today))}</p>
    <label>Procedimento realizado<input name="procedure" required maxlength="160" value="Manutenção ortodôntica"></label>
    <label>Dentista que realizou<select name="dentist" required>${dentOpts(lastDentist?.id||defDt(),'Selecione o dentista')}</select></label>
    <label>Próximo retorno<input type="date" name="next" min="${today}" value="${esc(next)}"></label>
    ${financial}`, form=>{
    if(!current()||!canEdit()||tdy()!==today){toast('O contexto mudou. Abra a manutenção novamente.');return false;}
    const procedure=String(form.get('procedure')||'').trim();
    const dentist=db.dt.find(d=>d.id===form.get('dentist')&&d.ativo!==false);
    const returnDate=String(form.get('next')||'');
    const total=Number(form.get('amount')||0);
    const method=form.get('method');
    if(!procedure||procedure.length>160||!dentist){toast('Informe o procedimento e selecione um dentista ativo.');return false;}
    if(returnDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(returnDate)||returnDate<today)){toast('Informe uma data válida para o próximo retorno.');return false;}
    if(!Number.isFinite(total)||total<0||total>999999999.99||r2(total)!==total){
      toast('Confira o valor da manutenção.');return false;
    }
    if(total>0&&(!canCharge()||!OV_FEE_FORMS.includes(method))){
      toast('Confira o acesso financeiro e a forma de pagamento.');return false;
    }
    if(patient.orthoUltimaData===today&&!confirm('Já existe manutenção registrada hoje. Confirmar um novo atendimento?'))return false;

    const evolution={id:uid(),data:today,n:'',txt:'[Ortodontia] '+procedure+' — realizado por '+dentist.nome+'.',
      performedByDentistId:dentist.id,performedByDentistName:dentist.nome};
    if(total>0){
      const amount=r2(total),commission=comCalc(dentist.id,procedure,amount,1);
      const payments=[ovFeeMake(amount,method,today)];
      db.vd.push({id:uid(),pid:patient.id,dt:dentist.id,proc:procedure,valor:amount,mat:commission.mat,
        lab:commission.lab,rep:commission.rep,data:today,pg:payments,orthoEvolutionId:evolution.id});
    }
    (patient.evol=patient.evol||[]).push(evolution);
    patient.orthoBaixas=patient.orthoBaixas||[];
    if(!patient.orthoBaixas.includes(today.slice(0,7)))patient.orthoBaixas.push(today.slice(0,7));
    patient.orthoUltimaData=today;
    patient.orthoProximo=returnDate;
    patient.orthoDentista=dentist.id;
    save();render();
    toast(total>0?'Manutenção registrada e recebimento lançado em Vendas.':'Manutenção registrada na evolução.');
  });
}

// Sincroniza somente vendas comprovadamente vinculadas ao orçamento.
// A entrada do planejamento NÃO é recebimento: pagamentos são registrados apenas no caixa.
function ovSyncBudgetFinancial(p,o){
  if(!p||!o||o.status!=='Aprovado')return {ok:true,changed:false};
  const itens=(o.itens||[]).filter(i=>i.vid||i.paymentSaleId);
  if(!itens.length)return {ok:true,changed:false};
  const rows=itens.map(i=>({i,v:(db.vd||[]).find(v=>String(v.id)===String(i.paymentSaleId||i.vid)&&String(v.pid)===String(p.id))}));
  if(rows.some(x=>!x.v)||new Set(rows.map(x=>String(x.v.id))).size!==rows.length)
    return {ok:false,message:'Vínculos financeiros inconsistentes. Nenhum atendimento foi atualizado.'};
  const metas=rows.map(({i,v})=>({v,novo:r2(num(i.valor)*fac(o))}));
  if(metas.some(x=>recebido(x.v)>x.novo+0.005))
    return {ok:false,message:'O novo valor é inferior ao que já foi recebido. Confira os pagamentos antes de salvar.'};
  let changed=false;
  metas.forEach(({v,novo})=>{if(Math.abs(num(v.valor)-novo)>0.005){v.valor=novo;changed=true}});
  return {ok:true,changed};
}

// Valida o conjunto completo antes de alterar qualquer lançamento.
function ovBudgetUndoRows(p,o){
  const itens=(o.itens||[]).filter(i=>i.vid),ids=new Set(itens.map(i=>String(i.vid)));
  const rows=(db.vd||[]).filter(v=>ids.has(String(v.id)));
  const compartilhado=(db.p||[]).some(q=>{
    const outrosOrcamentos=(q.orcs||[]).some(b=>
      (q!==p||b!==o)&&(b.itens||[]).some(i=>(i.vid&&ids.has(String(i.vid)))||(i.paymentSaleId&&ids.has(String(i.paymentSaleId)))));
    const outrosTratamentos=(q.trat||[]).some(t=>
      t.vid&&ids.has(String(t.vid))&&(q!==p||String(t.oid)!==String(o.id)));
    return outrosOrcamentos||outrosTratamentos;
  });
  if(ids.size!==itens.length||rows.length!==ids.size||rows.some(v=>String(v.pid)!==String(p.id))||compartilhado)
    return null;
  return rows;
}

function obReceiptDate(button,field){
  const input=button.closest('.ob-pay')?.querySelector('input#'+field);
  if(input?.value&&input.validity.valid)return input.value;
  toast('Informe a data em que o pagamento foi recebido.');
  input?.focus();
  return '';
}

function obAllocateReceipts(sales,payments){
  const entries=payments.map(payment=>({payment,allocated:0}));
  for(const sale of sales){
    let balance=saldoV(sale);
    for(const entry of entries){
      const {payment,allocated}=entry;
      const value=r2(Math.min(balance,payment.valor-allocated));
      if(value<=0)continue;
      entry.allocated=r2(allocated+value);
      // A soma das partes conserva a taxa arredondada da operação original.
      const fee=r2(r2(payment.taxaValor*entry.allocated/payment.valor)-r2(payment.taxaValor*allocated/payment.valor));
      (sale.pg??=[]).push({...payment,id:uid(),valor:value,taxaValor:fee,liquido:r2(value-fee)});
      balance=r2(balance-value);
    }
  }
}
const A={
  agrentadd:()=>{
    const date=view.agDate||tdy(),chair=$('agRentChair').value,start=$('agRentStart').value,end=$('agRentEnd').value;
    if(!start||!end||mins(start)>=mins(end)){toast('Informe um horário de início anterior ao término.',3500);return}
    const chairs=chair==='ambos'?['1','2']:[chair];
    const conflicts=chairs.some(c=>agRentalOverlaps(date,c,mins(start),mins(end))||db.ag.some(a=>a.data===date&&String(a.cadeira||'1')===c&&!['Cancelado','Faltou'].includes(a.st)&&mins(a.hora)<mins(end)&&mins(start)<mins(a.hora)+(a.dur||30)));
    if(conflicts){toast('Já existe aluguel ou atendimento nesse período. Ajuste os horários antes de bloquear.',4500);return}
    if(!confirm('Bloquear '+(chair==='ambos'?'os dois consultórios':'o consultório '+chair)+' em '+date.split('-').reverse().join('/')+' das '+start+' às '+end+'?'))return;
    chairs.forEach(c=>db.ag.push({id:uid(),tipoRegistro:'aluguel',data:date,cadeira:c,hora:start,dur:mins(end)-mins(start),st:'Bloqueado',proc:'Aluguel de consultório'}));
    save();render();toast('Horários bloqueados para aluguel.');
  },
  agrentremove:(b,d)=>{
    const r=agRentals(view.agDate||tdy()).find(x=>String(x.id)===String(d.id));if(!r)return;
    if(!confirm('Liberar o Consultório '+r.cadeira+' em '+r.data.split('-').reverse().join('/')+' das '+r.inicio+' às '+r.fim+'?'))return;
    if(r.cloud)db.ag=db.ag.filter(x=>String(x.id)!==String(d.id));else db.alugueis=db.alugueis.filter(x=>String(x.id)!==String(d.id));save();render();toast('Horário liberado.');
  },
  ovFinDetail:(b,d)=>ovFinDetail(d.t),
  ovFinPdf:()=>ovFinPdf(),
  logout:()=>doLogout(),
  pPage:(b,d)=>{view.pPage=Math.max(0,Number(d.p)||0);render();},
  vPage:(b,d)=>{view.vPage=Math.max(0,Number(d.p)||0);render();},
  agexpand:(b,d)=>{view.agExpanded=String(d.id);render();},
  agcollapse:()=>{view.agExpanded='';render();},
  agencerrar:(b,d)=>{
    const a=db.ag.find(x=>String(x.id)===String(d.id));if(!a)return;
    const options=[['Compareceu','Atendido'],['Faltou','Faltou'],['Cancelado','Desmarcou'],['Reagendou','Reagendou'],['Aguardando','Aguardando']];
    const html=`<p class="ov-ag-modal-note">Selecione o resultado do atendimento:</p><div class="ov-ag-status-options">${options.map(([v,label])=>`<label><input type="radio" name="status" value="${v}" ${v===(a.st||'Aguardando')?'checked':''}>${label}</label>`).join('')}</div><p class="ov-ag-modal-note">Ao selecionar Reagendou, escolha entre marcar uma nova data ou aguardar a decisão do paciente.</p>`;
    ovAgDialog('Dar baixa no agendamento',html,form=>{
      const status=String(form.get('status')||'');if(!options.some(x=>x[0]===status))return false;
      if(status==='Reagendou'){
        const html2=`<p class="ov-ag-modal-note">O paciente já definiu quando poderá retornar?</p><div class="ov-ag-status-options"><label><input type="radio" name="modo" value="pendente" checked> Aguardando definição do paciente</label><label><input type="radio" name="modo" value="agora"> Reagendar agora</label></div><div data-ag-nova-data hidden><label>Nova data<input name="data" type="date" min="${tdy()}"></label><label>Novo horário<input name="hora" type="time" value="${esc(a.hora)}"></label></div>`;
        setTimeout(()=>{
          const dialog=ovAgDialog('Reagendar consulta',html2,form2=>{
            const modo=String(form2.get('modo')||'pendente');
            if(modo==='pendente'){
              a.st='Reagendou';a.reagendamentoPendente=true;
              view.agExpanded='';save();render();toast('Paciente aguardando definição de nova data. Horário liberado.');return;
            }
            const data=String(form2.get('data')||''),hora=String(form2.get('hora')||'');
            if(!/^\d{4}-\d{2}-\d{2}$/.test(data)||data<tdy()||!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)){toast('Informe data e horário válidos.');return false}
            const nova={...a,id:uid(),data,hora,st:'Agendado'};
            delete nova.vid;delete nova.reagendamentoPendente;
            if(confl(nova)){toast('Horário ocupado. Escolha outro.',4000);return false}
            a.st='Reagendou';a.reagendamentoPendente=false;
            db.ag.push(nova);view.agExpanded='';save();render();toast('Consulta reagendada. Histórico preservado.');
          });
          const sync=()=>{
            const now=dialog.querySelector('input[name="modo"]:checked')?.value==='agora';
            const fields=dialog.querySelector('[data-ag-nova-data]');fields.hidden=!now;
            fields.querySelectorAll('input').forEach(input=>input.required=now);
          };
          dialog.querySelectorAll('input[name="modo"]').forEach(r=>r.addEventListener('change',sync));sync();
        },0);
        return;
      }
      a.st=status;view.agExpanded='';save();render();toast(status==='Cancelado'?'Consulta desmarcada':status==='Faltou'?'Falta registrada':status==='Aguardando'?'Consulta aguardando':'Atendimento registrado');
    });
  },
  agreagpend:(b,d)=>{
    const a=db.ag.find(x=>String(x.id)===String(d.id)&&x.reagendamentoPendente===true);
    if(!a)return;
    const html=`<label>Nova data<input name="data" type="date" required min="${tdy()}"></label><label>Novo horário<input name="hora" type="time" required value="${esc(a.hora)}"></label>`;
    ovAgDialog('Definir nova consulta',html,form=>{
      const data=String(form.get('data')||''),hora=String(form.get('hora')||'');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(data)||data<tdy()||!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)){toast('Informe data e horário válidos.');return false}
      const nova={...a,id:uid(),data,hora,st:'Agendado'};
      delete nova.vid;delete nova.reagendamentoPendente;
      if(confl(nova)){toast('Horário ocupado. Escolha outro.',4000);return false}
      a.reagendamentoPendente=false;db.ag.push(nova);save();render();toast('Nova consulta agendada. Histórico preservado.');
    });
  },
  agfalta:(b,d)=>{const a=db.ag.find(x=>x.id===d.id);if(!a)return;a.st='Faltou';save();render();toast('Falta registrada')},
  agcancel:(b,d)=>{const a=db.ag.find(x=>x.id===d.id);if(!a)return;a.st='Cancelado';save();render();toast('Agendamento cancelado')},
  agreativ:(b,d)=>{const a=db.ag.find(x=>x.id===d.id);if(!a)return;const t={...a,st:'Agendado'};if(confl(t)){toast('Esse horário já está ocupado por outro atendimento.',3500);return}a.st='Agendado';save();render();toast('Agendamento reativado')},
  rxsign:async (b,d,p)=>{if(p)await window.NexoDocumentSigning?.open('rx',p)},
  rxicp:async (b,d,p)=>{if(p)await window.NexoDocumentSigning?.exportForIcp('rx',p)},
  atsign:async (b,d,p)=>{if(p)await window.NexoDocumentSigning?.open('at',p)},
  aticp:async (b,d,p)=>{if(p)await window.NexoDocumentSigning?.exportForIcp('at',p)},
  rxpdf:async (b,d,p)=>{if(!p)return;try{const r=await rxDoc(p);if(!r)return;r.doc.save(r.fname);toast('Receituário gerado',2200)}catch(e){console.error(e);toast('Não foi possível gerar o PDF',3000)}},
  rxprint:async (b,d,p)=>{if(!p)return;try{const r=await rxDoc(p);if(!r)return;if(!r.doc||typeof r.doc.output!=='function')throw new Error('Gerador de PDF não retornou um documento válido');const blob=r.doc.output('blob');if(!(blob instanceof Blob))throw new Error('PDF inválido');const u=URL.createObjectURL(blob),w=window.open(u,'_blank');if(!w){r.doc.save(r.fname);toast('Pop-up bloqueado: o PDF foi baixado para você imprimir',3500)}setTimeout(()=>URL.revokeObjectURL(u),60000)}catch(e){console.error('Erro ao imprimir receituário:',e);toast('Falha ao gerar receituário: '+(e?.message||'erro desconhecido'),5000)}},
  rxsave:async (b,d,p)=>{if(!p)return;try{const r=await rxDoc(p);if(!r)return;if(!r.doc||typeof r.doc.output!=='function')throw new Error('Gerador de PDF não retornou um documento válido');const data=r.doc.output('datauristring').replace(/;filename=[^;]*;/,';');(p.arquivos=p.arquivos||[]).push({id:uid(),nome:r.fname,tipo:'application/pdf',categoria:'Receituário',data,dataEnvio:hojeBR()});save();render();toast('Receituário salvo no prontuário',3000)}catch(e){console.error(e);toast('Não foi possível salvar o receituário',3000)}},
  rxmodel:(b,d,p)=>{const st=view.rx;if(!st||st.model==='livre'&&!String(st.texto).trim())return;(db.rxm=db.rxm||{})[st.model]=st.texto;save();render();toast('Modelo salvo: será usado nos próximos receituários',3000)},
  cfgtab:(b,d)=>{view.cfgTab=d.t;render()},
  atpdf:async (b,d,p)=>{if(!p)return;try{const r=await atDoc(p);if(!r)return;r.doc.save(r.fname);toast('Atestado gerado',2200)}catch(e){console.error(e);toast('Não foi possível gerar o PDF',3000)}},
  atprint:async (b,d,p)=>{if(!p)return;try{const r=await atDoc(p);if(!r)return;const u=r.doc.output('bloburl'),w=window.open(u,'_blank');if(!w){r.doc.save(r.fname);toast('Pop-up bloqueado: o PDF foi baixado para você imprimir',3500)}}catch(e){console.error(e);toast('Não foi possível gerar o PDF',3000)}},
  atsave:async (b,d,p)=>{if(!p)return;try{const r=await atDoc(p);if(!r)return;const data=r.doc.output('datauristring').replace(/;filename=[^;]*;/,';');(p.arquivos=p.arquivos||[]).push({id:uid(),nome:r.fname,tipo:'application/pdf',categoria:'Atestado',data,dataEnvio:hojeBR()});save();render();toast('Atestado salvo no prontuário',3000)}catch(e){console.error(e);toast('Não foi possível salvar o atestado',3000)}},
  atreset:(b,d,p)=>{if(!view.at)return;view.at.edited=false;render();toast('Texto padrão restaurado',2200)},
  cfgattxt:()=>{db.cl=db.cl||{};db.cl.atTexto=AT_TXT_DEF;save();render();toast('Texto padrão do atestado restaurado',2500)},
  rxreset:(b,d,p)=>{const st=view.rx;if(!st||!p)return;if(db.rxm)delete db.rxm[st.model];st.texto=rxGen(p,st.model);st.edited=false;save();render();toast('Modelo original restaurado',2500)},
  cfglogorm:()=>{if(db.cl){db.cl.logo='';delete db.cl.logoW;delete db.cl.logoH;db.cl.semLogo=false}save();render();toast('Logo padrão restaurada',2500)},
  cfgnologo:()=>{if(!confirm('Remover todas as logos e deixar o sistema sem nenhuma imagem de logo?'))return;db.cl=db.cl||{};db.cl.logo='';db.cl.icone='';db.cl.semLogo=true;delete db.cl.logoW;delete db.cl.logoH;delete db.cl.iconeW;delete db.cl.iconeH;save();render();toast('Todas as logos foram removidas',2500)},
  cfgcolorreset:()=>{window.oralValleSetLocalAccent('#ff7a00');applyTheme();render();toast('Cor laranja padrão restaurada',2200)},
  cfgiconrm:()=>{if(db.cl){db.cl.icone='';delete db.cl.iconeW;delete db.cl.iconeH}save();render();toast('Ícone personalizado removido',2500)},
  agpick:(b,d)=>{const p=db.p.find(x=>x.id===d.id);if(!p)return;$('apn').value=p.nome;$('ap').value=p.id;const bx=$('apsug');bx.hidden=true;bx.innerHTML='';agAuto(p.id)},
  agstatus:(b,d)=>{const a=db.ag.find(x=>x.id===d.id);if(!a)return;a.st=a.st==='Confirmado'?'Compareceu':'Confirmado';save();render();},
  agedit:(b,d)=>{
    const a=db.ag.find(x=>String(x.id)===String(d.id));if(!a)return;
    const html=`<label>Data da consulta<input name="data" type="date" required value="${esc(a.data)}"></label><label>Horário<input name="hora" type="time" required value="${esc(a.hora)}"></label><label>Duração (minutos)<input name="dur" type="number" min="5" max="480" step="5" required value="${Number(a.dur||30)}"></label>`;
    ovAgDialog('Editar consulta',html,form=>{
      const data=String(form.get('data')||''),hora=String(form.get('hora')||''),dur=Number(form.get('dur'));
      if(!/^\d{4}-\d{2}-\d{2}$/.test(data)||Number.isNaN(Date.parse(data+'T12:00:00'))){toast('Data inválida.',3500);return false}
      if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)){toast('Horário inválido.',3500);return false}
      if(!Number.isFinite(dur)||dur<5||dur>480){toast('Duração inválida.',3500);return false}
      const test={...a,data,hora,dur};
      if(confl(test)){toast('Esse horário conflita com outro atendimento ou aluguel.',4500);return false}
      a.data=data;a.hora=hora;a.dur=dur;view.agDate=data;view.agExpanded='';save();render();toast('Agendamento atualizado.');
    });
  },
  agslot:(b,d)=>{const h=$('ah'),c=$('acadeira');if(!h||!c){toast('Cadastre um paciente para poder agendar',3000);return}h.value=d.h;c.value=d.c;h.dataset.touched='1';$('ad').value=view.agDate||tdy();const f=h.closest('.card');if(f)f.scrollIntoView({behavior:'smooth',block:'center'});toast('Preenchido: '+d.h+' no Consultório '+d.c+'. Escolha o paciente e agende.',3200)},
  actab:(b,d)=>{view.acTab=['acesso','usuarios','recuperacao'].includes(d.t)?d.t:'acesso';view.newrec=view.acTab==='recuperacao'?view.newrec:'';render()},
  acpw:async()=>{const a=$('acp0').value,n=$('acp1').value,n2=$('acp2').value,e=pwOk(n,n2);if(e){toast(e,3000);return}
    const u=AUTH.users.find(x=>x.id===ME.id);if(!u||(await hashPw(a,u.salt))!==u.hash){toast('Senha atual incorreta',3000);return}
    u.salt=rnd(16);u.hash=await hashPw(n,u.salt);aSave();['acp0','acp1','acp2'].forEach(i=>$(i).value='');toast('Senha alterada')},
  acadd:async()=>{if(!ME||!ME.admin)return;const nome=$('acn').value.trim(),login=lgn($('acl').value),pw=$('acs').value;
    if(!nome||!login){toast('Preencha nome e usuário',3000);return}if(pw.length<6){toast('A senha precisa ter pelo menos 6 caracteres',3000);return}
    if(AUTH.users.some(x=>x.login===login)){toast('Já existe um usuário com esse nome de entrada',3000);return}
    const salt=rnd(16);AUTH.users.push({id:uid(),nome,login,salt,hash:await hashPw(pw,salt),admin:false,perms:pmDefault()});view.pmOpen=AUTH.users[AUTH.users.length-1].id;aSave();render();toast('Usuário adicionado. Defina o que ele pode ver e alterar.',3500)},
  acadmin:(b,d)=>{
    if(!ME||!ME.admin||!d.id||d.id===ME.id)return;
    const target=AUTH.users.find(x=>String(x.id)===String(d.id));if(!target)return;
    const next=!target.admin;
    if(!next&&AUTH.users.filter(x=>x.admin).length<=1){toast('A clínica precisa manter ao menos um administrador',3500);return}
    if(!confirm(next?'Conceder acesso administrativo completo a '+target.nome+'?':'Retirar o acesso administrativo de '+target.nome+'?'))return;
    target.admin=next;
    if(!next)target.perms=pmDefault();
    if(!aSave()){target.admin=!next;return}
    render();toast(next?'Administrador adicionado':'Acesso administrativo retirado',3000);
  },
  acrm:(b,d)=>{if(!ME||!ME.admin||d.id===ME.id)return;arm(d.id,()=>{AUTH.users=AUTH.users.filter(x=>x.id!==d.id);aSave();render();toast('Usuário removido')})},
  acrec:async()=>{if(!ME||!ME.admin)return;const c=newCode(),s=rnd(16);AUTH.rec={salt:s,hash:await hashPw(recNorm(c),s)};aSave();view.newrec=c;render();toast('Novo código gerado. Anote agora.',3500)},
  orthonav:()=>{view.h='ortho';view.id=null;render();topo()},
  implnav:()=>{view.h='impl';view.id=null;render();topo()},
  protnav:()=>{view.h='prot';view.id=null;render();topo()},
  carebaixa:(b,d)=>{
    const p=db.p.find(x=>String(x.id)===String(d.id)),kind=d.kind;if(!p||!['ortho','impl','prot'].includes(kind))return;
    if(kind==='ortho')return ovOrthoMaintenance(b,p);
    if(!(kind==='impl'?p.implAtivo:p.protAtivo))return;
    const today=tdy(),stages=kind==='impl'?IMPL_ETAPAS:PROT_ETAPAS,key=kind==='impl'?'implEtapa':'protEtapa';
    const current=p[key]||stages[0];
    const detail=prompt('Descreva o procedimento realizado para registrar na evolução:',current);
    if(detail===null)return;if(!detail.trim()){toast('Informe o procedimento realizado');return}
    const next=stages[Math.min(stages.indexOf(current)+1,stages.length-1)];
    if(!confirm('Registrar a etapa "'+current+'" e avançar para "'+next+'"?'))return;
    (p.evol=p.evol||[]).push({id:uid(),data:today,n:'',txt:'['+(kind==='impl'?'Implantodontia':'Prótese')+'] '+detail.trim()+(kind==='prot'&&p.protCor?' | Cor: '+p.protCor:'')});
    p[key]=next;p[kind==='impl'?'implUltimaData':'protUltimaData']=today;
    save();view.id=p.id;view.tab='odo';render();topo();toast('Baixa registrada na evolução. Paciente permanece em acompanhamento.');
  },
  carealta:(b,d)=>{const p=db.p.find(x=>String(x.id)===String(d.id)),kind=d.kind;if(!p||!['ortho','impl','prot'].includes(kind))return;
    if(!confirm('Confirmar '+(kind==='ortho'?'alta ortodôntica':'conclusão do tratamento')+' de '+p.nome+'? O paciente sairá desta lista.'))return;
    const label=kind==='ortho'?'Ortodontia':kind==='impl'?'Implantodontia':'Prótese';
    (p.evol=p.evol||[]).push({id:uid(),data:tdy(),n:'',txt:'['+label+'] Tratamento finalizado / alta registrada.'});
    if(kind==='ortho')p.orthoMensal=false;else if(kind==='impl'){p.implAtivo=false;p.implEtapa='Tratamento concluído';p.implAltaEm=tdy()}else{p.protAtivo=false;p.protEtapa='Tratamento concluído';p.protAltaEm=tdy()}
    save();render();toast('Alta registrada no prontuário');
  },
  nav:(b,d)=>{view.obx=null;view.obxAll=null;view.h=d.t;view.id=null;view.trForm=false;view.trDraft=null;view.link=null;view.novoPac=false;delArm=null;view.prOpen=null;if(d.t==='pf'){view.pfPid='';view.pfNew=false}if(d.t!=='cm')view.cmDent='';render();topo()},
  pfShow:(b,d)=>{view.pfGroup=['proposal','approved','lost'].includes(d.t)?d.t:'proposal';view.pfSt='';view.pfNew=false;render();},
  pfNew:()=>{view.pfNew=true;view.pfPid='';render()},
  pfCancel:()=>{view.pfNew=false;render()},
  pfOpen:(b,d)=>{if(d.oid)(view.orcOpen=view.orcOpen||{})[d.oid]=true;view.id=d.pid;view.tab='orc';view.trSel=[];view.trTd={};view.trSh={};view.trUni=null;view.trBasket=[];view.trForm=false;view.trDraft=null;view.trFlt='';delArm=null;render();topo()},
  pfCreate:()=>{const p=db.p.find(x=>x.id===view.pfPid);if(!p){toast('Selecione um paciente');return}
    p.orcs.unshift({id:uid(),data:new Date().toLocaleDateString('pt-BR'),status:'Pendente',itens:[{id:uid(),proc:'',dente:'',valor:'',dt:defDt()}],desc:'',val:plusDays(15),cond:''});
    save();view.pfNew=false;view.id=p.id;view.tab='orc';render();topo();toast('Proposta criada para '+p.nome)},
  avsok:(b,d)=>{avsList=avsList.filter(x=>x.id!==d.id);avsRender()},
  avsgo:(b,d)=>{const a=(db.ag||[]).find(x=>x.id===d.id);avsList=avsList.filter(x=>x.id!==d.id);view.h='ag';view.id=null;if(a)view.agDate=a.data;render();avsRender();topo()},
  avsperm:()=>{avsAudio();try{const r=Notification.requestPermission(res=>{});if(r&&r.then)r.then(()=>{render()});else render()}catch(e){toast('Não foi possível pedir permissão neste navegador.',3500)}},
  avstest:async()=>{avsAudio();avsBeep();try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(e){}const ok=await avsNotify('Teste de aviso','Assim chegará o aviso do horário do paciente.','teste');toast(ok?'Aviso de teste enviado':'Aviso na tela ativo. Notificação do celular ainda não ativada.',3500)},
  pfNext:()=>{const p=db.p.find(x=>x.id===view.pfPid);if(!p){toast('Selecione um paciente');return}toast('Paciente selecionado: '+p.nome)},
  addlem:()=>{
    const titulo=$('lemTitulo').value.trim();
    if(!titulo){toast('Escreva o lembrete antes de adicionar');$('lemTitulo').focus();return}
    db.lem=db.lem||[];
    db.lem.push({id:uid(),titulo,data:$('lemData').value||tdy(),hora:$('lemHora').value||'',tipo:$('lemTipo').value||'Geral',obs:$('lemObs').value.trim(),feito:false});
    save();render();toast('Lembrete adicionado');
  },
  togglelem:(b,d)=>{const x=(db.lem||[]).find(y=>y.id===d.id);if(!x)return;x.feito=!x.feito;delArm=null;save();render()},
  rmlem:(b,d)=>arm(d.id,()=>{db.lem=(db.lem||[]).filter(x=>x.id!==d.id);save();render();toast('Lembrete excluído')}),
  svw:(b,d)=>{view.sv=d.t;view.vPage=0;render()},
  cmdent:(b,d)=>{view.cmDent=d.id;render();topo()},
  cmback:()=>{view.cmDent='';render();},
  agf:(b,d)=>{view.ag=d.t;render()},
  agdate:(b,d)=>{const e=$('agDate');if(e&&e.value){const x=new Date(e.value+'T12:00:00');x.setDate(x.getDate()+num(d.d));view.agDate=x.toISOString().slice(0,10);render()}},
  agtoday:()=>{view.agDate=tdy();render()},
  arqt:()=>{view.arq=!view.arq;view.pPage=0;view.pendOnly=false;q='';render()},
  novoPac:()=>{view.novoPac=true;render();setTimeout(()=>$('nn')?.focus(),50)},
  cancelNovoPac:()=>{view.novoPac=false;render()},
  dent:(b,d)=>{view.dent=d.t;render()},
  add:()=>{const n=$('nn').value.trim();if(!n){toast('Digite o nome do paciente');return}
    const cpfTxt=($('nc')?$('nc').value:'').trim(),tel=$('nt').value.trim();
    const r=pvCheck(n,cpfTxt,tel),bl=pvBloqueios(r,cpfTxt);
    if(bl.length){pvRender();toast(bl[0][0]+(bl[0][1]?': '+bl[0][1].nome:''),4200);return}
    db.p.push({id:uid(),nome:n,tel:pvFmtTel(tel),nasc:'',cpf:pvFmtCpf(cpfTxt),obs:'',arq:false,anam:{c:{},med:'',queixa:'',ultima:''},orcs:[],trat:[],olog:[],dplan:[],evol:[]});save();q='';view.novoPac=false;render();toast('Paciente cadastrado')},
  open:async (b,d)=>{const patient=db.p.find(x=>String(x.id)===String(d.id));if(!patient)return;if(window.OralCloud?.enabled&&window.OralCloudData?.loadPatient&&!OralCloudData.patientLoaded(patient.id)){b.disabled=true;b.setAttribute('aria-busy','true');try{const details=await OralCloudData.loadPatient(patient.id);if(details)Object.assign(patient,details);OralCloudData.prepareDefaults(db)}catch(error){b.disabled=false;b.removeAttribute('aria-busy');toast('Não foi possível carregar o prontuário: '+(error.message||'erro de conexão'),5000);return}}view.id=d.id;view.tab='dados';view.trSel=[];view.trTd={};view.trSh={};view.trUni=null;view.trBasket=[];view.trForm=false;view.trDraft=null;view.trFlt='';delArm=null;render();topo()},
  back:()=>{view.id=null;delArm=null;render()},
  tab:(b,d)=>{if(d.t==='auditoria'&&!window.OralPatientAudit?.allowed())return;const mobile=window.matchMedia('(max-width:760px)').matches;const tabs=mobile?b.closest('.tabs'):null;const left=tabs?tabs.scrollLeft:null;view.tab=d.t;delArm=null;render();if(left!==null){const restore=()=>{const next=document.querySelector('.ov-content .tabs');if(next)next.scrollLeft=left};restore();requestAnimationFrame(restore)}},
  auditrefresh:()=>{const p=cur();if(p&&window.OralPatientAudit?.allowed())window.OralPatientAudit.refresh(p.id)},
  verificarArquivoAssinado:async(b,d,p)=>{if(!p)return;const f=(p.arquivos||[]).find(x=>String(x.id)===String(d.id));if(!f||!f.sha256||!f.data){alert('Arquivo ou hash não disponível.');return;}try{const response=await fetch(f.data);const bytes=await response.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');alert(hash.toLowerCase()===String(f.sha256).toLowerCase()?'Integridade conferida: o PDF corresponde ao SHA-256 armazenado. Isso NÃO verifica a identidade do signatário.':'ALERTA: o conteúdo do PDF não corresponde ao SHA-256 registrado.');}catch(e){alert('Não foi possível verificar o arquivo: '+e.message);}},
  rmArquivo:(b,d,p)=>{if(!p)return;const f=(p.arquivos||[]).find(x=>String(x.id)===String(d.id));if(f&&(f.assinaturaTipo||f.sha256||/assinad/i.test(String(f.categoria||'')))){alert('Documento com assinatura: exclusão bloqueada nesta tela. A proteção definitiva exige políticas no Supabase.');return;}p.arquivos=(p.arquivos||[]).filter(x=>x.id!==d.id);save();render();toast('Arquivo removido do prontuário')},
  arq:(b,d,p)=>{p.arq=!p.arq;save();view.id=null;render();toast(p.arq?'Paciente arquivado':'Paciente reativado')},
  del:(b,d,p)=>{
    if(!p.arq){toast('Arquive o paciente antes de excluir');return}
    if(db.vd.some(v=>v.pid===p.id)||db.ag.some(a=>a.pid===p.id)){toast('Há vendas ou consultas ligadas a este paciente. Mantenha arquivado.',3500);return}
    arm(p.id,()=>{db.p=db.p.filter(x=>x.id!==p.id);save();view.id=null;render();toast('Paciente excluído')})},
  tooth:(b,d)=>{view.tsel=d.n;render()},
  ttsel:(b,d)=>{const s=(view.trSel||[]).map(String),i=s.indexOf(d.n);if(i>=0)s.splice(i,1);else s.push(d.n);view.trSel=s;b.classList.toggle('sel');ttRefresh()},
  ttmode:(b,d)=>{view.trMode=d.m;ttRefresh()},
  ttmore:(b,d,p)=>{const c=ttCollect();if(c.err){toast(c.err[0],2800);ttFocus(c.err[1]);return}
    if(!c.lines.length){toast('Selecione os dentes e o tratamento primeiro');return}
    c.lines.forEach(l=>{l.id=uid();ttBasket().push(l)});
    document.querySelectorAll('.tt.sel').forEach(x=>x.classList.remove('sel'));
    view.trSel=[];view.trTd={};view.trUni=null;ttRefresh();
    toast('Procedimento adicionado à lista. Selecione os dentes do próximo procedimento.',3200)},
  ttbrm:(b,d)=>{view.trBasket=ttBasket().filter(l=>l.id!==d.id);ttRefresh()},
  ttrm:(b,d)=>{view.trSel=(view.trSel||[]).map(String).filter(x=>x!==d.n);const bt=document.querySelector('.tt[data-n="'+d.n+'"]');if(bt)bt.classList.remove('sel');ttRefresh()},
  trcancel:()=>{view.trForm=false;view.trDraft=null;render()},
  tsit:(b,d,p)=>{const n=view.tsel;if(!n)return;const o=(p.odo=p.odo||{}),de=o[n]||0,pa=+d.v;if(de===pa)return;o[n]=pa;(p.olog=p.olog||[]).push({d:new Date().toLocaleDateString('pt-BR'),n:+n,de,pa});if(p.olog.length>200)p.olog.shift();save();render()},
  addplan:(b,d,p)=>{const t=$('dpt').value.trim();if(!t){toast('Descreva o que precisa ser feito');return}(p.dplan=p.dplan||[]).push({id:uid(),n:view.tsel,txt:t,feito:false,data:tdy()});save();render();toast('Anotado no dente '+view.tsel)},
  planok:(b,d,p)=>{const x=(p.dplan||[]).find(y=>y.id===d.id);if(!x)return;x.feito=true;x.fdata=tdy();(p.evol=p.evol||[]).push({id:uid(),data:tdy(),n:x.n,txt:x.txt});save();render();toast('Lançado na evolução de hoje')},
  rmplan:(b,d,p)=>arm(d.id,()=>{p.dplan=p.dplan.filter(x=>x.id!==d.id);save();render()}),
  addevol:(button,d,p)=>{
    const form=$('odo-evolution');
    if(!p||!form||button.disabled)return;
    const tooth=$('evn').value, date=$('evd').value||tdy(), description=$('evt').value.trim();
    const completion=form.odontogramCompletion;
    let record;
    if(completion){
      record=p.odo?.__nexoVisual?.records?.[tooth]?.[completion.index];
      if(completion.patientId!==p.id||completion.tooth!==tooth||!record||JSON.stringify(record)!==completion.snapshot){
        clearOdontogramCompletion();toast('A marcação mudou. Selecione o procedimento novamente.');return;
      }
    }
    if(!description&&!tooth){toast('Selecione um dente ou escreva a evolução.');return}
    const text=record?[completion.procedure||'Procedimento realizado',description].filter(Boolean).join(' — '):
      description||'Evolução registrada para o dente '+tooth+'.';
    button.disabled=true;
    const id=uid();
    (p.evol=p.evol||[]).push({id,data:date,n:tooth,txt:text});
    if(record){record.status='finalizado';record.evolutionId=id;}
    save();render();toast(record?'Baixa e evolução registradas.':'Evolução salva');
  },
  rmevol:async (b,d,p)=>{
    const evolution=p?.evol?.find(item=>item.id===d.id);
    if(!evolution||evolution.maintenanceCancellation)return;
    if(!isOrthoMaintenance(evolution)){
      arm(d.id,()=>{p.evol=p.evol.filter(x=>x.id!==d.id);save();render()});
      return;
    }
    if(!ME?.admin){toast('Somente administradores podem cancelar manutenções.');return;}
    const cloud=window.OralCloud;
    const clinic=cloud?.clinicId;
    const actor=cloud?.enabled?cloud.session?.user?.id:ME.id;
    if(cloud?.enabled){
      if(!actor||!clinic)return toast('Entre na clínica para cancelar a manutenção.');
      b.disabled=true;
      try{
        const allowed=await cloud.request('/rest/v1/rpc/nexodent_can_cancel_maintenance',{method:'POST',body:{p_clinic:clinic}});
        if(!allowed)return toast('Somente administradores podem cancelar manutenções.');
        if(cloud.clinicId!==clinic||cur()!==p||!b.isConnected)return;
      }catch(error){
        toast('Cancelamento administrativo indisponível. Confira a atualização do Supabase e tente novamente.',5000);
        return;
      }finally{b.disabled=false;}
    }
    const sales=db.vd.filter(sale=>sale.pid===p.id&&sale.orthoEvolutionId===evolution.id);
    const reason=prompt('Motivo do cancelamento da manutenção:');
    if(reason===null)return;
    if(!reason.trim()||reason.trim().length>500){toast('Informe um motivo de até 500 caracteres.');return;}
    const totalReceived=sales.reduce((total,sale)=>total+recebido(sale),0);
    const financial=sales.length?' O lançamento vinculado será retirado de Vendas.':'';
    const payments=totalReceived>0?' Isso removerá '+brl(totalReceived)+' em recebimentos registrados. Nenhum valor será devolvido automaticamente.':'';
    if(!confirm('Cancelar esta manutenção e manter o original no histórico?'+financial+payments))return;

    evolution.maintenanceCancellation={reason:reason.trim(),at:new Date().toISOString(),by:actor};
    const remaining=p.evol.filter(item=>isOrthoMaintenance(item)&&!item.maintenanceCancellation);
    const month=String(evolution.data||'').slice(0,7);
    if(!remaining.some(item=>item.data?.slice(0,7)===month)){
      p.orthoBaixas=(p.orthoBaixas||[]).filter(value=>value!==month);
    }
    if(p.orthoUltimaData===evolution.data){
      p.orthoUltimaData=remaining.map(item=>item.data||'').sort().at(-1)||'';
    }
    if(sales.length){
      const linked=new Set(sales);
      db.vd=db.vd.filter(sale=>!linked.has(sale));
    }
    save();render();
    toast('Cancelamento registrado. Confira a confirmação de salvamento.');
  },
  sigclr:(b,d,p)=>{p.sign='';p.signDate='';p.signTermo='';save();render()},
  addo:(b,d,p)=>{const nid=uid();(view.orcOpen=view.orcOpen||{})[nid]=true;p.orcs.unshift({id:nid,data:new Date().toLocaleDateString('pt-BR'),status:'Pendente',itens:[{id:uid(),proc:'',dente:'',valor:'',dt:defDt()}],desc:'',val:plusDays(15),cond:''});save();render()},
  addi:(b,d,p)=>{getO(p,d.o).itens.push({id:uid(),proc:'',dente:'',valor:'',dt:defDt()});save();render()},
  rmi:(b,d,p)=>{const o=getO(p,d.o),it=o.itens[+d.i];if(it&&(it.vid||it.paymentSaleId)){toast('Este item já teve baixa. Exclua a venda antes de remover.',3000);return}if(it&&it.tid){const t=(p.trat||[]).find(z=>z.id===it.tid);if(t){delete t.oid;delete t.oiid}}o.itens.splice(+d.i,1);save();render()},
  addtr:(b,d,p)=>{
    if((view.trSel||[]).length||ttBasket().length){ttSave(p);return}
    if(!view.trForm){view.trForm=true;view.trDraft=view.trDraft||{};render();setTimeout(()=>{const e=$('trform');if(e)e.scrollIntoView({behavior:'smooth',block:'center'})},60);return}
    const proc=$('tnp').value.trim(),dt=$('tnd').value,val=num($('tnv').value),custo=num($('tnc').value),obs=$('tnobs').value.trim(),oid=$('tnor').value,m=procBy(proc);
    if(!proc){toast('Selecione o procedimento');return}
    if(!dt){toast('Escolha o dentista responsável');return}
    if(!(val>0)){toast('Informe o valor do tratamento');return}
    p.trat=p.trat||[];
    const teeth=(view.trSel||[]).map(String).sort((a,b)=>a-b),list=teeth.length?teeth:[''];
    let orc=null;
    if(oid==='new'){orc={id:uid(),data:new Date().toLocaleDateString('pt-BR'),status:'Pendente',itens:[],desc:'',val:plusDays(15),cond:''};p.orcs.unshift(orc)}
    else if(oid&&oid!=='none'){
      orc=getO(p,oid);if(!orc||orc.archivedAt){toast('Selecione um orçamento ativo.');return}
    }
    list.forEach(n=>{
      const t={id:uid(),proc,dente:n,obs,valor:r2(val),custo:r2(custo),mats:m?matSnap(m):[],dt,status:'Pendente',rep:0,vid:null,data:''};
      if(orc){const it={id:uid(),proc,dente:n,valor:String(r2(val)),obs,dt,tid:t.id};orc.itens.push(it);t.oid=orc.id;t.oiid=it.id}
      p.trat.push(t);
    });
    view.trSel=[];view.trForm=false;view.trDraft=null;save();render();
    toast(list.length>1?list.length+' tratamentos adicionados':'Tratamento adicionado'+(orc?' ao orçamento':''),2400)},
  trbaixa:(b,d,p)=>{
    if(!p)return;
    const o=d.o&&getO(p,d.o);
    if(d.o&&(!o||o.status!=='Aprovado')){toast('O orçamento precisa estar aprovado.');return}
    let item=o?.itens.find(i=>String(i.id)===String(d.item));
    let x=d.id?(p.trat||[]).find(t=>String(t.id)===String(d.id)):item&&(p.trat||[]).find(t=>(item.tid&&t.id===item.tid)||(t.oiid===item.id&&t.oid===o.id));
    if(!x&&!item)return;
    const fresh=!x;
    if(fresh)x={proc:item.proc,dente:item.dente||'',obs:item.obs||'',valor:r2(num(item.valor)*fac(o)),dt:item.dt,qtd:item.qtd,unit:item.unit,oid:o.id,oiid:item.id,status:'Pendente',mats:[]};
    if(!item&&x.oiid)item=(getO(p,x.oid)?.itens||[]).find(i=>i.id===x.oiid);
    if(x.vid||item?.vid||x.status==='Concluído'){toast('Este procedimento já foi concluído.');return}
    if(x.status==='Cancelado'||item?.status==='Cancelado'){toast('Este procedimento está cancelado.');return}
    if(!x.dt){toast('Escolha o dentista responsável no orçamento antes de concluir.');return}
    let v=item?.paymentSaleId?db.vd.find(v=>v.id===item.paymentSaleId&&v.pid===p.id):null;
    if(item?.paymentSaleId&&!v){toast('Vínculo financeiro não encontrado. Confira antes de concluir.');return}
    const val=v?num(v.valor):r2(num(x.valor));if(!(val>0)){toast('Informe o valor do procedimento no orçamento.');return}
    if(!confirm('Concluir '+(x.proc||'este procedimento')+(x.dente?' — dente '+x.dente:'')+'? Isso registra somente esta execução clínica e preserva os pagamentos existentes.'))return;
    const mm=comCalc(x.dt,x.proc,val,qOf(x)),rep=r2(mm.rep),data=tdy();
    if(fresh){x.id=uid();(p.trat=p.trat||[]).push(x);item.tid=x.id}
    if(v){Object.assign(v,{dt:x.dt,proc:x.proc,mat:mm.mat,lab:mm.lab,rep,clinicalPending:false,performedAt:data})}
    else{v={id:uid(),pid:p.id,dt:x.dt,proc:x.proc,valor:val,mat:mm.mat,lab:mm.lab,rep,data,pg:[]};db.vd.push(v)}
    x.vid=v.id;x.status='Concluído';x.rep=rep;x.data=data;
    (p.evol=p.evol||[]).push({id:uid(),data,n:x.dente||'',txt:(x.proc||'Procedimento')+(x.dente?' ('+dLab(x.dente)+' '+x.dente+')':'')+(x.obs?': '+x.obs:''),auto:true,vid:v.id,tid:x.id});
    if(item)item.vid=v.id;save();render();toast('Procedimento concluído. Pagamentos existentes preservados.');
  },
  rmtr:(b,d,p)=>{const x=(p.trat||[]).find(t=>t.id===d.id);if(x&&(x.vid||(getO(p,x.oid)?.itens||[]).some(i=>i.id===x.oiid&&i.paymentSaleId))){toast('Não é possível excluir um tratamento com baixa. Exclua a venda primeiro.',3000);return}arm(d.id,()=>{if(x&&x.oiid){const oo=getO(p,x.oid);if(oo)oo.itens=oo.itens.filter(i=>i.id!==x.oiid)}p.trat=p.trat.filter(y=>y.id!==d.id);save();render()})},
  copy:(b,d,p)=>copy(orcText(p,getO(p,d.o)),'Orçamento copiado'),
  owa:(b,d,p)=>waOpen(p.tel,orcText(p,getO(p,d.o))),
  print:(b,d,p)=>printOrc(p,getO(p,d.o)),
  pdf:(b,d,p)=>pdfOrc(p,getO(p,d.o)),
  obaixa:(b,d,p)=>{
    const o=getO(p,d.o),it=o.itens[+d.i];
    if(!it.dt){toast('Escolha o dentista que vai executar');return}
    const v=r2(num(it.valor)*fac(o));if(!(v>0)){toast('Informe o valor do item');return}
    view.obx=o.id+':'+it.id;view.obxAll=null;render()},
  obcancel:()=>{view.obx=null;view.obxAll=null;render()},
  lemtab:(b,d)=>{view.lemTab=d.t;render()},
  orthowa:(b,d)=>{const p=db.p.find(x=>x.id===d.id);if(!p)return;const nome=String(p.nome||'').trim().split(/\s+/)[0]||'Olá';waOpen(p.tel,'Olá, '+nome+'! Está na hora do seu retorno mensal de ortodontia. Podemos agendar sua próxima manutenção?')},
  retwa:(b,d)=>{const p=db.p.find(x=>x.id===d.id);if(!p)return;waOpen(p.tel,retMsg(p,retLast(p)));p.retCont=tdy();save();render()},
  retok:(b,d)=>{const p=db.p.find(x=>x.id===d.id);if(!p)return;p.retCont=tdy();save();render();toast('Contato registrado',2000)},
  retall:()=>{view.retAll=!view.retAll;render()},
  cfgretmsg:()=>{db.cl=db.cl||{};db.cl.retMsg=RET_MSG_DEF;save();render();toast('Mensagem padrão restaurada',2500)},
  rmorc:(b,d,p)=>{
    if(!p)return;
    const o=(p.orcs||[]).find(x=>String(x.id)===String(d.o));if(!o||o.archivedAt)return;
    arm('orc:'+o.id,()=>{
      const vinculados=(p.trat||[]).filter(t=>String(t.oid)===String(o.id));
      const hasFinancial=(o.itens||[]).some(i=>i.vid||i.paymentSaleId)||vinculados.some(t=>t.vid);
      const message=hasFinancial
        ? 'Retirar este orçamento da lista? Vendas, recebimentos, taxas, comissões e saldos vinculados sairão dos totais. O histórico ficará em Arquivados e poderá ser restaurado.'
        : 'Excluir definitivamente este orçamento e sua proposta financeira? Os tratamentos vinculados serão mantidos, mas sem vínculo com a proposta.';
      if(!confirm(message))return;
      if(hasFinancial){
        o.archivedAt=new Date().toISOString();
      }else{
        vinculados.forEach(t=>{t.oid=null;t.oiid=null});
        p.orcs=p.orcs.filter(x=>String(x.id)!==String(o.id));
      }
      if(view.orcOpen)delete view.orcOpen[o.id];
      if(view.obxAll===o.id)view.obxAll=null;
      save();render();toast(hasFinancial?'Orçamento retirado da lista e arquivado.':'Orçamento e proposta excluídos.');
    });
  },
  restoreorc:(b,d,p)=>{
    const o=p&&getO(p,d.o);if(!o?.archivedAt)return;
    delete o.archivedAt;
    save();render();toast('Orçamento restaurado à lista.');
  },
  orcsave:(b,d,p)=>{
    const o=p&&getO(p,d.o);if(!o)return;
    if(o.status==='Aprovado'){
      const result=ovSyncBudgetFinancial(p,o);
      if(!result.ok){toast(result.message,5500);return}
    }
    save();render();toast('Orçamento salvo e financeiro sincronizado.',3200);
  },
  orccollapse:(b,d,p)=>{if(!p||!getO(p,d.o))return;save();view.orcOpen=view.orcOpen||{};view.orcOpen[d.o]=false;view.obx=null;view.obxAll=null;render();toast('Orçamento recolhido. Toque no resumo para abrir novamente.',2600)},
  otoggle:(b,d)=>{view.orcOpen=view.orcOpen||{};view.orcOpen[d.o]=!view.orcOpen[d.o];view.obx=null;view.obxAll=null;render()},
  obundoall:(b,d,p)=>{
    const o=p&&getO(p,d.o);if(!o)return;
    const rows=ovBudgetUndoRows(p,o);
    if(!rows){toast('Vínculos financeiros inconsistentes. Nenhuma baixa foi desfeita.',4500);return}
    if(!rows.length){toast('Este orçamento não tem baixas para desfazer.');return}
    const total=r2(rows.reduce((s,v)=>s+recebido(v),0)),n=rows.reduce((s,v)=>s+(v.pg||[]).length,0);
    if(!confirm('Desfazer todas as baixas deste orçamento?\n\n'+rows.length+' atendimento(s) financeiro(s) e suas comissões serão removidos.\n'+n+' recebimento(s), totalizando '+brl(total)+', serão removidos do caixa.\n\nOs procedimentos voltarão a ficar pendentes. O histórico clínico e uma cópia dos lançamentos serão preservados. Será necessário registrar novamente os recebimentos. Isso não devolve dinheiro ao paciente.'))return;
    const ids=new Set(rows.map(v=>String(v.id)));
    const registro={id:uid(),data:new Date().toISOString(),usuario:ME&&(ME.nome||ME.login||ME.id)||'Usuário',recebido:total,vendas:JSON.parse(JSON.stringify(rows))};
    (o.baixasDesfeitas=o.baixasDesfeitas||[]).push(registro);
    o.itens.forEach(i=>{if(i.vid&&ids.has(String(i.vid)))delete i.vid;if(i.paymentSaleId&&ids.has(String(i.paymentSaleId)))delete i.paymentSaleId});
    (p.trat||[]).forEach(t=>{if(t.vid&&ids.has(String(t.vid))){t.vid=null;t.status='Pendente';t.rep=0;t.data=''}});
    (db.ag||[]).forEach(a=>{if(a.vid&&ids.has(String(a.vid))){delete a.vid;if(a.st==='Compareceu')a.st='Confirmado'}});
    // Não apaga nem altera evoluções anteriores, inclusive as assinadas.
    (p.evol=p.evol||[]).push({id:uid(),data:tdy(),n:'',txt:'Baixas do orçamento de '+o.data+' desfeitas por '+registro.usuario+': '+rows.length+' atendimento(s) e '+brl(total)+' em recebimentos removidos. Procedimentos reabertos para correção.',auto:false});
    db.vd=db.vd.filter(v=>!ids.has(String(v.id)));
    view.obx=null;view.obxAll=null;save();render();toast('Baixas desfeitas. Edite o orçamento e refaça os lançamentos.',4500);
  },
  oball:(b,d,p)=>{
    const o=getO(p,d.o),pend=o.itens.filter(it=>!it.vid&&!it.paymentSaleId);
    const sd=pend.find(it=>!it.dt);if(sd){toast('Escolha o dentista do item "'+(sd.proc||'sem nome')+'" antes de dar baixa',3500);return}
    const sv=pend.find(it=>!(r2(num(it.valor)*fac(o))>0));if(sv){toast('Informe o valor do item "'+(sv.proc||'sem nome')+'"',3500);return}
    view.obx=null;view.obxAll=o.id;render()},
  obfull:(b,d,p)=>{
    const o=p&&getO(p,d.o);
    if(!o||o.status!=='Aprovado')return;
    const method=b.closest('details')?.querySelector('[data-ob-full-method]')?.value;
    if(!method){toast('Selecione a forma realmente utilizada no pagamento.');return}
    const linked=obLinkedSales(p,o);
    const pending=o.itens.filter(it=>!it.paymentSaleId&&!it.vid);
    if(linked.length+pending.length!==o.itens.length){toast('Confira os vínculos financeiros deste orçamento antes de quitar.');return}
    const value=it=>r2(num(it.valor)*fac(o));
    if(pending.some(it=>!it.dt||value(it)<=0)){toast('Confira o dentista e o valor de cada item.');return}
    const due=r2(linked.reduce((sum,sale)=>sum+saldoV(sale),0)+pending.reduce((sum,it)=>sum+value(it),0));
    if(due<=0||due!==Number(d.amount)){toast('O saldo mudou. Abra novamente o recebimento para conferir.');render();return}
    const date=obReceiptDate(b,d.dateField);
    if(!date)return;
    const sales=[...linked,...pending.map(it=>obLaunch(p,it,value(it),0,'',date,0))];
    obAllocateReceipts(sales,[ovFeeMake(due,method,date)]);
    view.obxAll=null;save();render();toast('Quitação registrada no orçamento.');
  },
  oballconf:(b,d,p)=>{
    const o=getO(p,d.o),pend=o.itens.filter(it=>!it.vid&&!it.paymentSaleId);if(!pend.length)return;
    const val=it=>r2(num(it.valor)*fac(o)),tot=r2(pend.reduce((a,it)=>a+val(it),0));
    if(pend.some(it=>!it.dt||!(val(it)>0))){toast('Confira o dentista e o valor de cada item.');return}
    const forms=nxPayMethods(nxPayPlan(o));

    const amounts=['oab','oab2'].map(field=>r2(num($(field)?.value)));
    const received=r2(amounts.reduce((sum,amount)=>sum+amount,0));
    if(amounts.some(amount=>amount<0)||!(received>0)){toast('Informe os valores efetivamente recebidos.');return}
    if(received>tot){toast('O valor recebido é maior que o total da baixa ('+brl(tot)+')',3500);return}
    const data=obReceiptDate(b,'oad');
    if(!data)return;
    const receipts=forms.flatMap((method,index)=>amounts[index]>0?[ovFeeMake(amounts[index],method,data)]:[]);
    const sales=pend.map(it=>obLaunch(p,it,val(it),0,'',data,0));
    obAllocateReceipts(sales,receipts);
    view.obxAll=null;save();render();toast(pend.length+(pend.length===1?' item financeiro':' itens financeiros')+': financeiro registrado, procedimentos permanecem pendentes',3500)},
  obcollectconf:(b,d,p)=>{
    const o=getO(p,d.o);if(!o||o.status!=='Aprovado')return;
    const sales=obLinkedSales(p,o);
    const outstanding=sales.filter(v=>saldoV(v)>0.005);
    const totalDue=r2(outstanding.reduce((sum,v)=>sum+saldoV(v),0));
    if(!outstanding.length){toast('Este orçamento não tem saldo em aberto.');return}
    const forms=nxPayMethods(nxPayPlan(o));

    const fields=['obc1','obc2'];
    const panel=b.closest('.ob-pay');
    const amounts=fields.map(field=>r2(num(panel?.querySelector('input#'+field)?.value)));
    if(amounts.some(a=>a<0)||amounts.some(a=>!Number.isFinite(a))){toast('Confira os valores informados.');return}
    const totalReceived=r2(amounts.reduce((sum,a)=>sum+a,0));
    if(!(totalReceived>0)){toast('Informe pelo menos um valor recebido.');return}
    if(totalReceived>totalDue+0.005){toast('O recebimento supera o saldo em aberto ('+brl(totalDue)+').');return}
    const date=obReceiptDate(b,'obcd');
    if(!date)return;
    const receipts=forms.flatMap((method,index)=>amounts[index]>0?[ovFeeMake(amounts[index],method,date)]:[]);
    obAllocateReceipts(outstanding,receipts);
    save();render();toast('Recebimento registrado no orçamento e distribuído entre os saldos em aberto.');
  },
  obconf:(b,d,p)=>{
    const o=getO(p,d.o),it=o&&o.itens[+d.i];if(!it)return;
    if(it.vid||it.paymentSaleId){toast('Este item já possui lançamento financeiro. Registre o recebimento no saldo existente.');return}
    if(!it.dt){toast('Escolha o dentista que vai executar');return}
    const vv=num($('obv').value);if(!(vv>0)){toast('Informe o valor do atendimento');return}
    const rc=num($('obc').value);if(!(rc>0)){toast('Informe o valor efetivamente recebido.');return}
    if(rc>vv+0.005){toast('O valor recebido é maior que o valor da venda');return}
    obLaunch(p,it,vv,rc,$('obf').value,$('obd').value||tdy(),0);
    view.obx=null;save();render();toast('Recebimento registrado. O procedimento permanece pendente.',3000)},
  addvd:()=>{
    const vv=num($('vv').value);if(!(vv>0)){toast('Informe o valor do atendimento');return}
    const dtid=$('vdn').value;if(!dtid){toast('Escolha o dentista');return}
    let rc=$('vrc').value.trim()===''?0:num($('vrc').value);
    if(rc>vv){toast('O valor recebido é maior que o valor da venda');return}
    const proc=$('vpr').value.trim(),mm=comCalc(dtid,proc,vv,(view.pre&&view.pre.qtd)||1),data=$('vdt').value||tdy(),pid=$('vp').value;
    if(!pid){toast('Selecione o paciente');return}
    const override=$('ovFeeOverride'), rawPct=override?.value;
    const pct=ovFeeReadRate(rawPct);
    if(rc>0&&(override?.validity.badInput||rawPct&&pct===null)){toast('Taxa inválida');return}
    if(view.link?.oid){
      const p=db.p.find(p=>p.id===pid),o=p&&getO(p,view.link.oid),it=o?.itens.find(i=>i.id===view.link.ii);
      if(!it||view.link.pid!==pid){toast('Orçamento não encontrado para este paciente.');return}
      if(it.vid||it.paymentSaleId){toast('O item já possui financeiro. Registre o recebimento no saldo existente.');return}
      obLaunch(p,it,vv,rc,$('vfm').value,data,0,pct);view.link=null;save();render();toast('Financeiro registrado. Procedimento permanece pendente.');return;
    }
    const v={id:uid(),pid,dt:dtid,proc,valor:r2(vv),mat:mm.mat,lab:mm.lab,rep:r2(num($('vr').value)),data,pg:[]};
    if(rc>0)v.pg.push(ovFeeMake(rc,$('vfm').value,data,null,pct));
    const lk=view.link;
    if(lk&&lk.pid===pid){
      if(lk.ag){const a=db.ag.find(x=>x.id===lk.ag);if(a){a.vid=v.id;a.st='Compareceu'}}
    }
    {const pt=db.p.find(x=>x.id===pid);
     if(pt){
       let dente='',ag=null;
       if(lk&&lk.pid===pid){
         if(lk.oid)db.p.forEach(q=>(q.orcs||[]).forEach(o=>o.itens.forEach(i=>{if(i.id===lk.ii&&i.dente)dente=String(i.dente)})));
         if(lk.ag)ag=db.ag.find(x=>x.id===lk.ag)||null;
       }
       const txt=(proc||'Atendimento')+' — realizado por '+dName(dtid)+'.'+(ag?'\nConsulta agendada: '+ag.hora+'–'+hm(mins(ag.hora)+(ag.dur||30))+'.':'');
       (pt.evol=pt.evol||[]).push({id:uid(),data,n:dente,txt,auto:true,vid:v.id,ag:ag?ag.id:undefined});
     }}
    view.link=null;db.vd.push(v);save();render();toast('Venda lançada e evolução atualizada')},
  rmvd:(b,d)=>arm(d.id,()=>{
    db.p.forEach(p=>p.orcs.forEach(o=>o.itens.forEach(i=>{if(i.vid===d.id)delete i.vid;if(i.paymentSaleId===d.id)delete i.paymentSaleId})));db.p.forEach(p=>(p.trat||[]).forEach(t=>{if(t.vid===d.id){t.vid=null;t.status='Pendente';t.rep=0;t.data=''}}));
    db.ag.forEach(a=>{if(a.vid===d.id){delete a.vid;if(a.st==='Compareceu')a.st='Confirmado'}});
    db.p.forEach(p=>{if(p.evol)p.evol=p.evol.filter(e=>!(e.auto&&e.vid===d.id))});
    db.vd=db.vd.filter(x=>x.id!==d.id);save();render()}),
  rcv:(b,d)=>{
    const v=db.vd.find(x=>x.id===d.id),inp=document.querySelector(`[data-rcv="${esc(d.id)}"]`),f=document.querySelector(`[data-rcvf="${esc(d.id)}"]`),val=num(inp.value);
    if(!(val>0)){toast('Informe o valor recebido');return}
    if(val>saldoV(v)+0.005){toast('Valor maior que o saldo ('+brl(saldoV(v))+')',3000);return}
    v.pg.push(ovFeeMake(val,f.value,tdy()));save();render();toast('Recebimento registrado')},
  ovFeeEdit:(b,d)=>{
    if(!ME?.admin)return;
    const receipt=db.vd.find(v=>v.id===d.id)?.pg.find(p=>p.id===d.pg);
    if(!receipt||!ovFeeApplies(receipt.forma))return;
    const suggested=ovFeeNeedsReview(receipt)?ovFeeConfiguredRate(receipt.forma):ovFeeReadRate(receipt.taxaPct);
    const input=prompt('Informe a taxa efetiva (%) do comprovante deste recebimento de '+brl(receipt.valor)+' em '+fd(receipt.data)+'.',suggested??'');
    if(input===null)return;
    const pct=ovFeeReadRate(input);
    if(pct===null){toast('Informe uma taxa entre 0% e 100%.');return}
    const {taxaPct,taxaValor,taxaOrigem,liquido}=ovFeeMake(num(receipt.valor),receipt.forma,receipt.data,receipt.id,pct);
    if(!confirm('Registrar taxa de '+brl(taxaValor)+' para este recebimento? O valor pago pelo paciente permanece '+brl(receipt.valor)+'.'))return;
    (receipt.taxaAjustes??=[]).push({em:new Date().toISOString(),por:ME.id,anterior:{taxaPct:receipt.taxaPct,taxaValor:receipt.taxaValor,taxaOrigem:receipt.taxaOrigem}});
    Object.assign(receipt,{taxaPct,taxaValor,taxaOrigem,liquido});
    save();render();ovFinDetail('received');toast('Taxa do recebimento atualizada.');
  },
  ovPaymentMethodEdit:(b,d)=>ovEditReceiptMethod(d.id,d.pg,d.group==='1'),
  cfgFinanceRates:()=>{if(!ME?.admin)return;view.h='cfg';view.id=null;view.cfgTab='financeiro';render();topo()},
  rmpg:(b,d)=>arm(d.pg,()=>{const v=db.vd.find(x=>x.id===d.id);v.pg=v.pg.filter(p=>p.id!==d.pg);save();render()}),
  adddt:()=>{const n=$('dn').value.trim();if(!n){toast('Digite o nome do dentista');return}
    db.dt.push({id:uid(),nome:n,modo:$('dm').value,pct:($('dp').value||'0').replace(',','.'),base:$('dbs').value,ativo:true});save();render();toast('Dentista cadastrado')},
  dtarq:(b,d)=>{const x=db.dt.find(y=>y.id===d.id);x.ativo=x.ativo===false;save();render()},
  rmdt:(b,d)=>arm(d.id,()=>{db.dt=db.dt.filter(x=>x.id!==d.id);save();render()}),
  cpay:(b,d)=>{
    const inp=document.querySelector(`[data-cpv="${esc(d.id)}"]`),val=num(inp.value),t=dtTot(d.id);
    if(!(val>0)){toast('Informe o valor pago');return}
    if(val>t.apagar+0.005){toast('Valor maior que o saldo a pagar ('+brl(t.apagar)+')',3000);return}
    const dI=document.querySelector(`[data-cpd="${esc(d.id)}"]`),oI=document.querySelector(`[data-cpo="${esc(d.id)}"]`);
    db.cp.push({id:uid(),dt:d.id,data:(dI&&dI.value)||tdy(),valor:r2(val),obs:oI?oI.value.trim():''});save();render();toast('Pagamento registrado')},
  cpayextra:(b,d)=>{
    const dentist=db.dt.find(item=>String(item.id)===String(d.id));
    const canAdd=()=>pmLvl('cm')>=2&&pmLvl('dt')>=2;
    if(!dentist||!canAdd())return;
    ovAgDialog('Adicionar valor extra',`<label>Valor extra (R$)<input name="amount" type="number" min="0.01" step="0.01" required></label>
      <label>Motivo<input name="note" maxlength="200" required></label>`,form=>{
      if(!canAdd()||!db.dt.includes(dentist))return false;
      const valor=Number(form.get('amount')),obs=String(form.get('note')||'').trim();
      if(!Number.isSafeInteger(Math.round(valor*100))||r2(valor)<=0||!obs){
        toast('Informe um valor positivo e o motivo do acréscimo.');return false;
      }
      dentist.repasseExtras=[...dtRepasseExtras(dentist.id),{data:tdy(),valor:r2(valor),obs}];
      save();render();toast('Valor extra adicionado ao saldo a pagar.');
    });
  },
  cpayretro:(b,d)=>{
    const dentist=db.dt.find(item=>String(item.id)===String(d.id));
    if(!dentist||pmLvl('cm')<2)return;
    ovAgDialog('Registrar repasse retroativo',`<p>Repasse já realizado a ${esc(dentist.nome)}.</p>
      <label>Data em que foi pago<input name="date" type="date" max="${tdy()}" required></label>
      <label>Valor pago (R$)<input name="amount" type="number" min="0.01" step="0.01" required></label>
      <label>Referência ou observação<input name="note" maxlength="200"></label>`,form=>{
      const data=String(form.get('date')||''),valor=Number(form.get('amount')),obs=String(form.get('note')||'').trim();
      if(pmLvl('cm')<2||!db.dt.includes(dentist))return false;
      if(!window.NexoCashModel?.validDate(data)||data>tdy()||!Number.isFinite(valor)||valor<=0){
        toast('Informe o valor e a data em que o repasse foi pago.');return false;
      }
      if(db.cp.some(payment=>payment.dt===dentist.id&&payment.data===data&&r2(num(payment.valor))===r2(valor))&&
         !confirm('Já existe um repasse com a mesma data e valor. Confirmar que é outro pagamento?'))return false;
      db.cp.push({id:uid(),dt:dentist.id,data,valor:r2(valor),obs,retroativo:true});
      save();render();toast('Repasse retroativo registrado.');
    });
  },
  rmcp:(b,d)=>arm(d.id,()=>{db.cp=db.cp.filter(c=>c.id!==d.id);save();render()}),
  addpr:()=>{const n={id:uid(),nome:'Novo procedimento',min:'30',mat:'',lab:'',custo:'',par:'',parTipo:'reais',preco:'',parc:false,mats:[]};db.pr.unshift(n);view.prOpen=n.id;view.prFilter='all';view.prq='';save();render();setTimeout(()=>document.querySelector('.nc-editor[open]')?.scrollIntoView({block:'nearest',behavior:'smooth'}),0)},
  addmt:()=>{const nome=$('mtn').value.trim(),preco=num($('mtp').value),qtd=num($('mtq').value)||1,stock=num($('mts').value),val=$('mtv').value;if(!nome){toast('Digite o nome do material');return}if(!(preco>0)){toast('Informe o preço da embalagem');return}if(stock<0||!Number.isFinite(stock)){toast('Quantidade em estoque inválida');return}db.mt.push({id:uid(),nome,un:$('mtu').value,preco:String(preco),qtd:String(qtd),val:'',ret:false,lotes:stock>0?[{id:uid(),qtd:String(stock),val,ret:false}]:[]});save();render();toast('Material cadastrado')},
  addmtlot:(b,d)=>{const m=db.mt.find(y=>y.id===d.id),q=document.querySelector(`[data-newlot-q="${esc(d.id)}"]`),v=document.querySelector(`[data-newlot-v="${esc(d.id)}"]`);if(!m||!q)return;const n=num(q.value);if(!(n>0)||!Number.isFinite(n)){toast('Informe a quantidade do lote');return}m.lotes=m.lotes||[];m.lotes.push({id:uid(),qtd:String(n),val:v?.value||'',ret:false});save();render();toast('Lote adicionado')},
  togglemtlot:(b,d)=>{const m=db.mt.find(y=>y.id===d.id),l=m?.lotes?.find(x=>x.id===d.r);if(!l)return;l.ret=!l.ret;save();render();toast(l.ret?'Lote retirado do estoque':'Lote reativado')},
  retmt:(b,d)=>{const m=db.mt.find(y=>y.id===d.id);if(!m)return;const l=(m.lotes||[]).filter(x=>!x.ret).sort((a,b)=>(a.val||'9999').localeCompare(b.val||'9999'))[0];if(l)l.ret=true;else m.ret=true;save();render();toast('Lote retirado do estoque')},
  repmt:(b,d)=>{const m=db.mt.find(y=>y.id===d.id);if(!m)return;m.ret=false;save();render();toast('Material reativado')},
  rmmt:(b,d)=>{const u=mtUsage(d.id);if(u.length){toast('Este material é usado em '+u.length+' procedimento(s). Remova-o de lá antes de excluir.',3500);return}arm(d.id,()=>{db.mt=db.mt.filter(m=>m.id!==d.id);save();render();toast('Material excluído')})},
  addpm:(b,d)=>{const x=db.pr.find(y=>y.id===d.id),sel=$('pms-'+d.id);if(!x||!sel||!sel.value){toast('Escolha um material');return}x.mats=x.mats||[];const ex=x.mats.find(r=>r.mid===sel.value);if(ex)ex.q=String(num(ex.q)+1);else x.mats.push({id:uid(),mid:sel.value,q:'1'});syncMat(x);view.prOpen=x.id;save();render()},
  rmpm:(b,d)=>{const x=db.pr.find(y=>y.id===d.id);if(!x)return;x.mats=(x.mats||[]).filter(r=>r.id!==d.r);if(x.mats.length)syncMat(x);else x.mat='';view.prOpen=x.id;save();render()},
  prsearch:()=>{if(view.prq===undefined)view.prq='';else delete view.prq;render();setTimeout(()=>{const e=document.getElementById('prq');if(e){e.focus();e.select()}},0)},
  prmaterial:()=>{view.prMaterial=view.prMaterial===false;render();toast(view.prMaterial===false?'Custo de materiais ocultado':'Custo de materiais ativado')},
  prauto:()=>{let n=0;db.pr.forEach(x=>{const s=prCalc(x).sug;if(s>0){x.preco=s.toFixed(2);n++}});save();render();toast(n+' procedimento(s) precificado(s) automaticamente')},
  prprint:()=>{window.print()},
  evsigclr:(b,d,p)=>{p.evolSign='';p.evolSignDate='';save();render()},
  printevol:(b,d,p)=>printEvolucao(p),
  evsignprint:(b,d,p)=>window.NexoEvolutionSigning?window.NexoEvolutionSigning.open(p):toast("Módulo de assinatura não carregado"),
  evolicp:(b,d,p)=>{alert("O documento será aberto para impressão. Selecione Salvar como PDF e assine o arquivo com um assinador ICP-Brasil externo. O NexoDent NÃO aplica assinatura digital nesta etapa. Confira o conteúdo e a identificação profissional antes de assinar.");printEvolucao(p)},
  printficha:(b,d,p)=>printFicha(p),
  savebtn:(b,d,p)=>{const ae=document.activeElement;if(ae&&ae.blur)ae.blur();save();updSaveStat();toastSaved('✓ Tudo salvo neste paciente')},
  prshare:()=>{copy(window.location.href,'Link copiado')},
  rmpr:(b,d)=>arm(d.id,()=>{db.pr=db.pr.filter(x=>x.id!==d.id);save();render()}),
  usesug:(b,d)=>{const x=db.pr.find(y=>y.id===d.id);x.preco=prCalc(x).sug.toFixed(2);save();render()},
  addag:()=>{
    const ap=$('ap').value,ad=$('ad').value,ah=$('ah').value,dtid=$('adn').value,du=Math.max(5,num($('adu').value)||30),cadeira=$('acadeira').value||'1';
    if(!ap){toast('Digite o nome e escolha o paciente na lista',3500);const n=$('apn');if(n)n.focus();return}
    if(!ad||!ah){toast('Informe data e hora');return}
    const n={id:uid(),pid:ap,data:ad,hora:ah,dur:du,dt:dtid,proc:$('apr').value.trim(),tipo:($('atp')?$('atp').value.trim():''),cadeira,st:'Agendado'},c=confl(n),key=ad+ah+dtid+cadeira;
    if(c&&view.enc!==key){view.enc=key;toast('Conflito: '+pName(c.pid)+' às '+c.hora+' no '+(c.cadeira==='2'?'Consultório 2':'Consultório 1')+'. Toque de novo para encaixar mesmo assim.',4500);return}
    view.enc=null;db.ag.push(n);save();render();toast('Consulta agendada')},
  rmag:(b,d)=>arm(d.id,()=>{db.ag=db.ag.filter(x=>x.id!==d.id);save();render()}),
  agbaixa:(b,d)=>{const a=db.ag.find(x=>x.id===d.id),m=procBy(a.proc);view.pre={pid:a.pid,dt:a.dt,proc:a.proc,valor:m&&m.preco?m.preco:'',ag:a.id};view.h='vd';view.sv='dia';render();topo()},
  agwa:(b,d)=>{const a=db.ag.find(x=>x.id===d.id),p=db.p.find(x=>x.id===a.pid);
    waOpen(p?p.tel:'','Olá, '+(p?p.nome.split(' ')[0]:'')+'! Confirmando sua consulta em '+fd(a.data)+' às '+a.hora+(a.dt?' com '+dName(a.dt):'')+'. Podemos confirmar?')},
  bksave:async()=>{
    const filename='consultorio-backup-'+tdy()+'.json';
    try{
      // Navegadores comuns não disponibilizam a integração claude.use('downloads').
      // O link temporário inicia um download nativo no computador ou celular.
      const blob=new Blob([bkData()],{type:'application/json;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');
      link.href=url;link.download=filename;link.style.display='none';
      document.body.appendChild(link);
      link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      markBk();render();
      toast('Download solicitado. Confira os downloads do navegador.',4500);
    }catch(e){
      toast('Não foi possível iniciar o download. Use o texto do backup.',4500);
    }
  },
  bktxt:()=>{view.bkt=!view.bkt;render()},
  bkcopy:()=>copy(bkData(),'Backup copiado. Cole em um lugar seguro.',()=>{markBk();render()}),
  bkrst:()=>restore()
};


// Condições adicionais informadas livremente na anamnese do paciente.
A.addcomorb=(b,d,p)=>{
  if(!p)return;
  const field=document.getElementById('ov-new-comorb');
  const name=String(field?.value||'').trim().replace(/\s+/g,' ');
  if(!name){toast('Digite a condição de saúde.');field?.focus();return}
  if(name.length>120){toast('Use até 120 caracteres.');return}
  p.anam=p.anam||{c:{},med:'',queixa:'',ultima:''};p.anam.c=p.anam.c||{};
  const existing=Object.keys(p.anam.c).find(x=>x.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'));
  if(existing){p.anam.c[existing]=true;toast('Condição já cadastrada.');}
  else p.anam.c[name]=true;
  save();render();toastSaved('✓ Condição salva');
};
A.rmcomorb=(b,d,p)=>{
  if(!p||!d.name||CHECKS.includes(d.name))return;
  if(p.anam?.c)delete p.anam.c[d.name];
  save();render();toastSaved('✓ Condição removida');
};
