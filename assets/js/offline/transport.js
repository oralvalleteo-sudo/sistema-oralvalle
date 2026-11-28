/* Experimental transport for relational batches, not yet wired to UI. */
(function(root){
'use strict';
async function send(item,cloud=root.OralCloud){
if(!cloud?.enabled||!cloud.session?.user?.id||cloud.session.user.id!==item.user||cloud.clinicId!==item.clinic)throw new Error('Offline session scope mismatch');
if(!Array.isArray(item.payload)||!Number.isSafeInteger(item.revision)||item.revision<0)throw new Error('Invalid offline batch');
try{
const result=await cloud.request('/rest/v1/rpc/nexodent_offline_apply',{method:'POST',body:{p_clinic:item.clinic,p_operation:item.id,p_revision:item.revision,p_changes:item.payload}});
if(cloud.session?.user?.id!==item.user||cloud.clinicId!==item.clinic)throw new Error('Session changed');
if(result?.id!==item.id||!['applied','already_applied'].includes(result.status))throw new Error('Invalid server acknowledgement');
return result;
}catch(error){
if(cloud.session?.user?.id!==item.user||cloud.clinicId!==item.clinic)throw error;
if(error.code==='40001')return {id:item.id,status:'conflict'};
if(error.code==='42501')return {id:item.id,status:'denied'};
throw error;
}
}
const api=Object.freeze({send});if(typeof module==='object'&&module.exports)module.exports=api;else root.NexoOfflineTransport=api;
})(globalThis);
