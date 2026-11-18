const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('Despesas fica na seção Controle e respeita o acesso financeiro',()=>{
 const context={A:{},document:{body:{},addEventListener(){}},MutationObserver:class{observe(){}},ME:{id:'one',admin:true},AUTH:{users:[]},db:{lem:[]},window:{},view:{},mtAlertas:()=>[],esc:String};vm.createContext(context);
 for(const file of ['assets/js/permissions.js','assets/js/features/dashboard.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
 const sidebar=()=>vm.runInContext("ovSidebar('cash')",context);
 let html=sidebar();const control=html.slice(html.indexOf('<div class="ov-section">Controle</div>'));
 assert.match(control,/data-t="cash"[^>]*>.*?<span>Despesas<\/span>/);assert.equal((html.match(/data-t="cash"/g)||[]).length,1);assert.doesNotMatch(html.slice(0,html.indexOf('<div class="ov-section">Controle</div>')),/data-t="cash"/);
 context.ME={id:'two',admin:false,perms:{vd:'view'}};assert.match(sidebar(),/data-t="cash"/);
 context.ME.perms.vd='none';assert.doesNotMatch(sidebar(),/data-t="cash"/);
});
