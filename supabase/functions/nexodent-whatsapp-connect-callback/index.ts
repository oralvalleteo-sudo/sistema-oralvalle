const BASE=(Deno.env.get('SUPABASE_URL')||'').trim();
const SERVICE=(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'').trim();
const ORIGIN=(Deno.env.get('NEXODENT_APP_ORIGIN')||'https://oralvalleteo-sudo.github.io').trim();
const APP=(Deno.env.get('NEXODENT_APP_URL')||'https://oralvalleteo-sudo.github.io/sistema-oralvalle/').trim();
const APP_ID=(Deno.env.get('META_APP_ID')||'').trim();
const SECRET=(Deno.env.get('META_APP_SECRET')||'').trim();
const CONFIG=(Deno.env.get('META_WHATSAPP_CONFIG_ID')||'').trim();
const VERSION=(Deno.env.get('META_GRAPH_VERSION')||'').trim();
const KEY=(Deno.env.get('META_WHATSAPP_ENCRYPTION_KEY')||'').trim();
const CALLBACK=BASE+'/functions/v1/nexodent-whatsapp-connect-callback';
const encoder=new TextEncoder();
const b64=a=>btoa(String.fromCharCode(...a)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function hash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
// Exact origins owned by this NexoDent deployment; never reflect arbitrary origins.
const ALLOWED_ORIGINS=new Set(['https://app.nexodents.com.br','https://oralvalleteo-sudo.github.io']);
function originValue(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash?url.origin:'';}catch{return '';}}
function allowed(req){return ALLOWED_ORIGINS.has(req.headers.get('origin')||'');}
function configurationErrors(){
 const errors=[];
 try{if(new URL(BASE).protocol!=='https:')errors.push('SUPABASE_URL');}catch{errors.push('SUPABASE_URL');}
 if(!SERVICE)errors.push('SUPABASE_SERVICE_ROLE_KEY');
 if(!/^\d+$/.test(APP_ID))errors.push('META_APP_ID');
 if(!SECRET)errors.push('META_APP_SECRET');
 if(!/^\d+$/.test(CONFIG))errors.push('META_WHATSAPP_CONFIG_ID');
 if(!/^v\d+\.\d+$/.test(VERSION))errors.push('META_GRAPH_VERSION');
 if(!/^[a-f0-9]{64}$/i.test(KEY))errors.push('META_WHATSAPP_ENCRYPTION_KEY');
 if(!ALLOWED_ORIGINS.has(originValue(ORIGIN)))errors.push('NEXODENT_APP_ORIGIN');
 try{const app=new URL(APP);if(!ALLOWED_ORIGINS.has(app.origin)||app.protocol!=='https:'||app.username||app.password||app.search||app.hash)errors.push('NEXODENT_APP_URL');}catch{errors.push('NEXODENT_APP_URL');}
 return errors;
}
function ready(){return configurationErrors().length===0;}
function cors(req){return {...(allowed(req)?{'Access-Control-Allow-Origin':req.headers.get('origin')}:{}),'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Expose-Headers':'X-Nexodent-Function-Version','X-Nexodent-Function-Version':'280','Vary':'Origin','Cache-Control':'no-store'};}
function reply(req,status,data){return new Response(JSON.stringify(data),{status,headers:{...cors(req),'Content-Type':'application/json'}});}
async function db(path,method='GET',body=undefined){const response=await fetch(BASE+'/rest/v1/'+path,{method,headers:{apikey:SERVICE,Authorization:'Bearer '+SERVICE,'Content-Type':'application/json',Prefer:'return=representation,resolution=merge-duplicates'},...(body===undefined?{}:{body:JSON.stringify(body)})});if(!response.ok)throw Error('database');return response.json();}
async function admin(clinic,user){const rows=await db('clinic_members?clinic_id=eq.'+encodeURIComponent(clinic)+'&user_id=eq.'+encodeURIComponent(user)+'&admin=eq.true&active=eq.true&select=user_id');return Array.isArray(rows)&&rows.length===1;}
function redirect(status){try{const app=new URL(APP);if(app.protocol!=='https:'||!ALLOWED_ORIGINS.has(app.origin)||app.username||app.password||app.search||app.hash)throw Error('invalid');if(!app.pathname.endsWith('/'))app.pathname+='/';const target=new URL('integracoes/index.html',app);target.searchParams.set('whatsapp',status);return new Response(null,{status:303,headers:{Location:target.href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});}catch{return new Response('Endereço do sistema não configurado.',{status:503});}}
async function seal(value){const iv=crypto.getRandomValues(new Uint8Array(12)),key=await crypto.subtle.importKey('raw',new Uint8Array(KEY.match(/../g).map(x=>parseInt(x,16))),'AES-GCM',false,['encrypt']);const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(value));return b64(iv)+'.'+b64(new Uint8Array(encrypted));}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:allowed(req)?204:403,headers:cors(req)});
 if(req.method==='POST')return embeddedCallback(req);
 if(req.method!=='GET')return new Response('Método inválido.',{status:405});
 if(!ready())return redirect('configuration_required');
 const url=new URL(req.url),state=url.searchParams.get('state')||'',code=url.searchParams.get('code')||'';
 if(!/^[A-Za-z0-9_-]{43}$/.test(state))return redirect('error');
 try{
  const rows=await db('nexodent_whatsapp_oauth_states?state_hash=eq.'+await hash(state)+'&flow=eq.redirect&select=clinic_id,user_id,expires_at','DELETE');
  if(!Array.isArray(rows)||rows.length!==1)return redirect('error');
  const row=rows[0],expiry=Date.parse(row.expires_at);if(!Number.isFinite(expiry)||expiry<Date.now()||!await admin(row.clinic_id,row.user_id))return redirect('error');
  if(url.searchParams.has('error')||!code||code.length>4096)return redirect('cancelled');
  const response=await fetch('https://graph.facebook.com/'+VERSION+'/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:APP_ID,client_secret:SECRET,redirect_uri:CALLBACK,code})});
  if(!response.ok)return redirect('error');const result=await response.json();
  if(typeof result.access_token!=='string'||!result.access_token||result.access_token.length>16384)return redirect('error');
  // Recheck membership after external authorization; no browser receives the token.
  if(!await admin(row.clinic_id,row.user_id))return redirect('error');
  const lifetime=Number(result.expires_in),expiresAt=Number.isFinite(lifetime)&&lifetime>0?new Date(Date.now()+Math.min(lifetime,31536000)*1000).toISOString():null;
  await db('nexodent_whatsapp_credentials?on_conflict=clinic_id','POST',{clinic_id:row.clinic_id,user_id:row.user_id,access_token_cipher:await seal(result.access_token),expires_at:expiresAt,updated_at:new Date().toISOString()});
  // Authorization alone is NOT a registered number or a validated webhook.
  const existing=await db('nexodent_channel_connections?clinic_id=eq.'+encodeURIComponent(row.clinic_id)+'&provider=eq.whatsapp_business&select=status');
  if(!existing.some(x=>x.status==='connected'))await db('nexodent_channel_connections?on_conflict=clinic_id,provider','POST',{clinic_id:row.clinic_id,provider:'whatsapp_business',status:'pending',external_account_label:'Autorizado — número e webhook pendentes',updated_at:new Date().toISOString()});
  return redirect('authorized');
 }catch{return redirect('error');}
});

async function embeddedCallback(req){
 if(!allowed(req))return reply(req,403,{error:'Origem não autorizada.'});
 if(!ready())return reply(req,503,{code:'WHATSAPP_NOT_CONFIGURED',configuration_fields:configurationErrors(),error:'Configuração WhatsApp incompleta. Confira no Supabase: '+configurationErrors().join(', ')+'.'});
 try{
  const authorization=req.headers.get('authorization')||'';
  if(!/^Bearer \S+$/i.test(authorization))return reply(req,401,{error:'Entre novamente no NexoDent.'});
  const auth=await fetch(BASE+'/auth/v1/user',{headers:{apikey:SERVICE,Authorization:authorization}});
  if(!auth.ok)return reply(req,401,{error:'Sessão inválida.'});
  const user=await auth.json();let input;try{input=await req.json();}catch{return reply(req,400,{error:'Pedido inválido.'});}
  const {clinic_id:clinic,state,code,waba_id:waba,phone_number_id:phone}=input||{};
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clinic||'')||!user?.id||
   !/^[A-Za-z0-9_-]{43}$/.test(state||'')||typeof code!=='string'||!code||code.length>4096||
   !/^\d{1,40}$/.test(waba||'')||!/^\d{1,40}$/.test(phone||''))return reply(req,400,{error:'Cadastro do WhatsApp incompleto. Conclua a seleção do número na Meta.'});
  if(!await admin(clinic,user.id))return reply(req,403,{error:'Somente administradores ativos podem conectar o WhatsApp.'});
  const rows=await db('nexodent_whatsapp_oauth_states?state_hash=eq.'+await hash(state)+'&flow=eq.embedded&clinic_id=eq.'+encodeURIComponent(clinic)+'&user_id=eq.'+encodeURIComponent(user.id)+'&select=clinic_id,user_id,expires_at','DELETE');
  if(!Array.isArray(rows)||rows.length!==1)return reply(req,409,{error:'Esta tentativa já foi usada ou não pertence à sessão. Inicie novamente.'});
  const expiry=Date.parse(rows[0].expires_at);if(!Number.isFinite(expiry)||expiry<Date.now())return reply(req,409,{error:'A autorização expirou. Inicie novamente.'});
  const existing=await db('nexodent_channel_connections?clinic_id=eq.'+encodeURIComponent(clinic)+'&provider=eq.whatsapp_business&select=status');
  if(existing.some(x=>x.status==='connected'))return reply(req,409,{error:'A clínica já tem uma conexão ativa. Não substituímos o número automaticamente.'});
  const tokenResponse=await fetch('https://graph.facebook.com/'+VERSION+'/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:APP_ID,client_secret:SECRET,code})});
  if(!tokenResponse.ok)return reply(req,400,{error:'A Meta não validou a autorização. Inicie novamente.'});
  const token=await tokenResponse.json();if(typeof token.access_token!=='string'||!token.access_token||token.access_token.length>16384)return reply(req,400,{error:'Autorização Meta inválida.'});
  // Browser IDs are only hints: verify the number belongs to the authorized WABA on Graph.
  let next='https://graph.facebook.com/'+VERSION+'/'+waba+'/phone_numbers?fields=id,display_phone_number&limit=100';
  const proofKey=await crypto.subtle.importKey('raw',encoder.encode(SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const proof=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',proofKey,encoder.encode(token.access_token)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  let selected=null;
  for(let page=0;page<10&&next;page++){
   const target=new URL(next);if(target.protocol!=='https:'||target.hostname!=='graph.facebook.com'||target.username||target.password)throw Error('invalid pagination');
   target.searchParams.delete('access_token');target.searchParams.set('appsecret_proof',proof);
   const numbersResponse=await fetch(target.href,{headers:{Authorization:'Bearer '+token.access_token},redirect:'error'});
   if(!numbersResponse.ok)return reply(req,403,{error:'Não foi possível confirmar o acesso ao número selecionado.'});
   const numbers=await numbersResponse.json();selected=Array.isArray(numbers.data)?numbers.data.find(n=>String(n.id)===phone):null;
   if(selected)break;next=typeof numbers.paging?.next==='string'?numbers.paging.next:'';
  }
  if(!selected)return reply(req,403,{error:'O número informado não pertence à conta WhatsApp autorizada.'});
  if(!await admin(clinic,user.id))return reply(req,403,{error:'A administração da clínica mudou durante a autorização.'});
  const lifetime=Number(token.expires_in),expiresAt=Number.isFinite(lifetime)&&lifetime>0?new Date(Date.now()+Math.min(lifetime,31536000)*1000).toISOString():null;
  await db('nexodent_whatsapp_credentials?on_conflict=clinic_id','POST',{clinic_id:clinic,user_id:user.id,access_token_cipher:await seal(token.access_token),expires_at:expiresAt,waba_id:waba,phone_number_id:phone,updated_at:new Date().toISOString()});
  await db('nexodent_channel_connections?on_conflict=clinic_id,provider','POST',{clinic_id:clinic,provider:'whatsapp_business',status:'pending',external_account_id:phone,external_account_label:String(selected.display_phone_number||phone).slice(0,100)+' — recebimento pendente',updated_at:new Date().toISOString()});
  return reply(req,200,{status:'pending',phone_number:String(selected.display_phone_number||phone).slice(0,100),message:'Número autorizado. Falta validar o webhook para receber mensagens.'});
 }catch{return reply(req,503,{error:'Não foi possível concluir o vínculo. Confira a atualização das funções e do banco no servidor.'});}
}
