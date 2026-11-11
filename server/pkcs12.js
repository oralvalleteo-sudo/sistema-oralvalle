'use strict';
const forge=require('node-forge');
function openCertificate(raw,password){
 const p12=forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(raw.toString('binary')),false,password);
 const certs=p12.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]||[];
 const keys=[forge.pki.oids.pkcs8ShroudedKeyBag,forge.pki.oids.keyBag].flatMap(t=>p12.getBags({bagType:t})[t]||[]).map(b=>b.key).filter(Boolean);
 if(keys.length!==1||!keys[0].n||!keys[0].e)throw Error('O arquivo deve conter exatamente uma chave privada RSA compatível');
 const key=keys[0],matches=certs.map(b=>b.cert).filter(c=>c?.publicKey?.n&&c.publicKey.n.compareTo(key.n)===0&&c.publicKey.e.compareTo(key.e)===0);
 if(matches.length!==1)throw Error('Não foi possível identificar o certificado correspondente à chave privada');
 const normalized=forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(key,certs.map(b=>b.cert),password,{algorithm:'3des'})).getBytes();
 return {cert:matches[0],key,p12,signingP12:Buffer.from(normalized,'binary')};
}
module.exports={openCertificate};
