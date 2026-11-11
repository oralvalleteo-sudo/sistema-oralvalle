/* Um lançador por janela, sem trocar a tela de trabalho. Só coordenadas são persistidas. */
(()=>{'use strict';
if(window.top!==window.self||window.NexoChatWidget)return;
const script=document.currentScript,root=new URL('../../',script.src),chatURL=new URL('comunicacao/index.html',root),uid=()=>window.OralCloud?.session?.user?.id||'';
const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('assets/css/chat-widget.css?v=1',root);document.head.append(css);
const launcher=document.createElement('button');launcher.id='nexodent-chat-launcher';launcher.type='button';launcher.hidden=true;launcher.setAttribute('aria-label','Abrir chat da equipe');launcher.setAttribute('aria-expanded','false');launcher.setAttribute('aria-controls','nexodent-chat-panel');launcher.setAttribute('aria-description','Arraste para mover. Com o botão em foco, use Alt e as setas para mudar a posição.');launcher.title='Chat da equipe · arraste para mover. Com o botão em foco, Alt + setas muda a posição.';
const icon=document.createElement('span');icon.setAttribute('aria-hidden','true');icon.textContent='💬';const badge=document.createElement('span');badge.dataset.chatUnread='';badge.hidden=true;badge.setAttribute('aria-hidden','true');launcher.append(icon,badge);
const panel=document.createElement('section');panel.id='nexodent-chat-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-labelledby','nexo-chat-widget-title');
const toolbar=document.createElement('div');toolbar.className='nexo-chat-toolbar';const title=document.createElement('h2');title.id='nexo-chat-widget-title';title.textContent='Chat da equipe';const full=document.createElement('a');full.href=chatURL.href;full.target='_blank';full.rel='noopener';full.textContent='Abrir central';
const reset=document.createElement('button');reset.type='button';reset.textContent='Repor botão';reset.title='Voltar o botão ao canto da tela';const closeButton=document.createElement('button');closeButton.type='button';closeButton.textContent='✕';closeButton.setAttribute('aria-label','Fechar chat');toolbar.append(title,full,reset,closeButton);panel.append(toolbar);
const probe=document.createElement('div');probe.id='nexodent-chat-safearea';document.body.append(probe,panel,launcher);
let user='',position=null,point={x:0,y:0},frame=null,frameClinic=null,selectedClinic=null,open=false,drag=null,lastDrag=-Infinity;
const frames=[];
const uuid=value=>typeof value==='string'&&/^[0-9a-f-]{36}$/i.test(value)?value:null;
function pageContext(){let picker=document.querySelector('#clinic');if(!picker){try{picker=document.querySelector('iframe[title="CRM"]')?.contentDocument?.querySelector('#clinic');}catch{}}return uuid(picker?.value)||uuid(window.OralCloud?.clinicId)||uuid(window.OralCloud?.config?.clinicId)||uuid(new URLSearchParams(location.search).get('clinic_id'));}
function context(){return pageContext()||selectedClinic;}
window.NexoChatContext={get clinicId(){return context()}};
window.NexoChatWidget={get isOpen(){return open},isFrameActive:child=>open&&frame?.contentWindow===child,open:openPanel,close:closePanel};
function bounds(){const v=window.visualViewport,s=getComputedStyle(probe),x=v?.offsetLeft||0,y=v?.offsetTop||0,width=v?.width||innerWidth,height=v?.height||innerHeight;const inset=p=>Math.max(8,(parseFloat(s[p])||0)+8);const left=x+inset('paddingLeft'),top=y+inset('paddingTop'),right=x+width-inset('paddingRight'),bottom=y+height-inset('paddingBottom');return {left,top,right,bottom,maxX:Math.max(left,right-56),maxY:Math.max(top,bottom-56)};}
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function placePanel(){if(!open)return;const b=bounds(),width=Math.min(560,b.right-b.left),above=Math.max(0,point.y-b.top-12),below=Math.max(0,b.bottom-point.y-68),useAbove=above>=below,space=Math.max(above,below);const height=Math.min(720,space>=260?space:b.bottom-b.top);
 let left=point.x+68;if(left+width>b.right)left=point.x-width-12;if(left<b.left)left=clamp(point.x+28-width/2,b.left,b.right-width);
 const top=space>=260?(useAbove?point.y-height-12:point.y+68):b.top;
 panel.style.left=left+'px';panel.style.top=clamp(top,b.top,b.bottom-height)+'px';panel.style.width=width+'px';panel.style.height=height+'px';}
function layout(){const b=bounds();point=position?{x:b.left+(b.maxX-b.left)*position.x,y:b.top+(b.maxY-b.top)*position.y}:{x:Math.max(b.left,b.maxX-8),y:Math.max(b.top,b.maxY-72)};launcher.style.left=point.x+'px';launcher.style.top=point.y+'px';placePanel();}
function move(x,y,save=false){const b=bounds();point={x:clamp(x,b.left,b.maxX),y:clamp(y,b.top,b.maxY)};position={x:(point.x-b.left)/Math.max(1,b.maxX-b.left),y:(point.y-b.top)/Math.max(1,b.maxY-b.top)};launcher.style.left=point.x+'px';launcher.style.top=point.y+'px';placePanel();if(save)persist();}
function persist(){if(!user)return;try{localStorage.setItem('nexodent_chat_position:'+user,JSON.stringify(position));}catch{}}
function restore(){position=null;try{const p=JSON.parse(localStorage.getItem('nexodent_chat_position:'+user)||'null');if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1)position=p;}catch{}layout();}
function visibility(){for(const entry of frames)entry.node.contentWindow?.postMessage({type:'nexodent:chat-visibility',visible:open&&entry.node===frame},location.origin);}
function frameURL(clinic){const url=new URL(chatURL);url.searchParams.set('embedded','1');if(clinic)url.searchParams.set('clinic_id',clinic);return url;}
function openPanel(){if(!uid())return;const clinic=context();
 // Trocar de clínica oculta a janela anterior; não descarta sua mensagem em edição.
 let entry=frames.find(item=>item.node===frame&&(clinic===null||item.clinic===clinic||item.requested===clinic))||frames.find(item=>item.clinic===clinic||item.requested===clinic);
 if(!entry){const node=document.createElement('iframe');node.title='Comunicação interna da clínica';node.referrerPolicy='no-referrer';node.src=frameURL(clinic).href;node.dataset.nexodentChat='true';node.addEventListener('load',visibility);entry={node,clinic,requested:clinic,title:'Chat da equipe'};frames.push(entry);panel.append(node);}
 frame=entry.node;frameClinic=entry.clinic;for(const item of frames)item.node.hidden=item.node!==frame;title.textContent=entry.title;
 const fullURL=new URL(chatURL);if(entry.clinic||clinic)fullURL.searchParams.set('clinic_id',entry.clinic||clinic);full.href=fullURL.href;open=true;panel.hidden=false;launcher.setAttribute('aria-expanded','true');launcher.setAttribute('aria-label','Fechar chat da equipe');placePanel();visibility();closeButton.focus({preventScroll:true});}
function closePanel(){open=false;panel.hidden=true;launcher.setAttribute('aria-expanded','false');launcher.setAttribute('aria-label','Abrir chat da equipe');visibility();if(!launcher.hidden)launcher.focus({preventScroll:true});}
closeButton.onclick=closePanel;reset.onclick=()=>{position=null;persist();layout();};
launcher.addEventListener('pointerdown',e=>{if(e.button!==0)return;lastDrag=-Infinity;drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:point.x,top:point.y,moved:false};try{launcher.setPointerCapture(e.pointerId)}catch{}});
launcher.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<6)return;drag.moved=true;launcher.classList.add('is-dragging');move(drag.left+dx,drag.top+dy);e.preventDefault();});
function endDrag(e){if(!drag||e.pointerId!==drag.id)return;if(drag.moved){lastDrag=performance.now();persist();}drag=null;launcher.classList.remove('is-dragging');}
launcher.addEventListener('pointerup',endDrag);launcher.addEventListener('pointercancel',endDrag);launcher.addEventListener('lostpointercapture',endDrag);
launcher.onclick=e=>{if(e.detail!==0&&performance.now()-lastDrag<400){lastDrag=-Infinity;e.preventDefault();return;}if(open)closePanel();else openPanel();};
launcher.addEventListener('keydown',e=>{if(!e.altKey||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;const step=e.shiftKey?50:20;move(point.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),point.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0),true);e.preventDefault();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open&&!document.querySelector('dialog[open]')){closePanel();e.preventDefault();}});
window.addEventListener('message',e=>{if(e.origin!==location.origin)return;const entry=frames.find(item=>item.node.contentWindow===e.source);if(!entry)return;
 if(e.data?.type==='nexodent:chat-close'&&entry.node===frame){closePanel();return;}
 if(e.data?.type==='nexodent:chat-context'&&e.data.user_id===uid()&&uuid(e.data.clinic_id)){entry.clinic=e.data.clinic_id;entry.title='Chat · '+String(e.data.clinic_name||'Equipe').slice(0,100);if(entry.node!==frame)return;if(!pageContext()){selectedClinic=e.data.clinic_id;frameClinic=e.data.clinic_id;}title.textContent=entry.title;const url=new URL(chatURL);url.searchParams.set('clinic_id',e.data.clinic_id);full.href=url.href;}
});
function session(){const next=uid();if(next!==user){open=false;panel.hidden=true;
 // Sair ou trocar de conta remove o conteúdo privado da sessão anterior.
 for(const entry of frames)entry.node.remove();frames.length=0;frame=null;frameClinic=null;selectedClinic=null;user=next;window.dispatchEvent(new Event('nexodent:chat-session'));launcher.setAttribute('aria-expanded','false');launcher.setAttribute('aria-label','Abrir chat da equipe');restore();}launcher.hidden=!user;}
window.addEventListener('nexodent:chat-unread',e=>{if(!open&&/^\d+$/.test(String(e.detail?.count)))launcher.setAttribute('aria-label','Abrir chat da equipe, '+e.detail.count+' mensagem(ns) não lida(s)');});
window.addEventListener('resize',layout);window.visualViewport?.addEventListener('resize',layout);window.visualViewport?.addEventListener('scroll',layout);
window.addEventListener('storage',e=>{if(e.key==='nexodent_chat_position:'+user)restore();});window.addEventListener('nexodent:clinic-data-loaded',session);document.addEventListener('visibilitychange',()=>{if(!document.hidden){session();layout();}});
setInterval(session,1000);session();layout();
if(!window.NexoChatBadge&&!document.querySelector('script[data-nexodent-chat-badge]')){const shared=document.createElement('script');shared.dataset.nexodentChatBadge='true';shared.src=new URL('assets/js/chat-badge.js?v=widget1',root);document.body.append(shared);}
})();
