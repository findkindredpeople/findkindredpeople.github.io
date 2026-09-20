import test from 'node:test';
import assert from 'node:assert/strict';
import {activities,byId,berlinToday,nextDate,isExpired,matchesFilters,selectedIds,toComparison} from '../berlin-activities-data.mjs';
import {wallTimeToUTC,makeCalendar,foldLine} from '../calendar.mjs';
import {validSavedPlan} from '../planner-storage.mjs';
import {evaluateActivity} from '../activity-fit.mjs';

test('published dates are not invented from recurring schedules',()=>{
  assert.equal(activities.length,15);
  assert.equal(new Set(activities.map(a=>a.id)).size,15);
  assert.equal(nextDate(byId.get('sprachraum-pablo'),'2026-09-20'),null);
  assert.equal(matchesFilters(byId.get('sprachraum-raumer'),{when:'7'},'2026-09-20'),false);
  const upcoming=activities.filter(a=>matchesFilters(a,{when:'7'},'2026-09-20'));
  assert.deepEqual(upcoming.map(a=>a.id).sort(),['clothing-swap','crochet-tiergarten','language-trail','singing-hansa']);
  assert.equal(matchesFilters(byId.get('clothing-swap'),{when:'7'},'2026-09-19'),false);
  assert.equal(isExpired(byId.get('clothing-swap'),'2026-09-27'),true);
  assert.equal(isExpired(byId.get('silent-book-club'),'2027-01-01'),false);
  assert.equal(nextDate(byId.get('crochet-tiergarten'),'2026-09-23'),'2026-10-13');
  assert.equal(berlinToday(new Date('2026-09-20T22:30:00Z')),'2026-09-21');
});
test('unknown costs and languages do not pass confirmed filters or comparisons',()=>{
  assert.equal(matchesFilters(byId.get('singing-hansa'),{free:true},'2026-09-20'),false);
  assert.equal(matchesFilters(byId.get('silent-book-club'),{language:'en'},'2026-09-20'),false);
  assert.equal(matchesFilters(byId.get('english-book-club'),{language:'en'},'2026-09-20'),true);
  assert.equal(toComparison(byId.get('knitting-pablo'),'2026-09-20').fee,null);
  const imported=toComparison(byId.get('sprachraum-wilhelm'),'2026-09-20');
  assert.equal(imported.fee,0); assert.equal(imported.duration,90);
  const result=evaluateActivity(imported,{minutes:180,cost:15});
  assert.equal(result.minutes,null); assert.equal(result.cost,null); assert.equal(result.status,'More to check');
  assert.deepEqual(selectedIds('clothing-swap,clothing-swap,<script>,singing-hansa,retro-gaming,sewing-pablo'),['clothing-swap','singing-hansa','retro-gaming']);
});
test('calendar conversion preserves Berlin summer/winter and rejects DST ambiguity',()=>{
  assert.equal(wallTimeToUTC('2026-09-22','15:00','Europe/Berlin').toISOString(),'2026-09-22T13:00:00.000Z');
  assert.equal(wallTimeToUTC('2026-11-10','15:00','Europe/Berlin').toISOString(),'2026-11-10T14:00:00.000Z');
  assert.equal(wallTimeToUTC('2026-09-22','15:00','UTC').toISOString(),'2026-09-22T15:00:00.000Z');
  assert.equal(wallTimeToUTC('2026-09-22','15:00','Asia/Kolkata').toISOString(),'2026-09-22T09:30:00.000Z');
  assert.throws(()=>wallTimeToUTC('2026-03-29','02:30','Europe/Berlin'),/does not exist/);
  assert.throws(()=>wallTimeToUTC('2026-10-25','02:30','Europe/Berlin'),/occurs twice/);
  assert.throws(()=>wallTimeToUTC('2026-02-31','10:00','Europe/Berlin'),/valid date/);
});
test('a known component above the limit blocks the visit even when another cost is unknown',()=>{
  const partial={duration:180,travel:null,fee:20,transport:null,newcomers:'unknown',schedule:'unknown',access:'unknown'};
  const result=evaluateActivity(partial,{minutes:90,cost:15});
  assert.equal(result.status,'Does not fit yet'); assert.equal(result.minutes,null); assert.equal(result.cost,null);
  assert.ok(result.blockers.some(reason=>reason.includes('90 minutes')));
  assert.ok(result.blockers.some(reason=>reason.includes('known cost')));
  assert.ok(result.questions.length>0);
  assert.equal(evaluateActivity({...partial,duration:60,fee:0},{minutes:90,cost:15}).status,'More to check');
});
test('calendar files use complete UTC times and escape/fold user-entered text',()=>{
  const content=makeCalendar({title:'Café, meet; talk\nEND:VEVENT',location:'Lützowstraße 27',date:'2026-09-22',time:'15:00',duration:150,uid:'crochet-2026-09-22',description:'😊'.repeat(50),source:byId.get('crochet-tiergarten').source},new Date('2026-09-20T12:00:00Z'));
  assert.match(content,/DTSTART:20260922T130000Z\r\nDTEND:20260922T153000Z/);
  assert.match(content,/SUMMARY:Café\\, meet\\; talk\\nEND:VEVENT/);
  assert.equal(content.match(/\r\nEND:VEVENT\r\n/g).length,1);
  assert.ok(content.split('\r\n').every(line=>Buffer.byteLength(line)<=75));
  const text='SUMMARY:'+ 'ä😊'.repeat(40);
  assert.equal(foldLine(text).replace(/\r\n /g,''),text);
  assert.throws(()=>makeCalendar({title:'x',date:'2026-09-22',time:'10:00',duration:0}),/duration/);
});
test('saved plans validate choices and preserve displayed invitations and ticks',()=>{
  const good={version:1,options:{goal:'follow',budget:60,online:false,quiet:true,german:true},checked:[true,false,false,true,false,false,false],invitation:'A displayed draft',note:'Check before sending.',savedAt:'2026-09-20T12:00:00Z',fields:{name:'Alex'},calendar:{zone:'Europe/Berlin'},activityId:'crochet-tiergarten'};
  assert.equal(validSavedPlan(good).invitation,good.invitation);
  assert.equal(validSavedPlan(good).checked[3],true);
  assert.equal(validSavedPlan({...good,options:{...good.options,budget:900}}),null);
  assert.equal(validSavedPlan({...good,checked:[]}),null);
  assert.equal(validSavedPlan({...good,savedAt:'not a date'}),null);
  assert.equal(validSavedPlan(null),null);
});
