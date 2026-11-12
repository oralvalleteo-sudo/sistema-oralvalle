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
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:allowed(req)?204:403,headers:cors(req)});
 if(req.method!=='POST')return reply(req,405,{error:'Método inválido.'});
 if(!allowed(req))return reply(req,403,{error:'Origem não autorizada.'});
 if(!ready())return reply(req,503,{code:'WHATSAPP_NOT_CONFIGURED',configuration_fields:configurationErrors(),error:'Configuração WhatsApp incompleta. Confira no Supabase: '+configurationErrors().join(', ')+'.'});
 try{
  const authorization=req.headers.get('authorization')||'';if(!/^Bearer \S+$/i.test(authorization))return reply(req,401,{error:'Entre novamente no NexoDent.'});
  const auth=await fetch(BASE+'/auth/v1/user',{headers:{apikey:SERVICE,Authorization:authorization}});if(!auth.ok)return reply(req,401,{error:'Sessão inválida. Entre novamente.'});
  const user=await auth.json();let input;try{input=await req.json();}catch{return reply(req,400,{error:'Pedido inválido.'});}
  const clinic=input?.clinic_id;if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clinic||''))return reply(req,400,{error:'Clínica inválida.'});
  if(!user?.id||!await admin(clinic,user.id))return reply(req,403,{error:'Somente administradores ativos da clínica podem conectar o WhatsApp.'});
  const state=b64(crypto.getRandomValues(new Uint8Array(32)));
  await db('nexodent_whatsapp_oauth_states','POST',{state_hash:await hash(state),clinic_id:clinic,user_id:user.id,expires_at:new Date(Date.now()+600000).toISOString(),flow:input.flow==='embedded'?'embedded':'redirect'});
  if(input.flow==='embedded')return reply(req,200,{flow:'embedded',app_id:APP_ID,config_id:CONFIG,version:VERSION,state,expires_in:600});
  const params=new URLSearchParams({client_id:APP_ID,redirect_uri:CALLBACK,response_type:'code',config_id:CONFIG,state});
  return reply(req,200,{authorization_url:'https://www.facebook.com/'+VERSION+'/dialog/oauth?'+params});
 }catch{return reply(req,503,{code:'WHATSAPP_BACKEND_UNAVAILABLE',error:'Não foi possível preparar a autorização. Confira a migration e a configuração WhatsApp no servidor.'});}
});
