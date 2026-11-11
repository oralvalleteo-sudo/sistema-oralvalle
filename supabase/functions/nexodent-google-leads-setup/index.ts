const base=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,origin=Deno.env.get('NEXODENT_APP_ORIGIN')!;
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
Deno.serve(async req=>{
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return reply(405,{error:'Método inválido'});
 if(!origin||req.headers.get('origin')!==origin)return reply(403,{error:'Origem não autorizada'});
 try{
  const authorization=req.headers.get('authorization')||'';
  const userResponse=await fetch(base+'/auth/v1/user',{headers:{apikey:service,Authorization:authorization}});
  if(!userResponse.ok)return reply(401,{error:'Entre novamente'});
  const user=await userResponse.json(),input=await req.json(),clinic=String(input.clinic_id||'');
  if(!/^[0-9a-f-]{36}$/i.test(clinic)||!['status','activate'].includes(input.action))return reply(400,{error:'Solicitação inválida'});
  const dbHeaders={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
  const members=await fetch(base+'/rest/v1/clinic_members?clinic_id=eq.'+clinic+'&user_id=eq.'+encodeURIComponent(user.id)+'&admin=eq.true&active=eq.true&select=user_id',{headers:dbHeaders});
  if(!members.ok||(await members.json()).length!==1)return reply(403,{error:'Somente administrador da clínica'});
  const raw=input.action==='activate'?Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join(''):null;
  const hash=raw?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))).map(x=>x.toString(16).padStart(2,'0')).join(''):null;
  const result=await fetch(base+'/rest/v1/rpc/nexodent_google_leads_setup',{method:'POST',headers:dbHeaders,body:JSON.stringify({p_clinic:clinic,p_key_hash:hash})});
  if(!result.ok)return reply(409,{error:'Vincule uma conta de anúncios e confirme a instalação da integração.'});
  return reply(200,{...await result.json(),...(raw?{google_key:raw,webhook_url:base+'/functions/v1/nexodent-google-leads-webhook?clinic_id='+clinic}:{})});
 }catch{return reply(503,{error:'Não foi possível configurar a captação'});}
});
