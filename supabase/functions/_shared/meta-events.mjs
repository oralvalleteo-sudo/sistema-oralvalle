export function whatsappContacts(value){
 const contacts=new Map((value.contacts||[]).map(c=>[c.wa_id,c.profile?.name]));
 return (value.messages||[]).filter(m=>typeof m.id==='string'&&/^\d{10,15}$/.test(m.from||'')&&m.type!=='system').map(m=>({
 event_id:m.id,phone:'+'+m.from,name:contacts.get(m.from)||'Contato WhatsApp',
 ...(m.referral?.source_type==='ad'?{ad_origin:'meta_ads',ad_id:String(m.referral.source_id||'').slice(0,100)}:{})
 }));
}
export function metaLeadContact(lead){
 const fields=new Map((lead.field_data||[]).map(f=>[f.name,Array.isArray(f.values)?String(f.values[0]||'').trim():'']));
 return {name:(fields.get('full_name')||[fields.get('first_name'),fields.get('last_name')].filter(Boolean).join(' ')||'Contato Meta Ads').slice(0,140),phone:(fields.get('phone_number')||'').slice(0,35),email:(fields.get('email')||'').slice(0,254),ad_id:String(lead.ad_id||'').slice(0,100),campaign_id:String(lead.campaign_id||'').slice(0,100)};
}
export async function verifyMetaSignature(raw,signature,secret){
 if(!secret||!/^sha256=[a-f0-9]{64}$/.test(signature||''))return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const bytes=Uint8Array.from(signature.slice(7).match(/../g),x=>parseInt(x,16));
 return crypto.subtle.verify('HMAC',key,bytes,raw);
}
