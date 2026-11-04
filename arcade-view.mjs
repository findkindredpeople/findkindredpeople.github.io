import {gameTypes,baseGameType} from './arcade-logic.mjs?v=20261104-games-1';
import {checkersMoves} from './checkers-logic.mjs';
import {escapeHtml as safe} from './arcade-copy.mjs';

export function boardView(type,p,{me=1,enabled=false,selected=-1,copy:c}={}) {
  type=baseGameType(type);
  const g=gameTypes[type];if(!g)return '';
  const checkers=type==='checkers',legal=checkers?checkersMoves(p):[],destinations=legal.filter(m=>m.from===selected).map(m=>m.to);
  return `<div class="arcade-board${checkers?' checkers-board':''}" style="grid-template-columns:repeat(${g.columns},1fr)">${Array.from({length:g.rows*g.columns},(_,visual)=>{
    const i=checkers&&me===2?63-visual:visual,token=p.board[i];
    if(checkers){
      const king=p.kings.includes(i),destination=destinations.includes(i),selectable=legal.some(m=>m.from===i),coordinate=`${String.fromCharCode(65+i%8)}${8-Math.floor(i/8)}`;
      const label=[coordinate,token?(token===me?c.you:c.opponent):c.empty,king?c.king:'',destination?c.legalMove:''].filter(Boolean).join(', ');
      return `<button type="button" data-cell="${i}" class="checker-square ${Math.floor(i/8)%2===i%2?'light':'dark'}${selected===i?' selected':''}${destination?' legal':''}" aria-label="${safe(label)}" aria-pressed="${selected===i}"${!enabled||!(selectable||destination)?' disabled':''}>${token?`<span class="checker-piece p${token}" aria-hidden="true">${king?'★':''}</span>`:destination?'<span class="checker-dot" aria-hidden="true"></span>':''}</button>`;
    }
    const memory=type==='memory',shown=memory&&(p.matched.includes(i)||p.firstCard===i||p.secondCard===i),symbol=memory?(shown?['☀','☾','★','☂','♣','♠','♥','♦'][p.deck[i]]:'?'):token?(type==='tic_tac_toe'?(token===1?'✕':'○'):'●'):'·';
    return `<button type="button" data-cell="${i}" class="${token?'p'+token:''}"${!enabled||!memory&&token||memory&&(p.matched.includes(i)||p.firstCard===i||p.secondCard>=0)?' disabled':''} aria-label="${safe(c.cell)} ${i+1}: ${safe(symbol)}">${safe(symbol)}</button>`;
  }).join('')}</div>`;
}
