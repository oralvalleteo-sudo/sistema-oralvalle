'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {isCorporateCertificate} = require('../server/certificate-policy');
const forge = {
  asn1: { toDer: value => ({getBytes: () => value}), oidToDer: oid => ({getBytes: () => `OID:${oid}`}) },
  pki: {certificateToAsn1: cert => cert.der || ''}
};
test('bloqueia CNPJ formatado no titular', () => {
  assert.equal(isCorporateCertificate({subject:{attributes:[{value:'Empresa 12.345.678/0001-90'}]}},forge),true);
});
test('bloqueia OID de CNPJ na extensão ASN.1 sem texto legível', () => {
  assert.equal(isCorporateCertificate({subject:{attributes:[]},der:'\0OID:2.16.76.1.3.3\0'},forge),true);
});
test('não identifica pessoa física sem indicador empresarial', () => {
  assert.equal(isCorporateCertificate({subject:{attributes:[{value:'Dentista'}]},der:'sem-oid'},forge),false);
});
test('anexos do prontuário não executam HTML, SVG nem URLs arbitrárias',()=>{
 const fs=require('node:fs'),vm=require('node:vm');const source=fs.readFileSync('assets/js/features/certificates.js','utf8');const code=source.slice(source.indexOf('function tabArquivos(p){'),source.indexOf('\nfunction patient(){'));
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const context=vm.createContext({esc:escape,rxHtml:()=>'',atHtml:()=>''});vm.runInContext(code,context);const html=context.tabArquivos({arquivos:[{id:'1',nome:'malicioso',data:'javascript:alert(1)'},{id:'2',nome:'svg',tipo:'image/svg+xml',data:'data:image/svg+xml;base64,AAAA'},{id:'3',nome:'pdf',tipo:'application/pdf',data:'data:application/pdf;base64,JVBERi0='}]});assert.ok(!html.includes('href="javascript:'));assert.ok(!html.includes('src="data:image/svg'));assert.ok(html.includes('href="data:application/pdf;base64,JVBERi0="'));
});
