export const base=Deno.env.get('SUPABASE_URL');
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
export const appOrigin=Deno.env.get('NEXODENT_APP_ORIGIN');
export const graphVersion=Deno.env.get('META_GRAPH_VERSION')||'v23.0';
export async function db(path,method='GET',body){
 const response=await fetch(base+'/rest/v1/'+path,{method,headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',Prefer:'return=representation,resolution=merge-duplicates'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('Banco indisponível');return response.json();
}
export async function graph(path,token,method='GET',body){
 const response=await fetch('https://graph.facebook.com/'+graphVersion+'/'+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{})},...(body?{body:new URLSearchParams(body)}:{}),signal:AbortSignal.timeout(12000)});
 const result=await response.json();if(!response.ok||result.error)throw Error('A Meta recusou a operação. Verifique permissões e ativos autorizados.');return result;
}
export async function pages(token){
 let path='me/accounts?fields=id,name,access_token&limit=100',all=[];
 for(let i=0;i<20;i++){
 const result=await graph(path,token);all.push(...(result.data||[]));
 if(!result.paging?.next)return all;
 const cursor=result.paging?.cursors?.after;if(!cursor)throw Error('Paginação Meta incompleta');
 path='me/accounts?fields=id,name,access_token&limit=100&after='+encodeURIComponent(cursor);
 }
 throw Error('Muitos ativos. Restrinja a autorização aos ativos da clínica.');
}
export async function listAll(path,token){
 const result=[];let cursor='';
 for(let i=0;i<20;i++){
 const page=await graph(path+(path.includes('?')?'&':'?')+'limit=100'+(cursor?'&after='+encodeURIComponent(cursor):''),token);result.push(...(page.data||[]));
 if(!page.paging?.next)return result;cursor=page.paging?.cursors?.after;if(!cursor)throw Error('Paginação Meta incompleta');
 }throw Error('Muitos ativos. Restrinja os ativos autorizados.');
}
export async function assets(provider,token){
 if(provider==='meta_ads')return (await pages(token)).map(p=>({id:p.id,label:p.name,token:p.access_token,parent_id:null}));
 const businesses=await listAll('me/businesses?fields=id,name',token),found=new Map();
 for(const b of businesses){
 const accounts=[...await listAll(b.id+'/owned_whatsapp_business_accounts?fields=id,name',token),...await listAll(b.id+'/client_whatsapp_business_accounts?fields=id,name',token)];
 for(const account of accounts){for(const phone of await listAll(account.id+'/phone_numbers?fields=id,display_phone_number,verified_name',token))found.set(phone.id,{id:phone.id,label:(phone.verified_name||account.name)+' · '+phone.display_phone_number,parent_id:account.id,token});}
 }return [...found.values()];
}
export async function hash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,'0')).join('');}
async function encryptionKey(){const hex=Deno.env.get('NEXODENT_CHANNEL_ENCRYPTION_KEY')||'';if(!/^[a-f0-9]{64}$/i.test(hex))throw Error('Criptografia não configurada');return crypto.subtle.importKey('raw',new Uint8Array(hex.match(/../g).map(x=>parseInt(x,16))),'AES-GCM',false,['encrypt','decrypt']);}
export async function seal(value){const iv=crypto.getRandomValues(new Uint8Array(12)),encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await encryptionKey(),new TextEncoder().encode(value)));return btoa(String.fromCharCode(...iv))+'.'+btoa(String.fromCharCode(...encrypted));}
export async function unseal(value){const [iv,data]=String(value).split('.');return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(atob(iv),c=>c.charCodeAt(0))},await encryptionKey(),Uint8Array.from(atob(data),c=>c.charCodeAt(0))));}
export async function administrator(req,clinic){
 if(!/^[0-9a-f-]{36}$/i.test(clinic||''))throw Error('Clínica inválida');
 const result=await fetch(base+'/auth/v1/user',{headers:{apikey:service,Authorization:req.headers.get('authorization')||''},signal:AbortSignal.timeout(10000)});if(!result.ok)throw Error('Sessão inválida');const user=await result.json();
 const members=await db('clinic_members?clinic_id=eq.'+clinic+'&user_id=eq.'+encodeURIComponent(user.id)+'&admin=eq.true&active=eq.true&select=user_id');if(members.length!==1)throw Error('Somente administradores ativos podem conectar canais');return user;
}
export const cors={'Access-Control-Allow-Origin':appOrigin||'','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
export const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:cors});
