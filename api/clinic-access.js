'use strict';
module.exports=async function clinicAccess(req,base,anon,authorization){
 const clinic=String(req.body?.clinic_id||'');
 if(!/^[0-9a-f-]{36}$/i.test(clinic))return false;
 const response=await fetch(base.replace(/\/$/,'')+'/rest/v1/rpc/nexodent_certificate_access',{method:'POST',headers:{apikey:anon,Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify({p_clinic:clinic}),signal:AbortSignal.timeout(8000)});
 return response.ok&&(await response.json())===true;
};
