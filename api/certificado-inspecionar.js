'use strict';
// Inspeção transitória de PKCS#12: não assina, não persiste e não registra segredos.
const {prepare,authorize}=require('../server/certificate-access');
const {openCertificate}=require('../server/pkcs12');
const MAX = 1024 * 1024; // 1 MiB
module.exports = async function handler(req, res) {
  try {
    if(!prepare(req,res))return;
    await authorize(req);
    const {pfxBase64, password} = req.body || {};
    if (typeof pfxBase64 !== 'string' || typeof password !== 'string' || pfxBase64.length > Math.ceil(MAX*4/3)+8 || password.length>512) return res.status(400).json({error:'Dados inválidos ou arquivo acima de 1 MB'});
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(pfxBase64)) return res.status(400).json({error:'Arquivo inválido'});
    const raw = Buffer.from(pfxBase64,'base64');
    if (!raw.length || raw.length>MAX) return res.status(400).json({error:'Arquivo inválido ou muito grande'});
    let cert;
    try { ({cert}=openCertificate(raw,password)); }
    catch (_) { return res.status(422).json({error:'Não foi possível abrir o certificado e sua chave privada. Verifique a senha e o arquivo.'}); }
    const fields = cert.subject.attributes.map(a=>({name:a.shortName||a.name,value:String(a.value)}));
    const now = new Date();
    return res.status(200).json({titular:fields.find(x=>x.name==='CN')?.value||'Não identificado',inicio:cert.validity.notBefore.toISOString(),fim:cert.validity.notAfter.toISOString(),vigente:now>=cert.validity.notBefore&&now<=cert.validity.notAfter,possuiChavePrivada:true,observacao:'Inspeção de senha, certificado e datas. Não verifica revogação, cadeia ICP-Brasil ou identidade do usuário. Não realiza assinatura.'});
  } catch (err) { return res.status(err.status||500).json({error:err.status?err.message:'Falha na inspeção do certificado'}); }
};
