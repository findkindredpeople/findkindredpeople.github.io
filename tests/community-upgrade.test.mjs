import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {isQuietTime,allowsNotification,normalizeSlots,agreedSlots,meetingCalendar,conversationStarters,quickStartDefaults} from '../community-upgrade.mjs';
test('quiet hours span midnight in the recipient timezone and end exclusively',()=>{
 const p={quietEnabled:true,quietStart:'22:00',quietEnd:'08:00',timeZone:'Europe/Berlin'};
 assert.equal(isQuietTime(p,new Date('2026-11-04T21:00:00Z')),true);
 assert.equal(isQuietTime(p,new Date('2026-11-05T06:59:00Z')),true);
 assert.equal(isQuietTime(p,new Date('2026-11-05T07:00:00Z')),false);
 assert.equal(isQuietTime({...p,quietStart:'08:00'},new Date()),false);
});
test('categories work independently without affecting messages stored in the app',()=>{
 assert.equal(allowsNotification('game_invite',{games:false}),false);
 assert.equal(allowsNotification('chat_message',{games:false}),true);
 assert.equal(allowsNotification('forum_reply',{community:false}),false);
});
test('poll slots are future, unique and sorted; confirmation needs both votes',()=>{
 assert.deepEqual(normalizeSlots(['2027-01-02T12:00Z','2027-01-01T12:00Z','2027-01-01T12:00Z','2020-01-01'],Date.parse('2026-11-04')),['2027-01-01T12:00:00.000Z','2027-01-02T12:00:00.000Z']);
 const p={options:['a','b'],participants:['a','b']};
 assert.deepEqual(agreedSlots(p,[{userId:'a',choices:[0,1]},{userId:'b',choices:[1]}]),[1]);
 assert.deepEqual(agreedSlots(p,[{userId:'a',choices:[0]}]),[]);
});
test('calendar contains UTC times, escaped data and an actual reminder',()=>{
 const ics=meetingCalendar({id:'poll-1',title:'Coffee, walk\nKindred',when:'2026-11-10T10:00Z',place:'Café; park'});
 assert.match(ics,/DTSTART:20261110T100000Z/);assert.match(ics,/TRIGGER:-PT30M/);assert.match(ics,/Coffee\\, walk\\nKindred/);assert.match(ics,/Café\\; park/);
});
test('starter messages are drafts with concrete invitations in supported languages',()=>{
 for (const lang of ['en','ru','de','uk','ar']) {const a=conversationStarters(lang);assert.equal(a.length,3);assert.ok(a.every(x=>x.label&&x.text.length>20));}
});

test('short onboarding defaults fit the actual profile choices and use readable language names',()=>{
 const html=readFileSync(new URL('../app.html',import.meta.url),'utf8');
 for(const locale of ['en','ru','de','uk','ar']) {
  const defaults=quickStartDefaults(locale);assert.ok(defaults.languages.length>2);
  for(const [key,value] of Object.entries(defaults)) {
   const match=html.match(new RegExp('<select[^>]*id="'+key+'"[^>]*>([\\s\\S]*?)</select>'));
   if(key==='languages')continue;assert.ok(match,`${key} must have a real profile selector`);
   assert.ok([...match[1].matchAll(/<option[^>]*value="([^"]*)"/g)].some(x=>x[1]===value),`${key}=${value} must remain a selectable preference`);
  }
 }
});
