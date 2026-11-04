import{initializeApp}from'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import{getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut}from'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import{getFirestore,collection,doc,addDoc,getDoc,onSnapshot,query,where,limit,runTransaction,serverTimestamp,updateDoc}from'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import{gameTypes,initialPosition,move,finishReveal}from'./arcade-logic.mjs';
import{communityCopy}from'./community-upgrade.mjs';
import{mountNotificationSettings}from'./community-tools.js';
const app=initializeApp({apiKey:'AIzaSyDeuW583lgxl08k-DYDju7jQiZP2jVqUk4',authDomain:'kindred-507209.firebaseapp.com',projectId:'kindred-507209',storageBucket:'kindred-507209.firebasestorage.app',messagingSenderId:'459167088901',appId:'1:459167088901:web:c13b3aeaf9d6e41e9cf76c'}),auth=getAuth(app),db=getFirestore(app),$=s=>document.querySelector(s);
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let user=null,language=localStorage.getItem('kindred_language')||'en',rooms=[],own=[],unsubs=[],stopRoom=()=>{},heartbeat,clock,roomId='',currentRoom,busy=false,live=false,stopSettings=()=>{};
const copy=()=>communityCopy(language),note=t=>{$('#gameStatus').textContent=t;};
const available=r=>r.mode==='random'&&r.status==='waiting'&&r.player1Id!==user?.uid&&Date.now()-(r.heartbeatAt?.toMillis?.()||0)<90000;
const adult=()=>!!user&&$('#gameAdultConfirmed').checked;
$('#gameLanguage').value=['en','ru','de'].includes(language)?language:'en';
language=$('#gameLanguage').value;
$('#gameLanguage').onchange=()=>{language=$('#gameLanguage').value;renderLobby();if(currentRoom)renderRoom(currentRoom);stopSettings();stopSettings=mountNotificationSettings($('#gameNotifications'),language);};
$('#gameSignIn').onclick=async()=>{try{if(user)await signOut(auth);else await signInWithPopup(auth,new GoogleAuthProvider());}catch{note(copy().error);}};
function renderLobby(){const c=copy();$('#gameTitle').textContent=c.lobby;$('#openRoomsTitle').textContent=c.openRooms;$('#ownRoomsTitle').textContent=c.yourRooms;
 $('#gameCreate').innerHTML=Object.entries(gameTypes).map(([type,g])=>`<button data-create="${type}">${safe(c.createGame)} · ${safe(g.name)}</button>`).join('');
 document.querySelectorAll('[data-create]').forEach(b=>{b.disabled=!user||busy;b.onclick=()=>createRoom(b.dataset.create);});
 const visible=rooms.filter(available);$('#gameRooms').innerHTML=visible.length?visible.map(r=>`<div class="room-row"><span>${safe(r.player1Name)} · ${safe(gameTypes[r.gameType]?.name)}</span><button data-join="${safe(r.id)}">${safe(c.join)}</button></div>`).join(''):`<p>${safe(c.noRooms)}</p>`;
 document.querySelectorAll('[data-join]').forEach(b=>{b.disabled=!user||busy||!live;b.onclick=()=>joinRoom(b.dataset.join);});
 $('#ownGameRooms').innerHTML=own.filter(r=>['waiting','playing','invited','finished'].includes(r.status)).sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0)).slice(0,15).map(r=>`<div class="room-row"><span>${safe(gameTypes[r.gameType]?.name)} · ${safe(r.status)}</span><button data-open="${safe(r.id)}">Open</button></div>`).join('');
 document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openRoom(b.dataset.open));
}
async function createRoom(type){if(!adult())return note('Please confirm you are 18 or older.');if(busy||!live)return;const existing=own.find(r=>r.gameType===type&&r.status==='waiting');if(existing)return openRoom(existing.id);busy=true;renderLobby();
 try{const ref=await addDoc(collection(db,'arcadeRooms'),{gameType:type,mode:'random',status:'waiting',player1Id:user.uid,player1Name:(user.displayName||'Kindred member').slice(0,80),player2Id:'',player2Name:'',participants:[user.uid],connectionId:'',state:initialPosition(type),rematchRequestedBy:'',round:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),heartbeatAt:serverTimestamp()});openRoom(ref.id);}catch{note(copy().error);}finally{busy=false;renderLobby();}
}
async function joinRoom(id){if(!adult())return note('Please confirm you are 18 or older.');if(busy||!live)return;busy=true;renderLobby();
 try{const ref=doc(db,'arcadeRooms',id);await runTransaction(db,async tx=>{const snap=await tx.get(ref),r=snap.data();if(!r||!available(r))throw Error('unavailable');tx.update(ref,{player2Id:user.uid,player2Name:(user.displayName||'Kindred member').slice(0,80),participants:[r.player1Id,user.uid],status:'playing',updatedAt:serverTimestamp()});});openRoom(id);}catch{note(copy().loadError);}finally{busy=false;renderLobby();}
}
function openRoom(id){stopRoom();clearInterval(heartbeat);roomId=id;currentRoom=null;$('#gameLobby').hidden=true;$('#gameRoom').hidden=false;history.replaceState(null,'',`arcade.html?room=${encodeURIComponent(id)}`);
 stopRoom=onSnapshot(doc(db,'arcadeRooms',id),snap=>{if(!snap.exists())return closeRoom();currentRoom={id:snap.id,...snap.data()};renderRoom(currentRoom);},()=>{note(copy().loadError);closeRoom();});
 heartbeat=setInterval(()=>{if(currentRoom?.status==='waiting'&&currentRoom.player1Id===user?.uid&&!document.hidden)void updateDoc(doc(db,'arcadeRooms',id),{heartbeatAt:serverTimestamp()}).catch(()=>{});},25000);
}
function closeRoom(){stopRoom();stopRoom=()=>{};clearInterval(heartbeat);roomId='';currentRoom=null;$('#gameLobby').hidden=false;$('#gameRoom').hidden=true;history.replaceState(null,'','arcade.html');renderLobby();}
function renderRoom(r){const c=copy(),p=r.state,me=r.player1Id===user?.uid?1:r.player2Id===user?.uid?2:0,host=$('#gameRoom'),myTurn=r.status==='playing'&&p.turn===me&&!p.winner,g=gameTypes[r.gameType];if(!g||!me)return closeRoom();
 const stateText=r.status==='waiting'?c.openRooms:r.status==='finished'?`${c.finished} · ${p.winner===3?'Draw':p.winner===me?'You won':'Other player won'}`:myTurn?c.turn:c.theirTurn;
 host.innerHTML=`<h2>${safe(g.name)}</h2><p>${safe(r.player1Name)} · ${safe(r.player2Name||'…')}</p><strong>${safe(stateText)}</strong><div class="arcade-board" style="grid-template-columns:repeat(${g.columns},1fr)">${Array.from({length:g.rows*g.columns},(_,i)=>{const token=p.board[i],shown=r.gameType==='memory'&&(p.matched.includes(i)||p.firstCard===i||p.secondCard===i);return `<button type="button" data-cell="${i}" class="${token?'p'+token:''}"${!myTurn||busy||r.gameType!=='memory'&&token||r.gameType==='memory'&&(p.matched.includes(i)||p.firstCard===i||p.secondCard>=0)?' disabled':''} aria-label="Cell ${i+1}">${r.gameType==='memory'?(shown?['☀','☾','★','☂','♣','♠','♥','♦'][p.deck[i]]:'?'):token?(r.gameType==='tic_tac_toe'?(token===1?'✕':'○'):'●'):'·'}</button>`;}).join('')}</div>${r.gameType==='memory'?`<p>${p.score1} : ${p.score2}</p>`:''}<div class="tool-actions">${myTurn&&p.firstCard>=0&&p.secondCard>=0?`<button data-next>${safe(c.next)}</button>`:''}<button data-back>${safe(c.back)}</button>${['waiting','playing'].includes(r.status)?`<button data-leave>${safe(c.leave)}</button>`:''}</div>`;
 host.querySelectorAll('[data-cell]').forEach(b=>b.onclick=()=>act('move',r.gameType==='connect_four'?Number(b.dataset.cell)%7:Number(b.dataset.cell)));
 host.querySelector('[data-next]')?.addEventListener('click',()=>act('next'));
 host.querySelector('[data-back]').onclick=closeRoom;host.querySelector('[data-leave]')?.addEventListener('click',()=>act('leave'));
}
async function act(action,selection){if(busy||!user)return;busy=true;renderRoom(currentRoom);try{const ref=doc(db,'arcadeRooms',roomId);await runTransaction(db,async tx=>{const snap=await tx.get(ref),r=snap.data(),me=r.player1Id===user.uid?1:r.player2Id===user.uid?2:0;if(!me)throw Error('participant');let updates={updatedAt:serverTimestamp()};if(action==='leave'){if(r.status==='waiting'&&me===1)updates.status='cancelled';else if(r.status==='playing'){updates.state={...r.state,winner:3-me};updates.status='finished';}else throw Error('status');}else{if(r.status!=='playing'||r.state.turn!==me)throw Error('turn');updates.state=action==='next'?finishReveal(r.state):move(r.gameType,r.state,selection);if(updates.state.winner)updates.status='finished';}tx.update(ref,updates);});if(action==='leave')closeRoom();}catch{note(copy().error);}finally{busy=false;if(currentRoom)renderRoom(currentRoom);}}
onAuthStateChanged(auth,async u=>{unsubs.forEach(fn=>fn());unsubs=[];closeRoom();user=u;rooms=[];own=[];live=false;$('#gameSignIn').textContent=u?'Sign out':'Sign in with Google';$('#gameAdultConfirmed').checked=false;clearInterval(clock);if(!u){renderLobby();return;}
 try{const p=await getDoc(doc(db,'profiles',u.uid));if(auth.currentUser?.uid!==u.uid)return;$('#gameAdultConfirmed').checked=p.data()?.adultConfirmed===true;}catch{}
 unsubs.push(onSnapshot(query(collection(db,'arcadeRooms'),where('mode','==','random'),where('status','==','waiting'),limit(40)),{includeMetadataChanges:true},s=>{live=!s.metadata.fromCache;rooms=s.docs.map(d=>({id:d.id,...d.data()}));renderLobby();},()=>note(copy().loadError)));
 unsubs.push(onSnapshot(query(collection(db,'arcadeRooms'),where('participants','array-contains',u.uid),limit(50)),s=>{own=s.docs.map(d=>({id:d.id,...d.data()}));renderLobby();},()=>note(copy().loadError)));
 clock=setInterval(renderLobby,15000);const id=new URL(location.href).searchParams.get('room');if(id&&/^[A-Za-z0-9_-]{1,128}$/.test(id))openRoom(id);
});
stopSettings=mountNotificationSettings($('#gameNotifications'),language);renderLobby();
window.addEventListener('pagehide',()=>{clearInterval(clock);clearInterval(heartbeat);stopRoom();unsubs.forEach(fn=>fn());stopSettings();});
