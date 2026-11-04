import {initialCheckers,checkersMove} from './checkers-logic.mjs';
export const gameTypes={tic_tac_toe:{rows:3,columns:3,name:'Tic-tac-toe'},connect_four:{rows:6,columns:7,name:'Connect Four'},memory:{rows:4,columns:4,name:'Memory'},checkers:{rows:8,columns:8,name:'Checkers 8×8'}};
export function initialPosition(type,random=Math.random,starter=1){
 if(!gameTypes[type]||![1,2].includes(starter))throw Error('Invalid game');
 const deck=type==='memory'?Array.from({length:16},(_,i)=>i%8):[];
 for(let i=deck.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
 const p={board:{},tokens1:[],tokens2:[],deck,matched:[],firstCard:-1,secondCard:-1,score1:0,score2:0,turn:starter,winner:0,lastMove:-1,moveCount:0};
 if(type==='checkers'){Object.assign(p,initialCheckers());p.tokens1=Object.keys(p.board).filter(i=>p.board[i]===1).map(Number);p.tokens2=Object.keys(p.board).filter(i=>p.board[i]===2).map(Number);}
 return p;
}
export function move(type,previous,selection){
 if(type==='checkers')return checkersMove(previous,selection);
 const p=structuredClone(previous),g=gameTypes[type];if(!g||p.winner||![1,2].includes(p.turn)||!Number.isInteger(selection))throw Error('Invalid move');
 if(type==='memory'){
   if(p.firstCard>=0&&p.secondCard>=0||selection<0||selection>=16||p.matched.includes(selection)||selection===p.firstCard)throw Error('Invalid card');
   if(p.firstCard<0){p.firstCard=selection;p.lastMove=selection;return p;}
   p.lastMove=selection;p.moveCount++;
   if(p.deck[p.firstCard]!==p.deck[selection]){p.secondCard=selection;return p;}
   p.matched.push(p.firstCard,selection);p.firstCard=-1;p.secondCard=-1;p['score'+p.turn]++;
   if(p.matched.length===16)p.winner=p.score1===p.score2?3:p.score1>p.score2?1:2;
   return p;
 }
 let cell=selection;
 if(type==='connect_four'){
  if(selection<0||selection>=7)throw Error('Invalid column');
  cell=-1;for(let r=5;r>=0;r--)if(p.board[r*7+selection]===undefined){cell=r*7+selection;break;}
 }
 if(cell<0||cell>=g.rows*g.columns||p.board[cell]!==undefined)throw Error('Occupied cell');
 p.board[cell]=p.turn;p.lastMove=cell;p.moveCount++;
 const row=Math.floor(cell/g.columns),col=cell%g.columns,length=type==='tic_tac_toe'?3:4;
 let won=false;
 for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]])for(let offset=0;offset<length;offset++){
  const line=Array.from({length},(_,step)=>[row+(step-offset)*dr,col+(step-offset)*dc]);
  if(line.every(([r,c])=>r>=0&&r<g.rows&&c>=0&&c<g.columns&&p.board[r*g.columns+c]===p.turn))won=true;
 }
 p.tokens1=Object.keys(p.board).filter(i=>p.board[i]===1).map(Number).sort((a,b)=>a-b);
 p.tokens2=Object.keys(p.board).filter(i=>p.board[i]===2).map(Number).sort((a,b)=>a-b);
 p.winner=won?p.turn:Object.keys(p.board).length===g.rows*g.columns?3:0;if(!p.winner)p.turn=3-p.turn;return p;
}
export function finishReveal(previous){if(previous.winner||previous.firstCard<0||previous.secondCard<0)throw Error('No pair to close');return {...previous,firstCard:-1,secondCard:-1,turn:3-previous.turn};}
