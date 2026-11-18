export const WORLD_THEMES = ['aquarium','forest','new_year','sunset','ocean','aurora','rain_city','sakura','cosmos','winter_forest','mountain_lake','fireflies','lavender','tropical','moonlight','neon_city','golden_hour','butterflies','rose_garden','desert','clouds','fireworks','cozy_rain','spring_meadow'];
export const WORLD_LANGUAGES = ['en','de','ru','uk','ar','es','fr','tr'];
export function validWorld(card) {
  return !!card && WORLD_THEMES.includes(card.theme) && WORLD_LANGUAGES.includes(card.language)
    && Array.isArray(card.answers) && card.answers.length===6 && card.answers.every(x=>Number.isInteger(x)&&x>=-1&&x<=1)
    && Array.isArray(card.interests) && card.interests.length<=3 && new Set(card.interests).size===card.interests.length
    && card.interests.every(x=>Number.isInteger(x)&&x>=0&&x<=11)
    && (card.referral===null || /^[a-f0-9]{24}$/.test(card.referral));
}
export function encodeWorld(card) {
  if(!validWorld(card))throw new TypeError('Invalid world');
  return btoa(['1',card.theme,card.answers.map(x=>x<0?'-':x).join(''),card.interests.join(','),card.referral??'-',card.language].join('|'))
    .replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
export function decodeWorld(token) {
  try {
    if(typeof token!=='string'||token.length<10||token.length>280||!/^[A-Za-z0-9_-]+$/.test(token))return null;
    const parts=atob(token.replaceAll('-','+').replaceAll('_','/')).split('|');
    if(parts.length!==6||parts[0]!=='1'||!/^[-01]{6}$/.test(parts[2])||!/^((?:[0-9]|1[01])(?:,(?:[0-9]|1[01]))*)?$/.test(parts[3]))return null;
    const card={theme:parts[1],answers:[...parts[2]].map(x=>x==='-'?-1:Number(x)),interests:parts[3]?parts[3].split(',').map(Number):[],referral:parts[4]==='-'?null:parts[4],language:parts[5]};
    return validWorld(card)?card:null;
  } catch{return null;}
}
export function worldFromUrl(raw) {
  try {
    const u=new URL(raw);
    if(u.username||u.password||u.port)return null;
    const web=u.protocol==='https:'&&['findkindredpeople.com','www.findkindredpeople.com'].includes(u.hostname)&&['/world.html','/app.html'].includes(u.pathname);
    const native=u.protocol==='kindred:'&&u.hostname==='world'&&!u.pathname;
    if(!web&&!native)return null;
    const hash=new URLSearchParams(u.hash.slice(1));
    const values=[...hash.getAll('world'),...u.searchParams.getAll('world')];
    return values.length===1?decodeWorld(values[0]):null;
  }catch{return null;}
}
export function compareWorlds(a,b) {
  if(!validWorld(a)||!validWorld(b))throw new TypeError('Invalid world');
  const pairs=a.answers.map((x,i)=>[x,b.answers[i]]).filter(([x,y])=>x>=0&&y>=0);
  return {matched:pairs.filter(([x,y])=>x===y).length,compared:pairs.length,sharedInterests:a.interests.filter(x=>b.interests.includes(x))};
}
export function worldDestinations(card,incoming=null) {
  if(!validWorld(card)||(incoming&&!validWorld(incoming)))throw new TypeError('Invalid world');
  const original=incoming??card;
  const params=new URLSearchParams({world:encodeWorld(original)});
  if(incoming)params.set('mine',encodeWorld({...card,referral:null}));
  if(original.referral)params.set('ref',original.referral);
  return {
    share:'https://findkindredpeople.com/world.html#world='+encodeWorld(card),
    android:'kindred://world?'+params,
    play:'https://play.google.com/store/apps/details?id=com.findkindredpeople.kindred&referrer='+encodeURIComponent(params.toString()),
    web:'https://findkindredpeople.com/app.html?'+params
  };
}
export function worldDailyIndex(day){return ((Math.trunc(day)%14)+14)%14;}
