import {appOrigin,administrator,db,assets,unseal,seal,graph,reply,cors} from '../_shared/meta-channel.mjs';
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return reply(405,{error:'Método inválido'});
 if(!appOrigin||req.headers.get('origin')!==appOrigin)return reply(403,{error:'Origem inválida'});
 try{
 const input=await req.json();if(!['meta_ads','whatsapp_business'].includes(input.provider)||!['list','select'].includes(input.action))return reply(400,{error:'Solicitação inválida'});
 await administrator(req,input.clinic_id);
 const credentials=await db('nexodent_meta_credentials?clinic_id=eq.'+input.clinic_id+'&provider=eq.'+input.provider+'&select=token_cipher');if(credentials.length!==1)return reply(409,{error:'Conecte sua conta novamente'});
 const available=await assets(input.provider,await unseal(credentials[0].token_cipher));
 if(input.action==='list')return reply(200,{assets:available.map(a=>({id:a.id,label:a.label}))});
 const selected=available.find(a=>a.id===input.external_id);if(!selected)return reply(403,{error:'Ativo não autorizado'});
 // Evita inscrever um ativo já vinculado a outra clínica.
 const bound=await db('nexodent_channel_assets?provider=eq.'+input.provider+'&external_id=eq.'+encodeURIComponent(selected.id)+'&select=clinic_id');
 if(bound.length&&bound[0].clinic_id!==input.clinic_id)return reply(409,{error:'Este ativo já pertence a outra clínica'});
 if(input.provider==='meta_ads')await graph(selected.id+'/subscribed_apps',selected.token,'POST',{subscribed_fields:'leadgen'});
 else await graph(selected.parent_id+'/subscribed_apps',selected.token,'POST');
 await db('rpc/nexodent_channel_asset_bind','POST',{p_clinic:input.clinic_id,p_provider:input.provider,p_external:selected.id,p_label:selected.label,p_parent:selected.parent_id,p_token:input.provider==='meta_ads'?await seal(selected.token):null});
 return reply(200,{connected:true,label:selected.label});
 }catch(error){return reply(502,{error:error instanceof Error?error.message:'Falha ao vincular canal'});}
});
