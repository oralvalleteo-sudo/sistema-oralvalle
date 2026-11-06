(()=>{'use strict';
// Exportação local, acionada manualmente. Nenhuma escrita no banco ou envio externo.
let snapshot=[],clinicId='';
window.addEventListener('nexocrm:leads-loaded',event=>{
 const d=event.detail||{};clinicId=String(d.clinicId||'');snapshot=Array.isArray(d.leads)?d.leads.map(x=>({...x})):[];
});
const cell=value=>{
 let s=String(value??'').replace(/[\r\n\t]+/g,' ').trim();
 // Evita interpretação de fórmulas ao abrir em planilhas.
 if(/^[=+@\-]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
};
function download(){
 if(!clinicId){alert('Aguarde o carregamento das oportunidades antes de exportar.');return;}
 if(!snapshot.length){alert('Não há oportunidades para exportar.');return;}
 const headers=['Nome','Telefone','Origem','Etapa','Valor estimado','Próximo contato','Criado em'];
 const rows=snapshot.map(x=>[x.name,x.phone,x.source,x.stage,x.estimated_value,x.next_contact_at,x.created_at]);
 const csv='\uFEFF'+[headers,...rows].map(row=>row.map(cell).join(';')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');
 a.href=url;a.download='nexodent-crm-oportunidades-'+new Date().toISOString().slice(0,10)+'.csv';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.getElementById('crm-export-csv-57')?.addEventListener('click',download);
})();