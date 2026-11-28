(function () {
  'use strict';
  if (!OralCloud.enabled) return;
  let pending = null;
  let running = null;
  let timer = null;
  let failure = null;
  let memberBaseline = [];
  let memberQueue = Promise.resolve();
  let membersRunning = false;
  let membersPending = 0;
  let disposed = false;
  let accessRequests = [];
  let accessError = '';
  let accessLoading = false;
  let pendingFiles = [];
  let vault = null;
  let localWrite = Promise.resolve();
  let localWrites = 0;
  let offlineSession = false;
  let offlineExpiry = null;
  let reconnecting = null;
  const OFFLINE_LEASE = 12 * 60 * 60 * 1000;
  const configuredClinic = () => new URLSearchParams(location.search).get('clinic_id') || OralCloud.config.clinicId;
  const networkFailure = error => Boolean(error) && (!navigator.onLine || (error instanceof TypeError && !error.status));
  const denied = error => [401, 403].includes(error.status) || error.code === '42501';

  function updateConnection() {
    let indicator = $('nexoOfflineStatus');
    if (LOCKED || !vault) { indicator?.remove(); return; }
    if (!indicator) {
      indicator = document.createElement('aside');
      indicator.id = 'nexoOfflineStatus';
      indicator.setAttribute('role', 'status');
      indicator.style.cssText = 'position:fixed;bottom:max(8px,env(safe-area-inset-bottom));left:8px;z-index:60;padding:6px 10px;border-radius:8px;background:#263f49;color:white;font-size:12px';
      document.body.appendChild(indicator);
    }
    const queued = localWrites || vault.record?.dirty || vault.record?.job;
    const label = running ? 'Sincronizando' : !navigator.onLine ? 'Sem conexão'
      : offlineSession ? 'Sessão offline' : 'Conectado';
    const message = label + (queued ? ' · alterações pendentes' : ' · sem alterações pendentes');
    if (indicator.textContent !== message) indicator.textContent = message;
  }

  function startLease() {
    clearTimeout(offlineExpiry);
    offlineExpiry = setTimeout(() => doLogout('A autorização offline expirou. Entre online para renovar.'),
      Math.max(0, vault.record.expires - Date.now()));
  }

  async function unlockOffline(email, secret) {
    const clinicId = await NexoOfflineVault.clinic(email, configuredClinic());
    const candidate = await NexoOfflineVault.open(email, clinicId, secret);
    const record = candidate.record;
    if (record.expires <= Date.now() || record.issued > Date.now()) {
      candidate.close();
      throw new Error('A autorização offline expirou. Entre online e desbloqueie a cópia para renovar.');
    }
    vault = candidate;
    disposed = false;
    offlineSession = true;
    OralCloud.clinicId = clinicId;
    OralCloud.bindActor(record.member.id);
    OralCloudData.restoreCheckpoint(record.base);
    db = migrate(copy(record.data));
    pending = record.dirty ? copy(record.data) : null;
    failure = null;
    AUTH = { users: [record.member], rec: null };
    unlock(record.member, false);
    startLease();
    updateConnection();
    startSync(clinicId);
    reconnect().catch(() => {});
  }

  async function verifyVaultSession() {
    const expected = vault.record;
    const clinicId = expected.base.clinic;
    const identity = OralCloud.session?.user?.id ? OralCloud.session.user : (await OralCloud.restoreSession())?.user;
    if (identity?.id !== expected.member.id) throw Object.assign(new Error('Entre no Supabase com a conta que criou a cópia offline.'), { reauthenticate: true });
    const clinics = await OralCloud.request('/rest/v1/rpc/clinic_list', { method: 'POST', body: {} });
    if (!clinics.some(clinic => clinic.clinic_id === clinicId && clinic.user_id === identity.id))
      throw Object.assign(new Error('Seu acesso a esta clínica foi revogado.'), { status: 403 });
    const members = await OralCloudData.members();
    const member = members.find(value => value.id === identity.id && value.active);
    if (!member || member.admin !== expected.member.admin || JSON.stringify(member.perms) !== JSON.stringify(expected.member.perms))
      throw Object.assign(new Error('As permissões da clínica mudaram. A cópia pendente foi preservada.'), { status: 403 });
    AUTH = { users: members.filter(value => value.active), rec: null };
    memberBaseline = copy(AUTH.users);
  }

  function reconnect() {
    if (!vault || !navigator.onLine || LOCKED) return Promise.resolve();
    if (reconnecting) return reconnecting;
    const activeVault = vault;
    reconnecting = (async () => {
      try {
        if (offlineSession) {
          await verifyVaultSession();
          if (vault !== activeVault || LOCKED) return;
          offlineSession = false;
        }
        if (networkFailure(failure)) failure = null;
        await flush();
      } catch (error) {
        if (vault !== activeVault) return;
        if (denied(error) || error.reauthenticate) {
          await lockVault(denied(error) ? error.message : 'Entre no Supabase e depois desbloqueie a cópia na tela Meu acesso.');
        }
      } finally { updateConnection(); }
    })().finally(() => { reconnecting = null; });
    return reconnecting;
  }

  async function lockVault(message) {
    LOCKED = true;
    $('app').inert = true;
    await localWrite.catch(() => {});
    if (running) await running.catch(() => {});
    vault?.close();
    vault = null;
    clearTimeout(offlineExpiry);
    offlineSession = false;
    pending = null;
    failure = null;
    disposed = true;
    stopSync();
    OralCloudData.reset();
    OralCloud.clinicId = null;
    OralCloud.bindActor(null);
    window.OralCloudFiles?.reset();
    AUTH = { users: [], rec: null };
    ME = null;
    db = migrate({});
    view.id = null;
    delArm = null;
    $('printarea')?.replaceChildren();
    $('cloudStatus')?.remove();
    cloudLock('login', message);
    $('app').inert = false;
    updateConnection();
  }

  function askOfflineCode(generated) {
    const dialog = document.createElement('dialog');
    dialog.style.maxWidth = 'min(440px, calc(100% - 32px))';
    dialog.innerHTML = `<form method="dialog">
      ${generated ? '<p>Guarde este código em um gerenciador de senhas. Você precisará dele para abrir a clínica sem internet.</p>' : ''}
      <label for="nexoVaultCode">Código offline desta clínica</label>
      <input id="nexoVaultCode" autocomplete="off" autocapitalize="none" spellcheck="false" required>
      <div class="row"><button value="unlock">${generated ? 'Ativar cópia offline' : 'Desbloquear'}</button>
      <button value="cancel" class="ghost" formnovalidate>Cancelar</button></div></form>`;
    const input = dialog.querySelector('input');
    if (generated) {
      input.value = generated;
      input.readOnly = true;
    } else input.type = 'password';
    document.body.appendChild(dialog);
    dialog.showModal();
    return new Promise(resolve => dialog.addEventListener('close', () => {
      const code = dialog.returnValue === 'unlock' ? input.value.trim() : null;
      dialog.remove();
      resolve(code);
    }, { once: true }));
  }

  async function enableOffline() {
    if (!navigator.onLine || !OralCloud.session?.user?.id || vault || pending || running || failure || syncBusy || membersPending)
      throw new Error('Conclua as alterações e conecte-se antes de configurar o acesso offline.');
    const clinicId = OralCloud.clinicId;
    const email = OralCloud.session.user.email;
    const actor = OralCloud.session.user.id;
    const previous = OralCloudData.checkpoint();
    const protocol = await OralCloud.request('/rest/v1/rpc/clinic_offline_capabilities', {
      method: 'POST', body: { p_clinic: clinicId }
    }).catch(error => {
      if (error.status === 404 || error.code === 'PGRST202')
        throw new Error('A sincronização offline ainda não está disponível no servidor.');
      throw error;
    });
    if (protocol !== 1) throw new Error('Protocolo de sincronização offline indisponível.');
    const existing = await NexoOfflineVault.exists(email, clinicId);
    if (clinicId !== OralCloud.clinicId || LOCKED || pending || running || syncBusy || membersPending) return;
    const generated = existing ? null : NexoOfflineVault.code();
    const secret = await askOfflineCode(generated);
    if (!secret) return;
    if (generated && secret !== generated) throw new Error('Confirme o código gerado pelo NexoDent.');
    if (clinicId !== OralCloud.clinicId || LOCKED || pending || running || syncBusy || membersPending) return;
    $('app').inert = true;
    stopSync();
    try {
      const members = await OralCloudData.members();
      const member = members.find(value => value.id === actor && value.active);
      if (!member) throw new Error('Sua conta não tem acesso ativo a esta clínica.');
      if (existing) {
        const savedVault = await NexoOfflineVault.open(email, clinicId, secret.trim());
        const record = savedVault.record;
        const permissionsChanged = record.member.admin !== member.admin ||
          JSON.stringify(record.member.perms) !== JSON.stringify(member.perms);
        if (record.member.id !== member.id || (record.dirty || record.job) && permissionsChanged) {
          savedVault.close();
          throw new Error('As permissões ou a conta mudaram. A cópia criptografada foi preservada.');
        }
        if (record.dirty || record.job) {
          vault = savedVault;
          OralCloudData.restoreCheckpoint(record.base);
          db = migrate(copy(record.data));
          pending = copy(record.data);
          await vault.write(value => ({ ...value, issued: Date.now(), expires: Date.now() + OFFLINE_LEASE }));
        } else {
          try {
            const raw = migrate(await OralCloudData.load({ full: true }));
            OralCloudData.prepareDefaults(raw);
            const issued = Date.now();
            await savedVault.write(() => ({ member, issued, expires: issued + OFFLINE_LEASE,
              base: OralCloudData.checkpoint(), data: OralCloudData.snapshot(raw), dirty: false, job: null }));
            db = raw;
            vault = savedVault;
          } catch (error) { savedVault.close(); throw error; }
        }
      } else {
        const raw = migrate(await OralCloudData.load({ full: true }));
        OralCloudData.prepareDefaults(raw);
        const issued = Date.now();
        vault = await NexoOfflineVault.create(email, clinicId, secret.trim(), { member, issued, expires: issued + OFFLINE_LEASE,
          base: OralCloudData.checkpoint(), data: OralCloudData.snapshot(raw), dirty: false, job: null });
        db = raw;
      }
      OralCloud.bindActor(member.id);
      AUTH = { users: members.filter(value => value.active), rec: null };
      memberBaseline = copy(AUTH.users);
      ME = { ...member, keep: false };
      startLease();
      idleReset();
      render();
      reconnect().catch(() => {});
    } catch (error) {
      if (!vault) OralCloudData.restoreCheckpoint(previous);
      throw error;
    } finally {
      $('app').inert = false;
      startSync(clinicId);
      updateConnection();
    }
  }
  // Sincronização entre abas e aparelhos: consulta apenas a revisão, sem baixar
  // os dados completos a cada ciclo. Nunca substitui um formulário em edição.
  let syncTimer = null;
  let syncBusy = false;
  let syncRevision = null;
  let syncClinic = null;
  let syncSession = 0;
  let syncNotice = false;
  let syncDueAt = 0;
  let syncLastCheck = 0;
  let syncFailures = 0;
  const SYNC_MIN_MS = 8000;
  const SYNC_JITTER_MS = 4000;
  const SYNC_FOCUS_COOLDOWN_MS = 3000;
  const syncDelay = () => Math.min(60000, SYNC_MIN_MS * 2 ** syncFailures) + Math.random() * SYNC_JITTER_MS;
  function cancelSyncTimer() {
    clearTimeout(syncTimer);
    syncTimer = null;
    syncDueAt = 0;
  }
  function scheduleSync(delay = syncDelay()) {
    if (!syncClinic || document.hidden) return;
    const due = Date.now() + delay;
    if (syncTimer !== null && syncDueAt <= due) return;
    cancelSyncTimer();
    const session = syncSession;
    syncDueAt = due;
    syncTimer = setTimeout(async () => {
      syncTimer = null;
      syncDueAt = 0;
      await syncTick();
      if (session === syncSession) scheduleSync();
    }, delay);
  }
  const editing = () => {
    const el = document.activeElement;
    return !!(el && (el.matches?.('input, textarea, select, [contenteditable="true"]')));
  };
  function stopSync() {
    cancelSyncTimer();
    syncLastCheck = 0;
    syncFailures = 0;
    syncSession++;
    syncRevision = null;
    syncClinic = null;
    syncNotice = false;
  }
  async function syncTick() {
    if (syncBusy || disposed || LOCKED || !syncClinic || syncClinic !== OralCloud.clinicId || document.hidden) return;
    if (vault && (offlineSession || pending || vault.record.dirty || vault.record.job) && !failure) {
      await reconnect();
      return;
    }
    if (vault && (!navigator.onLine || failure)) return;
    syncBusy = true;
    syncLastCheck = Date.now();
    let failed = false;
    const clinicId = OralCloud.clinicId;
    const session = syncSession;
    try {
      if (vault) await verifyVaultSession();
      const meta = await OralCloud.request('/rest/v1/rpc/clinic_load_start', {
        method: 'POST', body: { p_clinic: clinicId }
      });
      if (session !== syncSession || clinicId !== OralCloud.clinicId || LOCKED || disposed || typeof meta?.revision !== 'string') return;
      // A gravação feita neste aparelho também atualiza a revisão local.
      // Evita recarregar todos os módulos sem necessidade após cada salvamento.
      const currentRevision = OralCloudData.currentRevision();
      if (meta.revision === currentRevision) { syncRevision = meta.revision; syncNotice = false; return; }
      // A primeira verificação também compara com o banco: uma alteração pode
      // ocorrer entre a abertura da clínica e o início do monitoramento.
      if (syncRevision !== null && meta.revision === syncRevision) return;
      // Preserve drafts, pending writes, and lazily loaded clinical records.
      // A patient record is never silently replaced while open.
      if (pending || running || failure || membersRunning || membersPending || editing() || view.id) {
        if (!syncNotice) {
          syncNotice = true;
          localToast('Há novidades de outro aparelho. Conclua a edição ou feche o prontuário para sincronizar.', 4500);
        }
        return;
      }
      // Mostrar a marca apenas durante a atualização efetiva, sem bloquear a edição.
      const previous = OralCloudData.checkpoint();
      const raw = await OralCloudData.load({ full: Boolean(vault) });
      if (session !== syncSession || clinicId !== OralCloud.clinicId || LOCKED || disposed) return;
      // O usuário pode começar a editar enquanto os dados são baixados.
      if (pending || running || failure || membersRunning || membersPending || editing() || view.id) {
        OralCloudData.restoreCheckpoint(previous);
        return;
      }
      const fresh = migrate(raw);
      OralCloudData.prepareDefaults(fresh);
      if (vault) {
        $('app').inert = true;
        try {
          await vault.write(record => ({ ...record, base: OralCloudData.checkpoint(), data: OralCloudData.snapshot(fresh) }));
        } catch (error) {
          OralCloudData.restoreCheckpoint(previous);
          throw error;
        } finally { $('app').inert = false; }
      }
      db = fresh;
      OralCloudData.prepareDefaults(db);
      window.dispatchEvent(new CustomEvent('nexodent:clinic-data-loaded', { detail: { clinicId: OralCloud.clinicId } }));
      syncRevision = meta.revision;
      syncNotice = false;
      render();
    } catch (error) {
      // A conexão pode oscilar: manter a tela e os dados atuais intactos.
      failed = true;
      if (vault && denied(error)) await lockVault(error.message);
      console.warn('[Oral Valle] Sincronização adiada:', error);
    } finally {
      if (session === syncSession) syncFailures = failed ? Math.min(3, syncFailures + 1) : 0;
      syncBusy = false;
    }
  }
  function startSync(clinicId) {
    stopSync();
    syncClinic = clinicId;
    // Espalha as consultas de revisão para que as estações não consultem em bloco.
    syncRevision = OralCloudData.currentRevision();
    scheduleSync();
    document.addEventListener('visibilitychange', onSyncVisible);
    window.addEventListener('online', onSyncVisible);
    window.addEventListener('focus', onSyncVisible);
  }
  function onSyncVisible() {
    if (document.hidden) { cancelSyncTimer(); return; }
    if (syncBusy) return;
    if (syncFailures || Date.now() - syncLastCheck < SYNC_FOCUS_COOLDOWN_MS) { scheduleSync(); return; }
    scheduleSync(250 + Math.random() * 1000);
  }

  const copy = value => JSON.parse(JSON.stringify(value));
  window.addEventListener('offline', () => {
    if (vault) offlineSession = true;
    updateConnection();
  });
  window.addEventListener('online', () => { updateConnection(); reconnect().catch(() => {}); });
  const localToast = toast;
  const localPermissionCard = pmCardHtml;

  // O backend pode sinalizar conflito pela mensagem CLOUD_CONFLICT, sem SQLSTATE 40001.
  // Nunca repetir uma gravação contra uma revisão desatualizada automaticamente.
  function isRevisionConflict(error) {
    const details = [error?.code, error?.message, error?.details, error?.hint]
      .filter(Boolean).join(' ');
    return error?.code === '40001' || /CLOUD_CONFLICT|clinic revision changed/i.test(details);
  }

  function isFinalizedEvolutionConflict(error) {
    return [error?.code, error?.message, error?.details, error?.hint]
      .some(value => typeof value === 'string' && value.includes('NEXODENT_FINALIZED_EVOLUTION_IMMUTABLE'));
  }

  function isEvolutionDentistReference(error) {
    return /nexodent_evolution_dentists_evolution_fkey/.test(error?.message||'');
  }

  function requiresReload(error) {
    return Boolean(error?.needsReload || isRevisionConflict(error) || isFinalizedEvolutionConflict(error) || isEvolutionDentistReference(error));
  }

  function status(message, error = false) {
    let panel = $('cloudStatus');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'cloudStatus';
      panel.setAttribute('role', 'status');
      document.body.appendChild(panel);
    }
    panel.className = 'cloud-status' + (error ? ' cloud-error' : '');
    panel.replaceChildren();
    const text = document.createElement('span');
    text.textContent = message;
    panel.appendChild(text);
    if (error && vault) {
      const retry = document.createElement('button');
      retry.className = 'sm';
      retry.textContent = 'Sincronizar novamente';
      retry.onclick = () => {
        if (!requiresReload(failure)) { failure = null; reconnect().catch(() => {}); }
      };
      if (!requiresReload(failure)) panel.append(retry);
      const recovery = document.createElement('button');
      recovery.className = 'ghost sm';
      recovery.textContent = 'Baixar cópia criptografada';
      recovery.onclick = () => vault?.export().then(file => {
        const url = URL.createObjectURL(new Blob([file], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'nexodent-copia-offline-' + tdy() + '.json';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }).catch(problem => localToast(problem.message, 4500));
      panel.append(recovery);
      panel.hidden = false;
      return;
    }
    if (error) {
      const backup = document.createElement('button');
      backup.className = 'ghost sm';
      backup.textContent = 'Baixar alterações pendentes';
      backup.onclick = () => downloadBackup();
      const retry = document.createElement('button');
      retry.className = 'sm';
      retry.textContent = requiresReload(failure) ? 'Recarregar dados' : 'Tentar novamente';
      retry.onclick = async () => {
        if (requiresReload(failure)) {
          if (!confirm('Há alterações locais NÃO gravadas. Vamos baixar uma cópia antes de recarregar. A recarga descarta as alterações locais atuais; será necessário reaplicá-las manualmente. Deseja continuar?')) return;
          downloadBackup();
          pending = null;
          failure = null;
          try { await openClinic(OralCloud.keep); } catch (error) { status(error.message, true); }
        } else { failure = null; flush().catch(() => {}); }
      };
      panel.append(backup, retry);
    }
    // Avisos de sucesso ficam ocultos; erros continuam visíveis com ações de recuperação.
    panel.hidden = !error;
  }

  function downloadBackup() {
    const recovery = { app: 'oralvalle-pending-changes', v: 1, exp: new Date().toISOString(),
      core: OralCloudData.snapshot(db), files: pendingFiles,
      note: 'Alterações pendentes, não é um backup completo. Não restaurar como backup da clínica.' };
    const url = URL.createObjectURL(new Blob([JSON.stringify(recovery)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'oralvalle-alteracoes-pendentes-' + tdy() + '.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function saved() {
    lastSaved = new Date();
    lastSavedPid = view.id || null;
    updSaveStat();
    status('✓ Alterações confirmadas no Supabase.');
  }

  async function flush() {
    clearTimeout(timer);
    if (membersRunning) return memberQueue.then(() => flush());
    if (running) return running;
    if (vault && (!navigator.onLine || offlineSession)) return;
    if (failure) throw failure;
    running = (async () => {
      while ((pending || vault?.record.dirty || vault?.record.job) && !disposed && !LOCKED) {
        const snapshot = pending;
        pending = null;
        try {
          let revision;
          if (vault) {
            await localWrite;
            const activeVault = vault;
            const record = await activeVault.write(value => value.job ? value : ({
              ...value, job: { id: crypto.randomUUID(), data: value.data }
            }));
            OralCloudData.restoreCheckpoint(record.base);
            revision = await OralCloudData.save(record.job.data, record.job.id);
            const base = OralCloudData.checkpoint();
            const committed = await activeVault.write(value => ({
              ...value, base, job: null, dirty: JSON.stringify(value.data) !== JSON.stringify(record.job.data)
            }));
            pending = committed.dirty ? copy(committed.data) : pending;
          } else {
            revision = await OralCloudData.save(snapshot);
          }
          syncRevision = revision;
          if (!pending) saved();
        } catch (error) {
          if (!pending) pending = snapshot;
          if (vault && networkFailure(error)) {
            offlineSession = true;
            updateConnection();
            return;
          }
          failure = error;
          status(isFinalizedEvolutionConflict(error)
            ? 'O Supabase protegeu uma evolução finalizada e recusou a gravação. Suas alterações pendentes foram preservadas.'
            : isRevisionConflict(error)
            ? (vault ? 'Há um conflito com outra alteração da clínica. Sua cópia criptografada foi preservada.' : 'Outro usuário alterou a clínica. Suas alterações não foram sobrescritas: baixe o backup e recarregue.')
            : isEvolutionDentistReference(error)
            ? 'O vínculo com o dentista impediu a exclusão. Baixe as alterações pendentes, recarregue e use Cancelar manutenção no prontuário.'
            : 'Não foi possível gravar no Supabase: ' + error.message, true);
          throw error;
        }
      }
    })().finally(() => { running = null; updSaveStat(); updateConnection(); });
    return running;
  }

  save = function () {
    if (LOCKED || !OralCloud.clinicId || disposed) {
      localToast('Entre na clínica antes de gravar dados.', 3500);
      return;
    }
    pending = OralCloudData.snapshot(db);
    if (vault) {
      const latest = pending;
      localWrites++;
      localWrite = vault.write(record => ({ ...record, data: latest, dirty: true })).catch(error => {
        failure = error;
        status('Alterações ainda não gravadas neste aparelho: ' + error.message, true);
        throw error;
      }).finally(() => { localWrites--; updateConnection(); });
      localWrite.catch(() => {});
      updateConnection();
    }
    lastSaved = null;
    updSaveStat();
    if (!failure) status('Gravando alterações no Supabase…');
    clearTimeout(timer);
    timer = setTimeout(() => flush().catch(() => {}), 350);
  };

  saveStatText = function (patient) {
    if (failure) return '⚠ Alterações pendentes';
    if (vault && (pending || running)) return localWrites ? 'Gravando neste aparelho…' : 'Salvo neste aparelho · sincronização pendente';
    if (pending || running) return '⏳ Aguardando confirmação do Supabase';
    return patient && lastSaved && lastSavedPid === patient.id
      ? '✓ Tudo salvo às ' + hhmm(lastSaved) : '✓ Dados carregados do Supabase';
  };
  toastSaved = function () {
    if (failure) return localToast('Há alterações pendentes. Confira o aviso de conexão.', 3500);
    localToast(pending || running ? 'Aguardando confirmação do Supabase…' : '✓ Alterações confirmadas no Supabase');
  };
  toast = function (message, duration) {
    // Ações legadas avisam imediatamente; não confundir mudança em tela com gravação remota.
    if ((pending || running || membersPending) && /salv|registrad|restaurad|cadastrad|atualizad|removid|importa.*conclu/i.test(message))
      message += ' — confirmação no Supabase pendente.';
    localToast(message, duration);
  };

  function splashMessage(message) {
    const el = document.getElementById('ov-splash-message');
    if (el) el.textContent = message;
  }
  async function openClinic(keep) {
    splashMessage('Carregando seus procedimentos...');
    disposed = false;
    stopSync();
    document.removeEventListener('visibilitychange', onSyncVisible);
    window.removeEventListener('online', onSyncVisible);
    window.removeEventListener('focus', onSyncVisible);
    window.OralCloudFiles?.reset();
    const clinics = await OralCloud.request('/rest/v1/rpc/clinic_list', { method: 'POST', body: {} });
    if (!Array.isArray(clinics) || !clinics.length)
      throw new Error('Sua conta ainda não tem acesso à clínica. Confirme seu e-mail e peça ao administrador Ricardo Silva que aprove seu cadastro em Configurações → Acessos.');
    const configured = configuredClinic();
    const clinic = configured ? clinics.find(item => item.clinic_id === configured) : clinics.length === 1 ? clinics[0] : null;
    if (!clinic) throw new Error('Defina clinicId no arquivo de configuração: há mais de uma clínica ou o vínculo não corresponde.');
    OralCloud.clinicId = clinic.clinic_id;
    // Members and clinic data are independent reads. Start both together to
    // avoid an unnecessary network round trip during login.
    const membersPromise = OralCloudData.members();
    const dataPromise = OralCloudData.load();
    let members, raw;
    try {
      [members, raw] = await Promise.all([membersPromise, dataPromise]);
    } catch (error) {
      error.clinicLoad = true;
      throw error;
    }
    AUTH = { users: members.filter(member => member.active), rec: null };
    memberBaseline = copy(AUTH.users);
    // Nunca importar automaticamente os dados locais ao preencher as credenciais.
    db = migrate(raw);
    OralCloudData.prepareDefaults(db);
    window.dispatchEvent(new CustomEvent('nexodent:clinic-data-loaded', { detail: { clinicId: OralCloud.clinicId } }));
    const member = AUTH.users.find(user => user.id === clinic.user_id);
    if (!member) throw new Error('Vínculo de usuário não disponível.');
    accessRequests = [];
    accessError = '';
    // Access requests are only needed when the admin opens the access settings.
    // Do not make the first screen wait for this secondary request.
    if (member.admin) refreshAccessRequests();
    pending = null;
    failure = null;
    lastSaved = null;
    pendingFiles = [];
    unlock(member, keep);
    // Restore navigation only after authentication and clinic permissions are loaded.
    if (typeof ovRestoreNavigation === "function") { ovRestoreNavigation(); render(); }
    OralCloudData.prepareDefaults(db);
    status('Conectado ao Supabase · ' + clinic.nome);
    startSync(clinic.clinic_id);
    window.NexoModules?.refresh();
  }

  async function refreshAccessRequests() {
    accessLoading = true;
    try {
      accessRequests = await OralCloudData.pendingUsers();
      accessError = '';
    } catch (error) {
      accessRequests = [];
      accessError = error.code === 'PGRST202' || error.status === 404
        ? 'Execute a migration 202610140002_main_clinic_access.sql para ativar a aprovação de usuários.'
        : 'Não foi possível carregar as solicitações: ' + explain(error);
    } finally { accessLoading = false; }
  }

  function accessRequestsHtml() {
    const list = accessRequests.map(user => `<article class="pg" style="flex-wrap:wrap">
      <span><strong>${esc(user.nome || 'Usuário sem nome')}</strong><br>${esc(user.email)}</span>
      <span class="row" style="flex:none"><button class="sm" data-act="cloudapprove" data-id="${esc(user.id)}">Aprovar</button><button class="danger sm" data-act="cloudreject" data-id="${esc(user.id)}">Rejeitar</button></span>
    </article>`).join('');
    return `<section class="card"><div class="row"><h2 style="margin:0">Solicitações de acesso</h2><button class="ghost sm" data-act="cloudrequests"${accessLoading ? ' disabled' : ''}>Atualizar</button></div>
      <p class="note">Somente contas com e-mail confirmado aparecem aqui. Aprovar libera inicialmente a visualização da agenda, lista de pacientes e lembretes. Ajuste abaixo as permissões de cada usuário.</p>
      ${accessError ? `<p role="alert">${esc(accessError)}</p>` : list || '<p class="note">Nenhuma solicitação pendente.</p>'}</section>`;
  }

  function cloudLock(mode, message = '') {
    document.getElementById('ov-startup-shell')?.remove();
    LOCKED = true;
    clearTimeout(idleT);
    $('app').innerHTML = '';
    $('app').style.display = 'none';
    let lock = $('lock');
    if (!lock) { lock = document.createElement('div'); lock.id = 'lock'; document.body.appendChild(lock); }
    const clinic = topCl();
    const warning = message ? `<div class="lk-err" role="alert">${esc(message)}</div>` : '';
    const legalLinks='<nav aria-label="Informações legais" style="margin:18px auto 0;max-width:380px;font-size:13px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px;align-items:center;text-align:center;line-height:1.4"><a href="./legal/privacidade.html" target="_blank" rel="noopener">Privacidade</a><a href="./legal/cookies.html" target="_blank" rel="noopener">Cookies e armazenamento</a><a href="./legal/direitos.html" target="_blank" rel="noopener">Seus direitos</a><a href="./legal/termos.html" target="_blank" rel="noopener">Termos de uso</a></nav>';
    const legalNotice='<p style="font-size:13px">Antes de cadastrar, consulte o aviso de privacidade. O cadastro não autoriza publicidade. '+(window.NexoLegalAcceptance?.active()?'<label><input type="checkbox" id="cloudTerms" required> Li e aceito os <a href="./legal/termos.html" target="_blank" rel="noopener">termos de uso</a>.</label>':'Os termos de contratação estão em revisão; não há contratação paga por este cadastro.')+'</p>';
    const email = '<label for="cloudEmail">E-mail</label><input id="cloudEmail" type="email" autocomplete="username" autocapitalize="none" required>';
    let body;
    if (mode === 'checking') body = `<h1>Restaurando acesso</h1><p class="lk-t" role="status">Verificando sua sessão e carregando a clínica…</p>`;
    else if (mode === 'load') body = `<h1>Carregar clínica</h1>${warning}<button type="submit">Tentar carregar novamente</button><button type="button" class="lk-link" data-cloud-back>Voltar ao login</button>`;
    else if (mode === 'signup') body = `<h1>Criar conta</h1><p class="lk-t">Cadastre seu acesso. O administrador precisará autorizar sua entrada na clínica.</p>${warning}${legalNotice}<label for="cloudName">Nome completo</label><input id="cloudName" autocomplete="name" required>${email}<label for="cloudPassword">Senha (mínimo 6 caracteres)</label><input id="cloudPassword" type="password" autocomplete="new-password" minlength="6" required><label for="cloudRepeat">Repita a senha</label><input id="cloudRepeat" type="password" autocomplete="new-password" minlength="6" required><button type="submit">Cadastrar</button><button type="button" class="lk-link" data-cloud-back>Já tenho conta. Entrar</button>`;
    else if (mode === 'recover') body = `<h1>Redefinir senha</h1><p class="lk-t">Enviaremos um link para o e-mail cadastrado no Supabase.</p>${warning}${email}<button type="submit">Enviar link</button><button type="button" class="lk-link" data-cloud-back>Voltar</button>`;
    else if (mode === 'password') body = `<h1>Definir senha</h1>${warning}<label for="cloudPassword">Nova senha</label><input id="cloudPassword" type="password" autocomplete="new-password" minlength="6" required><label for="cloudRepeat">Repita a senha</label><input id="cloudRepeat" type="password" autocomplete="new-password" minlength="6" required><button type="submit">Salvar senha</button>`;
    else if (mode === 'offline') body = `<h1>Desbloquear acesso offline</h1>${warning}${email}<label for="cloudPassword">Código offline</label><input id="cloudPassword" type="password" autocomplete="off" required><button type="submit">Desbloquear</button><button type="button" class="lk-link" data-cloud-back>Voltar</button>`;
    else body = `<h1>Entrar</h1><p class="lk-t">Entre com seu acesso da clínica no Supabase.</p>${warning}${email}<label for="cloudPassword">Senha</label><input id="cloudPassword" type="password" autocomplete="current-password" required><label class="lk-chk"><input id="cloudKeep" type="checkbox"> Manter conectado neste aparelho</label><button type="submit">Entrar</button><button type="button" class="lk-link" data-cloud-signup>Criar conta</button><button type="button" class="lk-link" data-cloud-forgot>Esqueci a senha</button><button type="button" class="lk-link" data-cloud-offline>Acesso offline</button>`;
    lock.innerHTML = `<div class="lk-box"><div class="lk-brand"><strong>${esc(clinic.marca)}</strong><span>${esc(clinic.sub)}</span></div><form>${body}</form>${legalLinks}</div>`;
    // Controle visual de senha: não interfere na autenticação nem no valor digitado.
    lock.querySelectorAll('input[type="password"]').forEach(input => {
      const wrapper = document.createElement('span');
      wrapper.style.cssText = 'display:block;position:relative;width:100%;';
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
      input.style.paddingRight = '46px';
      input.style.boxSizing = 'border-box';
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.setAttribute('aria-label', 'Mostrar senha');
      toggle.setAttribute('aria-pressed', 'false');
      toggle.title = 'Mostrar senha';
      toggle.textContent = '👁';
      toggle.style.cssText = 'position:absolute;right:8px;top:50%;transform:translateY(-50%);width:34px;height:34px;min-height:0;padding:0;border:0;border-radius:6px;background:transparent;color:#667085;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:19px;box-shadow:none;';
      toggle.addEventListener('click', () => {
        const visible = input.type === 'password';
        input.type = visible ? 'text' : 'password';
        toggle.setAttribute('aria-label', visible ? 'Ocultar senha' : 'Mostrar senha');
        toggle.setAttribute('aria-pressed', String(visible));
        toggle.title = visible ? 'Ocultar senha' : 'Mostrar senha';
        toggle.style.opacity = visible ? '0.55' : '1';
      });
      wrapper.appendChild(toggle);
    });
    lock.querySelector('[data-cloud-signup]')?.addEventListener('click', () => { location.hash = 'cadastro'; });
    lock.querySelector('[data-cloud-back]')?.addEventListener('click', () => {
      if (location.hash === '#cadastro') history.replaceState(null, '', location.pathname + location.search);
      cloudLock('login');
    });
    lock.querySelector('[data-cloud-offline]')?.addEventListener('click', () => cloudLock('offline'));
    lock.querySelector('[data-cloud-forgot]')?.addEventListener('click', () => cloudLock('recover'));
    lock.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      const button = lock.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        if (mode === 'offline') {
          await unlockOffline($('cloudEmail').value.trim(), $('cloudPassword').value.trim());
        } else if (mode === 'load') {
          await openClinic(OralCloud.keep);
        } else if (mode === 'signup') {
          const nome = $('cloudName').value.trim();
          const password = $('cloudPassword').value;
          const error = pwOk(password, $('cloudRepeat').value);
          if (!nome) throw new Error('Preencha seu nome.');
          if (error) throw new Error(error);
          const acceptance=window.NexoLegalAcceptance?.metadata($('cloudTerms')?.checked);
          await OralCloud.signup(nome, $('cloudEmail').value.trim(), password,acceptance);
          history.replaceState(null, '', location.pathname + location.search);
          cloudLock('login', 'Solicitação de cadastro enviada. Se necessário, confirme seu e-mail. Para acessar a clínica, peça ao administrador que autorize sua conta. Se já possui conta, entre ou recupere sua senha.');
        } else if (mode === 'recover') {
          await OralCloud.recover($('cloudEmail').value.trim());
          cloudLock('login', 'Se o e-mail estiver cadastrado, você receberá o link de recuperação.');
        } else if (mode === 'password') {
          const password = $('cloudPassword').value;
          const error = pwOk(password, $('cloudRepeat').value);
          if (error) throw new Error(error);
          await OralCloud.password(password);
          await openClinic(OralCloud.keep);
        } else {
          const keep = $('cloudKeep').checked;
          await OralCloud.login($('cloudEmail').value.trim(), $('cloudPassword').value, keep);
          await openClinic(keep);
        }
      } catch (error) { cloudLock(error.clinicLoad ? 'load' : mode === 'load' ? 'login' : mode, explain(error)); }
    };
    (lock.querySelector('input') || lock.querySelector('[type="submit"]'))?.focus();
  }

  function explain(error) {
    if (error.code === '57014' || /canceling statement due to statement timeout/i.test(error.message || ''))
      return error.clinicLoad
        ? 'Seu acesso foi autenticado, mas o banco excedeu o tempo para carregar a clínica. Nenhum dado foi alterado por esta leitura. Tente novamente; se persistir, é necessário verificar o carregamento no Supabase.'
        : 'O banco excedeu o tempo para concluir a operação. Verifique o Supabase antes de repetir uma gravação.';
    if (error.clinicLoad && error.status !== 401 && error.status !== 403 && error.code !== '42501' && error.code !== 'PGRST202' && error.status !== 404)
      return 'Seu acesso foi autenticado, mas não foi possível carregar a clínica. Tente carregar novamente.';
    if (error.code === 'PGRST202' || error.status === 404)
      return 'A leitura paginada ainda não está disponível. Aplique a migration 202610200002_bounded_clinic_reads.sql no Supabase e recarregue.';
    return error.message || 'Falha de conexão. Verifique sua internet e tente novamente.';
  }

  authBoot = async function () {
    db = migrate({});
    // Não exibir o formulário de login enquanto uma sessão salva é validada.
    if (location.hash === '#cadastro') cloudLock('signup');
    else {
      // Neutral loading surface: never expose clinical content before authentication.
      LOCKED = true;
      $('app').style.display = 'none';
      const oldLock = $('lock'); if (oldLock) oldLock.remove();
      document.body.classList.add('ov-session-check');
      document.getElementById('ov-startup-shell')?.removeAttribute('hidden');
    }
    try {
      if (!navigator.onLine) { cloudLock('offline'); return; }
      const restored = await OralCloud.restoreSession();
      if (restored?.recovery) cloudLock('password');
      else if (restored) await openClinic(restored.keep);
      else if (location.hash !== '#cadastro') cloudLock('login');
    } catch (error) { cloudLock(error.clinicLoad ? 'load' : 'login', explain(error)); }
    finally { document.body.classList.remove('ov-session-check'); document.getElementById('ov-startup-shell')?.remove(); }
  };

  window.addEventListener('hashchange', () => {
    if (!LOCKED || !['', '#cadastro'].includes(location.hash)) return;
    cloudLock(location.hash === '#cadastro' ? 'signup' : 'login');
  });

  doLogout = async function (message) {
    if (vault) {
      try { await localWrite; }
      catch (error) { if (!message) { localToast(error.message, 5000); return; } }
      await lockVault(message);
      try { await OralCloud.logout(); } catch (_) {}
      return;
    }
    try {
      await memberQueue;
      await flush();
    } catch (_) { localToast('Não foi possível sair: há alterações não gravadas. Resolva o aviso ou baixe um backup.', 5000); return; }
    disposed = true;
    stopSync();
    document.removeEventListener('visibilitychange', onSyncVisible);
    window.removeEventListener('online', onSyncVisible);
    window.removeEventListener('focus', onSyncVisible);
    window.OralCloudFiles?.reset();
    OralCloudData.reset();
    try { await OralCloud.logout(); } catch (_) {}
    clearTimeout(idleT);
    ME = null; AUTH = { users: [], rec: null };
    accessRequests = []; accessError = '';
    try { sessionStorage.removeItem('oralvalle:navigation:v1'); } catch (_) {}
    db = migrate({}); view.id = null; view.h = 'pac'; delArm = null;
    $('cloudStatus')?.remove();
    cloudLock('login', message || '');
  };

  acHtml = function () {
    if (!ME) return '';
    return `<section class="card"><h2>Meu acesso</h2><p>Conectado como <strong>${esc(ME.nome)}</strong> (${esc(ME.login)}).</p><p class="note">Dados compartilhados no Supabase. Novas contas são criadas na tela de cadastro e aprovadas pelo administrador em Configurações → Acessos, onde também são ajustadas as permissões.</p><button class="ghost" data-act="logout">Sair do sistema</button>${!vault ? ' <button class="ghost" data-act="offlineenable">Configurar ou abrir cópia offline</button>' : ' <button class="ghost" data-act="offlinedisable">Fechar cópia offline</button>'}<h2 style="margin-top:18px">Alterar minha senha</h2><label for="acp0">Senha atual</label><input id="acp0" type="password" autocomplete="current-password"><label for="acp1">Nova senha</label><input id="acp1" type="password" autocomplete="new-password"><label for="acp2">Repita a nova senha</label><input id="acp2" type="password" autocomplete="new-password"><button data-act="acpw" style="margin-top:12px">Alterar senha</button></section>`;
  };
  A.offlineenable = () => enableOffline().catch(error => localToast(error.message, 6000));
  A.offlinedisable = async () => {
    try {
      await localWrite;
      await lockVault('Cópia offline bloqueada neste aparelho.');
      if (navigator.onLine && OralCloud.session?.user) await openClinic(OralCloud.keep);
    } catch (error) { localToast(error.message, 4500); }
  };
  pmCardHtml = function () {
    if (vault) return '<section class="card"><p>Feche a cópia offline em Meu acesso para administrar permissões.</p></section>';
    const html = localPermissionCard();
    if (!html) return '';
    return accessRequestsHtml() + html.split('<h3 class="up-h" style="margin-top:20px">')[0] + '<p class="note">Novos usuários aparecem nas solicitações após confirmar o e-mail. Remover um usuário revoga o acesso à clínica, sem apagar sua conta de autenticação.</p></section>';
  };

  aSave = function () {
    if (vault) {
      AUTH.users = copy(memberBaseline);
      localToast('Bloqueie a cópia offline antes de alterar permissões.', 4500);
      return false;
    }
    const captured = copy(AUTH.users);
    membersPending++;
    memberQueue = memberQueue.catch(() => {}).then(async () => {
      await flush();
      membersRunning = true;
      $('app').inert = true;
      try {
        for (const previous of memberBaseline) {
          const current = captured.find(member => member.id === previous.id);
          const patch = !current ? { active: false }
            : JSON.stringify(previous.perms) !== JSON.stringify(current.perms) ? { perms: current.perms } : null;
          if (patch) await OralCloudData.updateMember(previous.id, patch);
        }
        memberBaseline = copy(captured);
        db = migrate(await OralCloudData.load());
        OralCloudData.prepareDefaults(db);
        render();
        OralCloudData.prepareDefaults(db);
        status('✓ Permissões confirmadas no Supabase.');
      } finally {
        membersRunning = false;
        $('app').inert = false;
        if (pending) timer = setTimeout(() => flush().catch(() => {}), 350);
      }
    }).catch(error => {
      AUTH.users = copy(memberBaseline);
      render();
      error.needsReload = true;
      failure = error;
      status('Permissões não confirmadas: ' + explain(error), true);
      localToast('Permissões não gravadas: ' + explain(error), 6000);
      throw error;
    }).finally(() => { membersPending--; });
    memberQueue.catch(() => {});
    status('Gravando permissões no Supabase…');
    return true;
  };

  A.acpw = async function () {
    if (vault && (offlineSession || !navigator.onLine)) {
      localToast('Conecte-se antes de alterar a senha do Supabase.', 4500);
      return;
    }
    const password = $('acp1').value;
    const error = pwOk(password, $('acp2').value);
    if (error) return localToast(error, 3500);
    try {
      await OralCloud.login(ME.login, $('acp0').value, OralCloud.keep);
      await OralCloud.password(password);
      render(); localToast('Senha alterada no Supabase.');
    } catch (error) { localToast(explain(error), 5000); }
  };
  A.acadd = () => localToast('Peça ao usuário que crie a conta na tela de cadastro e confirme o e-mail. Depois, aprove a solicitação em Acessos.', 5000);
  // A promoção administrativa é exclusiva do Supabase: nunca salvar somente no navegador.
  A.acadmin = (button, data) => {
    if (vault || !ME?.admin || membersPending || membersRunning || !data?.id || data.id === ME.id) return;
    const target = AUTH.users.find(user => String(user.id) === String(data.id));
    if (!target || !target.active) return;
    const makeAdmin = !target.admin;
    if (!makeAdmin && AUTH.users.filter(user => user.active && user.admin).length <= 1) {
      localToast('A clínica precisa manter pelo menos um administrador.', 3500);
      return;
    }
    if (!confirm((makeAdmin ? 'Conceder acesso administrativo completo a ' : 'Retirar acesso administrativo de ') + target.nome + '?')) return;
    const clinicId = OralCloud.clinicId;
    button.disabled = true;
    membersPending++;
    memberQueue = memberQueue.catch(() => {}).then(async () => {
      await flush();
      membersRunning = true;
      $('app').inert = true;
      try {
        if (!clinicId || OralCloud.clinicId !== clinicId) throw new Error('A clínica mudou. Entre novamente.');
        await OralCloud.request('/rest/v1/rpc/nexodent_set_clinic_admin', {
          method: 'POST', body: { p_clinic_id: clinicId, p_user_id: target.id, p_make_admin: makeAdmin }
        });
        AUTH.users = (await OralCloudData.members()).filter(user => user.active);
        memberBaseline = copy(AUTH.users);
        const current = AUTH.users.find(user => user.id === ME.id);
        if (current) ME = { ...ME, ...current };
        render();
        status(makeAdmin ? '✓ Administrador promovido no Supabase.' : '✓ Acesso administrativo retirado no Supabase.');
      } catch (error) {
        // Uma falha após a RPC pode significar que o banco foi alterado: forçar nova leitura.
        try {
          AUTH.users = (await OralCloudData.members()).filter(user => user.active);
          memberBaseline = copy(AUTH.users);
          render();
        } catch (_) {}
        localToast('Não foi possível confirmar a alteração: ' + explain(error), 6000);
        status('Erro ao alterar administrador: ' + explain(error), true);
      } finally {
        membersRunning = false;
        $('app').inert = false;
      }
    }).finally(() => { membersPending--; button.disabled = false; });
    memberQueue.catch(() => {});
  };

  A.cloudrequests = async () => {
    if (!ME?.admin || accessLoading) return;
    await refreshAccessRequests();
    if (ME?.admin && !LOCKED) render();
  };
  function decideAccess(button, userId, approve) {
    if (vault || !ME?.admin || membersPending) return;
    const requested = accessRequests.find(user => user.id === userId);
    if (!requested) return;
    if (!confirm((approve ? 'Aprovar o acesso de ' : 'Rejeitar a solicitação de ') + requested.email + '?')) return;
    button.disabled = true;
    membersPending++;
    // A aprovação também muda a revisão clínica; não pode disputar com uma gravação em curso.
    memberQueue = memberQueue.catch(() => {}).then(async () => {
      await flush();
      membersRunning = true;
      $('app').inert = true;
      try {
        await OralCloudData.decideUser(userId, approve);
        AUTH.users = (await OralCloudData.members()).filter(member => member.active);
        memberBaseline = copy(AUTH.users);
        db = migrate(await OralCloudData.load());
        OralCloudData.prepareDefaults(db);
        await refreshAccessRequests();
        render();
        OralCloudData.prepareDefaults(db);
        status(approve ? '✓ Usuário aprovado na clínica.' : '✓ Solicitação rejeitada.');
      } catch (error) {
        // A alteração pode ter ocorrido antes da falha de recarga. Não salvar contra um baseline antigo.
        error.needsReload = true;
        failure = error;
        status('Não foi possível concluir a aprovação: ' + explain(error), true);
        throw error;
      } finally {
        membersRunning = false;
        $('app').inert = false;
      }
    }).finally(() => { membersPending--; button.disabled = false; });
    memberQueue.catch(() => {});
  }
  A.cloudapprove = (button, data) => decideAccess(button, data.id, true);
  A.cloudreject = (button, data) => decideAccess(button, data.id, false);
  A.acrec = () => cloudLock('recover');
  A.savebtn = () => { document.activeElement?.blur(); save(); flush().catch(() => {}); };
  const localBackupView = bkHtml;
  bkHtml = () => localBackupView().replace('guardados neste navegador. Se limpar o navegador ou trocar de aparelho, tudo se perde.', 'compartilhados no Supabase. Faça backup antes de restaurar ou importar dados.');

  window.addEventListener('beforeunload', event => {
    if ((vault ? localWrites || failure && !requiresReload(failure) : pending || running || failure) || membersPending || pendingFiles.length) { event.preventDefault(); event.returnValue = ''; }
  });
  async function fileOperation(patientId, operation, data) {
    if (vault && (offlineSession || !navigator.onLine || pending || running))
      throw new Error('Conecte-se e sincronize as alterações antes de alterar arquivos.');

    const intent = copy({ patientId, operation, data });
    pendingFiles.push(intent);
    membersPending++;
    memberQueue = memberQueue.catch(() => {}).then(async () => {
      await flush();
      if (LOCKED || disposed) throw new Error('Entre na clínica antes de alterar arquivos.');
      membersRunning = true;
      $('app').inert = true;
      try {
        const revision = await OralCloudData.changeFile(patientId, operation, intent.data);
        pendingFiles = pendingFiles.filter(value => value !== intent);
        if (vault) {
          const base = OralCloudData.checkpoint();
          await vault.write(record => ({ ...record, base }));
        }
        saved();
        return revision;
      } catch (error) {
        error.needsReload = true;
        failure = error;
        status('Arquivo sem confirmação de gravação: ' + explain(error) + ' Baixe as alterações pendentes antes de recarregar.', true);
        throw error;
      } finally { membersRunning = false; $('app').inert = false; }
    }).finally(() => { membersPending--; });
    return memberQueue;
  }
  window.OralCloudSync = Object.freeze({ flush, fileOperation,
    get dirty() { return Boolean(pending || running || failure || membersPending || pendingFiles.length); } });
})();