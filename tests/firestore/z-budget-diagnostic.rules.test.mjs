import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,Timestamp,serverTimestamp} from 'firebase/firestore';
import {initialPosition,move} from '../../arcade-logic.mjs';

test('diagnose evaluation cost of checkers validation components',async()=>{
 const original=await readFile(new URL('../../firestore.rules',import.meta.url),'utf8');
 const opening=initialPosition('checkers');
 const lone={...opening,board:{42:1,1:2},tokens1:[42],tokens2:[1]};
 const last={...opening,board:{42:1,33:2},tokens1:[42],tokens2:[33]};
 const expressions={geometry:'checkersGeometry(o.state,n.state)',board:'checkersBoardUpdate(o.state,n.state)',metadata:'checkersMetadata(o.state,n.state)',outcome:'checkersOutcome(o,n)',
  boardMetadata:'checkersBoardUpdate(o.state,n.state) && checkersMetadata(o.state,n.state)',
  exceptGeometry:'checkersBoardUpdate(o.state,n.state) && checkersMetadata(o.state,n.state) && checkersOutcome(o,n)',
  exceptOutcome:'checkersGeometry(o.state,n.state) && checkersBoardUpdate(o.state,n.state) && checkersMetadata(o.state,n.state)'};
 for(const [name,expression] of Object.entries(expressions)){
  const rules=original.replace(/function checkersMove\(o,n\) \{[\s\S]*?\n    \}/,`function checkersMove(o,n) { return ${expression};\n    }`);
  const env=await initializeTestEnvironment({projectId:'demo-kindred-arcade',firestore:{host:'127.0.0.1',port:8088,rules}});
  for(const [scenario,state,selection] of [['opening',opening,40*64+33],['lone',lone,42*64+35],['last',last,42*64+24]]){
   const room={gameType:'checkers',mode:'random',status:'playing',player1Id:'alice',player1Name:'Alice',player2Id:'bob',player2Name:'Bob',participants:['alice','bob'],connectionId:'',state,rematchRequestedBy:'',round:1,createdAt:Timestamp.now(),updatedAt:Timestamp.now(),heartbeatAt:Timestamp.now()};
   await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'arcadeRooms','diagnostic'),room));
   const next=move('checkers',state,selection);
   try{await updateDoc(doc(env.authenticatedContext('alice').firestore(),'arcadeRooms','diagnostic'),{state:next,status:next.winner?'finished':'playing',updatedAt:serverTimestamp()});console.log('BUDGET_DIAGNOSTIC',name,scenario,'PASS');}
   catch(error){console.log('BUDGET_DIAGNOSTIC',name,scenario,'FAIL',error.message.slice(0,180));}
  }
  if(name==='geometry'){
   const report=await (await fetch('http://127.0.0.1:8088/emulator/v1/projects/demo-kindred-arcade:ruleCoverage')).json();
   console.log('COVERAGE_DIAGNOSTIC',JSON.stringify(report).slice(0,4500));
  }
  await env.cleanup();
 }
});
