import {activities,byId,checkedOn,berlinToday,nextDate,isExpired,selectedIds,matchesFilters} from './berlin-activities-data.mjs?v=20260921-1';
import {firstVisitMessage} from './first-visit.mjs?v=20260921-1';
import {trackPilot} from './pilot-metrics.mjs?v=20260921-1';
import {refreshPilot} from './berlin-pilot.js?v=20260921-1';
import {downloadCalendar} from './calendar.mjs';
const $ = id => document.getElementById(id), selected = new Set();
const track = (event,id) => {trackPilot(event,id); refreshPilot();};
let visitItem = null;
const saveKey = 'kindred-berlin-shortlist-v1';
const cards = new Map(activities.map(item => [item.id,$(item.id)]));
const status = text => {$('activity-status').textContent = text;};
const prettyDate = date => new Intl.DateTimeFormat('en-GB',{dateStyle:'full',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
function readSaved() {
  const value = JSON.parse(localStorage.getItem(saveKey) || 'null');
  return value?.version === 1 && Array.isArray(value.ids) ? selectedIds(value.ids.join(',')) : [];
}
function savedButtons() {
  try {const saved = readSaved(); $('restore-shortlist').disabled = !saved.length; $('delete-shortlist').disabled = !localStorage.getItem(saveKey);}
  catch {$('restore-shortlist').disabled = true; $('delete-shortlist').disabled = false;}
}
function selectionChanged() {
  for (const [id,card] of cards) card.querySelector('[data-select]').checked = selected.has(id);
  $('selection-summary').textContent = `${selected.size} of 3 selected. ${selected.size < 2 ? 'Choose at least 2 to compare.' : 'Add your travel and personal requirements on the next page.'}`;
  $('selected-names').replaceChildren();
  for (const id of selected) {
    const li = document.createElement('li'), remove = document.createElement('button');
    li.append(byId.get(id).title+' '); remove.type = 'button'; remove.className = 'text-button'; remove.textContent = 'Remove'; remove.setAttribute('aria-label','Remove '+byId.get(id).title);
    remove.addEventListener('click',() => {selected.delete(id); selectionChanged(); status('Activity removed from your shortlist.');});
    li.append(remove); $('selected-names').append(li);
  }
  $('selection-dock').hidden = !selected.size; document.body.classList.toggle('has-shortlist',!!selected.size);
  $('dock-count').textContent = `${selected.size} of 3 selected`;
  $('dock-compare').disabled = selected.size < 2; $('share-shortlist').disabled = !selected.size;
  $('shortlist-link-box').hidden = true;
  $('compare-selected').disabled = selected.size < 2; $('save-shortlist').disabled = !selected.size;
}
function filter() {
  const today = berlinToday();
  const filters = {weekday:$('filter-weekday').value,startAfter:$('filter-start').value,finishBy:$('filter-end').value,query:$('activity-query').value,area:$('filter-area').value,category:$('filter-category').value,language:$('filter-language').value,when:$('filter-when').value,duration:$('filter-duration').value,free:$('filter-cost').value === 'free'};
  const sorted = [...activities].sort((a,b) => (nextDate(a,today) || '9999').localeCompare(nextDate(b,today) || '9999') || a.title.localeCompare(b.title));
  let count = 0, dated = 0;
  $('time-filter-note').hidden = !(filters.startAfter && filters.finishBy && filters.startAfter >= filters.finishBy);
  $('english-note').hidden = filters.language !== 'en';
  const english = activities.filter(item => item.language === 'en' && !isExpired(item,today));
  const englishDated = english.filter(item=>nextDate(item,today));
  $('english-note').textContent = `${english.length} ${english.length === 1 ? "programme" : "programmes"} in this collection explicitly ${english.length === 1 ? "lists" : "list"} English discussion; ${englishDated.length} ${englishDated.length === 1 ? "has" : "have"} a future published date. A page written in English does not mean every activity runs in English. Ask about dates and language before travelling.`;
  for (const item of sorted) {
    const card = cards.get(item.id), next = nextDate(item,today), visible = matchesFilters(item,filters,today);
    card.hidden = !visible; if (visible) {count++; if (next) dated++;}
    card.querySelector('[data-next]').textContent = next ? `Next published date: ${prettyDate(next)} · ${item.start}–${item.end}` : `Ask for the next date${item.startsIn && today < item.startsIn+'-01' ? ' · starts October 2026' : ''}`;
    card.querySelector('[data-calendar]').hidden = !next;
    $('activity-list').append(card);
    if (isExpired(item,today)) selected.delete(item.id);
  }
  $('activity-count').textContent = `${count} ${count === 1 ? 'programme' : 'programmes'} match · ${dated} with a published date · ${count-dated} need a date confirmed`;
  $('no-activities').hidden = count !== 0;
  selectionChanged();
}
document.querySelector('.activity-filters').hidden = false; $('shortlist').hidden = false;
for (const card of cards.values()) {card.querySelector('.select-activity').hidden = false; card.querySelector('[data-visit]').hidden = false;}
for (const button of document.querySelectorAll('[data-preset]')) button.addEventListener('click',() => {
  $('filters').reset();
  const preset = button.dataset.preset;
  if (preset === 'week') $('filter-when').value = '7';
  if (preset === 'free') $('filter-cost').value = 'free';
  if (preset === 'english') $('filter-language').value = 'en';
  if (preset === 'german') $('filter-language').value = 'de';
  filter();
});
$('reset-empty').addEventListener('click',()=>{$('filters').reset(); filter(); $('activity-query').focus();});
$('filters').addEventListener('input',filter); $('filters').addEventListener('submit',event => event.preventDefault());
$('filters').addEventListener('reset',() => setTimeout(filter,0));
$('activity-list').addEventListener('change',event => {
  if (!event.target.matches('[data-select]')) return;
  const id = event.target.value;
  if (event.target.checked && selected.size >= 3) {event.target.checked = false; status('You can compare up to 3 activities. Untick one before adding another.'); return;}
  if (event.target.checked) {selected.add(id); track('choose',id);} else selected.delete(id);
  selectionChanged(); status(`${selected.size} ${selected.size === 1 ? 'activity' : 'activities'} selected.`);
});
for (const button of [$('compare-selected'),$('dock-compare')]) button.addEventListener('click',() => {if (selected.size >= 2) {track('compare'); location.href = 'compare-activities.html?berlin='+encodeURIComponent([...selected].join(','));}});
$('share-shortlist').addEventListener('click',async () => {
  if (!selected.size) return;
  const url = new URL('berlin-activities.html',location.href); url.searchParams.set('pick',[...selected].join(','));
  $('shortlist-link').value = url.href; $('shortlist-link-box').hidden = false;
  try {await navigator.clipboard.writeText(url.href); status('Shortlist link copied. Share it yourself; only public activity IDs are included.');}
  catch {$('shortlist-link').focus(); $('shortlist-link').select(); status('Copy the selected link to share your shortlist.');}
});
$('clear-shortlist').addEventListener('click',() => {selected.clear(); selectionChanged(); status('Selection cleared. Any saved shortlist is unchanged; use Delete saved to remove it.');});
$('save-shortlist').addEventListener('click',() => {
  try {localStorage.setItem(saveKey,JSON.stringify({version:1,ids:[...selected],savedAt:new Date().toISOString()})); savedButtons(); status('Shortlist saved in this browser. Use Restore saved when you return.');}
  catch {status('This browser could not save the shortlist. You can still compare the selected activities.');}
});
$('restore-shortlist').addEventListener('click',() => {
  try {const saved = readSaved(); selected.clear(); saved.filter(id => !isExpired(byId.get(id))).forEach(id => selected.add(id)); selectionChanged(); status(selected.size ? 'Saved shortlist restored. Past one-off sessions are omitted; confirm the remaining dates.' : 'No current activities remain in this saved shortlist. Choose new ones.');}
  catch {status('The saved shortlist could not be read. You can delete it and save a new selection.');}
});
$('delete-shortlist').addEventListener('click',() => {try {localStorage.removeItem(saveKey); savedButtons(); status('Saved shortlist deleted from this browser. Your current selection is unchanged.');} catch {status('Browser storage is unavailable. You can clear this site’s data in your browser settings.');}});
$('activity-list').addEventListener('click',event => {
  const visit = event.target.closest('[data-visit]'); if (visit) openVisit(visit.dataset.visit);
  const button = event.target.closest('[data-calendar]'); if (!button) return;
  const item = byId.get(button.dataset.calendar), date = nextDate(item);
  if (!date) {filter(); status('That published date has passed. Check the organiser for the next session.'); return;}
  try {downloadCalendar({title:item.title,location:`${item.venue}, ${item.address}`,description:`Source checked ${item.checkedOn}. ${item.booking} ${item.cost}`,date,time:item.start,duration:item.duration,source:item.source,uid:`${item.id}-${date}`},`kindred-${item.id}-${date}.ics`); track('calendar',item.id); status('Calendar download started for the next published session, in Berlin time. Import it into your calendar; this does not reserve a place.');}
  catch (error) {status(error.message);}
});
$('visit-feedback-form').hidden = false; $('feedback-date').max = berlinToday();
$('visit-feedback-form').addEventListener('submit',event => {
  event.preventDefault(); const item = byId.get($('feedback-activity').value); if (!item) return;
  if ($('feedback-date').value > berlinToday()) {$('feedback-status').textContent = 'Use the date of a visit that already happened.'; return;}
  const body = `Activity: ${item.title}\nVisit date: ${$('feedback-date').value}\nSource: ${item.source}\nLanguage used: ${$('feedback-language').value.trim() || 'Not provided'}\nComing on my own: ${$('feedback-alone').value || 'Not provided'}\n\nMy first-hand tip:\n${$('feedback-tip').value.trim()}\n\nPublication permission: ${$('feedback-permission').checked ? 'I allow Kindred to publish this tip without my name after editorial review.' : 'Private feedback only. I do not permit publication.'}`;
  $('feedback-text').value = body; $('feedback-email').href = `mailto:nadiiahonda34@gmail.com?subject=${encodeURIComponent('Kindred: Berlin first-visit tip')}&body=${encodeURIComponent(body)}`; $('feedback-draft').hidden = false; $('feedback-status').textContent = 'Draft prepared. Read it, then open your email app or copy it. Nothing has been sent.'; $('feedback-text').focus();
});
$('visit-feedback-form').addEventListener('input',event => {if (event.target.id !== 'feedback-text') {$('feedback-draft').hidden = true; $('feedback-status').textContent = 'Details changed. Prepare a new draft before sending.';}});
if ((Date.parse(berlinToday()) - Date.parse(checkedOn)) / 86400000 > 30) {$('freshness-note').hidden = false; $('freshness-note').textContent = 'These sources were last checked on 20 September 2026, more than 30 days ago. Details may have changed. Recheck every session on its organiser’s page.';}
const shared = selectedIds(new URLSearchParams(location.search).get('pick'));
shared.filter(id=>!isExpired(byId.get(id))).forEach(id=>selected.add(id));
if (shared.length) status('Shared shortlist loaded. It is not saved on this device until you choose Save. Confirm dates before travelling.');
filter(); savedButtons();
document.addEventListener('visibilitychange',() => {if (!document.hidden) filter();});

function updateVisitMessage() {
  if (!visitItem) return;
  $('visit-message').value = firstVisitMessage(visitItem,$('visit-language').value,$('visit-english').checked);
  $('visit-copy-status').textContent = '';
}
function openVisit(id) {
  visitItem = byId.get(id); if (!visitItem) return;
  $('visit-dialog-heading').textContent = 'Your first visit: '+visitItem.title;
  const date = nextDate(visitItem);
  $('visit-facts').textContent = `${visitItem.venue} · ${date ? prettyDate(date)+' · '+visitItem.start+'–'+visitItem.end : 'Next date needs confirmation'}. ${visitItem.languageText} ${visitItem.cost}`;
  $('visit-tip').textContent = 'Kindred idea: '+visitItem.tip;
  $('visit-source').href = visitItem.source; $('visit-source').dataset.organiser = id;
  $('visit-plan').href = 'friendship-planner.html?berlin='+encodeURIComponent(id); $('visit-plan').dataset.plan = id;
  $('visit-english').checked = $('filter-language').value === 'en';
  updateVisitMessage(); $('visit-dialog').showModal();
}
$('visit-language').addEventListener('change',updateVisitMessage);
$('visit-english').addEventListener('change',updateVisitMessage);
$('copy-visit-message').addEventListener('click',async () => {
  try {await navigator.clipboard.writeText($('visit-message').value); $('visit-copy-status').textContent = 'Questions copied. Choose a contact method on the organiser’s page.';}
  catch {$('visit-message').focus(); $('visit-message').select(); $('visit-copy-status').textContent = 'Select and copy the questions above.';}
});
document.addEventListener('click',event => {
  const source = event.target.closest('a[data-organiser]'); if (source && byId.has(source.dataset.organiser)) track('organiser',source.dataset.organiser);
  const plan = event.target.closest('a[data-plan]'); if (plan && byId.has(plan.dataset.plan)) track('plan',plan.dataset.plan);
});
