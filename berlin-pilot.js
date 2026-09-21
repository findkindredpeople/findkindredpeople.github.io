import {pilotKey,newPilot,readPilot,trackPilot,pilotSummary,pilotReport} from './pilot-metrics.mjs?v=20260921-1';
const $ = id => document.getElementById(id);
const panel = $('pilot-panel');
function update() {
  const state = readPilot();
  $('pilot-active').hidden = !state; $('pilot-start-form').hidden = !!state;
  if (!state) {$('pilot-report').value = ''; return;}
  const summary = pilotSummary(state);
  $('pilot-summary').textContent = `${summary.days} ${summary.days === 1 ? 'day' : 'days'} used · ${summary.choose} activity selections · ${summary.organiser} organiser-link clicks. ${summary.returned ? 'A return on another day is recorded.' : 'No return on another day recorded yet.'}`;
  $('pilot-expiry').textContent = `Recording ends ${new Date(state.expiresAt).toLocaleDateString()}. Expired data is removed the next time this page opens.`;
  const report = pilotReport(state,$('pilot-feedback').value);
  if ($('pilot-report').value !== report) $('pilot-draft').hidden = true;
  $('pilot-report').value = report;
}
export function refreshPilot() {if (panel) update();}
if (panel) {
  $('pilot-controls').hidden = false;
  trackPilot('browse'); update();
  if (new URLSearchParams(location.search).get('pilot') === '1') panel.open = true;
  $('pilot-start-form').addEventListener('submit',event => {
    event.preventDefault(); if (!$('pilot-consent').checked) return;
    try {localStorage.setItem(pilotKey,JSON.stringify(newPilot())); trackPilot('browse'); $('pilot-status').textContent = 'The optional pilot is active in this browser. Nothing is sent automatically.'; update();}
    catch {$('pilot-status').textContent = 'This browser cannot save pilot counters. You can still use the collection and send ordinary feedback.';}
  });
  $('pilot-stop').addEventListener('click',() => {
    try {localStorage.removeItem(pilotKey); $('pilot-consent').checked = false; $('pilot-feedback').value = ''; $('pilot-draft').hidden = true; update(); $('pilot-status').textContent = 'Pilot recording stopped and its local counters deleted. Your saved shortlist and planner are unchanged.';}
    catch {$('pilot-status').textContent = 'Browser storage could not be changed. Clear this site’s browser data to remove the counters.';}
  });
  $('pilot-feedback').addEventListener('input',() => {$('pilot-draft').hidden = true; update();});
  $('pilot-download').addEventListener('click',() => {
    const state = readPilot(); if (!state) {update(); return;}
    const url = URL.createObjectURL(new Blob([pilotReport(state,$('pilot-feedback').value)],{type:'text/plain;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = 'kindred-berlin-pilot.txt'; document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    $('pilot-status').textContent = 'Report download started. It stays under your control until you choose to share it.';
  });
  $('pilot-email-draft').addEventListener('click',() => {
    const state = readPilot(); if (!state) {update(); return;}
    update(); $('pilot-email-link').href = `mailto:nadiiahonda34@gmail.com?subject=${encodeURIComponent('Kindred Berlin: voluntary pilot feedback')}&body=${encodeURIComponent(pilotReport(state,$('pilot-feedback').value))}`;
    $('pilot-draft').hidden = false; $('pilot-status').textContent = 'Draft ready. Nothing has been sent. Sending it will disclose your email address to Kindred.';
  });
  panel.addEventListener('toggle',() => {if (panel.open) update();});
  document.addEventListener('visibilitychange',()=>{if (!document.hidden) {trackPilot('browse'); update();}});
}
