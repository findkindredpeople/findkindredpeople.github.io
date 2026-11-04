import{initializeApp}from'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import{getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut}from'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import{getFirestore,collection,doc,addDoc,getDoc,onSnapshot,query,where,limit,runTransaction,serverTimestamp,updateDoc}from'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import{gameTypes,initialPosition,move,finishReveal,baseGameType,wireGameType}from'./arcade-logic.mjs?v=20261104-games-1';
import{checkersMoves,checkersProofWrites}from'./checkers-logic.mjs';
import{seriesTarget,seriesWinner,seriesFields,roundScore,nextRound}from'./arcade-series.mjs';
import{arcadeCopy}from'./arcade-copy.mjs';
import{boardView}from'./arcade-view.mjs';
import{communityCopy}from'./community-upgrade.mjs';
import{mountNotificationSettings}from'./community-tools.js';
const app=initializeApp({apiKey:'AIzaSyDeuW583lgxl08k-DYDju7jQiZP2jVqUk4',authDomain:'kindred-507209.firebaseapp.com',projectId:'kindred-507209',storageBucket:'kindred-507209.firebasestorage.app',messagingSenderId:'459167088901',appId:'1:459167088901:web:c13b3aeaf9d6e41e9cf76c'}),auth=getAuth(app),db=getFirestore(app),$=s=>document.querySelector(s);
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let user=null,language=localStorage.getItem('kindred_language')||'en',rooms=[],own=[],unsubs=[],stopRoom=()=>{},heartbeat,clock,roomId='',currentRoom,busy=false,live=false,stopSettings=()=>{},format=1,selectedChecker=-1,positionKey='',roomLive=false,pendingRoomId=new URL(location.href).searchParams.get('room');
const copy=()=>({...communityCopy(language),...arcadeCopy(language)}),note=t=>{$('#gameStatus').textContent=t;};
const available=r=>!!gameTypes[baseGameType(r.gameType)]&&r.mode==='random'&&r.status==='waiting'&&r.player1Id!==user?.uid&&Date.now()-(r.heartbeatAt?.toMillis?.()||0)<90000;
const adult=()=>!!user&&$('#gameAdultConfirmed').checked;
$('#gameLanguage').value=['en','ru','de'].includes(language)?language:'en';
language=$('#gameLanguage').value;
$('#gameLanguage').onchange=()=>{language=$('#gameLanguage').value;localStorage.setItem('kindred_language',language);document.documentElement.lang=language;renderLobby();if(currentRoom)renderRoom(currentRoom);stopSettings();stopSettings=mountNotificationSettings($('#gameNotifications'),language);};
$('#gameFormat').onchange=()=>{format=Number($('#gameFormat').value);renderLobby();};
$('#gameSignIn').onclick=async()=>{try{if(user)await signOut(auth);else await signInWithPopup(auth,new GoogleAuthProvider());}catch{note(copy().error);}};
function renderLobby(){const c=copy();$('#gameTitle').textContent=c.lobby;$('#openRoomsTitle').textContent=c.openRooms;$('#ownRoomsTitle').textContent=c.yourRooms;
 $('#gameSignIn').textContent=user?c.signout:c.signin;$('#gameAdultText').textContent=c.adult;$('#gameFormatLabel').textContent=c.format;$('#gameFormat').options[0].textContent=c.single;$('#gameFormat').options[1].textContent=c.series;$('#gameFormat').disabled=busy;$('#gameFormatHint').textContent=format===3?c.seriesHint:'';document.documentElement.lang=language;
 $('#gameCreate').innerHTML=Object.entries(gameTypes).map(([type,g])=>`<button data-create="${type}">${safe(c.createGame)} · ${safe(c.names[type])}</button>`).join('');
 document.querySelectorAll('[data-create]').forEach(b=>{b.disabled=!user||busy||!live;b.onclick=()=>createRoom(b.dataset.create);});
 const visible=rooms.filter(r=>available(r)&&seriesTarget(r)===format);$('#gameRooms').innerHTML=visible.length?visible.map(r=>`<div class="room-row"><span>${safe(r.player1Name)} · ${safe(c.names[baseGameType(r.gameType)])}<small>${safe(seriesTarget(r)===3?c.series:c.single)}</small></span><button data-join="${safe(r.id)}">${safe(c.join)}</button></div>`).join(''):`<p>${safe(user?c.noRooms:c.signin)}</p>`;
 document.querySelectorAll('[data-join]').forEach(b=>{b.disabled=!user||busy||!live;b.onclick=()=>joinRoom(b.dataset.join);});
 $('#ownGameRooms').innerHTML=own.filter(r=>gameTypes[baseGameType(r.gameType)]&&['waiting','playing','invited','finished'].includes(r.status)).sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0)).slice(0,15).map(r=>`<div class="room-row"><span>${safe(c.names[baseGameType(r.gameType)])} · ${safe(c.statuses[r.status])}<small>${safe(seriesTarget(r)===3?c.series:c.single)}${seriesTarget(r)===3?` · ${r.wins1} : ${r.wins2}`:''}</small></span><button data-open="${safe(r.id)}">${safe(c.open)}</button></div>`).join('');
 document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openRoom(b.dataset.open));
}
async function createRoom(type){if(!adult())return note(copy().adultRequired);if(busy||!live||!gameTypes[type])return;const existing=own.find(r=>r.gameType===wireGameType(type,format)&&r.status==='waiting'&&seriesTarget(r)===format);if(existing)return openRoom(existing.id);busy=true;renderLobby();
 try{const ref=await addDoc(collection(db,'arcadeRooms'),{gameType:wireGameType(type,format),mode:'random',status:'waiting',player1Id:user.uid,player1Name:(user.displayName||'Kindred member').slice(0,80),player2Id:'',player2Name:'',participants:[user.uid],connectionId:'',state:initialPosition(type),rematchRequestedBy:'',round:1,...seriesFields(format),createdAt:serverTimestamp(),updatedAt:serverTimestamp(),heartbeatAt:serverTimestamp()});openRoom(ref.id);}catch{note(copy().error);}finally{busy=false;renderLobby();}
}
async function joinRoom(id){if(!adult())return note(copy().adultRequired);if(busy||!live)return;busy=true;renderLobby();
 try{const ref=doc(db,'arcadeRooms',id);await runTransaction(db,async tx=>{const snap=await tx.get(ref),r=snap.data();if(!r||!available(r))throw Error('unavailable');tx.update(ref,{player2Id:user.uid,player2Name:(user.displayName||'Kindred member').slice(0,80),participants:[r.player1Id,user.uid],status:'playing',updatedAt:serverTimestamp()});});openRoom(id);}catch{note(copy().loadError);}finally{busy=false;renderLobby();}
}
function openRoom(id){stopRoom();clearInterval(heartbeat);roomId=id;currentRoom=null;roomLive=false;selectedChecker=-1;positionKey='';note('');$('#gameLobby').hidden=true;$('#gameRoom').hidden=false;history.replaceState(null,'',`arcade.html?room=${encodeURIComponent(id)}`);
 stopRoom=onSnapshot(doc(db,'arcadeRooms',id),{includeMetadataChanges:true},snap=>{if(!snap.exists())return closeRoom();roomLive=!snap.metadata.fromCache;currentRoom={id:snap.id,...snap.data()};renderRoom(currentRoom);},()=>{note(copy().loadError);closeRoom();});
 heartbeat=setInterval(()=>{if(currentRoom?.status==='waiting'&&currentRoom.player1Id===user?.uid&&!document.hidden)void updateDoc(doc(db,'arcadeRooms',id),{heartbeatAt:serverTimestamp()}).catch(()=>{});},25000);
}
function closeRoom(){stopRoom();stopRoom=()=>{};clearInterval(heartbeat);roomId='';currentRoom=null;$('#gameLobby').hidden=false;$('#gameRoom').hidden=true;history.replaceState(null,'','arcade.html');renderLobby();}
function renderRoom(r){
 const c=copy(),p=r.state,type=baseGameType(r.gameType),me=r.player1Id===user?.uid?1:r.player2Id===user?.uid?2:0,host=$('#gameRoom');if(!gameTypes[baseGameType(r.gameType)]||!me)return closeRoom();
 const myTurn=r.status==='playing'&&p.turn===me&&!p.winner,canMove=myTurn&&roomLive&&!busy,key=`${r.id}:${r.round}:${p.moveCount}:${p.turn}`;
 if(key!==positionKey){selectedChecker=p.forcedFrom??-1;positionKey=key;}
 const result=p.winner===3?c.draw:p.winner===me?c.won:c.lost;
 const stateText=r.status==='finished'?result:r.status==='playing'?(myTurn?c.turn:c.theirTurn):c.statuses[r.status];
 const series=seriesTarget(r)===3,champion=seriesWinner(r),legal=type==='checkers'?checkersMoves(p):[];
 const hint=myTurn&&type==='checkers'?(p.forcedFrom>=0?c.chain:legal.some(m=>m.captured>=0)?c.capture:c.selectPiece):'';
 const proposed=r.rematchRequestedBy,readyLabel=proposed===user.uid?c.waitingReady:proposed?(series?c.ready:c.acceptRematch):series?(champion?c.newSeries:c.nextRound):c.rematch;
 host.innerHTML=`<div class="game-room-heading"><h2>${safe(c.names[baseGameType(r.gameType)])}</h2><span>${safe(c.round)} ${series?r.seriesRound:r.round} · ${safe(series?c.series:c.single)}</span></div>
  <div class="game-players"><span class="player-one">${safe(r.player1Name)}${me===1?` · ${safe(c.you)}`:''}</span><span class="player-two">${safe(r.player2Name||'…')}${me===2?` · ${safe(c.you)}`:''}</span></div>
  ${series?`<p class="series-score">${safe(c.score)} <strong>${r.wins1} : ${r.wins2}</strong></p>`:''}
  ${champion?`<p class="series-champion" role="status">${safe(champion===me?c.seriesWon:c.seriesLost)}</p>`:''}
  <p class="game-turn" aria-live="polite">${safe(stateText)}</p>${!roomLive?`<p class="tool-note">${safe(c.offline)}</p>`:''}${hint?`<p class="checker-hint">${safe(hint)}</p>`:''}
  ${boardView(r.gameType,p,{me,enabled:canMove,selected:selectedChecker,copy:c})}
  ${type==='memory'?`<p class="pairs-score">${p.score1} : ${p.score2}</p>`:''}
  <div class="tool-actions">${myTurn&&type==='memory'&&p.firstCard>=0&&p.secondCard>=0?`<button data-next${!canMove?' disabled':''}>${safe(c.next)}</button>`:''}
   ${r.status==='invited'&&me===2?`<button data-accept${busy||!roomLive?' disabled':''}>${safe(c.accept)}</button><button data-decline${busy||!roomLive?' disabled':''}>${safe(c.decline)}</button>`:''}
   ${r.status==='finished'?`<button class="primary" data-ready${busy||!roomLive||proposed===user.uid?' disabled':''}>${safe(readyLabel)}</button>`:''}
   <button data-back>${safe(c.back)}</button>
   ${['waiting','playing'].includes(r.status)||r.status==='invited'&&me===1?`<button data-leave${busy||!roomLive?' disabled':''}>${safe(r.status==='playing'?c.resign:c.cancel)}</button>`:''}</div>
  <details class="game-rules"><summary>${safe(c.rules)}</summary><p>${safe(c.gameRules[type])}</p>${series?`<p>${safe(c.seriesHint)}</p>`:''}</details>`;
 host.querySelectorAll('[data-cell]').forEach(b=>b.onclick=()=>{
  const cell=Number(b.dataset.cell);
  if(type==='checkers'){
   const destination=legal.find(m=>m.from===selectedChecker&&m.to===cell);
   if(destination)void act('move',destination.from*64+destination.to);
   else if(legal.some(m=>m.from===cell)){selectedChecker=cell;renderRoom(r);}
  }else void act('move',type==='connect_four'?cell%7:cell);
 });
 host.querySelector('[data-next]')?.addEventListener('click',()=>act('next'));
 host.querySelector('[data-ready]')?.addEventListener('click',()=>act('ready'));
 host.querySelector('[data-accept]')?.addEventListener('click',()=>act('accept'));
 host.querySelector('[data-decline]')?.addEventListener('click',()=>act('decline'));
 host.querySelector('[data-back]').onclick=closeRoom;
 host.querySelector('[data-leave]')?.addEventListener('click',()=>{if(r.status!=='playing'||confirm(c.resignConfirm))void act('leave');});
}
async function act(action,selection){
 if(busy||!user||!currentRoom||!roomLive)return;const activeId=roomId,uid=user.uid;busy=true;renderRoom(currentRoom);
 try{const ref=doc(db,'arcadeRooms',activeId);await runTransaction(db,async tx=>{
  const snap=await tx.get(ref),r=snap.data();if(!r)throw Error('unavailable');
  const me=r.player1Id===uid?1:r.player2Id===uid?2:0;if(!me)throw Error('participant');
  const updates={updatedAt:serverTimestamp()};
  if(action==='ready'){
   if(r.status!=='finished'||r.rematchRequestedBy===uid)throw Error('status');
   if(r.rematchRequestedBy)Object.assign(updates,nextRound(r));else updates.rematchRequestedBy=uid;
  }else if(action==='accept'||action==='decline'){
   if(r.status!=='invited'||me!==2)throw Error('status');updates.status=action==='accept'?'playing':'declined';
  }else if(action==='leave'){
   if(['waiting','invited'].includes(r.status)&&me===1)updates.status='cancelled';
   else if(r.status==='playing'){updates.state={...r.state,winner:3-me};updates.status='finished';Object.assign(updates,roundScore(r,3-me));}
   else throw Error('status');
  }else{
   if(r.status!=='playing'||r.state.turn!==me)throw Error('turn');
   updates.state=action==='next'?finishReveal(r.state):move(r.gameType,r.state,selection);
   if(updates.state.winner)updates.status='finished';Object.assign(updates,roundScore(r,updates.state.winner));
   if(baseGameType(r.gameType)==='checkers')for(const proof of checkersProofWrites(r.round,r.state,updates.state))tx.set(doc(db,'arcadeRooms',activeId,'checkersProofs',proof.id),proof.data);
  }tx.update(ref,updates);
 });if(['leave','decline'].includes(action)&&roomId===activeId)closeRoom();
 }catch{note(copy().error);}finally{busy=false;if(currentRoom)renderRoom(currentRoom);}
}
onAuthStateChanged(auth,async u=>{unsubs.forEach(fn=>fn());unsubs=[];closeRoom();user=u;rooms=[];own=[];live=false;$('#gameSignIn').textContent=u?copy().signout:copy().signin;$('#gameAdultConfirmed').checked=false;clearInterval(clock);if(!u){renderLobby();return;}
 try{const p=await getDoc(doc(db,'profiles',u.uid));if(auth.currentUser?.uid!==u.uid)return;$('#gameAdultConfirmed').checked=p.data()?.adultConfirmed===true;}catch{}
 if(auth.currentUser?.uid!==u.uid)return;
 unsubs.push(onSnapshot(query(collection(db,'arcadeRooms'),where('mode','==','random'),where('status','==','waiting'),limit(40)),{includeMetadataChanges:true},s=>{live=!s.metadata.fromCache;rooms=s.docs.map(d=>({id:d.id,...d.data()}));renderLobby();},()=>note(copy().loadError)));
 unsubs.push(onSnapshot(query(collection(db,'arcadeRooms'),where('participants','array-contains',u.uid),limit(50)),s=>{own=s.docs.map(d=>({id:d.id,...d.data()}));renderLobby();},()=>note(copy().loadError)));
 clock=setInterval(renderLobby,15000);const id=pendingRoomId;pendingRoomId='';if(id&&/^[A-Za-z0-9_-]{1,128}$/.test(id))openRoom(id);
});
stopSettings=mountNotificationSettings($('#gameNotifications'),language);renderLobby();
window.addEventListener('pagehide',()=>{clearInterval(clock);clearInterval(heartbeat);stopRoom();unsubs.forEach(fn=>fn());stopSettings();});
