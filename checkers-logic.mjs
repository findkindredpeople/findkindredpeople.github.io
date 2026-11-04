// English draughts, 8×8: short kings, compulsory forward captures for men.
// A capture sequence is committed one jump at a time; forcedFrom keeps the turn.
const directions = [[-1,-1],[-1,1],[1,-1],[1,1]];
export function initialCheckers() {
  const board = {};
  for (let cell=0; cell<64; cell++) {
    const row=Math.floor(cell/8), column=cell%8;
    if ((row+column)%2===1 && (row<3 || row>4)) board[cell]=row<3?2:1;
  }
  return {board,kings:[],forcedFrom:-1,quietMoves:0,lastFrom:-1,lastCaptured:-1};
}
function pieceMoves(position, from, capturesOnly=false) {
  const {board,turn}=position, row=Math.floor(from/8), column=from%8, king=position.kings.includes(from);
  if (board[from]!==turn) return [];
  const moves=[];
  for (const [dr,dc] of directions) {
    if (!king && dr!==(turn===1?-1:1)) continue;
    const r=row+dr,c=column+dc;
    if (r<0 || r>7 || c<0 || c>7) continue;
    const adjacent=r*8+c;
    if (board[adjacent]===undefined && !capturesOnly) moves.push({from,to:adjacent,captured:-1});
    const r2=row+2*dr,c2=column+2*dc;
    if (board[adjacent]===3-turn && r2>=0 && r2<8 && c2>=0 && c2<8 && board[r2*8+c2]===undefined)
      moves.push({from,to:r2*8+c2,captured:adjacent});
  }
  return moves;
}
export function checkersMoves(position) {
  if (position.winner) return [];
  if (position.forcedFrom>=0) return pieceMoves(position,position.forcedFrom,true);
  const moves=Object.keys(position.board).flatMap(from=>pieceMoves(position,Number(from)));
  const captures=moves.filter(m=>m.captured>=0);
  return captures.length?captures:moves;
}
export function checkersMove(previous, selection) {
  if (!Number.isInteger(selection) || selection<0 || selection>=4096 || previous.winner || ![1,2].includes(previous.turn)) throw Error('Invalid move');
  const from=Math.floor(selection/64),to=selection%64;
  const legal=checkersMoves(previous).find(m=>m.from===from&&m.to===to);
  if (!legal) throw Error('Illegal checkers move');
  const p=structuredClone(previous), player=p.turn, wasKing=p.kings.includes(from);
  delete p.board[from];
  if (legal.captured>=0) delete p.board[legal.captured];
  p.board[to]=player;
  const promoted=!wasKing && (player===1?to<8:to>=56);
  p.kings=p.kings.filter(i=>i!==from&&i!==legal.captured);
  if (wasKing||promoted) p.kings.push(to);
  p.kings.sort((a,b)=>a-b);
  p.lastFrom=from;p.lastCaptured=legal.captured;p.lastMove=to;p.moveCount++;
  p.quietMoves=wasKing&&legal.captured<0?p.quietMoves+1:0;
  const chain=legal.captured>=0&&!promoted&&pieceMoves(p,to,true).length>0;
  p.forcedFrom=chain?to:-1;
  if (!chain) {
    const opponent={...p,turn:3-player};
    p.winner=checkersMoves(opponent).length===0?player:p.quietMoves>=80?3:0;
    if (!p.winner) p.turn=3-player;
  }
  p.tokens1=Object.keys(p.board).filter(i=>p.board[i]===1).map(Number).sort((a,b)=>a-b);
  p.tokens2=Object.keys(p.board).filter(i=>p.board[i]===2).map(Number).sort((a,b)=>a-b);
  return p;
}
export function checkersProofWrites(round,before,after) {
  if(after.moveCount!==before.moveCount+1)return [];
  const proofs=[{id:'m',data:{group:-1,stamp:`${round}:${after.moveCount}`}}];
  if(after.lastCaptured<0){
    const count=Object.values(before.board).filter(value=>value===before.turn).length;
    for(let group=0;group<Math.ceil(count/3);group++)proofs.push({id:'c'+group,data:{group,stamp:`${round}:${before.moveCount}`}});
  }
  if(after.winner===before.turn){
    const count=Object.values(after.board).filter(value=>value===3-before.turn).length;
    for(let group=0;group<Math.ceil(count/3);group++)proofs.push({id:'b'+group,data:{group,stamp:`${round}:${after.moveCount}`}});
  }
  return proofs;
}
