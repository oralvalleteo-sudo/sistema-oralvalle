'use strict';
// Porta de integração deliberadamente fechada até haver provedor e autorização por clínica.
module.exports = async function(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Método não permitido'});}
 return res.status(503).json({code:'PAYMENTS_NOT_CONFIGURED',error:'Serviço de cobrança não configurado. Nenhuma cobrança foi emitida.'});
};
