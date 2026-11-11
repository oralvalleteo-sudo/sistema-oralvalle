import {db,unseal,graph} from '../_shared/meta-channel.mjs';
import {whatsappContacts,metaLeadContact,verifyMetaSignature} from '../_shared/meta-events.mjs';
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
async function binding(provider:string,id:string){
 if(!/^\d+$/.test(id))return null;
 const assets=await db('nexodent_channel_assets?provider=eq.'+provider+'&external_id=eq.'+id+'&select=*');if(assets.length!==1)return null;
 const asset=assets[0],connections=await db('nexodent_channel_connections?clinic_id=eq.'+asset.clinic_id+'&provider=eq.'+provider+'&status=eq.connected&external_account_id=eq.'+id+'&select=clinic_id');
 return connections.length===1?asset:null;
}
async function receive(clinic:string,channel:string,event:string,contact:unknown){return db('rpc/nexodent_channel_lead_receive','POST',{p_clinic:clinic,p_channel:channel,p_event:event,p_contact:contact});}
Deno.serve(async req=>{
 if(req.method==='GET'){
 const p=new URL(req.url).searchParams,token=Deno.env.get('META_WEBHOOK_VERIFY_TOKEN');
 if(token&&p.get('hub.mode')==='subscribe'&&p.get('hub.verify_token')===token)return new Response(p.get('hub.challenge')||'',{headers:{'Cache-Control':'no-store'}});
 return reply(403,{error:'Verificação inválida'});
 }
 if(req.method!=='POST')return reply(405,{error:'Método inválido'});
 try{
 const raw=new Uint8Array(await req.arrayBuffer());if(raw.length>1048576)return reply(413,{error:'Limite excedido'});
 if(!await verifyMetaSignature(raw,req.headers.get('x-hub-signature-256'),Deno.env.get('META_APP_SECRET')))return reply(401,{error:'Assinatura inválida'});
 const payload=JSON.parse(new TextDecoder().decode(raw));
 if(!['page','whatsapp_business_account'].includes(payload.object))return reply(200,{accepted:true});
 for(const entry of payload.entry||[]){for(const change of entry.changes||[]){
 if(payload.object==='whatsapp_business_account'&&change.field==='messages'){
 const value=change.value||{},asset=await binding('whatsapp_business',String(value.metadata?.phone_number_id||''));if(!asset)continue;
 for(const contact of whatsappContacts(value))await receive(asset.clinic_id,'whatsapp_business',contact.event_id,contact);
 }else if(payload.object==='page'&&change.field==='leadgen'){
 const value=change.value||{},asset=await binding('meta_ads',String(entry.id||''));if(!asset||!/^\d+$/.test(String(value.leadgen_id||'')))continue;
 const lead=await graph(encodeURIComponent(value.leadgen_id)+'?fields=id,field_data,ad_id,campaign_id',await unseal(asset.token_cipher));
 await receive(asset.clinic_id,'meta_ads',String(lead.id),metaLeadContact(lead));
 }
 }}
 return reply(200,{accepted:true});
 }catch{return reply(503,{error:'Entrega não concluída. Reenvie o evento.'});}
});
