/* Aviso curto no navegador; preferências por usuário neste aparelho. */
(()=>{'use strict';
if(window.top!==window.self||window.NexoNotificationSound)return;
let audio=null,last=0;
const user=()=>window.OralCloud?.session?.user?.id||'',pref=()=> 'nexodent_sound:'+user();
const enabled=()=>{try{return localStorage.getItem(pref())!=='off'}catch{return true}};
async function unlock(event){if(!event?.isTrusted||!user()||!enabled()||(navigator.userActivation&&!navigator.userActivation.isActive))return false;
 try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;if(!audio||audio.state==='closed')audio=new Audio();if(audio.state==='suspended')await audio.resume();return audio.state==='running'}catch{return false}}
function play(){if(!user()||!enabled()||audio?.state!=='running')return false;const now=Date.now();if(now-last<2000)return false;
 try{const key='nexodent_sound_last:'+user(),previous=Number(localStorage.getItem(key)||0);if(now-previous<2000)return false;localStorage.setItem(key,String(now));}catch{}
 last=now;try{for(const [delay,frequency] of [[0,880],[.22,1175]]){const oscillator=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime+delay;oscillator.type='sine';oscillator.frequency.value=frequency;oscillator.connect(gain);gain.connect(audio.destination);gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.22,at+.02);gain.gain.exponentialRampToValueAtTime(.0001,at+.2);oscillator.start(at);oscillator.stop(at+.22);}return true}catch{return false}}
function setEnabled(value){try{localStorage.setItem(pref(),value?'on':'off')}catch{}window.dispatchEvent(new Event('nexodent:sound-change'));}
window.NexoNotificationSound={enabled,unlock,play,setEnabled};
for(const event of ['pointerdown','pointerup','keydown'])document.addEventListener(event,unlock,true);
window.addEventListener('storage',()=>window.dispatchEvent(new Event('nexodent:sound-change')));
window.addEventListener('nexodent:chat-session',()=>window.dispatchEvent(new Event('nexodent:sound-change')));
window.dispatchEvent(new Event('nexodent:sound-change'));
// Com o app fechado, o som é controlado pelo aparelho.
navigator.serviceWorker?.addEventListener('message',event=>{if(event.data?.type==='nexodent:push-received')play();});
})();
