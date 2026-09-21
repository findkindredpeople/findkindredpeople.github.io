import test from 'node:test';
import assert from 'node:assert/strict';
import {byId,matchesFilters,nextDate} from '../berlin-activities-data.mjs';
import {firstVisitMessage} from '../first-visit.mjs';
import {newPilot,validPilot,recordPilot,pilotSummary,pilotReport,pilotKey,trackPilot,readPilot} from '../pilot-metrics.mjs';

test('day and time filters require a full published session, without inventing dates',()=>{
  const crochet=byId.get('crochet-tiergarten');
  assert.equal(matchesFilters(crochet,{weekday:'2',startAfter:'15:00',finishBy:'17:30'},'2026-09-21'),true);
  assert.equal(matchesFilters(crochet,{weekday:'0'},'2026-09-21'),false);
  assert.equal(matchesFilters(crochet,{startAfter:'15:01'},'2026-09-21'),false);
  assert.equal(matchesFilters(crochet,{finishBy:'17:29'},'2026-09-21'),false);
  assert.equal(matchesFilters(crochet,{startAfter:'18:00',finishBy:'10:00'},'2026-09-21'),false);
  assert.equal(matchesFilters(byId.get('electronic-jam'),{weekday:'3'},'2026-09-21'),false);
  const book=byId.get('english-book-club');
  assert.equal(matchesFilters(book,{weekday:'1',language:'en'},'2026-09-21'),true);
  assert.equal(matchesFilters(book,{weekday:'1',language:'en',when:'7'},'2026-09-21'),false);
  assert.equal(nextDate(book,'2026-09-21'),null);
});
test('first-visit questions distinguish published dates from missing dates and ask about English',()=>{
  const dated=firstVisitMessage(byId.get('crochet-tiergarten'),'en',true,'2026-09-21');
  assert.match(dated,/2026-09-22, 15:00–17:30/);
  assert.match(dated,/Can I take part using English/);
  const unknown=firstVisitMessage(byId.get('english-book-club'),'en',false,'2026-09-21');
  assert.match(unknown,/confirm the next date/); assert.doesNotMatch(unknown,/2026-09-/);
  assert.match(firstVisitMessage(byId.get('english-book-club'),'de',true,'2026-09-21'),/Kann ich auf Englisch teilnehmen/);
});
test('pilot requires explicit consent and expires exactly 30 days after it starts',()=>{
  const now=new Date('2026-09-21T12:00:00Z'),pilot=newPilot(now);
  assert.equal(recordPilot(null,'choose','crochet-tiergarten',now),null);
  assert.equal(validPilot({...pilot,consent:false},now),null);
  assert.equal(validPilot(pilot,new Date(+now-1)),null);
  assert.ok(validPilot(pilot,new Date(+now+30*86400000-1)));
  assert.equal(validPilot(pilot,new Date(+now+30*86400000)),null);
  assert.equal(validPilot({...pilot,expiresAt:'2027-01-01T00:00:00Z'},now),null);
});
test('pilot deduplicates daily actions and counts return by Berlin day, not UTC day',()=>{
  const now=new Date('2026-09-21T21:30:00Z');let pilot=newPilot(now);
  pilot=recordPilot(pilot,'choose','crochet-tiergarten',now);
  pilot=recordPilot(pilot,'choose','crochet-tiergarten',now);
  pilot=recordPilot(pilot,'organiser','unknown-id',now);
  pilot=recordPilot(pilot,'compare','',now); pilot=recordPilot(pilot,'compare','',now);
  assert.deepEqual([pilotSummary(pilot).days,pilotSummary(pilot).choose,pilotSummary(pilot).organiser,pilotSummary(pilot).compare],[1,1,0,1]);
  pilot=recordPilot(pilot,'browse','',new Date('2026-09-21T22:30:00Z'));
  assert.equal(pilotSummary(pilot).returned,true);assert.equal(pilotSummary(pilot).lastDay,'2026-09-22');
  const report=pilotReport(pilot);
  assert.match(report,/not site-wide visitor totals/);assert.match(report,/No permission to publish/);assert.doesNotMatch(report,/@|crochet-tiergarten/);
});
test('browser pilot storage stays empty without opting in; expired or invalid counters are cleared',()=>{
  const values=new Map();let writes=0;
  globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>{writes++;values.set(key,value);},removeItem:key=>values.delete(key)};
  try {
    assert.equal(trackPilot('choose','crochet-tiergarten'),false); assert.equal(writes,0);
    values.set(pilotKey,JSON.stringify(newPilot(new Date(Date.now()-31*86400000))));
    assert.equal(readPilot(),null);assert.equal(values.has(pilotKey),false);
    values.set(pilotKey,'not JSON'); assert.equal(readPilot(),null);assert.equal(values.has(pilotKey),false);
    values.set(pilotKey,JSON.stringify(newPilot()));assert.equal(trackPilot('organiser','crochet-tiergarten'),true);assert.equal(writes,1);
    values.delete(pilotKey);assert.equal(trackPilot('browse'),false);assert.equal(writes,1);
  } finally {delete globalThis.localStorage;}
});
