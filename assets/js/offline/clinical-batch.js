/* Adapter for existing relational change batches. No activation until vault/session integration. */
(function(root){
'use strict';
const supported=new Set(['appointments','patients','patient_anamneses','patient_conditions','patient_odontograms','odontogram_history','patient_evolutions','dental_plans','budgets','budget_items','treatments','treatment_materials','sales','receipts','installments']);
function prepare(changes,baseline,access){
if(!Array.isArray(changes)||changes.length>50000||!(baseline instanceof Map))throw new Error('Invalid clinical batch');
const old=new Map([...baseline.values()].map(v=>[JSON.stringify([v.table,v.id]),v]));
const seen=new Set();
for(const change of changes){
if(!supported.has(change.table)||typeof change.id!=='string'||!change.id)throw new Error('Unsupported offline clinical change');
const key=JSON.stringify([change.table,change.id]);if(seen.has(key))throw new Error('Duplicate clinical change');seen.add(key);
const before=old.get(key),rights=access[change.table];
const editable=slot=>typeof slot==='string'&&rights?.read&&(rights.admin||rights.write?.[slot]===true);
if(before&&!editable(before.row.slot))throw new Error('Existing row not editable');
if(change.delete===true){if(!before||change.row||(change.table==='patients'&&!rights?.admin))throw new Error('Deletion denied');}
else if(!change.row||!editable(change.row.slot))throw new Error('Clinical write denied');
}
return JSON.parse(JSON.stringify(changes));
}
const api=Object.freeze({prepare});if(typeof module==='object'&&module.exports)module.exports=api;else root.NexoClinicalBatch=api;
})(globalThis);
