'use strict';
function error(status,message){const e=new Error(message);e.status=status;return e;}
function prepare(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const origin=req.headers.origin;
 if(origin){const own='https://'+String(req.headers.host||'');const allowed=(process.env.CERTIFICATE_ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);if(origin!==own&&!allowed.includes(origin))throw error(403,'Origem não autorizada');res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');}
 if(req.method==='OPTIONS'){res.status(204).end();return false;}
 if(req.method!=='POST'){res.setHeader('Allow','POST, OPTIONS');throw error(405,'Método não permitido');}return true;
}
async function authorize(req){
 const base=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY,auth=String(req.headers.authorization||''),clinic=req.body?.clinicId;
 if(!base||!anon)throw error(503,'Autenticação não configurada no servidor');
 if(!/^Bearer [\w.\-]+$/.test(auth))throw error(401,'Sessão necessária');
 if(typeof clinic!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clinic))throw error(400,'Selecione uma clínica válida');
 const call=async(path,body)=>{const response=await fetch(base.replace(/\/$/,'')+path,{method:body?'POST':'GET',headers:{apikey:anon,Authorization:auth,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000)});if(!response.ok)throw error(response.status===401?401:403,'Sessão ou acesso à clínica não autorizado');return response.json();};
 const user=await call('/auth/v1/user');if(!user?.id)throw error(401,'Sessão inválida');
 // A RPC verifica o vínculo ativo e também aplica a guarda de assinatura, quando instalada.
 const members=await call('/rest/v1/rpc/clinic_members_list',{p_clinic:clinic});const member=Array.isArray(members)?members.find(m=>(m.user_id||m.id)===user.id&&m.active===true):null;
 if(!member)throw error(403,'Vínculo ativo com a clínica necessário');
 if(!member.admin&&member.perms&&(member.perms.pac!=='edit'||(member.perms['pac.arquivos']??'edit')!=='edit'))throw error(403,'Sem permissão para assinar documentos nesta clínica');
 return {user,clinic};
}
module.exports={prepare,authorize,error};
