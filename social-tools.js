import {chooseStep,dailyStep,localDayKey,recentDays,emptyDailyState,validDailyState,markDaily,undoDaily,friendshipPlan} from './social-steps.mjs?v=20261003-1';
const el = id => document.getElementById(id);
const mode = document.body.dataset.socialTool;
function renderStep(step) {
  el('output').hidden=false;
  el('result').textContent=step.title;
  el('estimate').textContent=`About ${step.minutes} minutes for this step. Check travel, booking and opening hours separately.`;
  el('steps').replaceChildren(...step.actions.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  el('message').textContent=step.message || 'This step does not need a message. Use the checklist above and decide what to do next.';
  el('guide').href=step.guide;
  el('copy').hidden=!step.message;
  el('shareStatus').textContent='';
}
async function copy(text,status) {
  try {await navigator.clipboard.writeText(text);status.textContent='Copied. Replace placeholders and check the text before using it.';}
  catch {status.textContent='Automatic copying is unavailable. Select and copy the text shown above.';}
}
function wireSharing(getText,path) {
  el('copy').addEventListener('click',()=>copy(el('message').textContent,el('shareStatus')));
  el('share').addEventListener('click',async()=>{
    const text=getText(),url=new URL(path,location.href).href,status=el('shareStatus');
    try {
      if(navigator.share){await navigator.share({title:'Kindred — a practical next step',text,url});status.textContent='Shared.';}
      else {await navigator.clipboard.writeText(text+'\n'+url);status.textContent='Step and link copied.';}
    } catch(error) {if(error.name!=='AbortError') status.textContent='Sharing is unavailable. You can copy the step above.';}
  });
}
if(mode==='dice') {
  let selected=null,previousId='';
  el('roll').addEventListener('click',()=>{
    selected=chooseStep(Number(el('time').value),el('energy').value,previousId);
    previousId=selected.id;renderStep(selected);el('toolStatus').textContent='A step matched to your selected time and energy is ready.';
  });
  for(const id of ['time','energy']) el(id).addEventListener('change',()=>{
    selected=null;el('output').hidden=true;el('toolStatus').textContent='Your options changed. Roll again for a step that fits them.';
  });
  wireSharing(()=>selected ? selected.title+'\n'+selected.actions.join('\n') : '', 'play.html');
}
if(mode==='daily') {
  const key='kindred-daily-v2';let memoryOnly=false,offset=0,shownDay='';
  function storedState() {
    let raw;
    try {raw=localStorage.getItem(key);} catch {memoryOnly=true;return null;}
    try {return raw?validDailyState(JSON.parse(raw)):null;} catch {return null;}
  }
  function legacyState() {
    try {return emptyDailyState(Number(localStorage.getItem('kindredDailyCount')||0),localStorage.getItem('kindredDailyLast')||'');}
    catch {memoryOnly=true;return emptyDailyState();}
  }
  let state=storedState()||legacyState(),selected=null;
  function save() {
    try {localStorage.setItem(key,JSON.stringify(state));memoryOnly=false;}
    catch {memoryOnly=true;}
  }
  function progress() {
    const today=localDayKey(),done=state.days[today];
    el('progress').textContent=`${state.total} step${state.total===1?'':'s'} recorded on this device. At most one completion is counted per local calendar day.`;
    el('todayStatus').textContent=done ? `Recorded today: ${done.title}. Other suggestions are optional; they are not marked as completed.` : 'No step recorded today. Mark a step only after you have actually done it.';
    el('done').disabled=Boolean(done);el('undo').hidden=!done;
    el('storageStatus').textContent=memoryOnly ? 'This browser cannot save progress. Your marks will last only while this page stays open.' : 'Progress stays in this browser. It is not shared with the community or synced to other devices. Older totals may include steps outside this recent history.';
    el('history').replaceChildren(...recentDays().map(day=>{
      const li=document.createElement('li'),date=document.createElement('span'),label=document.createElement('span');
      date.textContent=new Date(day+'T12:00:00').toLocaleDateString(undefined,{day:'numeric',month:'short'});
      label.textContent=state.days[day]?'Done':'No record';
      li.className=state.days[day]?'is-done':'';li.title=state.days[day]?.title||'No step recorded';li.append(date,label);return li;
    }));
  }
  function show() {
    shownDay=localDayKey();selected=dailyStep(el('goal').value,Number(el('time').value),shownDay,offset);renderStep(selected);progress();
  }
  for(const id of ['goal','time']) el(id).addEventListener('change',()=>{offset=0;show();});
  el('another').addEventListener('click',()=>{offset++;show();});
  el('done').addEventListener('click',()=>{
    const today=localDayKey();
    if(today!==shownDay){offset=0;show();el('todayStatus').textContent='A new day has started. Review this step before marking it.';return;}
    state=markDaily(storedState()||state,today,selected);save();progress();
  });
  el('undo').addEventListener('click',()=>{state=undoDaily(storedState()||state,localDayKey());save();progress();});
  wireSharing(()=>selected.title+'\n'+selected.actions.join('\n'),'daily.html');show();
}
if(mode==='compatibility') {
  const fields=['pace','setting','style'];
  const profile = prefix => Object.fromEntries(fields.map(key=>[key,el(prefix+key).value]));
  function reset() {el('output').hidden=true;el('toolStatus').textContent='Your choices changed. Build a new plan to use them.';}
  el('compare').addEventListener('change',()=>{el('second-person').hidden=!el('compare').checked;reset();});
  for(const id of [...fields,...fields.map(key=>'other-'+key)]) el(id).addEventListener('change',reset);
  el('go').addEventListener('click',()=>{
    const plan=friendshipPlan(profile(''),el('compare').checked?profile('other-'):null);
    el('comparison').replaceChildren(...plan.rows.map(row=>{
      const tr=document.createElement('tr');
      const title=document.createElement('th');title.scope='row';title.textContent=({pace:'Pace',setting:'Setting',style:'Connection'})[row.key];tr.append(title);
      for(const text of [row.first,row.second,row.question]){const td=document.createElement('td');td.textContent=text;tr.append(td);}return tr;
    }));
    el('result').textContent='One plan to discuss: '+plan.activity;
    el('message').textContent=plan.invitation;
    el('output').hidden=false;el('shareStatus').textContent='';
    el('toolStatus').textContent='Your discussion plan is ready. Agree the details with the other person; no compatibility score is calculated.';
  });
  el('copy').addEventListener('click',()=>copy(el('message').textContent,el('shareStatus')));
}
for(const button of document.querySelectorAll('button[data-copy-target]')) {
  const target=el(button.dataset.copyTarget),status=button.parentElement.querySelector('[role="status"]');
  if(target&&status){button.hidden=false;button.addEventListener('click',()=>copy(target.innerText.trim(),status));}
}
