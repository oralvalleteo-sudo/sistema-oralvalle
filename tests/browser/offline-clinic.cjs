const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium, webkit, devices } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '../..');
const clinic = '00000000-0000-0000-0000-000000000010';
const foreignClinic = '00000000-0000-0000-0000-000000000011';
const user = { id: '00000000-0000-0000-0000-000000000001', email: 'offline@example.invalid' };

const files = {
  '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
};

async function main() {
  const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
  const db = new PGlite();
  let loseReply = false;
  let unavailable = false;
  let rpc;
  const submitted = [];
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (unavailable && (url.pathname.startsWith('/test-supabase/') || url.pathname.endsWith('/index.html')))
      return response.writeHead(503).end();
    if (url.pathname.startsWith('/test-supabase/')) {
      const reply = (status, value) => response.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(value));
      try {
        if (url.pathname.endsWith('/auth/v1/user')) return reply(200, user);
        if (url.pathname.endsWith('/auth/v1/logout')) return reply(200, {});
        const name = url.pathname.split('/').at(-1);
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const args = JSON.parse(Buffer.concat(chunks).toString() || '{}');
        const result = await rpc(name, args);
        if (name === 'clinic_apply_offline') {
          submitted.push(args);
          if (loseReply) { loseReply = false; return response.destroy(); }
        }
        return reply(200, result);
      } catch (error) {
        return reply(error.code === '42501' ? 403 : error.code === '40001' ? 409 : 400,
          { code: error.code, message: error.message });
      }
    }
    const relative = url.pathname.replace(/^\/sistema-oralvalle\//, '') || 'index.html';
    const file = path.resolve(root, relative);
    try {
      if (!file.startsWith(root + path.sep)) throw new Error('Outside test root');
      let content = await fs.readFile(file);
      if (relative === 'assets/js/supabase/config.js') {
        content = content.toString()
          .replace(/url: '[^']+'/i, "url: '/test-supabase'")
          .replace(/publishableKey: '[^']+'/i, "publishableKey: 'synthetic'");
      }
      response.writeHead(200, { 'Content-Type': files[path.extname(file)] || 'application/octet-stream' });
      response.end(content);
    } catch (_) { response.writeHead(404).end(); }
  });
  let browser;
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql stable
        as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    `);
    for (const migration of [
      '202610140001_relational_clinics.sql',
      '202610200001_optimize_clinic_load.sql',
      '202610200002_bounded_clinic_reads.sql',
      '202610260001_performance_queries.sql',
      '202610260002_lazy_patient_details.sql',
      '202610270001_audit_history.sql',
      '202611270027_offline_write_receipts.sql',
    ]) await db.exec(await fs.readFile(path.join(root, 'supabase/migrations', migration), 'utf8'));
    await db.query('insert into auth.users values($1,$2)', [user.id, user.email]);
    await db.query("insert into clinics(id,nome) values($1,'Clínica de teste'),($2,'Outra clínica')", [clinic, foreignClinic]);
    await db.query("insert into clinic_members(clinic_id,user_id,nome,admin) values($1,$2,'Equipe teste',true)", [clinic, user.id]);
    let queue = Promise.resolve();
    rpc = (name, args) => {
      if (!/^[a-z_]+$/.test(name)) throw new Error('Invalid RPC');
      const params = Object.entries(args);
      const job = queue.then(() => db.transaction(async tx => {
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [user.id]);
        await tx.exec('set local role authenticated');
        return (await tx.query(`select public.${name}(${params.map(([key], index) => key + ' => $' + (index + 1)).join(',')}) result`,
          params.map(([, value]) => value && typeof value === 'object' ? JSON.stringify(value) : value))).rows[0].result;
      }));
      queue = job.catch(() => {});
      return job;
    };
    await assert.rejects(rpc('clinic_apply_offline', {
      p_clinic: foreignClinic, p_revision: 0, p_changes: [], p_operation: user.id,
    }), { code: '42501' });
    const anonymous = await db.query("select has_function_privilege('anon','public.clinic_apply_offline(uuid,bigint,jsonb,uuid)','execute') allowed");
    assert.equal(anonymous.rows[0].allowed, false);

    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const engine = process.env.NEXODENT_BROWSER === 'webkit' ? webkit : chromium;
    browser = await engine.launch(engine === chromium ? {
      executablePath: process.env.CHROMIUM_BIN || chromium.executablePath(),
      args: ['--no-sandbox'],
    } : {});
    const context = await browser.newContext(process.env.NEXODENT_BROWSER === 'webkit' ? devices['iPhone 15']
      : process.env.NEXODENT_BROWSER === 'android' ? devices['Pixel 7'] : {});
    await context.addInitScript(user => sessionStorage.setItem('oralvalle_cloud_session', JSON.stringify({
      user, access_token: 'synthetic', refresh_token: 'synthetic',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    })), user);
    await context.route('https://**/*', route => route.fulfill({ status: 204 }));

    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const url = `http://127.0.0.1:${server.address().port}/sistema-oralvalle/index.html`;
    await page.goto(url);
    await page.locator('.ov-content').first().waitFor();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await page.evaluate(() => {
      window.offlineTestMessages = [];
      new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes)
          if (node.classList?.contains('toast')) window.offlineTestMessages.push(node.textContent);
      }).observe(document.body, { childList: true });
      A.offlineenable();
    });
    const secret = await page.locator('#nexoVaultCode').inputValue().catch(async error => {
      console.error('Configuração offline:', await page.evaluate(() => offlineTestMessages));
      throw error;
    });
    assert.match(secret, /^[a-f0-9]{32}$/);
    await page.getByRole('button', { name: 'Ativar cópia offline' }).click();
    try { await page.locator('#nexoOfflineStatus').getByText(/sem alterações pendentes/).waitFor(); }
    catch (error) {
      console.error('Configuração offline:', await page.evaluate(() => offlineTestMessages));
      throw error;
    }

    await context.setOffline(true);
    await page.evaluate(() => {
      db.p.push({
        id: 'offline-patient', nome: 'Paciente sintético offline', olog: [],
        odo: { '11': { c: 'Teste' } }, anam: { c: {}, queixa: 'Sintético' }, evol: [{ id: 'offline-record', txt: 'Teste' }],
        orcs: [{ id: 'offline-budget', itens: [{ id: 'offline-item', proc: 'Teste' }] }], trat: [],
      });
      db.ag.push({ id: 'offline-appointment', pid: 'offline-patient', data: tdy(), hora: '10:00' });
      db.vd.push({ id: 'offline-sale', pid: 'offline-patient', valor: 20, pg: [{ id: 'offline-receipt', valor: 20 }] });
      save();
    });
    await page.waitForFunction(async ({ email, secret }) => {
      const local = await NexoOfflineVault.open(email, OralCloud.clinicId, secret);
      const ready = local.record.dirty && local.record.data.p.some(patient => patient.id === 'offline-patient');
      const archive = await local.export();
      local.close();
      if (archive.includes('Paciente sintético offline')) throw new Error('Dados clínicos em texto simples');
      return ready;
    }, { email: user.email, secret });
    assert.equal(submitted.length, 0);
    await page.evaluate(async ({ user, foreignClinic, secret }) => {
      for (const [email, clinic] of [[user.email, foreignClinic], ['other@example.invalid', OralCloud.clinicId]]) {
        try { await NexoOfflineVault.open(email, clinic, secret); }
        catch (error) {
          if (error.message.includes('indisponível')) continue;
          throw error;
        }
        throw new Error('Cópia abriu em outra conta ou clínica.');
      }
    }, { user, foreignClinic, secret });

    if (engine === webkit) {
      // WebKit's protocol-level offline emulation aborts navigation before dispatching the worker.
      // Return a server outage during reopening to exercise the worker's actual cached response.
      unavailable = true;
      await context.setOffline(false);
    }
    await page.reload();
    if (engine === webkit) await page.getByRole('button', { name: 'Acesso offline', exact: true }).click();
    await page.getByRole('heading', { name: 'Desbloquear acesso offline' }).waitFor();
    await page.locator('#cloudEmail').fill(user.email);
    await page.locator('#cloudPassword').fill('ffffffffffffffffffffffffffffffff');
    await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
    await page.getByRole('alert').getByText(/Código offline inválido/).waitFor();
    await page.locator('#cloudEmail').fill(user.email);
    await page.locator('#cloudPassword').fill(secret);
    await page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
    await page.locator('.ov-content').first().waitFor();
    assert.equal(await page.evaluate(() => db.p.find(p => p.id === 'offline-patient').evol[0].id), 'offline-record');
    assert.ok(await page.evaluate(() => OralCloudData.patientLoaded('offline-patient')));

    loseReply = true;
    unavailable = false;
    await context.setOffline(false);
    if (engine === webkit) await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForFunction(() => navigator.onLine);
    await page.waitForFunction(() => !OralCloudSync.dirty, null, { timeout: 30000 });
    assert.equal(submitted.length, 2);
    assert.deepEqual(submitted[0], submitted[1]);
    for (const [table, id] of [
      ['patients', 'offline-patient'], ['appointments', 'offline-appointment'],
      ['patient_evolutions', 'offline-record'], ['budgets', 'offline-budget'],
      ['receipts', 'offline-receipt'],
    ]) {
      const result = await db.query(`select count(*)::int n from ${table} where clinic_id=$1 and dados->>'id'=$2`, [clinic, id]);
      assert.equal(result.rows[0].n, 1, table);
    }
    assert.equal((await db.query("select count(*)::int n from patient_odontograms where slot='odo'")).rows[0].n, 1);
    await assert.rejects(rpc('clinic_apply_offline', { ...submitted[0], p_changes: [] }), { code: '22023' });
    await assert.rejects(rpc('clinic_apply_offline', { ...submitted[0], p_operation: user.id }), { code: '40001' });
    assert.equal((await db.query('select count(*)::int n from private.offline_write_receipts')).rows[0].n, 1);

    await context.setOffline(true);
    await page.evaluate(() => {
      db.p.find(p => p.id === 'offline-patient').nome = 'Rascunho em conflito';
      save();
    });
    await db.query('update clinics set revision=revision+1 where id=$1', [clinic]);
    await context.setOffline(false);
    await page.getByText(/Há um conflito com outra alteração/).waitFor();
    assert.equal((await db.query("select dados->>'nome' nome from patients where dados->>'id'='offline-patient'")).rows[0].nome, 'Paciente sintético offline');
    assert.equal(await page.evaluate(() => db.p.find(p => p.id === 'offline-patient').nome), 'Rascunho em conflito');
    await page.getByRole('button', { name: 'Baixar cópia criptografada' }).waitFor();
    await context.setOffline(true);
    await db.query('update clinic_members set admin=false, perms=$3 where clinic_id=$1 and user_id=$2',
      [clinic, user.id, JSON.stringify({ ag: 'view' })]);
    await context.setOffline(false);
    await page.getByText(/As permissões da clínica mudaram/).waitFor();
    assert.equal(await page.locator('.ov-content').count(), 0);
    assert.equal((await db.query('select count(*)::int n from private.offline_write_receipts')).rows[0].n, 1);
    console.log('Abertura offline, código inválido, criptografia, seis grupos de dados, isolamento, replay, conflito e alteração de permissões verificados.');
  } finally {
    await browser?.close();
    server.close();
    await db.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
