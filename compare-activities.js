import {evaluateActivity} from './activity-fit.mjs';

const $ = id => document.getElementById(id);
const form = $('comparison-form');
const keys = ['name', 'url', 'duration', 'travel', 'fee', 'transport', 'newcomers', 'schedule', 'access', 'notes'];
let exportText = '';
const number = id => $(id).value.trim() === '' ? null : Number($(id).value);
const money = (value, currency) => `${currency} ${value.toFixed(2)}`;
const el = (tag, text) => {const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node;};
const status = text => {$('comparison-status').textContent = text;};

function compare() {
  const limits = {minutes: Number($('time-limit').value), cost: Number($('cost-limit').value)};
  const currency = $('currency').value;
  const activities = [1, 2, 3].map(i => Object.fromEntries(keys.map(key => [key, ['duration', 'travel', 'fee', 'transport'].includes(key) ? number(`a${i}-${key}`) : $(`a${i}-${key}`).value.trim()]))).filter(a => a.name);
  if (activities.length < 2) {status('Give at least two activities a name before comparing.'); $('a1-name').focus(); return;}
  const output = $('comparison-results'); output.replaceChildren();
  const heading = el('h2', 'Your practical comparison'); heading.id = 'comparison-heading'; heading.tabIndex = -1; output.append(heading);
  const limitText = `Per visit: up to ${limits.minutes} minutes including return travel and ${money(limits.cost, currency)} including transport.`;
  const sample = !$('example-notice').hidden;
  output.append(el('p', sample ? 'Fictional example: these are not real listings or verified prices.' : 'Based only on the details you entered. Check them with each organiser.'));
  output.append(el('p', limitText));
  const grid = el('div'); grid.className = 'comparison-cards'; output.append(grid);
  const parts = ['KINDRED — ACTIVITY COMPARISON', sample ? 'Fictional example, not real listings.' : 'User-entered information; not verified by Kindred.', limitText];
  for (const activity of activities) {
    const result = evaluateActivity(activity, limits);
    const card = el('section'); card.className = 'comparison-result';
    card.append(el('h3', activity.name));
    const badge = el('p', result.status); badge.className = `fit-status ${result.blockers.length ? 'fit-no' : result.questions.length ? 'fit-unknown' : 'fit-yes'}`; card.append(badge);
    const totals = `Time: ${result.minutes === null ? 'not fully known' : result.minutes + ' min'} · Cost: ${result.cost === null ? 'not fully known' : money(result.cost, currency)}`;
    card.append(el('p', totals));
    const details = `Session: ${activity.duration ?? '?'} min + return travel: ${activity.travel ?? '?'} min. Visit fee: ${activity.fee === null ? '?' : money(activity.fee, currency)} + transport: ${activity.transport === null ? '?' : money(activity.transport, currency)}.`;
    card.append(el('p', details));
    const reasons = [...result.blockers, ...result.questions];
    if (!reasons.length) reasons.push('A possible next step is to confirm the next date and booking terms. This result does not verify safety or guarantee a good experience.');
    const list = el('ul'); reasons.forEach(reason => list.append(el('li', reason))); card.append(list);
    let listing = '';
    if (activity.url) {
      try {const url = new URL(activity.url); if (['http:', 'https:'].includes(url.protocol)) {const link = el('a', 'Open your saved listing'); link.href = url.href; link.rel = 'noopener noreferrer'; link.target = '_blank'; card.append(link); listing = url.href;}} catch { /* Invalid input is rejected by the form. */ }
    }
    if (activity.notes) card.append(el('p', `Your notes: ${activity.notes}`));
    grid.append(card);
    parts.push(`\n${activity.name}\n${result.status}\n${totals}\n${details}\n${reasons.map(x => '- ' + x).join('\n')}${listing ? '\nListing: ' + listing : ''}${activity.notes ? '\nNotes: ' + activity.notes : ''}`);
  }
  output.hidden = false; $('comparison-actions').hidden = false; $('comparison-copy-fallback').hidden = true;
  exportText = parts.join('\n\n') + '\n\nhttps://findkindredpeople.com/compare-activities.html\n';
  status('Comparison updated. You can copy, download or print these results.'); heading.focus();
}

form.hidden = false;
form.addEventListener('submit', event => {event.preventDefault(); compare();});
form.addEventListener('input', () => {
  // Hide old results so changed inputs cannot be mistaken for a current comparison.
  $('comparison-results').hidden = true; $('comparison-actions').hidden = true; $('comparison-copy-fallback').hidden = true;
  exportText = ''; status('Details changed. Select “Compare activities” to update your results.');
});
$('load-example').addEventListener('click', () => {
  form.reset(); $('time-limit').value = '90'; $('cost-limit').value = '15';
  const example = [
    {name:'Example library discussion',duration:60,travel:20,fee:0,transport:4,newcomers:'yes',schedule:'yes',access:'yes',notes:'Fictional example. Ask whether the next date is confirmed.'},
    {name:'Example craft workshop',duration:90,travel:40,fee:18,transport:4,newcomers:'yes',schedule:'yes',access:'yes',notes:'Fictional example. The fee includes materials.'},
    {name:'Example language table',duration:60,fee:0,newcomers:'unknown',schedule:'yes',access:'unknown',notes:'Fictional example with missing travel and joining details.'}
  ];
  example.forEach((a, i) => keys.forEach(key => {$(`a${i + 1}-${key}`).value = a[key] ?? (['newcomers', 'schedule', 'access'].includes(key) ? 'unknown' : '');}));
  $('example-notice').hidden = false; compare();
});
$('clear-comparison').addEventListener('click', () => {
  form.reset(); $('example-notice').hidden = true; $('comparison-results').hidden = true; $('comparison-actions').hidden = true; $('comparison-copy-fallback').hidden = true; exportText = '';
  status('All activity details cleared. Nothing was saved by this tool.'); $('a1-name').focus();
});
$('copy-comparison').addEventListener('click', async () => {
  try {await navigator.clipboard.writeText(exportText); status('Comparison copied.');}
  catch {$('comparison-copy-fallback').hidden = false; $('comparison-text').value = exportText; $('comparison-text').focus(); $('comparison-text').select(); status('Copy the selected text below.');}
});
$('download-comparison').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([exportText], {type:'text/plain;charset=utf-8'}));
  const link = el('a'); link.href = url; link.download = 'kindred-activity-comparison.txt'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); status('Your comparison download has started.');
});
$('print-comparison').addEventListener('click', () => window.print());
