/* Pure outbox model. Persist the entire resulting state in the encrypted vault
 * before acknowledging local edits. Server must atomically enforce idempotency,
 * authorization and expected revision. Not wired into production.
 */
(function(root){
'use strict';
const modules=new Set(['ag','pac.dados','pac.anam','pac.odo','pac.trat','pac.orc','pac.pag','pac.evol']);
function enqueue(queue,lease,permission,entityId,revision,payload){
if(!modules.has(permission)||!root.NexoOfflineLease.allowed(lease,permission,true))throw new Error('Permission denied');
if(typeof entityId!=='string'||!entityId||!Number.isSafeInteger(revision)||revision<0)throw new Error('Invalid mutation');
if(queue.some(x=>x.entityId===entityId&&x.permission===permission))throw new Error('Resolve existing pending mutation first');
const item={id:root.crypto.randomUUID(),user:lease.user,clinic:lease.clinic,permission,entityId,revision,payload:JSON.parse(JSON.stringify(payload)),status:'pending'};
return [...queue,item];
}
async function flush(queue,identity,send,persist){
let current=queue.slice();
for(const item of queue){
if(item.status!=='pending')break;
if(item.user!==identity.user||item.clinic!==identity.clinic)throw new Error('Scope mismatch');
let result;try{result=await send(JSON.parse(JSON.stringify(item)));}catch(e){break;}
if(!result||result.id!==item.id)break;
let next;
if(result.status==='applied'||result.status==='already_applied')next=current.filter(x=>x.id!==item.id);
else if(result.status==='conflict'||result.status==='denied')next=current.map(x=>x.id===item.id?{...x,status:result.status}:x);
else break;
await persist(next);current=next;
if(result.status==='conflict'||result.status==='denied')break;
}
return current;
}
const api=Object.freeze({enqueue,flush});if(typeof module==='object'&&module.exports)module.exports=api;else root.NexoOfflineOutbox=api;
})(globalThis);
