const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('assets/js/utils.js','utf8');
const context=vm.createContext({URL,location:{origin:'https://app.invalid'}});vm.runInContext(source,context);
test('imagens e anexos rejeitam URL executável, SVG e quebra de atributo',()=>{
 for(const value of ['javascript:alert(1)','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,AAAA" onerror="alert(1)','https://attacker.invalid/image.png','blob:https://other.invalid/file']){
 assert.equal(context.safeImageSrc(value),'');assert.equal(context.safeAttachmentUrl(value),'');
 }
 assert.equal(context.safeImageSrc('data:image/png;base64,AAAA'),'data:image/png;base64,AAAA');
 assert.equal(context.safeAttachmentUrl('data:application/pdf;base64,AAAA'),'data:application/pdf;base64,AAAA');
 assert.equal(context.safeAttachmentUrl('blob:https://app.invalid/file'),'blob:https://app.invalid/file');
});
