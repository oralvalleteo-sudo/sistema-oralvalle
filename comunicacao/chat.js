(()=>{'use strict';
const $=id=>document.getElementById(id),embedded=new URLSearchParams(location.search).get('embedded')==='1'&&window.parent!==window;
let cloud=window.OralCloud;
if(embedded){document.documentElement.classList.add('chat-embedded');try{if(window.parent.location.origin===location.origin&&window.parent.OralCloud)cloud=window.parent.OralCloud;}catch{}}

const state={clinic:null,user:null,canWrite:false,people:[],rooms:[],active:null,messages:new Map(),detail:null,version:0,busy:false,polling:false,older:false,roomOffset:0,roomHasMore:false,lastRead:null,reading:false,draft:null,lockedClinic:false,embedVisible:true};
function visible(){if(document.hidden)return false;if(!embedded)return true;try{return state.embedVisible&&window.parent.NexoChatWidget?.isOpen!==false&&window.parent.NexoChatWidget?.isFrameActive?.(window)!==false;}catch{return false}}
window.NexoChatEmbedded={hasDraft:()=>dirty()};
const status=text=>{$('status').textContent=text};
const rpc=(name,body={},clinic=state.clinic)=>cloud.request('/rest/v1/rpc/nexodent_chat_'+name,{method:'POST',body:{p_clinic:clinic,...body}});
const dirty=()=>!!($('body').value.trim()||$('file').files.length);
function confirmDiscard(){return !dirty()||confirm('Há uma mensagem não enviada. Descartar para trocar de conversa?')}
function setSending(value){state.busy=value;$('send').disabled=value||!state.canWrite;$('body').disabled=value;$('file').disabled=value;$('clinic').disabled=value||state.lockedClinic;$('new').disabled=value||!state.canWrite||state.people.filter(p=>p.id!==state.user).length===0;}
function clearComposer(){$('body').readOnly=false;$('file').disabled=false;$('send').disabled=!state.canWrite;$('body').value='';$('file').value='';$('clear-file').hidden=true;state.draft=null;}
function renderRooms(){
 const fragment=document.createDocumentFragment();
 for(const room of state.rooms){const button=document.createElement('button');button.type='button';button.className='room';button.setAttribute('aria-pressed',String(state.active===room.id));const title=document.createElement('strong');title.textContent=room.title;button.append(title);
 if(Number(room.unread)>0){const badge=document.createElement('span');badge.className='unread';badge.textContent=room.unread+' não lida(s)';button.append(badge)}
 const preview=document.createElement('small');preview.textContent=room.last_message?.body||(room.last_message?.has_file?'Arquivo compartilhado':room.kind==='group'?'Grupo da equipe':'Conversa individual');button.append(preview);button.onclick=()=>selectRoom(room);fragment.append(button);}
 $('rooms').replaceChildren(fragment);$('empty-rooms').hidden=state.rooms.length>0;
}
async function rooms(append=false){const version=state.version;const result=await rpc('rooms_list',{p_offset:append?state.roomOffset:0});if(version!==state.version)return;
 const incoming=result.rooms||[];if(append||state.roomOffset===0||!result.has_more)state.roomHasMore=result.has_more;
 if(append){for(const room of incoming)if(!state.rooms.some(x=>x.id===room.id))state.rooms.push(room);state.roomOffset+=incoming.length;}
 else{const ids=new Set(incoming.map(r=>r.id));state.rooms=[...incoming,...state.rooms.filter(r=>!ids.has(r.id))];if(state.roomOffset===0)state.roomOffset=incoming.length;}
 $('more-rooms').hidden=!state.roomHasMore;renderRooms();
}
function renderMessages(mode='new'){
 const box=$('messages'),top=box.scrollTop,height=box.scrollHeight,atBottom=height-top-box.clientHeight<100,fragment=document.createDocumentFragment();
 const ordered=[...state.messages.values()].sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1);
 for(const message of ordered){const article=document.createElement('article');article.className='message'+(message.author_id===state.user?' mine':'');const author=document.createElement('h3');author.textContent=message.author_id===state.user?'Você':message.author_name;const body=document.createElement('p');body.textContent=message.body;const time=document.createElement('time');time.dateTime=message.created_at;time.textContent=new Date(message.created_at).toLocaleString('pt-BR');article.append(author,body);
 if(message.attachment){const button=document.createElement('button');button.type='button';button.textContent='Baixar '+message.attachment.name+' ('+Math.ceil(message.attachment.size/1024)+' KB)';button.onclick=()=>download(message.id,button);article.append(button)}article.append(time);fragment.append(article);}
 box.replaceChildren(fragment);
 if(mode==='initial'||(mode==='new'&&atBottom))box.scrollTop=box.scrollHeight;else box.scrollTop=mode==='older'?top+(box.scrollHeight-height):top;
 $('older').hidden=!state.older;
}
async function markRead(){
 if(state.reading||!state.active||!state.messages.size||!visible())return;const box=$('messages');if(embedded&&!document.documentElement.classList.contains('has-chat-room'))return;if(box.scrollHeight-box.scrollTop-box.clientHeight>100)return;
 const id=[...state.messages.keys()].reduce((a,b)=>BigInt(a)>BigInt(b)?a:b);if(state.lastRead===id)return;
 const version=state.version,room=state.active,clinic=state.clinic;state.reading=true;
 try{await rpc('mark_read',{p_room:room,p_message:id},clinic);if(version===state.version){state.lastRead=id;const entry=state.rooms.find(r=>r.id===room);if(entry)entry.unread=0;renderRooms();$('new-messages').textContent='';}}
 catch(error){if(version===state.version)status(error.message)}finally{state.reading=false;}
}
async function messages(mode='new',remaining=5){
 if(!state.active)return;const version=state.version,room=state.active,clinic=state.clinic;
 const ids=[...state.messages.keys()].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1);
 const args={p_room:room};if(mode==='older'&&ids.length)args.p_before=ids[0];else if(mode==='new'&&ids.length)args.p_after=ids.at(-1);
 const result=await rpc('messages_page',args,clinic);if(version!==state.version)return;
 if(mode==='initial'||mode==='older')state.older=result.has_more;$('older').hidden=!state.older;
 let added=0;for(const message of result.messages||[])if(!state.messages.has(message.id)){state.messages.set(message.id,message);added++;}
 if(added||mode==='initial'){renderMessages(mode);if(mode==='new'&&added)$('new-messages').textContent=added+' nova(s) mensagem(ns).';}
 await markRead();
 if(mode==='new'&&result.has_more&&remaining>1&&version===state.version)await messages('new',remaining-1);
}
async function selectRoom(room){
 if(state.busy)return status('Aguarde a confirmação do envio.');if(state.active===room.id){document.documentElement.classList.add('has-chat-room');markRead();return;}if(!confirmDiscard())return;
 clearComposer();document.documentElement.classList.add('has-chat-room');state.version++;const version=state.version;state.active=room.id;state.messages.clear();state.lastRead=null;state.older=false;state.detail=null;
 $('title').textContent=room.title;$('messages').replaceChildren();$('participants').textContent='Carregando participantes…';$('new-messages').textContent='';$('manage').hidden=true;$('composer').hidden=!state.canWrite;$('read-only').hidden=state.canWrite;renderRooms();
 try{const detail=await rpc('detail',{p_room:room.id});if(version!==state.version)return;state.detail=detail;$('participants').textContent=(detail.members||[]).map(m=>m.name+(m.active?'':' (inativo)')).join(', ');$('manage').hidden=!(state.canWrite&&room.kind==='group'&&detail.room.created_by===state.user);await messages('initial');status('Conversa aberta. As mensagens são atualizadas automaticamente.');}
 catch(error){if(version===state.version)accessError(error);}
}
function accessError(error){status(error.message);if(['42501','403'].includes(error.code)||error.status===403){const unavailable=state.active;state.version++;state.active=null;state.rooms=state.rooms.filter(r=>r.id!==unavailable);renderRooms();state.messages.clear();$('messages').replaceChildren();$('composer').hidden=!dirty();$('body').readOnly=true;$('file').disabled=true;$('send').disabled=true;$('manage').hidden=true;$('title').textContent='Conversa indisponível';$('participants').textContent='Seu acesso pode ter sido alterado. Atualize as conversas.';}}
async function changeClinic(){
 if(state.busy)return;if(state.clinic&&!confirmDiscard()){$('clinic').value=state.clinic;return;}
 if($('room-dialog').open)$('room-dialog').close();state.version++;const version=state.version;state.clinic=$('clinic').value;document.documentElement.classList.remove('has-chat-room');document.querySelector('header>a').href='../index.html?clinic_id='+encodeURIComponent(state.clinic);state.active=null;state.rooms=[];state.messages.clear();state.roomOffset=0;state.roomHasMore=false;state.lastRead=null;clearComposer();$('messages').replaceChildren();$('composer').hidden=true;$('manage').hidden=true;$('participants').textContent='';$('title').textContent='Escolha uma conversa';$('older').hidden=true;renderRooms();
 try{const result=await rpc('people');if(version!==state.version)return;state.user=result.user_id;state.people=result.people||[];state.canWrite=result.can_write;
 if(embedded)window.parent.postMessage({type:'nexodent:chat-context',clinic_id:state.clinic,user_id:state.user,clinic_name:$('clinic').selectedOptions[0]?.textContent},location.origin);$('new').disabled=!state.canWrite||state.people.filter(p=>p.id!==state.user).length===0;$('workspace').hidden=false;await rooms();status(state.people.length>1?'Equipe carregada. Conversas e arquivos ficam restritos aos participantes.':'Só você está disponível nesta clínica. Cadastre ou libere o acesso dos colegas para conversar.');}
 catch(error){if(version===state.version){$('workspace').hidden=true;status(/42883|PGRST202/.test(error.code||'')?'A comunicação ainda precisa ser instalada no servidor. Solicite a ativação ao administrador.':error.message)}}
}
function renderPeople(selected=[]){
 const selection=new Set(selected),group=$('kind').value==='group';$('group-name-label').hidden=!group||$('room-form').dataset.mode==='manage';const fragment=document.createDocumentFragment();
 for(const person of state.people.filter(p=>p.id!==state.user)){const label=document.createElement('label'),input=document.createElement('input');input.type=group?'checkbox':'radio';input.name='person';input.value=person.id;input.checked=selection.has(person.id);label.append(input,document.createTextNode(person.name));fragment.append(label)}$('people').replaceChildren(fragment);
}
function openDialog(manage=false){
 if(!state.canWrite||state.busy)return;$('room-form').dataset.mode=manage?'manage':'create';$('dialog-title').textContent=manage?'Participantes do grupo':'Nova conversa';$('kind-label').hidden=manage;$('kind').value=manage?'group':'direct';$('group-name').value='';$('history-note').hidden=!manage;$('save-room').textContent=manage?'Salvar participantes':'Criar conversa';$('dialog-status').textContent='';renderPeople(manage?state.detail.members.map(m=>m.id):[]);$('room-dialog').showModal();
}
$('kind').onchange=()=>renderPeople();$('close-dialog').onclick=()=>$('room-dialog').close();$('new').onclick=()=>openDialog();$('manage').onclick=()=>openDialog(true);
$('room-form').onsubmit=async e=>{e.preventDefault();const version=state.version,clinic=state.clinic,manage=e.currentTarget.dataset.mode==='manage',users=[...$('people').querySelectorAll('input:checked')].map(i=>i.value);$('save-room').disabled=true;
 try{if(manage){await rpc('group_members',{p_room:state.active,p_users:users},clinic);if(version!==state.version)return;const detail=await rpc('detail',{p_room:state.active},clinic);state.detail=detail;$('participants').textContent=detail.members.map(m=>m.name).join(', ');}
 else{const id=await rpc('create',{p_kind:$('kind').value,p_title:$('group-name').value,p_users:users},clinic);if(version!==state.version)return;await rooms();const room=state.rooms.find(r=>r.id===id);if(room)await selectRoom(room);}
 $('room-dialog').close();status(manage?'Participantes atualizados.':'Conversa criada.');
 }catch(error){$('dialog-status').textContent=error.message}finally{$('save-room').disabled=false;}};
async function download(id,button){const version=state.version,room=state.active,clinic=state.clinic;button.disabled=true;
 try{const file=await rpc('download',{p_room:room,p_message:id},clinic);if(version!==state.version)return;if(!file)throw Error('Arquivo indisponível');const raw=atob(file.base64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==file.sha256)throw Error('O arquivo não passou na verificação de integridade.');const blob=new Blob([bytes],{type:'application/octet-stream'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=file.name;link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 catch(error){status(error.message)}finally{button.disabled=false;}}
$('file').onchange=()=>{$('clear-file').hidden=!$('file').files.length};$('clear-file').onclick=()=>{$('file').value='';$('clear-file').hidden=true;};
$('composer').onsubmit=async e=>{e.preventDefault();if(state.busy||!state.active||!state.canWrite)return;const body=$('body').value,file=$('file').files[0],room=state.active,clinic=state.clinic,version=state.version;
 if(!body.trim()&&!file)return status('Escreva uma mensagem ou selecione um arquivo.');if(file&&file.size>10485760)return status('O arquivo pode ter até 10 MB.');
 const fingerprint=JSON.stringify([room,body,file?.name,file?.size,file?.lastModified]);if(state.draft?.fingerprint!==fingerprint)state.draft={fingerprint,nonce:crypto.randomUUID()};setSending(true);status('Enviando…');
 try{let attachment=null;if(file){const bytes=new Uint8Array(await file.arrayBuffer());let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));attachment={name:file.name,mime:({pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',txt:'text/plain'})[file.name.split('.').at(-1).toLowerCase()]||'',base64:btoa(text)};}
 await rpc('send',{p_room:room,p_nonce:state.draft.nonce,p_body:body,p_file:attachment},clinic);if(version!==state.version)return;clearComposer();await messages('new');await rooms();status('Mensagem enviada.');$('body').focus();
 }catch(error){status('Não foi possível confirmar o envio: '+error.message+'. Seu rascunho foi mantido.');}finally{setSending(false);}};
$('more-rooms').onclick=()=>rooms(true).catch(e=>status(e.message));$('older').onclick=async()=>{$('older').disabled=true;try{await messages('older')}catch(e){status(e.message)}finally{$('older').disabled=false}};
$('back-rooms').onclick=()=>{document.documentElement.classList.remove('has-chat-room');$('rooms').querySelector('[aria-pressed="true"]')?.focus();};
$('messages').onscroll=()=>{markRead()};$('clinic').onchange=changeClinic;
async function init(){
 try{const auth=await cloud.restoreSession();if(!auth){$('login').hidden=false;status('Entre com a sua conta do NexoDent.');return;}
 const clinics=await cloud.request('/rest/v1/rpc/clinic_list',{method:'POST',body:{}});$('clinic').replaceChildren();for(const clinic of clinics||[]){const option=document.createElement('option');option.value=clinic.clinic_id;option.textContent=clinic.nome;$('clinic').append(option)}
 if(!clinics?.length)return status('Sua conta não possui vínculo ativo com uma clínica.');const chosen=new URLSearchParams(location.search).get('clinic_id')||cloud.config?.clinicId;if(clinics.some(c=>c.clinic_id===chosen))$('clinic').value=chosen;
 state.lockedClinic=embedded&&clinics.some(c=>c.clinic_id===chosen);$('clinic').disabled=state.lockedClinic;document.documentElement.classList.toggle('chat-clinic-locked',state.lockedClinic);$('login').hidden=true;await changeClinic();
 }catch(error){status(error.message)}}
$('login-form').onsubmit=async e=>{e.preventDefault();try{await cloud.login($('email').value,$('password').value,false);$('password').value='';await init()}catch(error){status(error.message)}};
async function sync(){if(!visible()||state.polling||state.busy||!state.clinic)return;state.polling=true;try{await rooms();await messages('new')}catch(error){accessError(error)}finally{state.polling=false}}
window.addEventListener('message',e=>{if(!embedded||e.source!==window.parent||e.origin!==location.origin||e.data?.type!=='nexodent:chat-visibility')return;state.embedVisible=e.data.visible===true;if(state.embedVisible){sync();markRead();}});
document.addEventListener('keydown',e=>{if(embedded&&e.key==='Escape'&&!document.querySelector('dialog[open]')){window.parent.postMessage({type:'nexodent:chat-close'},location.origin);e.preventDefault();}});
setInterval(sync,8000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});window.addEventListener('online',sync);window.addEventListener('beforeunload',e=>{if(dirty()){e.preventDefault();e.returnValue='';}});
init();
})();
