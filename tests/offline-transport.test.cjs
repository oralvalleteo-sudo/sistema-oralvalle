const test=require('node:test'),assert=require('node:assert/strict');const {send}=require('../assets/js/offline/transport.js');
const item={id:'op',user:'u',clinic:'c',revision:1,payload:[]};
const cloud=request=>({enabled:true,session:{user:{id:'u'}},clinicId:'c',request});
test('transport sends scoped batch and recognizes retry',async()=>{const c=cloud(async(path,opts)=>{assert.equal(path,'/rest/v1/rpc/nexodent_offline_apply');assert.deepEqual(opts.body,{p_clinic:'c',p_operation:'op',p_revision:1,p_changes:[]});return {id:'op',status:'already_applied'};});assert.equal((await send(item,c)).status,'already_applied');});
test('transport rejects wrong clinic before sending',async()=>{const c=cloud(async()=>assert.fail('unexpected request'));c.clinicId='other';await assert.rejects(send(item,c));});
test('transport preserves conflicts and rejects invalid acknowledgements',async()=>{assert.equal((await send(item,cloud(async()=>{throw Object.assign(new Error(),{code:'40001'});}))).status,'conflict');await assert.rejects(send(item,cloud(async()=>({id:'wrong',status:'applied'}))));});
