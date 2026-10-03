import {evaluateActivity} from './activity-fit.mjs?v=20261004-1';
import {byId,selectedIds,toComparison} from './berlin-activities-data.mjs';

import {toolText,comparisonData} from './german-tools.mjs?v=20261004-1';
const language=document.documentElement.lang==='de'?'de':'en',de=language==='de',t=text=>toolText(text,language);
const $ = id => document.getElementById(id);
const form = $('comparison-form');
const keys = ['name', 'url', 'duration', 'travel', 'fee', 'transport', 'newcomers', 'schedule', 'access', 'notes'];
let exportText = '';
let imported = false;
const number = id => $(id).value.trim() === '' ? null : Number($(id).value);
const money = (value, currency) => `${currency} ${value.toFixed(2)}`;
const el = (tag, text) => {const node = document.createElement(tag); if (text !== undefined) node.textContent = t(text); return node;};
const status = text => {$('comparison-status').textContent = t(text);};

function compare() {
  const limits = {minutes: Number($('time-limit').value), cost: Number($('cost-limit').value)};
  const currency = $('currency').value;
  const activities = [1, 2, 3].map(i => Object.fromEntries(keys.map(key => [key, ['duration', 'travel', 'fee', 'transport'].includes(key) ? number(`a${i}-${key}`) : $(`a${i}-${key}`).value.trim()]))).filter(a => a.name);
  if (activities.length < 2) {status('Give at least two activities a name before comparing.'); $('a1-name').focus(); return;}
  const output = $('comparison-results'); output.replaceChildren();
  const heading = el('h2', 'Your practical comparison'); heading.id = 'comparison-heading'; heading.tabIndex = -1; output.append(heading);
  const limitText = de?`Pro Besuch: bis zu ${limits.minutes} Minuten einschließlich Hin- und Rückweg und ${money(limits.cost,currency)} einschließlich Fahrtkosten.`:`Per visit: up to ${limits.minutes} minutes including return travel and ${money(limits.cost, currency)} including transport.`;
  const sample = !$('example-notice').hidden;
  output.append(el('p', sample ? 'Fictional example: these are not real listings or verified prices.' : imported ? 'Starts with published Berlin listing details, plus your edits. Source checks are dated; confirm current conditions with each organiser.' : 'Based only on the details you entered. Check them with each organiser.'));
  output.append(el('p', limitText));
  const grid = el('div'); grid.className = 'comparison-cards'; output.append(grid);
  const parts = ['KINDRED — ACTIVITY COMPARISON', sample ? 'Fictional example, not real listings.' : imported ? 'Published Berlin listing details plus user edits. See dated source notes and confirm current conditions.' : 'User-entered information; not verified by Kindred.', limitText].map(t);
  for (const activity of activities) {
    const result = evaluateActivity(activity, limits,language);
    const card = el('section'); card.className = 'comparison-result';
    card.append(el('h3', activity.name));
    const badge = el('p', result.status); badge.className = `fit-status ${result.blockers.length ? 'fit-no' : result.questions.length ? 'fit-unknown' : 'fit-yes'}`; card.append(badge);
    const totals = de?`Zeit: ${result.minutes===null?'nicht vollständig bekannt':result.minutes+' Min.'} · Kosten: ${result.cost===null?'nicht vollständig bekannt':money(result.cost,currency)}`:`Time: ${result.minutes === null ? 'not fully known' : result.minutes + ' min'} · Cost: ${result.cost === null ? 'not fully known' : money(result.cost, currency)}`;
    card.append(el('p', totals));
    const details = de?`Veranstaltung: ${activity.duration??'?'} Min. + Hin- und Rückweg: ${activity.travel??'?'} Min. Teilnahme und Material: ${activity.fee===null?'?':money(activity.fee,currency)} + Fahrtkosten: ${activity.transport===null?'?':money(activity.transport,currency)}.`:`Session: ${activity.duration ?? '?'} min + return travel: ${activity.travel ?? '?'} min. Visit fee: ${activity.fee === null ? '?' : money(activity.fee, currency)} + transport: ${activity.transport === null ? '?' : money(activity.transport, currency)}.`;
    card.append(el('p', details));
    const reasons = [...result.blockers, ...result.questions];
    if (!reasons.length) reasons.push(t('A possible next step is to confirm the next date and booking terms. This result does not verify safety or guarantee a good experience.'));
    const list = el('ul'); reasons.forEach(reason => list.append(el('li', reason))); card.append(list);
    let listing = '';
    if (activity.url) {
      try {const url = new URL(activity.url); if (['http:', 'https:'].includes(url.protocol)) {const link = el('a', 'Open your saved listing'); link.href = url.href; link.rel = 'noopener noreferrer'; link.target = '_blank'; card.append(link); listing = url.href;}} catch { /* Invalid input is rejected by the form. */ }
    }
    if (activity.notes) card.append(el('p', `${de?'Deine Notizen':'Your notes'}: ${activity.notes}`));
    grid.append(card);
    parts.push(`\n${activity.name}\n${result.status}\n${totals}\n${details}\n${reasons.map(x => '- ' + x).join('\n')}${listing ? '\n'+(de?'Angebot: ':'Listing: ')+listing : ''}${activity.notes ? '\n'+(de?'Notizen: ':'Notes: ')+activity.notes : ''}`);
  }
  output.hidden = false; $('comparison-actions').hidden = false; $('comparison-copy-fallback').hidden = true;
  exportText = parts.join('\n\n') + '\n\nhttps://findkindredpeople.com/'+(de?'angebote-vergleichen.html':'compare-activities.html')+'\n';
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
  imported = false; $('berlin-import-notice').hidden = true;
  form.reset(); $('time-limit').value = '90'; $('cost-limit').value = '15';
  const example = [
    {name:de?'Beispiel: Bibliotheksgespräch':'Example library discussion',duration:60,travel:20,fee:0,transport:4,newcomers:'yes',schedule:'yes',access:'yes',notes:de?'Erfundenes Beispiel. Frage, ob der nächste Termin bestätigt ist.':'Fictional example. Ask whether the next date is confirmed.'},
    {name:de?'Beispiel: Handarbeitsworkshop':'Example craft workshop',duration:90,travel:40,fee:18,transport:4,newcomers:'yes',schedule:'yes',access:'yes',notes:de?'Erfundenes Beispiel. Material im Preis enthalten.':'Fictional example. The fee includes materials.'},
    {name:de?'Beispiel: Sprachtisch':'Example language table',duration:60,fee:0,newcomers:'unknown',schedule:'yes',access:'unknown',notes:de?'Erfundenes Beispiel mit unbekannter Fahrtzeit und Teilnahmebedingungen.':'Fictional example with missing travel and joining details.'}
  ];
  example.forEach((a, i) => keys.forEach(key => {$(`a${i + 1}-${key}`).value = a[key] ?? (['newcomers', 'schedule', 'access'].includes(key) ? 'unknown' : '');}));
  $('example-notice').hidden = false; compare();
});
$('clear-comparison').addEventListener('click', () => {
  imported = false; $('berlin-import-notice').hidden = true;
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
const berlinIds = selectedIds(new URLSearchParams(location.search).get('berlin'));
if (berlinIds.length) {
  imported = true; $('currency').value = 'EUR';
  berlinIds.map(id => comparisonData(byId.get(id),language)).forEach((activity,i) => keys.forEach(key => {$(`a${i+1}-${key}`).value = activity[key] ?? ''; }));
  $('berlin-import-notice').hidden = false;
  status(de?`${berlinIds.length} Berliner ${berlinIds.length===1?'Angebot übernommen':'Angebote übernommen'}. Ergänze Hin- und Rückweg, Fahrtkosten und Teilnahmebedingungen und vergleiche dann.`:`${berlinIds.length} Berlin ${berlinIds.length === 1 ? 'activity added' : 'activities added'}. Enter your return travel, transport costs and joining checks, then compare.`);
}

const languageLink=document.getElementById('tool-language');
if(languageLink){const ids=selectedIds(new URLSearchParams(location.search).get('berlin'));if(ids.length){const url=new URL(languageLink.getAttribute('href'),location.href);url.searchParams.set('berlin',ids.join(','));languageLink.href=url.href;}}
