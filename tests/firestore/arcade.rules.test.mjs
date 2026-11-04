import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, limit,
  serverTimestamp, Timestamp, onSnapshot, runTransaction } from 'firebase/firestore';

let env;
const initial = type => ({board:{}, tokens1:[],tokens2:[],deck:type==='memory'?[0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7]:[], matched:[],
  firstCard:-1,secondCard:-1,score1:0,score2:0,turn:1,winner:0,lastMove:-1,moveCount:0});
function room(type='tic_tac_toe', extra={}) {
  return {gameType:type, mode:'random', status:'waiting',player1Id:'alice',player1Name:'Alice',
    player2Id:'',player2Name:'',participants:['alice'],connectionId:'',state:initial(type),
    rematchRequestedBy:'',round:1,createdAt:Timestamp.now(),updatedAt:Timestamp.now(),heartbeatAt:Timestamp.now(),...extra};
}
const db = uid => uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();
const ref = (uid,id='room') => doc(db(uid),'arcadeRooms',id);
async function seed(id,data) { await env.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(),'arcadeRooms',id),data)); }
async function playing(type='tic_tac_toe', state=initial(type), extra={}) {
  state={...state,tokens1:Object.keys(state.board).filter(k=>state.board[k]===1).map(Number).sort((a,b)=>a-b),tokens2:Object.keys(state.board).filter(k=>state.board[k]===2).map(Number).sort((a,b)=>a-b)};
  const data=room(type,{status:'playing',player2Id:'bob',player2Name:'Bob',participants:['alice','bob'],state,...extra});
  await seed('room',data);return data;
}
const advance = (state,cell, winner=0) => {
  const board={...state.board,[cell]:state.turn};
  return {...state,board,tokens1:Object.keys(board).filter(k=>board[k]===1).map(Number).sort((a,b)=>a-b),tokens2:Object.keys(board).filter(k=>board[k]===2).map(Number).sort((a,b)=>a-b),lastMove:cell,
    moveCount:state.moveCount+1,turn:winner?state.turn:3-state.turn,winner};
};
const move = (uid,state) => updateDoc(ref(uid),{state,status:state.winner?'finished':'playing',updatedAt:serverTimestamp()});
const join = uid => updateDoc(ref(uid),{player2Id:uid,player2Name:uid,participants:['alice',uid],status:'playing',updatedAt:serverTimestamp()});

before(async()=>{
  env=await initializeTestEnvironment({projectId:'demo-kindred-arcade',firestore:{host:'127.0.0.1',port:8088,
    rules:await readFile(new URL('../../firestore.rules',import.meta.url),'utf8')}});
});
after(async()=>{if(env)await env.cleanup();});
beforeEach(async()=>{await env.clearFirestore();});

test('only a signed-in host can create an empty table',async()=>{
  const data={...room(),createdAt:serverTimestamp(),updatedAt:serverTimestamp(),heartbeatAt:serverTimestamp()};
  await assertFails(setDoc(ref(null,'anon'),data));
  await assertFails(setDoc(ref('bob','forged'),data));
  await assertSucceeds(setDoc(ref('alice'),data));
  await assertFails(setDoc(ref('alice','started'),{...data,status:'playing'}));
  await assertFails(setDoc(ref('alice','board'),{...data,state:{...initial('tic_tac_toe'),board:{0:1}}}));
});

test('memory creation requires exactly eight pairs',async()=>{
  const data={...room('memory'),createdAt:serverTimestamp(),updatedAt:serverTimestamp(),heartbeatAt:serverTimestamp()};
  await assertSucceeds(setDoc(ref('alice'),data));
  await assertFails(setDoc(ref('alice','baddeck'),{...data,state:{...data.state,deck:Array(16).fill(0)}}));
});

test('public waiting query is allowed; private games and anonymous access are protected',async()=>{
  await seed('open',room());await playing();
  const open=query(collection(db('cara'),'arcadeRooms'),where('gameType','==','tic_tac_toe'),where('mode','==','random'),where('status','==','waiting'),limit(40));
  assert.equal((await assertSucceeds(getDocs(open))).size,1);
  await assertSucceeds(getDoc(ref('alice')));await assertSucceeds(getDoc(ref('bob')));
  await assertFails(getDoc(ref('cara')));await assertFails(getDocs(collection(db('cara'),'arcadeRooms')));
  await assertFails(getDoc(ref(null,'open')));
  const mine=query(collection(db('alice'),'arcadeRooms'),where('participants','array-contains','alice'),limit(100));
  assert.equal((await assertSucceeds(getDocs(mine))).size,2);
});

test('two guests racing for a seat cannot both join',async()=>{
  await seed('room',room());
  const results=await Promise.allSettled([join('bob'),join('cara')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const saved=(await getDoc(ref('alice'))).data();
  assert.equal(saved.participants.length,2);assert.ok(['bob','cara'].includes(saved.player2Id));
  await assertFails(updateDoc(ref(saved.player2Id),{player1Id:'mallory',updatedAt:serverTimestamp()}));
});

test('expired searches and blocked users cannot be joined',async()=>{
  await seed('room',room('tic_tac_toe',{heartbeatAt:Timestamp.fromMillis(Date.now()-120_000)}));
  await assertFails(join('bob'));
  await seed('room',room());
  await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),'blocks','alice_bob'),{blockerId:'alice',blockedId:'bob'}));
  await assertFails(join('bob'));
});

test('automatic matching can join an older table and cancel its own table atomically',async()=>{
  await seed('room',room());
  await seed('own',room('tic_tac_toe',{player1Id:'bob',player1Name:'Bob',participants:['bob']}));
  const client=db('bob');
  await assertSucceeds(runTransaction(client,async tx=>{
    const target=doc(client,'arcadeRooms','room'),own=doc(client,'arcadeRooms','own');
    await tx.get(target);await tx.get(own);
    tx.update(target,{player2Id:'bob',player2Name:'Bob',participants:['alice','bob'],status:'playing',updatedAt:serverTimestamp()});
    tx.update(own,{status:'cancelled',updatedAt:serverTimestamp()});
  }));
  assert.equal((await getDoc(doc(client,'arcadeRooms','own'))).data().status,'cancelled');
});

test('invitations need an accepted connection and only the invited player can accept',async()=>{
  await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),'connections','alice_bob'),{participants:['alice','bob'],status:'accepted'}));
  const data={...room('tic_tac_toe',{mode:'invite',status:'invited',player2Id:'bob',player2Name:'Bob',participants:['alice','bob'],connectionId:'alice_bob'}),
    createdAt:serverTimestamp(),updatedAt:serverTimestamp(),heartbeatAt:serverTimestamp()};
  await assertSucceeds(setDoc(ref('alice'),data));
  await assertFails(updateDoc(ref('alice'),{status:'playing',updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref('cara'),{status:'playing',updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(ref('bob'),{status:'playing',updatedAt:serverTimestamp()}));
  await assertFails(setDoc(ref('alice','stranger'),{...data,connectionId:'missing'}));
});

test('out-of-turn moves, overwrites, two-cell moves and forged outcomes are denied',async()=>{
  const data=await playing();let next=advance(data.state,0);
  await assertFails(move('bob',next));
  await assertFails(move('alice',{...next,board:{0:1,4:1}}));
  await assertFails(move('alice',{...next,winner:1,turn:1}));
  await assertSucceeds(move('alice',next));
  await assertFails(move('bob',advance(next,0)));
  await assertFails(updateDoc(ref('bob'),{'state.deck':[1,2],updatedAt:serverTimestamp()}));
});

test('two simultaneous moves by one player commit exactly once',async()=>{
  const data=await playing();
  const results=await Promise.allSettled([move('alice',advance(data.state,0)),move('alice',advance(data.state,4))]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(Object.keys((await getDoc(ref('alice'))).data().state.board).length,1);
});

test('a winning tic-tac-toe move finishes the round and prevents further moves',async()=>{
  const state={...initial('tic_tac_toe'),board:{0:1,1:1,3:2,4:2},moveCount:4};await playing('tic_tac_toe',state);
  const next=advance(state,2,1);await assertSucceeds(move('alice',next));
  await assertFails(move('bob',advance(next,8)));
});

test('connect four enforces gravity and all winning directions',async()=>{
  await playing('connect_four');await assertFails(move('alice',advance(initial('connect_four'),0)));
  await assertSucceeds(move('alice',advance(initial('connect_four'),35)));
  for(const columns of [[0,1,0,1,0,1,0],[0,6,1,6,2,5,3],[0,1,1,2,2,3,2,3,3,6,3],[6,5,5,4,4,3,4,3,3,0,3]]){
    let state=initial('connect_four');await playing('connect_four');
    for(let i=0;i<columns.length;i++){
      const col=columns[i];let cell=-1;
      for(let row=5;row>=0;row--)if(!(row*7+col in state.board)){cell=row*7+col;break;}
      state=advance(state,cell,i===columns.length-1?1:0);
      try { await assertSucceeds(move(i%2===0?'alice':'bob',state)); }
      catch (error) { throw new Error(`Connect-four sequence ${columns}: move ${i}, cell ${cell}`,{cause:error}); }
    }
  }
});

test('a dense connect-four draw remains within the rules evaluation budget',async()=>{
  const board={};for(let r=0;r<6;r++)for(let c=0;c<7;c++)board[r*7+c]=(Math.floor(c/2)+r)%2+1;
  delete board[2];const state={...initial('connect_four'),board,turn:2,moveCount:41};await playing('connect_four',state);
  await assertSucceeds(move('bob',advance(state,2,3)));
});

test('memory mismatch is visible to both players until the current player passes',async()=>{
  let state=initial('memory');await playing('memory');
  state={...state,firstCard:0,lastMove:0};await assertSucceeds(move('alice',state));
  await assertFails(move('alice',{...state,secondCard:0,moveCount:1}));
  state={...state,secondCard:2,lastMove:2,moveCount:1};await assertSucceeds(move('alice',state));
  const cleared={...state,firstCard:-1,secondCard:-1,turn:2};
  await assertFails(move('bob',cleared));await assertSucceeds(move('alice',cleared));
  await assertFails(move('alice',{...cleared,firstCard:4,lastMove:4}));
});

test('memory awards the pair correctly and rejects score and deck tampering',async()=>{
  let state={...initial('memory'),firstCard:0,lastMove:0};await playing('memory',state);
  const next={...state,matched:[0,1],firstCard:-1,lastMove:1,score1:1,moveCount:1};
  await assertFails(move('alice',{...next,score1:7}));
  await assertFails(move('alice',{...next,deck:Array(16).fill(0)}));
  await assertSucceeds(move('alice',next));
  await assertFails(move('alice',{...next,firstCard:0,lastMove:0}));
});

test('the last memory pair produces the correct draw',async()=>{
  const state={...initial('memory'),matched:Array.from({length:14},(_,i)=>i),score1:4,score2:3,turn:2,firstCard:14,lastMove:14,moveCount:7};
  await playing('memory',state);
  await assertSucceeds(move('bob',{...state,matched:Array.from({length:16},(_,i)=>i),firstCard:-1,lastMove:15,score2:4,moveCount:8,winner:3}));
});

test('resignation and rematches preserve identities and need both players',async()=>{
  const data=await playing();await assertSucceeds(move('bob',{...data.state,winner:1}));
  await assertSucceeds(updateDoc(ref('alice'),{rematchRequestedBy:'alice',updatedAt:serverTimestamp()}));
  const reset={status:'playing',state:initial('tic_tac_toe'),round:2,rematchRequestedBy:'',updatedAt:serverTimestamp()};
  await assertFails(updateDoc(ref('alice'),reset));
  await assertSucceeds(updateDoc(ref('bob'),reset));
  await assertFails(updateDoc(ref('bob'),{player1Name:'Replaced',updatedAt:serverTimestamp()}));
});

test('chat is private, sender identity is verified and account cleanup can remove shared rooms',async()=>{
  await playing();const message=uid=>doc(db(uid),'arcadeRooms','room','messages','hello');
  const data={senderId:'alice',senderName:'Alice',text:'Good game!',createdAt:serverTimestamp()};
  await assertFails(setDoc(message('bob'),data));await assertSucceeds(setDoc(message('alice'),data));
  await assertSucceeds(getDoc(message('bob')));await assertFails(getDoc(message('cara')));
  await assertFails(deleteDoc(ref('cara')));await assertSucceeds(deleteDoc(message('bob')));await assertSucceeds(deleteDoc(ref('bob')));
});

test('two clients observe the same committed move in real time',async()=>{
  const data=await playing();
  let stop;const observed=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Second client did not receive the move')),6000);
    stop=onSnapshot(ref('bob'),snap=>{if(snap.data()?.state.board['4']===1){clearTimeout(timeout);resolve(snap.data().state);}},reject);
  });
  const next=advance(data.state,4);await assertSucceeds(move('alice',next));
  try{assert.deepEqual(await observed,next);}finally{stop?.();}
});

test('board token metadata cannot be used to forge a win or rewrite identities',async()=>{
  const data=await playing();const next=advance(data.state,4);
  await assertFails(move('alice',{...next,tokens1:[0,1,2,4],winner:1,turn:1}));
  await assertFails(updateDoc(ref('alice'),{state:next,status:'playing',player2Id:'cara',updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref('alice'),{state:next,status:'playing',unexpected:true,updatedAt:serverTimestamp()}));
  await assertSucceeds(move('alice',next));
});

test('a memory rematch accepts a fresh valid shuffle after both players agree',async()=>{
  const state={...initial('memory'),matched:Array.from({length:16},(_,i)=>i),score1:4,score2:4,winner:3,moveCount:8};
  await playing('memory',state,{status:'finished',rematchRequestedBy:'alice'});
  const reset={...initial('memory'),deck:[...initial('memory').deck].reverse()};
  await assertSucceeds(updateDoc(ref('bob'),{status:'playing',state:reset,round:2,rematchRequestedBy:'',updatedAt:serverTimestamp()}));
  await assertSucceeds(move('alice',{...reset,firstCard:0,lastMove:0}));
});

test('blocking prevents acceptance but does not prevent declining an invitation',async()=>{
  await seed('room',room('tic_tac_toe',{mode:'invite',status:'invited',player2Id:'bob',player2Name:'Bob',participants:['alice','bob'],connectionId:'alice_bob'}));
  await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),'blocks','alice_bob'),{blockerId:'alice',blockedId:'bob'}));
  await assertFails(updateDoc(ref('bob'),{status:'playing',updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(ref('bob'),{status:'declined',updatedAt:serverTimestamp()}));
});

test('only the waiting host may refresh an open search',async()=>{
  await seed('room',room());await assertFails(updateDoc(ref('bob'),{heartbeatAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(ref('alice'),{heartbeatAt:serverTimestamp()}));
  await playing();await assertFails(updateDoc(ref('alice'),{heartbeatAt:serverTimestamp()}));
});
