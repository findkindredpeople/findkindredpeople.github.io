import {byId,berlinToday} from './berlin-activities-data.mjs?v=20260921-1';
export const pilotKey = 'kindred-berlin-pilot-v1';
export const pilotDays = 30;
const events = ['choose','organiser','compare','plan','calendar'];
export function newPilot(now = new Date()) {
  return {version:1,consent:true,startedAt:now.toISOString(),expiresAt:new Date(+now + pilotDays*86400000).toISOString(),days:{}};
}
export function validPilot(value, now = new Date()) {
  if (!value || value.version !== 1 || value.consent !== true || typeof value.days !== 'object' || !value.days || Array.isArray(value.days)) return null;
  const start = Date.parse(value.startedAt), end = Date.parse(value.expiresAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > +now || end <= +now || end !== start + pilotDays*86400000) return null;
  const days = {};
  for (const [day,row] of Object.entries(value.days).slice(0,31)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < berlinToday(new Date(start)) || day > berlinToday(now) || !row || typeof row !== 'object') continue;
    days[day] = Object.fromEntries(events.map(event => [event,Array.isArray(row[event]) ? [...new Set(row[event].filter(id=>typeof id === 'string' && (byId.has(id) || event === 'compare' && id === 'comparison')))].slice(0,20) : []]));
  }
  return {...newPilot(new Date(start)),days};
}
export function recordPilot(value, event, id = '', now = new Date()) {
  const state = validPilot(value,now); if (!state) return null;
  if (event !== 'browse' && !events.includes(event)) return state;
  if (event !== 'browse' && event !== 'compare' && !byId.has(id)) return state;
  const day = berlinToday(now);
  state.days[day] ||= Object.fromEntries(events.map(key=>[key,[]]));
  if (event !== 'browse') {
    const key = event === 'compare' ? 'comparison' : id;
    if (!state.days[day][event].includes(key)) state.days[day][event].push(key);
  }
  return state;
}
export function pilotSummary(state) {
  const days = Object.keys(state.days).sort();
  const totals = Object.fromEntries(events.map(event=>[event,Object.values(state.days).reduce((sum,row)=>sum+(row[event]?.length || 0),0)]));
  return {days:days.length,returned:days.length > 1,firstDay:days[0] || '',lastDay:days.at(-1) || '',...totals};
}
export function pilotReport(state, feedback = '') {
  const totals = pilotSummary(state);
  return `KINDRED BERLIN — VOLUNTARY PILOT REPORT\nThis browser only; not site-wide visitor totals.\nPeriod: ${totals.firstDay || 'not started'} to ${totals.lastDay || 'not started'}\nDays the collection was used: ${totals.days}\nReturned on another Berlin calendar day: ${totals.returned ? 'Yes' : 'Not recorded'}\nActivity selections: ${totals.choose}\nOrganiser-link clicks: ${totals.organiser}\nComparison openings: ${totals.compare}\nPlanner-link clicks: ${totals.plan}\nCalendar download starts: ${totals.calendar}\n\nCounts are at most one per activity per Berlin calendar day; comparison is at most one per day. Clicking does not prove attendance, booking or successful calendar import. This opt-in sample is not representative of all visitors.\n\nMy feedback (optional):\n${String(feedback).trim().slice(0,600) || 'Not provided'}\n\nPrivate product feedback only, not a public visit review. No permission to publish this feedback is given by sending this report.\n`;
}
export function readPilot() {
  try {
    const raw = localStorage.getItem(pilotKey); if (!raw) return null;
    const state = validPilot(JSON.parse(raw));
    if (!state) localStorage.removeItem(pilotKey);
    return state;
  } catch {try {localStorage.removeItem(pilotKey);} catch {} return null;}
}
export function trackPilot(event,id) {
  const state = recordPilot(readPilot(),event,id); if (!state) return false;
  try {localStorage.setItem(pilotKey,JSON.stringify(state)); return true;} catch {return false;}
}
