/* Device-local encrypted clinic data. No Supabase credentials are stored here. */
(function (global) {
  'use strict';
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const random = size => crypto.getRandomValues(new Uint8Array(size));
  async function prefix(email) {
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify([location.origin, email.trim().toLowerCase()])));
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('') + ':';
  }
  const scope = async (email, clinic) => await prefix(email) + clinic;
  const context = (id, version) => encoder.encode(JSON.stringify(['nexodent-offline-v1', id, version]));

  async function derive(secret, salt) {
    if (!/^[0-9a-f]{32}$/i.test(secret)) throw new Error('Código offline inválido.');
    const material = await crypto.subtle.importKey('raw', encoder.encode(secret.toLowerCase()), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
      material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  function connect() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('nexodent-offline', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('clinics');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
    });
  }

  async function transaction(mode, action) {
    const database = await connect();
    try {
      return await new Promise((resolve, reject) => {
        const tx = database.transaction('clinics', mode);
        let value;
        tx.oncomplete = () => resolve(value);
        tx.onabort = () => reject(value instanceof Error ? value : tx.error);
        action(tx.objectStore('clinics'), result => { value = result; }, () => tx.abort());
      });
    } finally { database.close(); }
  }

  const read = id => transaction('readonly', (store, done) => {
    const request = store.get(id);
    request.onsuccess = () => done(request.result);
  });

  function handle(id, key, salt, record, version) {
    let queue = Promise.resolve();
    let closed = false;
    return {
      get record() { return record; },
      close() { closed = true; record = null; },
      async export() {
        const stored = await read(id);
        const binary = value => Array.from(new Uint8Array(value));
        return JSON.stringify({ format: 'nexodent-offline-v1', id, version: stored.version,
          salt: binary(stored.salt), iv: binary(stored.iv), ciphertext: binary(stored.ciphertext) });
      },
      write(change) {
        const next = queue.then(async () => {
          if (closed) throw new Error('Acesso offline bloqueado.');
          const candidate = change(record);
          const revision = version + 1;
          const iv = random(12);
          const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: context(id, revision) },
            key, encoder.encode(JSON.stringify(candidate)));
          if (closed) throw new Error('Acesso offline bloqueado.');
          await transaction('readwrite', (store, done, abort) => {
            const request = store.get(id);
            request.onsuccess = () => {
              if ((request.result?.version || 0) !== version) {
                done(new Error('Outra aba alterou a cópia offline. Feche a outra aba e abra novamente.'));
                abort();
                return;
              }
              store.put({ salt, iv, ciphertext, version: revision }, id);
            };
          });
          version = revision;
          if (!closed) record = candidate;
          return candidate;
        });
        queue = next.catch(() => {});
        return next;
      },
    };
  }

  async function create(email, clinic, secret, record) {
    const id = await scope(email, clinic);
    const salt = random(16);
    const vault = handle(id, await derive(secret, salt), salt, null, 0);
    await vault.write(() => record);
    navigator.storage?.persist?.().catch(() => {});
    return vault;
  }

  async function open(email, clinic, secret) {
    const id = await scope(email, clinic);
    const stored = await read(id);
    if (!stored) throw new Error('Acesso offline indisponível para esta conta e clínica.');
    const key = await derive(secret, stored.salt);
    let record;
    try {
      const result = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: stored.iv, additionalData: context(id, stored.version) }, key, stored.ciphertext);
      record = JSON.parse(decoder.decode(result));
    } catch (_) { throw new Error('Código offline inválido ou cópia danificada.'); }
    return handle(id, key, stored.salt, record, stored.version);
  }

  global.NexoOfflineVault = Object.freeze({
    create, open,
    async clinic(email, configured) {
      if (configured) return configured;
      const keyPrefix = await prefix(email);
      const keys = await transaction('readonly', (store, done) => {
        const request = store.getAllKeys(IDBKeyRange.bound(keyPrefix, keyPrefix + '\uffff'));
        request.onsuccess = () => done(request.result);
      });
      if (keys.length !== 1) throw new Error('Abra o endereço da clínica que foi configurado para acesso offline.');
      return keys[0].slice(keyPrefix.length);
    },
    exists: async (email, clinic) => Boolean(await read(await scope(email, clinic))),
    code: () => Array.from(random(16), byte => byte.toString(16).padStart(2, '0')).join(''),
  });
})(window);
