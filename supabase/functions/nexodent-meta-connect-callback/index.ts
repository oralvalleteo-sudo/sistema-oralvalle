import {base,appOrigin,db,hash,seal} from '../_shared/meta-channel.mjs';
Deno.serve(async req=>{
 const redirect=(ok:boolean)=>Response.redirect(appOrigin+'/integracoes/index.html?meta_connection='+(ok?'authorized':'error'),303);
 if(req.method!=='GET')return new Response(null,{status:405});
 try{
 const url=new URL(req.url),state=url.searchParams.get('state'),code=url.searchParams.get('code');if(!state||!code)return redirect(false);
 const states=await db('nexodent_meta_oauth_states?state_hash=eq.'+await hash(state),'DELETE');
 if(states.length!==1||Date.parse(states[0].expires_at)<Date.now())return redirect(false);
 const s=states[0],members=await db('clinic_members?clinic_id=eq.'+s.clinic_id+'&user_id=eq.'+s.user_id+'&admin=eq.true&active=eq.true&select=user_id');if(members.length!==1)return redirect(false);
 const params=new URLSearchParams({client_id:Deno.env.get('META_APP_ID')!,client_secret:Deno.env.get('META_APP_SECRET')!,redirect_uri:base+'/functions/v1/nexodent-meta-connect-callback',code});
 const r=await fetch('https://graph.facebook.com/'+(Deno.env.get('META_GRAPH_VERSION')||'v23.0')+'/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:params,signal:AbortSignal.timeout(12000)});
 const data=await r.json();if(!r.ok||!data.access_token)return redirect(false);
 // Troca a autorização curta por uma credencial de longa duração antes de armazenar.
 const exchange=await fetch('https://graph.facebook.com/'+(Deno.env.get('META_GRAPH_VERSION')||'v23.0')+'/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'fb_exchange_token',client_id:Deno.env.get('META_APP_ID')!,client_secret:Deno.env.get('META_APP_SECRET')!,fb_exchange_token:data.access_token}),signal:AbortSignal.timeout(12000)});
 const long=await exchange.json();if(!exchange.ok||!long.access_token)return redirect(false);
 await db('nexodent_meta_credentials?on_conflict=clinic_id,provider','POST',{clinic_id:s.clinic_id,provider:s.provider,token_cipher:await seal(long.access_token),expires_at:long.expires_in?new Date(Date.now()+Number(long.expires_in)*1000).toISOString():null,updated_at:new Date().toISOString()});
 await db('nexodent_channel_connections?on_conflict=clinic_id,provider','POST',{clinic_id:s.clinic_id,provider:s.provider,status:'pending',external_account_label:'Escolha o ativo autorizado',updated_at:new Date().toISOString()});
 return redirect(true);
 }catch{return redirect(false);}
});
