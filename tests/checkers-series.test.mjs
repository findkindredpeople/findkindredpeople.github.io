import test from 'node:test';
import assert from 'node:assert/strict';
import {initialPosition,move} from '../arcade-logic.mjs';
import {checkersMoves} from '../checkers-logic.mjs';
import {seriesFields,roundScore,nextRound,seriesWinner} from '../arcade-series.mjs';

const position=(board,extra={})=>({...initialPosition('checkers'),board,...extra});
test('checkers starts with twelve pieces on dark squares per player and seven opening moves',()=>{
  const p=initialPosition('checkers');
  assert.equal(p.tokens1.length,12);assert.equal(p.tokens2.length,12);
  assert.ok(Object.keys(p.board).every(i=>(Math.floor(i/8)+i%8)%2===1));
  assert.equal(checkersMoves(p).length,7);
  assert.equal(move('checkers',p,40*64+33).turn,2);
});
test('a capture anywhere on the board takes priority over an ordinary move',()=>{
  const p=position({42:1,44:1,33:2,15:2});
  assert.deepEqual(checkersMoves(p),[{from:42,to:24,captured:33}]);
  assert.throws(()=>move('checkers',p,44*64+35));
  assert.equal(move('checkers',p,42*64+24).board[33],undefined);
});
test('a capture chain holds the same turn and forces the same piece',()=>{
  let p=position({42:1,44:1,33:2,17:2,55:2});
  p=move('checkers',p,42*64+24);assert.equal(p.turn,1);assert.equal(p.forcedFrom,24);
  assert.throws(()=>move('checkers',p,44*64+35));
  p=move('checkers',p,24*64+10);assert.equal(p.turn,2);assert.equal(p.forcedFrom,-1);
  assert.equal(Object.values(p.board).filter(v=>v===2).length,1);
});
test('promotion crowns the piece and ends the capture sequence',()=>{
  const p=move('checkers',position({17:1,10:2,12:2}),17*64+3);
  assert.deepEqual(p.kings,[3]);assert.equal(p.turn,2);assert.equal(p.forcedFrom,-1);
});
test('men cannot move backwards; kings move one square in either direction',()=>{
  const p=position({26:1,1:2});assert.throws(()=>move('checkers',p,26*64+35));
  const king={...p,kings:[26]};assert.equal(move('checkers',king,26*64+35).board[35],1);
  assert.throws(()=>move('checkers',king,26*64+44));
  assert.throws(()=>move('checkers',king,-1));
});
test('removing the last opposing piece or blocking every move wins the round',()=>{
  assert.equal(move('checkers',position({42:1,33:2}),42*64+24).winner,1);
  assert.equal(move('checkers',position({1:2,8:1,10:1,19:1,40:1}),40*64+33).winner,1);
});
test('eighty quiet king moves draw; a man move resets the no-progress counter',()=>{
  const p=position({42:1,1:2},{kings:[42,1],quietMoves:79});
  assert.equal(move('checkers',p,42*64+33).winner,3);
  assert.equal(move('checkers',{...p,kings:[1]},42*64+33).quietMoves,0);
});
test('two hundred deterministic legal moves remain coherent without changing the source position',()=>{
  let p=initialPosition('checkers'),seed=7;
  for(let i=0;i<200&&!p.winner;i++){
    const all=checkersMoves(p);assert.ok(all.length);const before=p,original=structuredClone(p);
    seed=(seed*1664525+1013904223)>>>0;const chosen=all[seed%all.length];
    p=move('checkers',p,chosen.from*64+chosen.to);assert.deepEqual(before,original);
    assert.equal(new Set(p.kings).size,p.kings.length);assert.ok(p.kings.every(k=>p.board[k]));
    assert.equal(Object.keys(p.board).length,p.tokens1.length+p.tokens2.length);
  }
});
test('series awards one point to a round winner and no points for draws',()=>{
  const room={...seriesFields(3)};
  assert.deepEqual(roundScore(room,0),{wins1:0,wins2:0});
  assert.deepEqual(roundScore(room,3),{wins1:0,wins2:0});
  assert.deepEqual(roundScore(room,2),{wins1:0,wins2:1});
  assert.equal(seriesWinner({...room,wins1:3}),1);
  assert.throws(()=>roundScore({...room,wins1:3},1));
});
test('next rounds preserve the score, alternate the starter and reset only after the series finishes',()=>{
  const room={gameType:'tic_tac_toe',...seriesFields(3),wins1:2,wins2:1,seriesRound:4,round:4,status:'finished',state:{winner:1}};
  const next=nextRound(room);assert.equal(next.wins1,2);assert.equal(next.seriesRound,5);assert.equal(next.state.turn,1);
  const even=nextRound({...room,round:3});assert.equal(even.state.turn,2);
  const reset=nextRound({...room,wins1:3});assert.equal(reset.wins1,0);assert.equal(reset.wins2,0);assert.equal(reset.seriesRound,1);
  assert.throws(()=>nextRound({...room,status:'playing'}));
});
