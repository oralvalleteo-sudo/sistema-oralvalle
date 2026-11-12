const BASE=Deno.env.get('SUPABASE_URL')||'';
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const ORIGIN=Deno.env.get('NEXODENT_APP_ORIGIN')||'https://oralvalleteo-sudo.github.io';
const APP=Deno.env.get('NEXODENT_APP_URL')||'https://oralvalleteo-sudo.github.io/sistema-oralvalle/';
const APP_ID=Deno.env.get('META_APP_ID')||'';
const SECRET=Deno.env.get('META_APP_SECRET')||'';
const CONFIG=Deno.env.get('META_WHATSAPP_CONFIG_ID')||'';
const VERSION=Deno.env.get('META_GRAPH_VERSION')||'';
const KEY=Deno.env.get('META_WHATSAPP_ENCRYPTION_KEY')||'';
const CALLBACK=BASE+'/functions/v1/nexodent-whatsapp-connect-callback';
const encoder=new TextEncoder();
const b64=a=>btoa(String.fromCharCode(...a)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function hash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
function ready(){try{const origin=new URL(ORIGIN),app=new URL(APP);return BASE&&SERVICE&&/^\d+$/.test(APP_ID)&&SECRET&&/^\d+$/.test(CONFIG)&&/^v\d+\.\d+$/.test(VERSION)&&/^[a-f0-9]{64}$/i.test(KEY)&&origin.protocol==='https:'&&ORIGIN===origin.origin&&app.protocol==='https:'&&app.origin===ORIGIN;}catch{return false;}}
function cors(){return {'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin','Cache-Control':'no-store'};}
function reply(status,data){return new Response(JSON.stringify(data),{status,headers:{...cors(),'Content-Type':'application/json'}});}
async function db(path,method='GET',body=undefined){const response=await fetch(BASE+'/rest/v1/'+path,{method,headers:{apikey:SERVICE,Authorization:'Bearer '+SERVICE,'Content-Type':'application/json',Prefer:'return=representation,resolution=merge-duplicates'},...(body===undefined?{}:{body:JSON.stringify(body)})});if(!response.ok)throw Error('database');return response.json();}
async function admin(clinic,user){const rows=await db('clinic_members?clinic_id=eq.'+encodeURIComponent(clinic)+'&user_id=eq.'+encodeURIComponent(user)+'&admin=eq.true&active=eq.true&select=user_id');return Array.isArray(rows)&&rows.length===1;}
function redirect(status){try{const app=new URL(APP);if(app.protocol!=='https:'||app.origin!==ORIGIN)throw Error('invalid');if(!app.pathname.endsWith('/'))app.pathname+='/';const target=new URL('integracoes/index.html',app);target.searchParams.set('whatsapp',status);return new Response(null,{status:303,headers:{Location:target.href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});}catch{return new Response('Endereço do sistema não configurado.',{status:503});}}
async function seal(value){const iv=crypto.getRandomValues(new Uint8Array(12)),key=await crypto.subtle.importKey('raw',new Uint8Array(KEY.match(/../g).map(x=>parseInt(x,16))),'AES-GCM',false,['encrypt']);const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(value));return b64(iv)+'.'+b64(new Uint8Array(encrypted));}
Deno.serve(async req=>{
 if(req.method!=='GET')return new Response('Método inválido.',{status:405});
 if(!ready())return redirect('configuration_required');
 const url=new URL(req.url),state=url.searchParams.get('state')||'',code=url.searchParams.get('code')||'';
 if(!/^[A-Za-z0-9_-]{43}$/.test(state))return redirect('error');
 try{
  const rows=await db('nexodent_whatsapp_oauth_states?state_hash=eq.'+await hash(state)+'&select=clinic_id,user_id,expires_at','DELETE');
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
