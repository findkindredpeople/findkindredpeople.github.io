import {activities,byId,checkedOn,berlinToday,nextDate,selectedIds} from './berlin-activities-data.mjs?v=20261003-2';
import {localizeActivity} from './berlin-activities-de.mjs?v=20261003-1';
import {words,formatDate,addDays,futureSessions,discoveryMatch,currentProgrammes,cardMarkup,resultCount} from './berlin-discovery.mjs?v=20261003-2';
import {downloadCalendar} from './calendar.mjs?v=20261003-1';
const $=id=>document.getElementById(id),language=document.documentElement.lang==='de'?'de':'en',t=words[language],week=document.body.dataset.view==='week';
const selected=new Set(),saveKey='kindred-berlin-shortlist-v1';
const status=text=>{$('discovery-status').textContent=text;};
const filters=()=>({query:$('discovery-query').value,area:$('discovery-area').value,category:$('discovery-category').value,language:$('discovery-language').value,when:$('discovery-when').value,free:$('discovery-cost').value==='free'});
function updateSelection(){
 document.querySelectorAll('[data-select]').forEach(input=>{input.checked=selected.has(input.value);});
 $('discovery-selected').replaceChildren();
 for(const id of selected){
  const li=document.createElement('li'),remove=document.createElement('button');
  li.append(localizeActivity(byId.get(id),language).title+' ');remove.type='button';remove.className='text-button';remove.textContent=language==='de'?'Entfernen':'Remove';
  remove.setAttribute('aria-label',`${remove.textContent}: ${localizeActivity(byId.get(id),language).title}`);remove.onclick=()=>{selected.delete(id);updateSelection();};li.append(remove);$('discovery-selected').append(li);
 }
 $('selection-count').textContent=`${selected.size} ${t.selected}`;
 $('discovery-compare').disabled=selected.size<2;$('discovery-save').disabled=!selected.size;
}
function render(){
 const now=new Date(),today=berlinToday(now),f=filters();
 let entries;
 if(week){
  const matching=activities.filter(item=>discoveryMatch(item,{...f,when:''},today,language));
  entries=futureSessions(matching,{now,days:Number(f.when)||7});
 }else{
  entries=currentProgrammes(activities,today).filter(item=>discoveryMatch(item,f,today,language))
   .sort((a,b)=>(nextDate(a,today)||'9999').localeCompare(nextDate(b,today)||'9999')||localizeActivity(a,language).title.localeCompare(localizeActivity(b,language).title))
   .map(item=>({item,date:nextDate(item,today)}));
 }
 $('discovery-list').innerHTML=entries.map(({item,date})=>cardMarkup(item,{language,date,session:week})).join('');
 document.querySelectorAll('[data-calendar],.select-activity').forEach(element=>{element.hidden=false;});
 $('discovery-count').textContent=resultCount(entries.length,language,week);
 $('date-range').textContent=week?`${t.period}: ${formatDate(today,language)} – ${formatDate(addDays(today,(Number(f.when)||7)-1),language)}`:t.all;
 $('discovery-empty').hidden=!!entries.length;$('empty-message').textContent=week?t.empty:t.none;$('discovery-widen').hidden=true;
 if(!entries.length&&f.when==='7'){
  const fitting=activities.filter(item=>discoveryMatch(item,{...f,when:''},today,language));
  const later=futureSessions(fitting,{now,days:365})[0];
  if(later){$('empty-message').textContent+=` ${t.later} ${formatDate(later.date,language)}.`;$('discovery-widen').hidden=Date.parse(later.date)-Date.parse(today)>=30*86400000;}
 }
 updateSelection();
}
$('discovery-controls').hidden=false;$('discovery-shortlist').hidden=false;
const initial=new URLSearchParams(location.search);
for(const [param,id] of [['language','discovery-language'],['area','discovery-area'],['category','discovery-category']]){
 const value=initial.get(param),control=$(id);if(value&&[...control.options].some(option=>option.value===value))control.value=value;
}
const currentIds=new Set(currentProgrammes(activities).map(item=>item.id));
for(const id of selectedIds(initial.get('pick')).filter(id=>currentIds.has(id)))selected.add(id);
$('discovery-filters').addEventListener('submit',event=>event.preventDefault());
$('discovery-filters').addEventListener('input',render);
$('discovery-filters').addEventListener('reset',()=>setTimeout(render,0));
$('discovery-widen').onclick=()=>{$('discovery-when').value='30';render();};
$('discovery-list').addEventListener('change',event=>{
 const input=event.target;if(!input.matches('[data-select]'))return;
 if(input.checked&&selected.size>=3&&!selected.has(input.value)){input.checked=false;status(t.max);return;}
 input.checked?selected.add(input.value):selected.delete(input.value);updateSelection();
});
$('discovery-list').addEventListener('click',event=>{
 const button=event.target.closest('[data-calendar]');if(!button)return;
 const item=byId.get(button.dataset.calendar),date=button.dataset.date;
 if(!item||!item.dates.includes(date))return;
 const a=localizeActivity(item,language);
 try{downloadCalendar({title:a.title,location:`${a.venue}, ${a.address}`,description:`${a.booking} ${a.cost}`,date,time:a.start,duration:a.duration,source:a.source,language},`kindred-${a.id}-${date}.ics`);status(t.calendarDone);}catch{status(t.calendarError);}
});
$('discovery-compare').onclick=()=>{if(selected.size>=2)location.href='compare-activities.html?berlin='+encodeURIComponent([...selected].join(','));};
$('discovery-save').onclick=()=>{try{localStorage.setItem(saveKey,JSON.stringify({version:1,ids:[...selected]}));status(t.saved);}catch{status(t.storageError);}};
$('discovery-restore').onclick=()=>{
 try{const saved=JSON.parse(localStorage.getItem(saveKey)||'null'),ids=saved?.version===1&&Array.isArray(saved.ids)?selectedIds(saved.ids.join(',')).filter(id=>currentIds.has(id)):[];
  if(!ids.length){status(t.noSaved);return;}selected.clear();ids.forEach(id=>selected.add(id));updateSelection();status(t.restored);
 }catch{status(t.storageError);}
};
$('discovery-delete').onclick=()=>{try{localStorage.removeItem(saveKey);status(t.deleted);}catch{status(t.storageError);}};
if(Date.parse(berlinToday())-Date.parse(checkedOn)>30*86400000){$('freshness-note').hidden=false;$('freshness-note').textContent=t.fresh;}
render();
