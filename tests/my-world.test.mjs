import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WORLD_THEMES,WORLD_LANGUAGES,encodeWorld,decodeWorld,worldFromUrl,worldDestinations,compareWorlds,worldDailyIndex} from '../world-core.mjs';
import {WORLD_COPY} from '../world-copy.mjs';
import {WorldGif} from '../world-gif.mjs';
const card={theme:'aurora',answers:[0,1,0,1,0,1],interests:[0,1,3],referral:'a'.repeat(24),language:'ru'};

test('all 24 themes and eight languages have complete copy and round-trip invitations',()=>{
 assert.equal(WORLD_THEMES.length,24);assert.equal(new Set(WORLD_THEMES).size,24);
 for(const language of WORLD_LANGUAGES){
  const copy=WORLD_COPY[language];assert.equal(copy.arrays.world_questions.length,6);assert.equal(copy.arrays.world_answer_a.length,6);assert.equal(copy.arrays.world_answer_b.length,6);assert.equal(copy.arrays.world_interests_list.length,12);assert.equal(copy.arrays.world_daily_prompts.length,14);
  for(const theme of WORLD_THEMES){assert.ok(copy.strings['world_'+theme]);const c={...card,theme,language};assert.deepEqual(decodeWorld(encodeWorld(c)),c);}
 }
});
test('hostile, ambiguous and malformed invitations are rejected',()=>{
 const token=encodeWorld(card);
 for(const url of ['https://evil.example/world.html#world='+token,'https://findkindredpeople.com.evil.example/world.html#world='+token,'https://user@findkindredpeople.com/world.html#world='+token,'https://findkindredpeople.com/world.html?world='+token+'&world='+token,'https://findkindredpeople.com/world.html?world='+token+'#world='+token,'kindred://world/extra?world='+token])assert.equal(worldFromUrl(url),null,url);
 for(const token of ['','x'.repeat(281),'!bad','MQ','eyJ1aWQiOiJzZWNyZXQifQ'])assert.equal(decodeWorld(token),null);
 for(const update of [{answers:[0,1]},{interests:[0,0]},{interests:[12]},{interests:[0,1,2,3]},{theme:'javascript:alert(1)'},{referral:'private-uid'},{language:'xx'}])assert.throws(()=>encodeWorld({...card,...update}));
});
test('comparison excludes unanswered questions and lists actual shared interests',()=>{
 const peer={...card,answers:[0,-1,1,1,-1,0],interests:[1,3,5]};
 assert.deepEqual(compareWorlds(card,peer),{matched:2,compared:4,sharedInterests:[1,3]});
 assert.equal(compareWorlds({...card,answers:Array(6).fill(-1)},peer).compared,0);
});
test('web, Android and Play preserve original invitation and include no portrait or identity',()=>{
 const links=worldDestinations({...card,referral:null},card);
 assert.deepEqual(worldFromUrl(links.share),{...card,referral:null});
 assert.deepEqual(worldFromUrl(links.android),card);
 assert.deepEqual(worldFromUrl(links.web),card);
 const referrer=new URLSearchParams(new URL(links.play).searchParams.get('referrer'));
 assert.deepEqual(decodeWorld(referrer.get('world')),card);assert.equal(referrer.get('ref'),card.referral);
 assert.deepEqual(decodeWorld(referrer.get('mine')),{...card,referral:null});
 assert.ok(!JSON.stringify(links).match(/portrait|email|photo|uid/));
});
test('daily prompts rotate correctly across fourteen UTC days',()=>{
 assert.equal(worldDailyIndex(-1),13);assert.equal(worldDailyIndex(14),0);assert.equal(new Set(Array.from({length:14},(_,i)=>worldDailyIndex(i))).size,14);
});
test('GIF encoder creates a real looping multiframe artifact',async()=>{
 const encoder=new WorldGif(32,24);
 for(let frame=0;frame<3;frame++){
  const rgba=new Uint8ClampedArray(32*24*4);
  for(let i=0;i<rgba.length;i+=4){rgba[i]=frame===0?255:(i%256);rgba[i+1]=frame===1?255:0;rgba[i+2]=frame===2?255:0;rgba[i+3]=255;}
  encoder.frame(rgba,10);
 }
 const bytes=Buffer.from(await encoder.finish().arrayBuffer());
 assert.equal(bytes.subarray(0,6).toString(),'GIF89a');assert.ok(bytes.includes(Buffer.from('NETSCAPE2.0')));assert.equal(bytes.at(-1),59);
 const file=process.env.WORLD_GIF_TEST_FILE;if(file)fs.writeFileSync(file,bytes);
 assert.throws(()=>encoder.frame(new Uint8ClampedArray(32*24*4)));
});
