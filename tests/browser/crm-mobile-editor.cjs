const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_BIN || '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 620 }, hasTouch: true, isMobile: true });
    const host = readFileSync('assets/css/nexodent-crm-embed.css', 'utf8');
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://nexo.invalid') return route.abort();
      if (url.pathname === '/') return route.fulfill({
        contentType: 'text/html',
        body: `<meta name="viewport" content="width=device-width,initial-scale=1">
          <script src="/assets/js/mobile-viewport.js"></script>
          <link rel="stylesheet" href="/assets/css/mobile-layout.css">
          <style>${host}
          body{margin:0} .shell{height:100dvh;overflow:hidden}
          .content{margin-top:110px;height:calc(100dvh - 110px);overflow:auto;padding:12px;box-sizing:border-box}
          #nexodent-chat-launcher{position:fixed;bottom:10px;right:10px;z-index:2147482001}
          </style><div class="shell"><div class="content"><div class="nexo-crm-embed">
          <iframe title="CRM" src="/crm/index.html?embedded=1"></iframe></div></div></div>
          <button id="nexodent-chat-launcher">Chat</button>`,
      });
      return route.fulfill({ path: '.' + url.pathname });
    });
    await page.goto('http://nexo.invalid/');
    const frame = page.frameLocator('iframe');
    assert.match(await page.locator('meta[name="viewport"]').getAttribute('content'), /user-scalable=no/);
    assert.equal(await page.evaluate(() => document.dispatchEvent(new Event('gesturestart', { cancelable: true }))), false);
    const pageBounds = await frame.locator('.crm-main').evaluate(main => ({
      padding: getComputedStyle(main).paddingInlineStart,
      fontSize: getComputedStyle(main.querySelector('#search')).fontSize,
    }));
    assert.equal(pageBounds.padding, '0px');
    assert.ok(parseFloat(pageBounds.fontSize) >= 16);

    await frame.locator('#editor').evaluate(editor => {
      editor.querySelector('#delete-lead').hidden = false;
      editor.showModal();
    });
    await page.locator('iframe.crm-visible-dialog').waitFor();

    async function checkSave() {
      const bounds = await frame.locator('#save').boundingBox();
      const size = await page.evaluate(() => ({ height: visualViewport.height, width: visualViewport.width }));
      assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= size.height, JSON.stringify({ bounds, size }));
      assert.ok(bounds.x >= 12 && bounds.x + bounds.width <= size.width - 12, JSON.stringify({ bounds, size }));
      await frame.locator('#save').click({ trial: true });
    }

    await checkSave();
    await frame.locator('#form').evaluate(form => { form.scrollTop = form.scrollHeight; });
    await checkSave();
    await page.setViewportSize({ width: 320, height: 420 });
    await page.waitForFunction(() => document.querySelector("iframe").getBoundingClientRect().height === visualViewport.height);
    await checkSave();
    await frame.locator('#cancel').click();
    await page.locator('iframe.crm-visible-dialog').waitFor({ state: 'detached' });
    assert.equal(await page.locator('#nexodent-chat-launcher').isVisible(), true);

    await frame.locator('#recovery-message').evaluate(dialog => dialog.showModal());
    await frame.locator('#recovery-send').click({ trial: true });
    await frame.locator('#recovery-message').evaluate(dialog=>dialog.close());
    await frame.locator('body').evaluate(()=>{
      document.getElementById('app').hidden=false;
      document.getElementById('clinic').replaceChildren(new Option('Clínica de teste','test-clinic'));
      const object=(id,parent_id,dados)=>({id,parent_id,dados,kind:'object'});
      const tables={
        budgets:[object('budget','patient',{status:'Aprovado'}),object('budget-2','p2',{status:'Aprovado',data:'06/11/2026'})],
        budget_items:[object('item','budget',{valor:800,paymentSaleId:'legacy-sale'}),object('item-2','budget-2',{valor:120,paymentSaleId:'second-sale'})],
        sales:[object('sale',null,{id:'legacy-sale'}),object('sale-2',null,{id:'second-sale'})],
        receipts:[object('receipt','sale',{data:'2026-11-12',valor:400}),object('receipt-2','sale-2',{data:'2026-11-12',valor:120})]
      };
      const leads=[
        {id:'google',name:'Lead Google',source:'Google Ads',stage:'Contatado',created_at:'2026-11-01',budget_id:'budget'},
        {id:'instagram',name:'Lead Meta',source:'Instagram',stage:'Novo lead',created_at:'2026-10-01'}
      ];
      window.OralCloud.enabled=true;
      window.OralCloud.request=async(path,options)=>{
        if(path.includes('nexodent_crm_leads')){
          const id=new URLSearchParams(path.split('?')[1]).get('id')?.slice(3);
          if(options?.method==='POST'){
            const lead={...options.body,id:'new-budget-lead',created_at:'2026-11-20'};
            leads.push(lead);
            return [lead];
          }
          if(options?.method==='PATCH')Object.assign(leads.find(lead=>lead.id===id),options.body);
          if(path.includes('budget_id=eq.'))return [];
          return id?leads.filter(lead=>lead.id===id):structuredClone(leads);
        }
        if(path.includes('/patients?'))return [{id:'p2',nome:'Paciente de orçamento'}];
        if(path.includes('nexodent_general_expenses'))return [
          {category:'Marketing — Google Ads',paid_at:'2026-11-06',amount:100}
        ];
        if(path.includes('clinic_load_start'))return {revision:'19',access:Object.fromEntries(Object.keys(tables).map(key=>[key,{read:true}]))};
        if(path.includes('clinic_load_page'))return {revision:'19',next:null,rows:tables[options.body.p_table]};
        return [];
      };
    });
    await frame.locator('#clinic').dispatchEvent('change');
    const marketing=frame.getByRole('tab',{name:'Análise de Marketing'});
    await marketing.click();
    const report=frame.locator('#crm-marketing');
    await report.getByText('Retorno sobre anúncios',{exact:true}).waitFor();
    const metric=label=>report.getByText(label,{exact:true}).locator('..').locator('dd');
    await report.getByLabel('Ano').selectOption('2026');
    assert.equal(await report.getByLabel('Mês').inputValue(),'');
    assert.equal(await report.getByLabel('Origem').inputValue(),'');
    assert.equal(await metric('Leads').innerText(),'2');
    await report.getByLabel('Mês').selectOption('11');
    await report.getByLabel('Origem').selectOption('google ads');
    assert.equal(await metric('Leads').innerText(),'1');
    assert.equal(await metric('Pacientes convertidos').innerText(),'1');
    assert.match(await metric('Valores contratados').innerText(),/800,00/);
    assert.match(await metric('Pagamentos recebidos').innerText(),/400,00/);
    assert.equal(await metric('Retorno sobre anúncios').innerText(),'4×');
    await report.getByText('Lead Google',{exact:true}).waitFor();
    await report.getByRole('button',{name:'Editar origem e etapa'}).click();
    await frame.locator('#editor select[name=source]').selectOption('Instagram');
    await frame.locator('#editor select[name=stage]').selectOption('Agendado');
    await frame.locator('#save').click();
    await report.getByText('Lead Google',{exact:true}).waitFor({state:'hidden'});
    await report.getByLabel('Origem').selectOption('instagram');
    await report.getByText(/Agendado.*400,00/).waitFor();
    await report.getByLabel('Origem').selectOption('orcamento');
    await report.getByText('Paciente de orçamento',{exact:true}).waitFor();
    await report.getByRole('button',{name:'Classificar origem'}).click();
    await frame.locator('#editor select[name=source]').selectOption('Google Ads');
    await frame.locator('#save').click();
    await report.getByText('Paciente de orçamento',{exact:true}).waitFor({state:'hidden'});
    await report.getByLabel('Origem').selectOption('google ads');
    await report.getByText(/Recebido.*120,00/).waitFor();
    assert.match(await metric('Pagamentos recebidos').innerText(),/120,00/);
    await frame.getByRole('tab',{name:'Oportunidades'}).click();
    await report.waitFor({state:'hidden'});
    console.log('Análise de Marketing: visão geral, filtros, pagamentos reais vinculados e navegação do CRM.');
    console.log('Ações dos diálogos do CRM continuam acessíveis em telas móveis.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
