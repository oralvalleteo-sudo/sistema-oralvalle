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
    await frame.locator('#editor').evaluate(editor => {
      editor.querySelector('#delete-lead').hidden = false;
      editor.showModal();
    });
    await page.locator('iframe.crm-visible-dialog').waitFor();

    async function checkSave() {
      const bounds = await frame.locator('#save').boundingBox();
      const height = await page.evaluate(() => visualViewport.height);
      assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= height, JSON.stringify({ bounds, height }));
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
    console.log('Ações dos diálogos do CRM continuam acessíveis em telas móveis.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
