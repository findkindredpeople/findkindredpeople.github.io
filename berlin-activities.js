import {activities,byId,checkedOn,berlinToday,nextDate,isExpired,selectedIds,matchesFilters} from './berlin-activities-data.mjs';
import {downloadCalendar} from './calendar.mjs';
const $ = id => document.getElementById(id), selected = new Set();
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
  for (const id of selected) {const li = document.createElement('li'); li.textContent = byId.get(id).title; $('selected-names').append(li);}
  $('compare-selected').disabled = selected.size < 2; $('save-shortlist').disabled = !selected.size;
}
function filter() {
  const today = berlinToday();
  const filters = {query:$('activity-query').value,area:$('filter-area').value,category:$('filter-category').value,language:$('filter-language').value,when:$('filter-when').value,duration:$('filter-duration').value,free:$('filter-cost').value === 'free'};
  const sorted = [...activities].sort((a,b) => (nextDate(a,today) || '9999').localeCompare(nextDate(b,today) || '9999') || a.title.localeCompare(b.title));
  let count = 0;
  for (const item of sorted) {
    const card = cards.get(item.id), next = nextDate(item,today), visible = matchesFilters(item,filters,today);
    card.hidden = !visible; if (visible) count++;
    card.querySelector('[data-next]').textContent = next ? `Next published date: ${prettyDate(next)} · ${item.start}–${item.end}` : `Ask for the next date${item.startsIn && today < item.startsIn+'-01' ? ' · starts October 2026' : ''}`;
    card.querySelector('[data-calendar]').hidden = !next;
    $('activity-list').append(card);
    if (isExpired(item,today)) selected.delete(item.id);
  }
  $('activity-count').textContent = `${count} ${count === 1 ? 'programme' : 'programmes'} match · dates use Berlin time`;
  $('no-activities').hidden = count !== 0;
  selectionChanged();
}
document.querySelector('.activity-filters').hidden = false; $('shortlist').hidden = false;
for (const card of cards.values()) card.querySelector('.select-activity').hidden = false;
$('filters').addEventListener('input',filter); $('filters').addEventListener('submit',event => event.preventDefault());
$('filters').addEventListener('reset',() => setTimeout(filter,0));
$('activity-list').addEventListener('change',event => {
  if (!event.target.matches('[data-select]')) return;
  const id = event.target.value;
  if (event.target.checked && selected.size >= 3) {event.target.checked = false; status('You can compare up to 3 activities. Untick one before adding another.'); return;}
  if (event.target.checked) selected.add(id); else selected.delete(id);
  selectionChanged(); status(`${selected.size} ${selected.size === 1 ? 'activity' : 'activities'} selected.`);
});
$('compare-selected').addEventListener('click',() => {if (selected.size >= 2) location.href = 'compare-activities.html?berlin='+encodeURIComponent([...selected].join(','));});
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
  const button = event.target.closest('[data-calendar]'); if (!button) return;
  const item = byId.get(button.dataset.calendar), date = nextDate(item);
  if (!date) {filter(); status('That published date has passed. Check the organiser for the next session.'); return;}
  try {downloadCalendar({title:item.title,location:`${item.venue}, ${item.address}`,description:`Source checked ${item.checkedOn}. ${item.booking} ${item.cost}`,date,time:item.start,duration:item.duration,source:item.source,uid:`${item.id}-${date}`},`kindred-${item.id}-${date}.ics`); status('Calendar file downloaded for the next published session, in Berlin time. Import it into your calendar; this does not reserve a place.');}
  catch (error) {status(error.message);}
});
$('visit-feedback-form').hidden = false; $('feedback-date').max = berlinToday();
$('visit-feedback-form').addEventListener('submit',event => {
  event.preventDefault(); const item = byId.get($('feedback-activity').value); if (!item) return;
  if ($('feedback-date').value > berlinToday()) {$('feedback-status').textContent = 'Use the date of a visit that already happened.'; return;}
  const body = `Activity: ${item.title}\nVisit date: ${$('feedback-date').value}\nSource: ${item.source}\n\nMy first-hand tip:\n${$('feedback-tip').value.trim()}\n\nPublication permission: ${$('feedback-permission').checked ? 'I allow Kindred to publish this tip without my name after editorial review.' : 'Private feedback only. I do not permit publication.'}`;
  $('feedback-text').value = body; $('feedback-email').href = `mailto:nadiiahonda34@gmail.com?subject=${encodeURIComponent('Kindred: Berlin first-visit tip')}&body=${encodeURIComponent(body)}`; $('feedback-draft').hidden = false; $('feedback-status').textContent = 'Draft prepared. Read it, then open your email app or copy it. Nothing has been sent.'; $('feedback-text').focus();
});
$('visit-feedback-form').addEventListener('input',event => {if (event.target.id !== 'feedback-text') {$('feedback-draft').hidden = true; $('feedback-status').textContent = 'Details changed. Prepare a new draft before sending.';}});
if ((Date.parse(berlinToday()) - Date.parse(checkedOn)) / 86400000 > 30) {$('freshness-note').hidden = false; $('freshness-note').textContent = 'These sources were last checked on 20 September 2026, more than 30 days ago. Details may have changed. Recheck every session on its organiser’s page.';}
filter(); savedButtons();
document.addEventListener('visibilitychange',() => {if (!document.hidden) filter();});
