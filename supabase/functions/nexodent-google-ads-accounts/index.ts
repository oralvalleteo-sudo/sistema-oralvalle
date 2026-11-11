const URL_BASE = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CLIENT_ID = Deno.env.get('GOOGLE_ADS_CLIENT_ID')!;
const CLIENT_SECRET = Deno.env.get('GOOGLE_ADS_CLIENT_SECRET')!;
const ENC_KEY = Deno.env.get('GOOGLE_ADS_ENCRYPTION_KEY')!;
const APP_ORIGIN = Deno.env.get('NEXODENT_APP_ORIGIN')!;
const API_VERSION = Deno.env.get('GOOGLE_ADS_API_VERSION') || 'v26';
const DEVELOPER_TOKEN = Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN') || '';

function cors() {
  return {
    'Access-Control-Allow-Origin': APP_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization,apikey,content-type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Vary': 'Origin',
  };
}
function reply(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
async function db(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation,resolution=merge-duplicates',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) throw new Error(`Falha no banco (${response.status})`);
  return data;
}
function fromB64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}
async function decrypt(value: string) {
  if (!/^[a-f0-9]{64}$/i.test(ENC_KEY || '')) throw new Error('Chave de criptografia não configurada');
  const [ivPart, dataPart] = String(value || '').split('.');
  if (!ivPart || !dataPart) throw new Error('Credencial armazenada em formato inválido');
  const rawKey = new Uint8Array((ENC_KEY.match(/../g) || []).map(x => parseInt(x, 16)));
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
  const clear = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64Url(ivPart) }, key, fromB64Url(dataPart),
  );
  return new TextDecoder().decode(clear);
}
async function getAccessToken(refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) {
    console.error('Google OAuth refresh falhou:', response.status, result.error || 'unknown');
    throw new Error('Não foi possível renovar a autorização Google. Reconecte a conta Google Ads.');
  }
  return result.access_token as string;
}
async function googleRequest(path: string, accessToken: string, method = 'GET', body?: unknown) {
  const response = await fetch(`https://googleads.googleapis.com/${API_VERSION}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': DEVELOPER_TOKEN,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) {
    const message = data?.error?.message || `Google Ads API respondeu HTTP ${response.status}`;
    console.error('Google Ads API:', response.status, message.slice(0, 500));
    throw new Error(message.slice(0, 350));
  }
  return data;
}
async function loadAccounts(accessToken: string) {
  // Desde 09/09/2026, os níveis de acesso são associados ao projeto Google Cloud;
  // o developer token deixou de ser obrigatório para chamadas novas.
  const accessible = await googleRequest('customers:listAccessibleCustomers', accessToken);
  const resources: string[] = Array.isArray(accessible?.resourceNames) ? accessible.resourceNames : [];
  const ids = [...new Set(resources.map((name: string) => name.match(/^customers\/(\d+)$/)?.[1]).filter(Boolean))] as string[];
  const accounts = await Promise.all(ids.slice(0, 100).map(async id => {
    try {
      const result = await googleRequest(`customers/${id}/googleAds:search`, accessToken, 'POST', {
        query: 'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager, customer.test_account FROM customer LIMIT 1',
      });
      const row = result?.results?.[0]?.customer || {};
      return {
        customer_id: id,
        descriptive_name: row.descriptiveName || `Conta Google Ads ${id}`,
        currency_code: row.currencyCode || null,
        time_zone: row.timeZone || null,
        manager: Boolean(row.manager),
        test_account: Boolean(row.testAccount),
      };
    } catch (error) {
      // Mantém a conta na lista mesmo se o usuário não tiver permissão para consultar seus metadados.
      return { customer_id: id, descriptive_name: `Conta Google Ads ${id}`, currency_code: null, time_zone: null, manager: false, test_account: false };
    }
  }));
  return accounts;
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() });
  if (req.method !== 'POST') return reply(405, { error: 'Método inválido' });
  try {
    if (!APP_ORIGIN || req.headers.get('origin') !== APP_ORIGIN) return reply(403, { error: 'Origem não autorizada' });
    const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!bearer) return reply(401, { error: 'Entre no NexoDent novamente.' });
    const userResponse = await fetch(`${URL_BASE}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${bearer}` },
    });
    if (!userResponse.ok) return reply(401, { error: 'Sessão NexoDent inválida. Entre novamente.' });
    const user = await userResponse.json();
    const input = await req.json();
    const clinicId = String(input?.clinic_id || '');
    const action = String(input?.action || 'list');
    if (!/^[0-9a-f-]{36}$/i.test(clinicId)) return reply(400, { error: 'Clínica inválida.' });
    if (!['list', 'select'].includes(action)) return reply(400, { error: 'Ação inválida.' });

    const members = await db(`clinic_members?clinic_id=eq.${encodeURIComponent(clinicId)}&user_id=eq.${encodeURIComponent(user.id)}&admin=eq.true&active=eq.true&select=user_id`);
    if (!Array.isArray(members) || members.length !== 1) return reply(403, { error: 'Somente administradores ativos da clínica podem gerenciar esta conexão.' });

    const credentials = await db(`nexodent_google_ads_credentials?clinic_id=eq.${encodeURIComponent(clinicId)}&select=refresh_token_cipher`);
    if (!Array.isArray(credentials) || credentials.length !== 1 || !credentials[0]?.refresh_token_cipher) {
      return reply(409, { error: 'A autorização Google ainda não foi concluída. Clique em Conectar Google Ads novamente.' });
    }
    const refreshToken = await decrypt(credentials[0].refresh_token_cipher);
    const accessToken = await getAccessToken(refreshToken);
    if (!DEVELOPER_TOKEN) return reply(503, { error: 'A plataforma precisa configurar o acesso à API Google Ads.' });
    const accounts = (await loadAccounts(accessToken)).filter((account: any) => !account.manager);

    if (action === 'list') {
      return reply(200, { accounts, count: accounts.length, api_version: API_VERSION });
    }

    const customerId = String(input?.customer_id || '').replace(/\D/g, '');
    if (!/^\d{10}$/.test(customerId)) return reply(400, { error: 'ID de conta Google Ads inválido.' });
    const selected = accounts.find((account: any) => account.customer_id === customerId);
    if (!selected) return reply(403, { error: 'Esta conta não está acessível pela conta Google autorizada.' });
    await db(`nexodent_channel_connections?on_conflict=clinic_id,provider`, 'POST', {
      clinic_id: clinicId,
      provider: 'google_ads',
      status: 'connected',
      external_account_id: selected.customer_id,
      external_account_label: selected.descriptive_name,
      updated_at: new Date().toISOString(),
    });
    return reply(200, { connected: true, account: selected });
  } catch (error) {
    const message = String((error as Error)?.message || 'Falha ao consultar contas Google Ads');
    return reply(502, { error: message });
  }
});
