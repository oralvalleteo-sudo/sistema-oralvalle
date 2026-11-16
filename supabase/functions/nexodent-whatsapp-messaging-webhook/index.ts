// Receptor de metadados. Não grava o texto das conversas e não substitui o webhook do CRM sem revisão.
const BASE=(Deno.env.get('SUPABASE_URL')||'').trim(),SERVICE=(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'').trim(),SECRET=(Deno.env.get('META_APP_SECRET')||'').trim(),VERIFY=(Deno.env.get('META_WHATSAPP_WEBHOOK_VERIFY_TOKEN')||'').trim();
const encoder=new TextEncoder(),uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const reply=(status,text)=>new Response(text,{status,headers:{'Cache-Control':'no-store','Content-Type':'text/plain','X-Nexodent-Function-Version':'305'}});
async function db(path,body){const r=await fetch(BASE+'/rest/v1/'+path,{method:body===undefined?'GET':'POST',headers:{apikey:SERVICE,Authorization:'Bearer '+SERVICE,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('database');return r.json().catch(()=>null);}
async function limitedBody(req){const reader=req.body?.getReader();if(!reader)return new Uint8Array();let size=0;const chunks=[];while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>1048576){await reader.cancel();return null;}chunks.push(part.value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return bytes;}
async function validSignature(raw,value){if(!/^sha256=[a-f0-9]{64}$/.test(value||''))return false;const key=await crypto.subtle.importKey('raw',encoder.encode(SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);const signature=new Uint8Array(value.slice(7).match(/../g).map(x=>parseInt(x,16)));return crypto.subtle.verify('HMAC',key,signature,raw);}
function timestamp(value,days){if(!/^\d{10,11}$/.test(String(value||'')))return null;const n=Number(value)*1000;if(n>Date.now()+300000||n<Date.now()-days*86400000)return null;return new Date(Math.min(n,Date.now())).toISOString();}
Deno.serve(async req=>{
 if(!/^https:\/\//.test(BASE)||!SERVICE||!SECRET||!VERIFY)return reply(503,'Webhook não configurado.');
 if(req.method==='GET'){const u=new URL(req.url);if(u.searchParams.get('hub.mode')!=='subscribe'||u.searchParams.get('hub.verify_token')!==VERIFY)return reply(403,'Verificação recusada.');const challenge=u.searchParams.get('hub.challenge')||'';return /^\d{1,100}$/.test(challenge)?reply(200,challenge):reply(400,'Desafio inválido.');}
 if(req.method!=='POST')return reply(405,'Método inválido.');
 const bytes=await limitedBody(req);if(!bytes)return reply(413,'Notificação acima do limite.');
 if(!await validSignature(bytes,req.headers.get('x-hub-signature-256')))return reply(401,'Assinatura inválida.');
 let payload;try{payload=JSON.parse(new TextDecoder().decode(bytes));}catch{return reply(400,'JSON inválido.');}
 if(payload?.object!=='whatsapp_business_account'||!Array.isArray(payload.entry))return reply(400,'Notificação inválida.');
 try{
  let count=0;
  for(const entry of payload.entry){if(!/^\d{1,40}$/.test(entry?.id||''))continue;
   for(const change of entry.changes||[]){if(change?.field!=='messages')continue;const value=change.value,id=String(value?.metadata?.phone_number_id||'');if(!/^\d{1,40}$/.test(id)||value?.messaging_product!=='whatsapp')continue;
    const rows=await db('nexodent_whatsapp_credentials?phone_number_id=eq.'+encodeURIComponent(id)+'&waba_id=eq.'+encodeURIComponent(entry.id)+'&select=clinic_id');if(!Array.isArray(rows)||rows.length!==1)continue;const clinic=rows[0].clinic_id;
    for(const message of value.messages||[]){if(++count>200)return reply(413,'Muitos eventos em uma notificação.');if(!['text','image','document','audio','video','sticker','location','contacts','interactive','button','order'].includes(message?.type))continue;const from=String(message.from||''),at=timestamp(message.timestamp,7);if(!/^[1-9]\d{7,14}$/.test(from)||typeof message.id!=='string'||message.id.length>1024||!at)continue;await db('rpc/nexodent_wa_inbound_record',{p_clinic:clinic,p_phone:id,p_from:from,p_message:message.id,p_at:at});}
    for(const status of value.statuses||[]){if(++count>200)return reply(413,'Muitos eventos em uma notificação.');const to=String(status?.recipient_id||''),at=timestamp(status?.timestamp,30);if(!/^[1-9]\d{7,14}$/.test(to)||!['sent','delivered','read','failed'].includes(status?.status)||typeof status.id!=='string'||status.id.length>1024||!at)continue;await db('rpc/nexodent_wa_delivery_record',{p_clinic:clinic,p_phone:id,p_to:to,p_message:status.id,p_status:status.status,p_at:at,p_request:uuid(status.biz_opaque_callback_data)?status.biz_opaque_callback_data:null,p_error:Number.isInteger(status.errors?.[0]?.code)?status.errors[0].code:null});}
   }
  }
  return reply(200,'EVENT_RECEIVED');
 }catch{return reply(503,'Não foi possível registrar a notificação. Tente novamente.');}
});
