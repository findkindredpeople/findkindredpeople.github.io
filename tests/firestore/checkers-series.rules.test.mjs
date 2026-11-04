import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,serverTimestamp,Timestamp} from 'firebase/firestore';
import {initialPosition,move as gameMove} from '../../arcade-logic.mjs';
import {checkersMoves} from '../../checkers-logic.mjs';
import {seriesFields,roundScore,nextRound} from '../../arcade-series.mjs';
let env;
const db=uid=>env.authenticatedContext(uid).firestore(),ref=uid=>doc(db(uid),'arcadeRooms','game');
const data=(gameType='checkers',extra={})=>({gameType,mode:'random',status:'playing',player1Id:'alice',player1Name:'Alice',player2Id:'bob',player2Name:'Bob',participants:['alice','bob'],connectionId:'',state:initialPosition(gameType),rematchRequestedBy:'',round:1,createdAt:Timestamp.now(),updatedAt:Timestamp.now(),heartbeatAt:Timestamp.now(),...extra});
const tokens=p=>({...p,tokens1:Object.keys(p.board).filter(k=>p.board[k]===1).map(Number).sort((a,b)=>a-b),tokens2:Object.keys(p.board).filter(k=>p.board[k]===2).map(Number).sort((a,b)=>a-b)});
const checkers=(board,extra={})=>tokens({...initialPosition('checkers'),board,...extra});
async function seed(room){await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'arcadeRooms','game'),room));return room;}
const save=(uid,state,extra={})=>updateDoc(ref(uid),{state,status:state.winner?'finished':'playing',updatedAt:serverTimestamp(),...extra});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-kindred-arcade',firestore:{host:'127.0.0.1',port:8088,rules:await readFile(new URL('../../firestore.rules',import.meta.url),'utf8')}});});
after(async()=>{if(env)await env.cleanup();});beforeEach(async()=>env.clearFirestore());

test('checkers creation requires the exact initial position and an empty score',async()=>{
  const r={...data('checkers',{status:'waiting',player2Id:'',player2Name:'',participants:['alice']}),...seriesFields(3),createdAt:serverTimestamp(),updatedAt:serverTimestamp(),heartbeatAt:serverTimestamp()};
  await assertSucceeds(setDoc(ref('alice'),r));
  await assertFails(setDoc(ref('alice'),{...r,state:{...r.state,kings:[40]}}));
  await assertFails(setDoc(ref('alice'),{...r,wins1:1}));
});
test('ordinary checkers moves are validated and cannot forge a result, king or second piece',async()=>{
  const r=await seed(data());const next=gameMove('checkers',r.state,40*64+33);
  await assertFails(save('bob',next));
  await assertFails(save('alice',{...next,kings:[33]}));
  await assertFails(save('alice',{...next,winner:1,turn:1}));
  await assertFails(save('alice',{...next,board:{...next.board,35:1}}));
  await assertSucceeds(save('alice',next));
});
test('mandatory captures and consecutive jumps cannot be skipped or reassigned',async()=>{
  const p=checkers({42:1,44:1,33:2,17:2,55:2});await seed(data('checkers',{state:p}));
  const quiet=tokens({...p,board:{...p.board,35:1},lastFrom:44,lastMove:35,lastCaptured:-1,turn:2,moveCount:1});delete quiet.board[44];
  quiet.tokens1=Object.keys(quiet.board).filter(k=>quiet.board[k]===1).map(Number);
  await assertFails(save('alice',quiet));
  const first=gameMove('checkers',p,42*64+24);
  await assertFails(save('alice',{...first,forcedFrom:-1,turn:2}));await assertSucceeds(save('alice',first));
  await assertFails(save('bob',gameMove('checkers',first,24*64+10)));
  await assertSucceeds(save('alice',gameMove('checkers',first,24*64+10)));
});
test('promotion ends the turn and a king can subsequently move backwards',async()=>{
  let p=checkers({17:1,10:2,12:2});await seed(data('checkers',{state:p}));
  p=gameMove('checkers',p,17*64+3);await assertSucceeds(save('alice',p));
  const king=checkers({26:1,1:2},{kings:[26]});await seed(data('checkers',{state:king}));
  await assertSucceeds(save('alice',gameMove('checkers',king,26*64+35)));
});
test('last capture, blocked opponent and no-progress draw have protected outcomes',async()=>{
  for(const p of [checkers({42:1,33:2}),checkers({1:2,8:1,10:1,19:1,40:1}),checkers({42:1,1:2},{kings:[42,1],quietMoves:79})]){
    await seed(data('checkers',{state:p}));const selection=p.board[40]?40*64+33:p.board[33]?42*64+24:42*64+33;
    const next=gameMove('checkers',p,selection);await assertSucceeds(save('alice',next));
    await assertFails(save('alice',{...next,winner:0}));
  }
});
test('120 real moves use the same shared rules and stay within Firestore evaluation limits',async()=>{
  let p=initialPosition('checkers'),seedValue=17;await seed(data('checkers',{state:p}));
  for(let i=0;i<120&&!p.winner;i++){
    const all=checkersMoves(p);seedValue=(seedValue*1664525+1013904223)>>>0;const selected=all[seedValue%all.length];
    const uid=p.turn===1?'alice':'bob';p=gameMove('checkers',p,selected.from*64+selected.to);
    try{await assertSucceeds(save(uid,p));}catch(error){throw new Error(`Checkers move ${i}: ${selected.from} → ${selected.to}`,{cause:error});}
  }
});
test('a series winner earns exactly one point; a point cannot be added during a normal move',async()=>{
  const p={...initialPosition('tic_tac_toe'),board:{0:1,1:1,3:2,4:2},tokens1:[0,1],tokens2:[3,4],moveCount:4};
  const room=await seed(data('tic_tac_toe',{state:p,...seriesFields(3)}));const next=gameMove('tic_tac_toe',p,2);
  await assertFails(save('alice',next));await assertFails(save('alice',next,{wins1:3,wins2:0}));
  await assertSucceeds(save('alice',next,roundScore(room,next.winner)));
  await assertFails(save('alice',next,{wins1:2,wins2:0}));
});
test('next round needs both players, keeps series score and alternates the first move',async()=>{
  const room=await seed(data('tic_tac_toe',{status:'finished',state:{...initialPosition('tic_tac_toe'),winner:1},...seriesFields(3),wins1:1}));
  await assertSucceeds(updateDoc(ref('alice'),{rematchRequestedBy:'alice',updatedAt:serverTimestamp()}));
  const next={...nextRound(room),updatedAt:serverTimestamp()};
  await assertFails(updateDoc(ref('alice'),next));
  await assertFails(updateDoc(ref('bob'),{...next,wins1:0}));
  await assertFails(updateDoc(ref('bob'),{...next,state:initialPosition('tic_tac_toe')}));
  await assertSucceeds(updateDoc(ref('bob'),next));
  assert.equal((await getDoc(ref('alice'))).data().state.turn,2);
});
test('a completed series can reset only with mutual agreement',async()=>{
  const room=await seed(data('memory',{status:'finished',state:{...initialPosition('memory'),winner:2},...seriesFields(3),wins1:1,wins2:3,seriesRound:4,round:4,rematchRequestedBy:'alice'}));
  const next={...nextRound(room),updatedAt:serverTimestamp()};
  await assertFails(updateDoc(ref('alice'),next));
  await assertFails(updateDoc(ref('bob'),{...next,wins2:3}));
  await assertSucceeds(updateDoc(ref('bob'),next));
});
test('resigning concedes one series point; identities and the match format stay frozen',async()=>{
  const room=await seed(data('checkers',seriesFields(3))),next={...room.state,winner:2};
  await assertFails(save('alice',next,{wins1:0,wins2:1,seriesTarget:1}));
  await assertSucceeds(save('alice',next,roundScore(room,2)));
  await assertFails(updateDoc(ref('bob'),{wins2:3,updatedAt:serverTimestamp()}));
});
