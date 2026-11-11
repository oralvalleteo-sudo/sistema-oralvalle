 'use strict';
// Assinador PDF transitório. Não persiste arquivo, certificado ou senha.
const { PDFDocument } = require('pdf-lib');
const { pdflibAddPlaceholder } = require('@signpdf/placeholder-pdf-lib');
const { SignPdf } = require('@signpdf/signpdf');
const { P12Signer } = require('@signpdf/signer-p12');
const {prepare,authorize}=require('../server/certificate-access');
const {openCertificate}=require('../server/pkcs12');
const { isCorporateCertificate } = require('../server/certificate-policy');
const MAX_PDF=2*1024*1024, MAX_P12=1024*1024;
function decode(input, max) {
 if(typeof input!=='string'||input.length>Math.ceil(max*4/3)+8||!input.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(input)) throw new Error('Arquivo inválido');
 const buf=Buffer.from(input,'base64'); if(!buf.length||buf.length>max)throw new Error('Arquivo acima do limite'); return buf;
}
module.exports=async function handler(req,res){
 try{
  if(!prepare(req,res))return;
  await authorize(req);
  const {pdfBase64,pfxBase64,password,acknowledge}=req.body||{};
  if(acknowledge!==true||typeof password!=='string'||!password||password.length>512)return res.status(400).json({error:'Confirme a autorização do titular e informe a senha'});
  const pdf=decode(pdfBase64,MAX_PDF),p12=decode(pfxBase64,MAX_P12);
  if(pdf.subarray(0,5).toString()!=='%PDF-')return res.status(400).json({error:'Arquivo não é PDF'});
  // Não é permitido usar esta rota para e-CNPJ sem controle de administrador implementado.
  const forge=require('node-forge');let cert,signingP12;
  try{({cert,signingP12}=openCertificate(p12,password));}catch(_){return res.status(422).json({error:'Certificado, chave privada ou senha inválidos'});}
  if(isCorporateCertificate(cert,forge))return res.status(403).json({error:'e-CNPJ indisponível nesta etapa: falta validar o perfil de administrador'});
  const now=new Date();if(now<cert.validity.notBefore||now>cert.validity.notAfter)return res.status(422).json({error:'Certificado fora da validade'});
  const doc=await PDFDocument.load(pdf,{ignoreEncryption:false});
  // Regravar um PDF com assinatura existente invalida os bytes já assinados.
  if(doc.getForm().getFields().some(field=>field.constructor.name==='PDFSignature')||/\/ByteRange\s*\[/.test(pdf.toString('latin1')))return res.status(409).json({error:'Este PDF já possui assinatura digital. Use um assinador com suporte a assinaturas adicionais para preservá-la.'});
  pdflibAddPlaceholder({pdfDoc:doc,reason:'Assinatura digital de documento',name:cert.subject.getField('CN')?.value||'Titular',contactInfo:'',location:'Brasil',signatureLength:16000});
  const prepared=Buffer.from(await doc.save({useObjectStreams:false}));
  const signed=await new SignPdf().sign(prepared,new P12Signer(signingP12,{passphrase:password}));
  res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition','attachment; filename="nexodent-assinado.pdf"');
  return res.status(200).send(signed);
 }catch(err){if(err.status)return res.status(err.status).json({error:err.message});return res.status(422).json({error:'Não foi possível assinar o PDF. Confira se é um PDF válido e se o certificado A1 é compatível.'});}
};
