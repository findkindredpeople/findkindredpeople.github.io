import {initialPosition} from './arcade-logic.mjs';

export const seriesTarget = room => room.seriesTarget===3?3:1;
export const seriesWinner = room => seriesTarget(room)===3 ? ((room.wins1||0)>=3?1:(room.wins2||0)>=3?2:0) : 0;
export function seriesFields(target=1) {
  if (![1,3].includes(target)) throw Error('Invalid format');
  return target===3?{seriesTarget:3,wins1:0,wins2:0,seriesRound:1}:{};
}
export function roundScore(room,winner) {
  if (seriesTarget(room)!==3) return {};
  if (seriesWinner(room)||![0,1,2,3].includes(winner)) throw Error('Series finished');
  return {wins1:room.wins1+(winner===1?1:0),wins2:room.wins2+(winner===2?1:0)};
}
export function nextRound(room,random=Math.random) {
  if (room.status!=='finished' || !room.state.winner) throw Error('Round still in progress');
  const round=room.round+1,series=seriesTarget(room)===3,finished=!!seriesWinner(room);
  return {state:initialPosition(room.gameType,random,series?(round%2===1?1:2):1),round,
    ...(series?{wins1:finished?0:room.wins1,wins2:finished?0:room.wins2,seriesRound:finished?1:room.seriesRound+1}:{}),
    status:'playing',rematchRequestedBy:''};
}
