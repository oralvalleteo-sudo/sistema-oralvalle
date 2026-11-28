/* Experimental encrypted offline vault. Not connected to production UI.
 * The caller must obtain a server-verified authorization lease before provisioning.
 * No plaintext clinical data or keys are persisted by this module.
 */
(function(root){
'use strict';
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const iterations=600000;
const random=n=>root.crypto.getRandomValues(new Uint8Array(n));
function scope(user,clinic){if(typeof user!=='string'||!user||typeof clinic!=='string'||!clinic)throw new Error('Invalid scope');return JSON.stringify([user,clinic]);}
async function key(secret,salt){if(typeof secret!=='string'||secret.length<12)throw new Error('Passphrase too short');const material=await root.crypto.subtle.importKey('raw',enc.encode(secret),'PBKDF2',false,['deriveKey']);return root.crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
async function seal(secret,user,clinic,value){const id=scope(user,clinic),salt=random(32),iv=random(12),k=await key(secret,salt);const ciphertext=await root.crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('nexodent:v1:'+id),tagLength:128},k,enc.encode(JSON.stringify(value)));return {id,version:1,salt,iv,ciphertext};}
async function unseal(secret,user,clinic,record){const id=scope(user,clinic);if(!record||record.id!==id||record.version!==1)throw new Error('Invalid vault scope');const k=await key(secret,record.salt);const bytes=await root.crypto.subtle.decrypt({name:'AES-GCM',iv:record.iv,additionalData:enc.encode('nexodent:v1:'+id),tagLength:128},k,record.ciphertext);return JSON.parse(dec.decode(bytes));}
function open(){return new Promise((resolve,reject)=>{const req=root.indexedDB.open('nexodent-offline-vault',1);req.onupgradeneeded=()=>req.result.createObjectStore('vaults',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('Vault blocked'));});}
async function transaction(mode,operation){const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('vaults',mode);let req;try{req=operation(tx.objectStore('vaults'));}catch(e){tx.abort();reject(e);return;}tx.oncomplete=()=>resolve(req.result);tx.onabort=()=>reject(tx.error||new Error('Vault transaction aborted'));tx.onerror=()=>reject(tx.error||new Error('Vault transaction failed'));});}finally{db.close();}}
async function write(secret,user,clinic,value){const record=await seal(secret,user,clinic,value);await transaction('readwrite',store=>store.put(record));}
async function read(secret,user,clinic){const record=await transaction('readonly',store=>store.get(scope(user,clinic)));return record?unseal(secret,user,clinic,record):null;}
const api=Object.freeze({seal,unseal,write,read});if(typeof module==='object'&&module.exports)module.exports=api;else root.NexoOfflineVault=api;
})(globalThis);
