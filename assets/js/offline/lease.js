/* Experimental verifier; requires a trusted server-issued ES256 lease and pinned public key. */
(function(root){
'use strict';
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
function decode(s){if(typeof s!=='string'||! /^[A-Za-z0-9_-]+$/.test(s))throw new Error('Invalid encoding');return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
async function verify(token,publicKey,user,clinic){
if(typeof token!=='string'||token.length>16384)throw new Error('Invalid lease');
const parts=token.split('.');if(parts.length!==3)throw new Error('Invalid lease');
const [h,p,s]=parts,header=JSON.parse(dec.decode(decode(h)));
if(header.alg!=='ES256'||header.typ!=='nexodent-offline+jwt')throw new Error('Invalid algorithm');
if(!await root.crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,decode(s),enc.encode(h+'.'+p)))throw new Error('Invalid signature');
const c=JSON.parse(dec.decode(decode(p))),now=Math.floor(Date.now()/1000);
if(c.iss!=='nexodent'||c.aud!=='nexodent-offline'||c.sub!==user||c.clinic_id!==clinic||!Number.isSafeInteger(c.iat)||!Number.isSafeInteger(c.exp)||c.iat>now||c.exp<=now||c.exp<=c.iat||c.exp-c.iat>86400)throw new Error('Expired or invalid lease');
if(!c.perms||typeof c.perms!=='object'||Array.isArray(c.perms))throw new Error('Invalid permissions');
const perms=Object.create(null);for(const [k,v] of Object.entries(c.perms)){if(!['none','view','edit'].includes(v))throw new Error('Invalid permission');perms[k]=v;}
return Object.freeze({user,clinic,expires:c.exp,perms:Object.freeze(perms)});
}
function allowed(lease,permission,write=false){return !!lease&&lease.expires>Math.floor(Date.now()/1000)&&(lease.perms[permission]==='edit'||(!write&&lease.perms[permission]==='view'));}
const api=Object.freeze({verify,allowed});if(typeof module==='object'&&module.exports)module.exports=api;else root.NexoOfflineLease=api;
})(globalThis);
