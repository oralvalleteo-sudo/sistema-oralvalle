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
function reply(req:Request,status:number,obj:unknown){return new Response(JSON.stringify(obj),{status,headers:{...cors(req),'Content-Type':'application/json','Cache-Control':'no-store'}})}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors(req)});
 if(req.method!=='POST')return reply(req,405,{error:'Método inválido'});
 try{
  if(req.headers.get('origin')!==Deno.env.get('NEXODENT_APP_ORIGIN'))return reply(req,403,{error:'Origem não autorizada'});
  const token=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');if(!token)return reply(req,401,{error:'Entre no NexoDent'});
  const userResponse=await fetch(URL_BASE+'/auth/v1/user',{headers:{apikey:SERVICE_KEY,Authorization:'Bearer '+token}});
  if(!userResponse.ok)return reply(req,401,{error:'Sessão inválida'});
  const user=await userResponse.json();const input=await req.json();const clinic=input.clinic_id;
  if(!/^[0-9a-f-]{36}$/i.test(clinic||''))return reply(req,400,{error:'Clínica inválida'});
  const member=await db('clinic_members?clinic_id=eq.'+encodeURIComponent(clinic)+'&user_id=eq.'+encodeURIComponent(user.id)+'&admin=eq.true&active=eq.true&select=user_id');
  if(!member.length)return reply(req,403,{error:'Somente administradores da clínica podem conectar contas'});
  const state=b64(random(32));const verifier=b64(random(48));const challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(verifier))));
  await db('nexodent_google_oauth_states','POST',{state_hash:await sha(state),clinic_id:clinic,user_id:user.id,verifier_cipher:await seal(verifier),expires_at:new Date(Date.now()+10*60*1000).toISOString()});
  const p=new URLSearchParams({client_id:CLIENT_ID,redirect_uri:CALLBACK,response_type:'code',scope:'https://www.googleapis.com/auth/adwords',access_type:'offline',prompt:'consent',state,code_challenge:challenge,code_challenge_method:'S256'});
  return reply(req,200,{authorization_url:'https://accounts.google.com/o/oauth2/v2/auth?'+p});
 }catch(e){console.error('google start failed');return reply(req,500,{error:'Falha ao iniciar autorização. Confira a configuração das funções.'})}
});
