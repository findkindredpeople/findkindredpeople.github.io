import test from 'node:test';
import assert from 'node:assert/strict';
import {germanPlan,comparisonData} from '../german-tools.mjs';
import {byId} from '../berlin-activities-data.mjs';
import {evaluateActivity} from '../activity-fit.mjs';
import {shortlistURL,shortlistSVG} from '../shortlist-share.mjs';
import {practiceCardMarkup} from '../berlin-discovery.mjs';

test('German plans preserve weekly time budgets, rest days and agreement boundaries',()=>{
 for(const goal of ['start','follow','keep'])for(const budget of [30,60,120])for(const online of [true,false])for(const quiet of [true,false]){
  const options={goal,budget,online,quiet,german:true},draft='Hallo, am [Tag]?',plan=germanPlan(options,draft);
  assert.equal(plan.minutes.reduce((a,b)=>a+b,0),budget);assert.equal(plan.tasks.length,7);assert.equal(plan.minutes[2],0);
  assert.equal(plan.invitation,draft);assert.match(plan.note,/Angaben.*fehlen/);assert.match(plan.boundary,/beide zustimmen/);
  assert.match(plan.summary,online?/ohne Fahrt/:/Fahrtzeit zusätzlich/);
 }
 assert.doesNotMatch(germanPlan({goal:'keep',budget:30,online:false,quiet:true},'Hallo Alex').note,/fehlen/);
});
test('German imports translate prose while keeping unknown amounts and exact session facts',()=>{
 for(const id of ['knitting-pablo','singing-hansa','sprachraum-pablo']){
  const en=comparisonData(byId.get(id),'en','2026-10-04'),de=comparisonData(byId.get(id),'de','2026-10-04');
  for(const key of ['duration','fee','travel','transport','url','newcomers','schedule','access'])assert.equal(de[key],en[key]);
  assert.match(de.notes,/Quelle geprüft/);assert.ok(de.notes.length<=400);
 }
 assert.equal(comparisonData(byId.get('knitting-pablo'),'de').fee,null);
 assert.equal(comparisonData(byId.get('sprachraum-pablo'),'de').fee,0);
});
test('translated comparisons keep partial-known costs and time blockers identical',()=>{
 const input={duration:120,travel:null,fee:20,transport:null,newcomers:'unknown',schedule:'no',access:'yes'},limits={minutes:90,cost:15};
 const en=evaluateActivity(input,limits),de=evaluateActivity(input,limits,'de');
 assert.equal(de.minutes,en.minutes);assert.equal(de.cost,en.cost);assert.equal(de.blockers.length,en.blockers.length);assert.equal(de.questions.length,en.questions.length);
 assert.equal(de.status,'Passt noch nicht');assert.match(de.blockers.join(' '),/30 Minuten/);assert.match(de.blockers.join(' '),/Kosten/);
 assert.equal(evaluateActivity({...input,duration:30,travel:10,fee:0,transport:0,newcomers:'yes',schedule:'yes'},limits,'de').status,'Passt zu deinen Angaben');
});
test('share URLs carry only allowed public IDs, deduplicate and cap the selection',()=>{
 const url=new URL(shortlistURL(['sprachraum-pablo','sprachraum-pablo','<script>','sprachraum-raumer','sprachraum-wilhelm','knitting-pablo']));
 assert.equal(url.origin,'https://findkindredpeople.com');assert.equal(url.pathname,'/berlin-aktivitaeten.html');
 assert.deepEqual([...url.searchParams.keys()],['pick']);assert.equal(url.searchParams.get('pick'),'sprachraum-pablo,sprachraum-raumer,sprachraum-wilhelm');assert.equal(url.hash,'#discovery-shortlist');
 assert.equal(new URL(shortlistURL(['knitting-pablo'],'en')).pathname,'/berlin-activities.html');
 assert.throws(()=>shortlistURL(['private-note']),/at least one/);
 const svg=shortlistSVG(['sprachraum-pablo']);assert.match(svg,/^<svg/);assert.doesNotMatch(svg,/<script|(?:href|src)=["\x27]https?:\/\//);assert.match(svg,/<path/);
});
test('German practice cards lead to German planning and do not fabricate dates',()=>{
 const card=practiceCardMarkup(byId.get('sprachraum-pablo'));
 assert.match(card,/freundschaftsplaner.html\?berlin=sprachraum-pablo/);assert.match(card,/Termin.*erfragen/);assert.doesNotMatch(card,/data-calendar|datetime=/);
});
