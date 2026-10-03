import {berlinToday,berlinZone,isExpired,matchesFilters,nextDate} from './berlin-activities-data.mjs';
import {categoryLabels,localizeActivity} from './berlin-activities-de.mjs';
export const words = {
  de:{next:'Nächster veröffentlichter Termin',unknown:'Nächsten Termin beim Veranstalter erfragen',when:'Wann',where:'Wo',cost:'Kosten',language:'Sprache',joining:'Teilnahme',minutes:'Minuten für die gesamte Veranstaltung. Berliner Zeit.',travel:'Fahrtkosten kommen hinzu.',tip:'Kindred-Idee für den ersten Besuch',source:'Details beim Veranstalter',checked:'Quelle geprüft am',plan:'Besuch planen (Englisch)',calendar:'Im Kalender vormerken',select:'Zum Vergleich hinzufügen',count:'passende Angebote',sessions:'veröffentlichte Termine',empty:'Für diese Auswahl ist kein Termin veröffentlicht.',none:'Keine Angebote passen zu dieser Auswahl.',later:'Nächster veröffentlichter Termin für deine übrige Auswahl:',next30:'Nächste 30 Tage anzeigen',selected:'von 3 ausgewählt',max:'Du kannst bis zu drei Angebote vergleichen.',saved:'Merkliste auf diesem Gerät gespeichert.',restored:'Gespeicherte Auswahl wiederhergestellt.',deleted:'Gespeicherte Merkliste gelöscht.',storageError:'Die Merkliste konnte in diesem Browser nicht gespeichert oder gelesen werden.',noSaved:'Keine gespeicherte Merkliste vorhanden.',calendarDone:'Kalenderdatei vorbereitet. Das ist keine Anmeldung oder Reservierung.',calendarError:'Kalenderdatei konnte nicht erstellt werden. Bitte nutze die Veranstalterseite.',period:'Zeitraum',all:'Alle aktuellen Angebote',fresh:'Die Quellen wurden vor mehr als 30 Tagen geprüft. Bitte kontrolliere aktuelle Angaben beim Veranstalter.'},
  en:{next:'Next published date',unknown:'Ask the organiser for the next date',when:'When',where:'Where',cost:'Cost',language:'Language',joining:'Joining',minutes:'minutes for the full session. Berlin time.',travel:'Travel costs are extra.',tip:'Kindred first-visit idea',source:'Organiser’s details',checked:'Source checked',plan:'Plan a visit',calendar:'Add a calendar reminder',select:'Add to comparison',count:'programmes match',sessions:'published sessions',empty:'No published sessions match this selection.',none:'No programmes match this selection.',later:'Next published date fitting your other choices:',next30:'Show the next 30 days',selected:'of 3 selected',max:'You can compare up to three programmes.',saved:'Shortlist saved on this device.',restored:'Saved selection restored.',deleted:'Saved shortlist deleted.',storageError:'This browser could not save or read the shortlist.',noSaved:'No saved shortlist found.',calendarDone:'Calendar file prepared. This is not a booking or registration.',calendarError:'The calendar file could not be created. Please use the organiser’s page.',period:'Date range',all:'All current programmes',fresh:'Sources were checked more than 30 days ago. Recheck current details with the organiser.'}
};
export const escapeHTML = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function formatDate(date, language='de') {
  return new Intl.DateTimeFormat(language==='de'?'de-DE':'en-GB',{dateStyle:'long',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
}
export function addDays(date,days) {return new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);}
export function berlinClock(now=new Date()) {
  return new Intl.DateTimeFormat('en-GB',{timeZone:berlinZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
}
export function futureSessions(items,{now=new Date(),days=7}={}) {
  const today=berlinToday(now),clock=berlinClock(now),until=addDays(today,days);
  return items.flatMap(item=>item.dates.filter(date=>date>=today&&date<until&&(date!==today||item.end>clock)).map(date=>({item,date})))
    .sort((a,b)=>a.date.localeCompare(b.date)||a.item.start.localeCompare(b.item.start)||a.item.id.localeCompare(b.item.id));
}
export function discoveryMatch(item,filters={},today=berlinToday(),language='de') {
  if(!matchesFilters(item,{...filters,query:''},today)) return false;
  const local=localizeActivity(item,language),query=(filters.query||'').trim().toLocaleLowerCase(language);
  return !query || [local.title,local.original,local.description,local.venue,local.area,categoryLabels[local.category],local.category].join(' ').toLocaleLowerCase(language).includes(query);
}
export function currentProgrammes(items,today=berlinToday()) {return items.filter(item=>!isExpired(item,today));}
export function cardMarkup(item,{language='de',date=nextDate(item),session=false}={}) {
  const a=localizeActivity(item,language),t=words[language],e=escapeHTML;
  const id= session ? `${a.id}-${date}` : a.id;
  return `<article class="activity-card" id="${e(id)}" data-activity="${e(a.id)}" aria-labelledby="title-${e(id)}">
<div class="activity-topline"><span class="activity-type">${e(language==='de'?categoryLabels[a.category]:a.category)}</span><span>${e(a.area)}</span></div>
<h2 id="title-${e(id)}">${e(a.title)}</h2><p class="original-title">${e(a.original)}</p><p>${e(a.description)}</p>
<p class="activity-next">${date?`${e(t.next)}: <time datetime="${date}">${e(formatDate(date,language))}</time> · ${a.start}–${a.end}`:e(t.unknown)}</p>
<dl class="activity-facts"><div><dt>${t.when}</dt><dd>${e(a.schedule)} · ${a.duration} ${t.minutes}</dd></div><div><dt>${t.where}</dt><dd>${e(a.venue)}<br>${e(a.address)}</dd></div><div><dt>${t.cost}</dt><dd>${e(a.cost)} ${t.travel}</dd></div><div><dt>${t.language}</dt><dd>${e(a.languageText)}</dd></div><div><dt>${t.joining}</dt><dd>${e(a.booking)}</dd></div></dl>
<p class="first-visit"><strong>${t.tip}</strong>${e(a.tip)}</p><p class="source-line"><a href="${e(a.source)}" target="_blank" rel="noopener noreferrer">${t.source} ↗<span class="sr-only">: ${e(a.title)}</span></a><br>${t.checked} <time datetime="${a.checkedOn}">${e(formatDate(a.checkedOn,language))}</time></p>
<div class="activity-actions"><a class="secondary-button" href="friendship-planner.html?berlin=${e(a.id)}">${t.plan}<span class="sr-only">: ${e(a.title)}</span></a>${date?`<button class="secondary-button" type="button" data-calendar="${e(a.id)}" data-date="${date}" hidden>${t.calendar}<span class="sr-only">: ${e(a.title)}, ${e(formatDate(date,language))}</span></button>`:''}</div>
<label class="select-activity" hidden><input type="checkbox" data-select value="${e(a.id)}">${t.select}<span class="sr-only">: ${e(a.title)}</span></label></article>`;
}
