import { normalizeLead } from '../_shared/google-lead.mjs';
const base=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return reply(405,{error:'POST necessário'});
 try{
  const text=await req.text();if(new TextEncoder().encode(text).length>65536)return reply(413,{error:'Limite excedido'});
  const body=JSON.parse(text),clinic=new URL(req.url).searchParams.get('clinic_id');
  if(!/^[0-9a-f-]{36}$/i.test(clinic||'')||typeof body.google_key!=='string'||body.google_key.length>200)return reply(401,{error:'Entrega não autorizada'});
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body.google_key)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const lead=normalizeLead(body);
  const r=await fetch(base+'/rest/v1/rpc/nexodent_google_lead_receive',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({p_clinic:clinic,p_key_hash:hash,p_lead:lead})});
  if(!r.ok)return reply(r.status===403?403:503,{error:'Entrega não processada'});
  return reply(200,await r.json());
 }catch{return reply(400,{error:'Entrega inválida'});}
});
