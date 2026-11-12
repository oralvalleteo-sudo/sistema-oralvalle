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
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors()});
 if(req.method!=='POST')return reply(405,{error:'Método inválido.'});
 if(req.headers.get('origin')!==ORIGIN)return reply(403,{error:'Origem não autorizada.'});
 if(!ready())return reply(503,{code:'WHATSAPP_NOT_CONFIGURED',error:'O administrador precisa configurar o aplicativo Meta e a autorização WhatsApp no Supabase.'});
 try{
  const authorization=req.headers.get('authorization')||'';if(!/^Bearer \S+$/i.test(authorization))return reply(401,{error:'Entre novamente no NexoDent.'});
  const auth=await fetch(BASE+'/auth/v1/user',{headers:{apikey:SERVICE,Authorization:authorization}});if(!auth.ok)return reply(401,{error:'Sessão inválida. Entre novamente.'});
  const user=await auth.json();let input;try{input=await req.json();}catch{return reply(400,{error:'Pedido inválido.'});}
  const clinic=input?.clinic_id;if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clinic||''))return reply(400,{error:'Clínica inválida.'});
  if(!user?.id||!await admin(clinic,user.id))return reply(403,{error:'Somente administradores ativos da clínica podem conectar o WhatsApp.'});
  const state=b64(crypto.getRandomValues(new Uint8Array(32)));
  await db('nexodent_whatsapp_oauth_states','POST',{state_hash:await hash(state),clinic_id:clinic,user_id:user.id,expires_at:new Date(Date.now()+600000).toISOString(),flow:input.flow==='embedded'?'embedded':'redirect'});
  if(input.flow==='embedded')return reply(200,{flow:'embedded',app_id:APP_ID,config_id:CONFIG,version:VERSION,state,expires_in:600});
  const params=new URLSearchParams({client_id:APP_ID,redirect_uri:CALLBACK,response_type:'code',config_id:CONFIG,state});
  return reply(200,{authorization_url:'https://www.facebook.com/'+VERSION+'/dialog/oauth?'+params});
 }catch{return reply(503,{code:'WHATSAPP_BACKEND_UNAVAILABLE',error:'Não foi possível preparar a autorização. Confira a migration e a configuração WhatsApp no servidor.'});}
});
