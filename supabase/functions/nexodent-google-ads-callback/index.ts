const URL_BASE=Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CLIENT_ID=Deno.env.get('GOOGLE_ADS_CLIENT_ID')!;
const CLIENT_SECRET=Deno.env.get('GOOGLE_ADS_CLIENT_SECRET')!;
const ENC_KEY=Deno.env.get('GOOGLE_ADS_ENCRYPTION_KEY')!;
const CALLBACK=URL_BASE+'/functions/v1/nexodent-google-ads-callback';
const enc=new TextEncoder();
const hex=(a:Uint8Array)=>Array.from(a).map(x=>x.toString(16).padStart(2,'0')).join('');
const b64=(a:Uint8Array)=>btoa(String.fromCharCode(...a)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const random=(n:number)=>crypto.getRandomValues(new Uint8Array(n));
async function sha(s:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s))))}
async function key(){if(!/^[a-f0-9]{64}$/i.test(ENC_KEY||''))throw Error('GOOGLE_ADS_ENCRYPTION_KEY inválida');return crypto.subtle.importKey('raw',new Uint8Array(ENC_KEY.match(/../g)!.map(x=>parseInt(x,16))),'AES-GCM',false,['encrypt','decrypt'])}
async function seal(s:string){const iv=random(12),data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(),enc.encode(s)));return b64(iv)+'.'+b64(data)}
function cors(req:Request){const origin=req.headers.get('origin')||'';const allowed=Deno.env.get('NEXODENT_APP_ORIGIN')||'';return {'Access-Control-Allow-Origin':origin===allowed?origin:allowed,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'}}
async function db(path:string,method='GET',body?:unknown){const r=await fetch(URL_BASE+'/rest/v1/'+path,{method,headers:{'apikey':SERVICE_KEY,'Authorization':'Bearer '+SERVICE_KEY,'Content-Type':'application/json','Prefer':'return=representation,resolution=merge-duplicates'},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)throw Error('Banco de dados indisponível ('+r.status+')');return await r.json()}
function reply(req:Request,status:number,obj:unknown){return new Response(JSON.stringify(obj),{status,headers:{...cors(req),'Content-Type':'application/json'}})}
function unb64(s:string){const t=s.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(t),c=>c.charCodeAt(0))}
async function unseal(s:string){const [iv,data]=s.split('.');return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv)},await key(),unb64(data)))}
function redirect(ok:boolean){const base=Deno.env.get('NEXODENT_APP_ORIGIN')!;return Response.redirect(base+'/integracoes/index.html?google_ads='+(ok?'authorized':'error'),303)}
Deno.serve(async(req)=>{
 if(req.method!=='GET')return new Response('Método inválido',{status:405});
 const url=new URL(req.url);const state=url.searchParams.get('state')||'';const code=url.searchParams.get('code')||'';
 if(!state||!code)return redirect(false);
 try{
  const stateHash=await sha(state);
  const rows=await db('nexodent_google_oauth_states?state_hash=eq.'+encodeURIComponent(stateHash)+'&select=clinic_id,user_id,verifier_cipher,expires_at');
  if(rows.length!==1||new Date(rows[0].expires_at).getTime()<Date.now())return redirect(false);
  // Consumir estado antes da troca do código: proteção contra replay.
  await db('nexodent_google_oauth_states?state_hash=eq.'+encodeURIComponent(stateHash),'DELETE');
  const verifier=await unseal(rows[0].verifier_cipher);
  const body=new URLSearchParams({code,client_id:CLIENT_ID,client_secret:CLIENT_SECRET,redirect_uri:CALLBACK,grant_type:'authorization_code',code_verifier:verifier});
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  if(!response.ok){console.error('Google token HTTP',response.status);return redirect(false)}
  const result=await response.json();if(!result.refresh_token)return redirect(false);
  await db('nexodent_google_ads_credentials?on_conflict=clinic_id','POST',{clinic_id:rows[0].clinic_id,user_id:rows[0].user_id,refresh_token_cipher:await seal(result.refresh_token),updated_at:new Date().toISOString()});
  await db('nexodent_channel_connections?on_conflict=clinic_id,provider','POST',{clinic_id:rows[0].clinic_id,provider:'google_ads',status:'pending',external_account_label:'Autorizado — seleção de conta pendente',updated_at:new Date().toISOString()});
  return redirect(true);
 }catch(e){console.error('google callback',e);return redirect(false)}
});
