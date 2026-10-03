import test from 'node:test';
import assert from 'node:assert/strict';
import {socialSteps,eligibleSteps,chooseStep,dailyStep,localDayKey,recentDays,emptyDailyState,validDailyState,markDaily,undoDaily,friendshipPlan} from '../social-steps.mjs';

test('every time and energy combination stays within budget and can offer another step',()=>{
  for(const minutes of [10,45,90]) for(const energy of ['low','medium','high']) {
    for(const random of [0,.25,.5,.75,1,NaN]) {
      const first=chooseStep(minutes,energy,'',random);
      assert.ok(first.minutes<=minutes);assert.equal(first.energy,energy);
      if(minutes===45)assert.ok(first.minutes>10);
      if(minutes===90)assert.ok(first.minutes>45);
      const next=chooseStep(minutes,energy,first.id,random);
      assert.notEqual(next.id,first.id);assert.ok(next.minutes<=minutes);
    }
  }
  assert.throws(()=>eligibleSteps(30,'low'),RangeError);
  assert.throws(()=>chooseStep(10,'unknown'),RangeError);
});
test('daily suggestions respect the goal and budget and are stable for a local day',()=>{
  for(const goal of ['join','follow','keep']) for(const minutes of [10,45,90]) {
    const first=dailyStep(goal,minutes,'2026-10-03');
    assert.equal(first.goal,goal);assert.ok(first.minutes<=minutes);
    assert.equal(dailyStep(goal,minutes,'2026-10-03').id,first.id);
    assert.notEqual(dailyStep(goal,minutes,'2026-10-03',1).id,first.id);
  }
  assert.throws(()=>dailyStep('join',10,'2026-02-30'),RangeError);
});
test('progress counts one real mark per day and undo restores the prior total',()=>{
  const original=emptyDailyState();
  const marked=markDaily(original,'2026-10-03',socialSteps[0]);
  assert.equal(marked.total,1);
  const repeated=markDaily(marked,'2026-10-03',socialSteps[1]);
  assert.deepEqual(repeated,marked);assert.equal(repeated.days['2026-10-03'].id,socialSteps[0].id);
  assert.deepEqual(undoDaily(marked,'2026-10-03'),original);
  const next=markDaily(marked,'2026-10-04',socialSteps[1]);
  assert.equal(next.total,2);assert.equal(Object.keys(next.days).length,2);
});
test('legacy totals remain available without inventing a seven-day history',()=>{
  const state=emptyDailyState(12,'2026-10-01','2026-10-03');
  assert.equal(state.total,12);assert.deepEqual(Object.keys(state.days),['2026-10-01']);
  assert.equal(state.days['2026-10-01'].id,'legacy');
  assert.equal(markDaily(state,'2026-10-03',socialSteps[0]).total,13);
  assert.equal(emptyDailyState(Infinity,'2026-10-03').total,0);
  assert.deepEqual(emptyDailyState(12,'2026-10-10','2026-10-03').days,{});
});
test('corrupt records cannot inflate completion state or claim future completions',()=>{
  assert.equal(validDailyState({version:2,total:NaN,days:{}}),null);
  assert.equal(validDailyState({version:2,total:1,days:{'2026-02-30':{id:'legacy',title:'old'}}},'2026-10-03'),null);
  assert.equal(validDailyState({version:2,total:1,days:{'2026-10-04':{id:'legacy',title:'old'}}},'2026-10-03'),null);
  assert.equal(validDailyState({version:2,total:0,days:{'2026-10-03':{id:'legacy',title:'old'}}},'2026-10-03'),null);
  assert.deepEqual(validDailyState(emptyDailyState(3,'2026-10-01','2026-10-03'),'2026-10-03'),emptyDailyState(3,'2026-10-01','2026-10-03'));
});
test('local-day records do not switch at UTC midnight and history spans calendar boundaries',()=>{
  const old=process.env.TZ;process.env.TZ='Europe/Berlin';
  try {
    assert.equal(localDayKey(new Date('2026-10-03T22:30:00Z')),'2026-10-04');
    assert.deepEqual(recentDays(new Date('2026-11-02T12:00:00Z')),['2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01','2026-11-02']);
  } finally {if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
});
test('different preferences produce questions to agree, without inventing a matching score',()=>{
  const first={pace:'weekly',setting:'large',style:'activity'};
  const second={pace:'occasional',setting:'one',style:'talk'};
  const single=friendshipPlan(first),compared=friendshipPlan(first,second);
  assert.notEqual(compared.pace,single.pace);assert.notEqual(compared.setting,single.setting);assert.notEqual(compared.style,single.style);
  assert.match(compared.pace,/one agreed date/);assert.match(compared.setting,/suit you both/);
  assert.ok(compared.rows.every(row=>row.second!=='Ask the other person'));
  assert.ok(single.rows.every(row=>row.second==='Ask the other person'));
  assert.match(compared.invitation,/\[day\/time\]/);assert.equal('score' in compared,false);
  assert.throws(()=>friendshipPlan({...first,setting:'unsupported'}),RangeError);
});
