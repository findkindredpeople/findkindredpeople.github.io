import test from 'node:test';
import assert from 'node:assert/strict';
import {activities,byId} from '../berlin-activities-data.mjs';
import {localizeActivity} from '../berlin-activities-de.mjs';
import {futureSessions,discoveryMatch,cardMarkup} from '../berlin-discovery.mjs';
import {makeCalendar} from '../calendar.mjs';

test('weekly collection uses explicit dates, and a seven-day window excludes its end boundary',()=>{
 const sessions=futureSessions(activities,{now:new Date('2026-10-03T21:20:00Z'),days:7});
 assert.deepEqual(sessions.map(({item,date})=>[item.id,date]),[['knitting-pablo','2026-10-06']]);
 const items=[{id:'dated',dates:['2026-10-03','2026-10-09','2026-10-10'],start:'16:00',end:'18:00'},{id:'recurring-only',dates:[],start:'16:00',end:'18:00'}];
 assert.deepEqual(futureSessions(items,{now:new Date('2026-10-03T21:20:00Z')}).map(s=>s.date),['2026-10-09']);
 assert.equal(items[0].dates.length,3);
});
test('weekly dates use Berlin midnight and remove sessions after their end time',()=>{
 const items=[{id:'today',dates:['2026-10-04'],start:'15:00',end:'17:00'}];
 assert.equal(futureSessions(items,{now:new Date('2026-10-03T22:30:00Z'),days:1}).length,1);
 assert.equal(futureSessions(items,{now:new Date('2026-10-04T15:01:00Z'),days:1}).length,0);
 const autumn=[{id:'clock-change',dates:['2026-10-25'],start:'15:00',end:'17:00'}];
 assert.equal(futureSessions(autumn,{now:new Date('2026-10-25T15:30:00Z'),days:1}).length,1);
 assert.equal(futureSessions(autumn,{now:new Date('2026-10-25T16:01:00Z'),days:1}).length,0);
});
test('German search preserves shared facts and finds translated activity words',()=>{
 for(const item of activities){
  const local=localizeActivity(item);
  for(const field of ['title','description','schedule','cost','languageText','booking','tip'])assert.ok(local[field],item.id+': '+field);
  for(const field of ['dates','fee','start','end','source','checkedOn','venue','address'])assert.deepEqual(local[field],item[field]);
 }
 assert.equal(discoveryMatch(byId.get('crochet-tiergarten'),{query:'häkeln'},'2026-10-03'),true);
 assert.equal(discoveryMatch(byId.get('english-book-club'),{language:'de'},'2026-10-03'),false);
 assert.equal(discoveryMatch(byId.get('crochet-tiergarten'),{free:true},'2026-10-03'),false);
 assert.equal(discoveryMatch(byId.get('clothing-swap'),{},'2026-10-03'),false);
});
test('calendar keeps the published Berlin session time and German booking notice',()=>{
 const item=byId.get('knitting-pablo');
 const event=makeCalendar({title:localizeActivity(item).title,date:'2026-10-06',time:item.start,duration:item.duration,source:item.source,language:'de'},new Date('2026-10-03T20:00:00Z')).replace(/\r\n /g,'');
 assert.match(event,/DTSTART:20261006T133000Z/);
 assert.match(event,/DTEND:20261006T153000Z/);
 assert.match(event,/keine Anmeldung oder Reservierung/);
 assert.match(event,/STATUS:TENTATIVE/);
 const card=cardMarkup(item,{language:'de',date:'2026-10-06'});
 assert.match(card,/datetime="2026-10-06"/);
 assert.match(card,/freundschaftsplaner\.html\?berlin=knitting-pablo/);
});
