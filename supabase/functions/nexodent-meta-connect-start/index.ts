import {base,appOrigin,graphVersion,administrator,db,hash,reply,cors} from '../_shared/meta-channel.mjs';
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return reply(405,{error:'Método inválido'});
 if(!appOrigin||req.headers.get('origin')!==appOrigin)return reply(403,{error:'Origem inválida'});
 try{
 const input=await req.json();if(!['meta_ads','whatsapp_business'].includes(input.provider))return reply(400,{error:'Canal inválido'});
 const user=await administrator(req,input.clinic_id),appId=Deno.env.get('META_APP_ID');
 if(!appId||!Deno.env.get('META_APP_SECRET')||!Deno.env.get('NEXODENT_CHANNEL_ENCRYPTION_KEY'))return reply(503,{error:'A plataforma ainda precisa configurar o aplicativo Meta.'});
 const state=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');
 await db('nexodent_meta_oauth_states','POST',{state_hash:await hash(state),clinic_id:input.clinic_id,user_id:user.id,provider:input.provider,expires_at:new Date(Date.now()+600000).toISOString()});
 const scopes=input.provider==='meta_ads'?'pages_show_list,pages_read_engagement,pages_manage_metadata,leads_retrieval':'business_management,whatsapp_business_management,whatsapp_business_messaging';
 const params=new URLSearchParams({client_id:appId,redirect_uri:base+'/functions/v1/nexodent-meta-connect-callback',response_type:'code',scope:scopes,state});
 return reply(200,{authorization_url:'https://www.facebook.com/'+graphVersion+'/dialog/oauth?'+params});
 }catch{return reply(403,{error:'Não foi possível autorizar. Verifique sua sessão e acesso de administrador.'});}
});
