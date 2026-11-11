(()=>{'use strict';
let count='0',key='',busy=false;
const label=()=>BigInt(count)>99n?'99+':count;
function apply(){for(const el of document.querySelectorAll('[data-chat-unread]')){el.hidden=count==='0';el.style.display=count==='0'?'none':'';el.textContent=label();el.setAttribute('aria-label',count+' mensagem(ns) não lida(s)');}}
window.NexoChatBadge={get count(){return count},label};
async function tick(){const cloud=window.OralCloud,clinic=cloud?.clinicId;if(!clinic||document.hidden||busy||!document.querySelector('[data-chat-unread]'))return;
 const current=clinic+':'+cloud.session?.user?.id;if(current!==key){key=current;count='0';apply();}busy=true;
 try{const result=await cloud.request('/rest/v1/rpc/nexodent_chat_unread',{method:'POST',body:{p_clinic:clinic}});if(key!==current||cloud.clinicId!==clinic)return;if(/^\d+$/.test(String(result))){count=String(result);apply();}}
 catch(error){if(error.status===403){count='0';apply();}}finally{busy=false;}}
setInterval(tick,20000);document.addEventListener('DOMContentLoaded',tick);window.addEventListener('nexodent:clinic-data-loaded',tick);document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});
})();
