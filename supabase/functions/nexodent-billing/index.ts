import {db,manager,ready,mode,response,allowedOrigin,checkout,cancelRemote} from '../_shared/saas-billing.mjs';
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return response(req,200,{});
 if(req.method!=='POST')return response(req,405,{error:'Método inválido'});
 if(!allowedOrigin(req))return response(req,403,{error:'Origem inválida'});
 try{
 const input=await req.json(),user=await manager(req,input.clinic_id);
 if(input.action==='checkout')return await checkout(req,input,user);
 if(input.action==='status')return response(req,200,{configured:ready(),mode});
 if(input.action==='cancel'||input.action==='free'){
 if(input.action==='free'){
 const members=await db('clinic_members?clinic_id=eq.'+input.clinic_id+'&active=eq.true&select=user_id');if(members.length>1)return response(req,409,{error:'Desative usuários adicionais antes de mudar para o plano grátis'});
 }
 await cancelRemote(input.clinic_id,input.action==='free');return response(req,200,{ok:true});
 }
 return response(req,400,{error:'Ação inválida'});
 }catch{return response(req,403,{error:'Não foi possível gerenciar a assinatura. Confirme sua sessão, acesso administrativo e configuração de pagamento.'});}
});
