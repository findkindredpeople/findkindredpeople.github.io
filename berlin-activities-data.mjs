// Source pages were read on this date. Never advance it without checking them again.
export const checkedOn = '2026-09-20';
export const berlinZone = 'Europe/Berlin';
const root = 'https://www.berlin.de/stadtbibliothek-friedrichshain-kreuzberg/';
const pablo = root + 'bibliotheken/bezirkszentralbibliothek-pablo-neruda/veranstaltungen-projekte/';
const wilhelm = root + 'bibliotheken/mittelpunktbibliothek-wilhelm-liebknecht-namik-kemal/veranstaltungen-projekte/';
const venues = {
  pablo: {venue: 'Pablo-Neruda-Bibliothek', address: 'Frankfurter Allee 14A, 10247 Berlin', area: 'Friedrichshain'},
  wilhelm: {venue: 'Wilhelm-Liebknecht / Namık-Kemal-Bibliothek', address: 'Adalbertstraße 2, 10999 Berlin', area: 'Kreuzberg'},
  raumer: {venue: 'Friedrich-von-Raumer-Bibliothek', address: 'Dudenstraße 18–20, 10965 Berlin', area: 'Kreuzberg'},
  tiergarten: {venue: 'Bibliothek Tiergarten-Süd', address: 'Lützowstraße 27, 10785 Berlin', area: 'Tiergarten'},
  hansa: {venue: 'Hansabibliothek', address: 'Altonaer Straße 15, 10557 Berlin', area: 'Hansaviertel'}
};
const autumnTuesdays = ['2026-09-22', '2026-10-13', '2026-10-27', '2026-11-10', '2026-11-24'];
const records = [
  {id:'crochet-tiergarten', title:'Crochet together', original:'Gemeinsam Häkeln', place:'tiergarten', category:'Crafts', dates:autumnTuesdays, start:'15:00', end:'17:30', duration:150, recurring:true,
    schedule:'Published Tuesdays, 15:00–17:30', fee:null, cost:'Fee not stated; materials are provided.', language:'unknown', languageText:'Session language not stated.', booking:'No registration. Beginners and experienced makers are welcome; mixed ages, 8 and up.',
    description:'A shared crochet table with supplies available. Bring an unfinished piece or start with the materials at the library.', tip:'A simple question about yarn or a stitch gives you something concrete to discuss while your hands are busy.', source:'https://www.berlin.de/land/kalender/index.php?detail=276751'},
  {id:'singing-hansa', title:'Group singing at Hansabibliothek', original:'Heilsames Singen', place:'hansa', category:'Music', dates:autumnTuesdays, start:'11:00', end:'12:30', duration:90, recurring:true,
    schedule:'Published Tuesdays, 11:00–12:30', fee:null, cost:'Fee not stated.', language:'unknown', languageText:'Session language not stated.', booking:'Registration required; places are limited. Contact details are on the organiser’s page. No singing experience required.',
    description:'Sing in a group led by Nicole Rubinstein-Gross. Bring drinking water and ask about available places before travelling.', tip:'If introducing yourself feels difficult, ask the leader how a first session begins.', source:'https://www.berlin.de/land/kalender/index.php?detail=266299'},
  ...[
    {id:'sprachraum-pablo', place:'pablo', schedule:'Tuesdays, 16:00–18:00', start:'16:00', end:'18:00', duration:120},
    {id:'sprachraum-wilhelm', place:'wilhelm', schedule:'Thursdays, 15:00–16:30', start:'15:00', end:'16:30', duration:90},
    {id:'sprachraum-raumer', place:'raumer', schedule:'Mondays, 11:30–13:00, starting October 2026', start:'11:30', end:'13:00', duration:90, startsIn:'2026-10'}
  ].map(item => ({...item, title:'SprachRaum · ' + venues[item.place].venue.split('-Bibliothek')[0], original:'SprachRaum', category:'Languages', dates:[], recurring:true, fee:0, cost:'Free entry.', language:'de', languageText:'German practice; beginners welcome.', booking:'No registration.', description:'An informal place to practise German with others at different levels.', tip:'Prepare one everyday question you would like to practise asking.', source:root + 'aktuelles/veranstaltungen-ausstellungen/sprachraum-1601921.php'})),
  {id:'english-book-club', title:'English-language book club', original:'English-Language Book Club', place:'pablo', category:'Books', dates:[], start:'17:30', end:'19:00', duration:90, recurring:true,
    schedule:'Second Monday of the month, 17:30–19:00; ask for the next date and book', fee:null, cost:'Fee not stated.', language:'en', languageText:'English; native and non-native speakers welcome.', booking:'Registration required. Read the selected book first; ask the organiser for the current title.',
    description:'Discuss a shared book in English. The last dated session on the source was 14 September 2026, so the next selection needs checking.', tip:'Write down one passage or question in advance; you do not need a complete literary analysis.', source:pablo + 'english-language-book-club-1603589.php'},
  {id:'silent-book-club', title:'Silent Book Club Xhain', original:'Silent Book Club Xhain', place:'pablo', category:'Books', dates:['2026-10-20','2026-11-17','2026-12-15'], start:'18:30', end:'20:30', duration:120, recurring:true,
    schedule:'Published Tuesdays, 18:30–20:30', fee:0, cost:'Free entry.', language:'unknown', languageText:'Read in your own language; conversation language not stated.', booking:'No registration. Bring a book or borrow one; introductions are optional.',
    description:'A quiet reading hour sits between an optional introduction and time to wind down. Everyone can choose their own book.', tip:'This is a low-pressure first visit if you enjoy company without needing continuous conversation.', source:pablo + 'silent-book-club-xhain-1531452.php'},
  {id:'knitting-pablo', title:'Knitting and crochet group', original:'Stricktreff', place:'pablo', category:'Crafts', dates:[], start:'15:30', end:'17:30', duration:120, recurring:true,
    schedule:'First Tuesday of the month, 15:30–17:30', fee:0, materialsUnknown:true, cost:'Free entry; bring your own project. Material costs are not listed.', language:'unknown', languageText:'Session language not stated.', booking:'No registration. Beginners and experienced participants welcome.',
    description:'Work on your knitting or crochet project alongside other makers and exchange help.', tip:'Choose a small project you can carry easily and ask whether someone can show you one technique.', source:pablo + 'stricktreff-fuer-anfaenger-innen-fortgeschrittene-1622246.php'},
  {id:'sewing-pablo', title:'Sewing café', original:'Nähcafé', place:'pablo', category:'Crafts', dates:[], start:'10:30', end:'14:30', duration:240, recurring:true,
    schedule:'First and third Saturday of the month, 10:30–14:30', fee:0, materialsUnknown:true, cost:'Free entry; bring fabric and patterns. Material costs are not listed.', language:'unknown', languageText:'Session language not stated.', booking:'No registration. Beginners welcome. Held in the WerkRaum.',
    description:'Bring a sewing project to work on in a shared workshop setting.', tip:'Before taking a large project, ask which equipment is available and whether a short first visit is possible.', source:pablo + 'naehcafe-916674.php'},
  {id:'retro-gaming', title:'Retro gaming with the museum', original:'RetroGaming mit dem Computerspielemuseum', place:'pablo', category:'Games', dates:[], start:'14:30', end:'16:30', duration:120, recurring:true,
    schedule:'Second Friday of the month, 14:30–16:30', fee:0, cost:'Free entry.', language:'unknown', languageText:'Session language not stated.', booking:'No registration; all ages. Held in the WerkRaum.',
    description:'Explore older video games with the Computerspielemuseum in a shared library session.', tip:'Ask another player which game they recommend, then agree how to take turns.', source:pablo + 'retrogaming-1284594.php'},
  {id:'electronic-jam', title:'Electronic music jam', original:'Electronic Music Jam', place:'pablo', category:'Music', dates:[], start:'18:30', end:'20:30', duration:120, recurring:true,
    schedule:'Monthly, 18:30–20:30; next date needs checking', fee:0, cost:'Free entry; library equipment is available.', language:'unknown', languageText:'Session language not stated.', booking:'Registration through the organiser’s page. Ages 16 and up; beginners welcome. Held in the Musikraum.',
    description:'Make electronic music together using available devices or your own equipment. The last dated session listed was 16 September 2026.', tip:'Ask how a beginner can join one simple part before bringing equipment.', source:pablo + 'artikel.1433015.php'},
  {id:'smartphone-cafe', title:'Smartphone café', original:'Smartphone Café', place:'wilhelm', category:'Everyday skills', dates:[], start:'11:00', end:'12:00', duration:60, recurring:true,
    schedule:'Mondays, 11:00–12:00', fee:0, cost:'Free entry.', language:'unknown', languageText:'Session language not stated.', booking:'No registration. Bring your smartphone; ground-floor café.',
    description:'Work through everyday phone questions with others in an informal café setting.', tip:'Bring one question to discuss. Keep passwords, financial details and private messages off the shared screen.', source:wilhelm + 'smartphone-cafe-gemeinsam-loesen-wir-ihre-handy-probleme-1658266.php'},
  {id:'clothing-swap', title:'Adult clothing swap', original:'Kleidertauschparty', place:'wilhelm', category:'Swaps', dates:['2026-09-26'], start:'11:00', end:'14:00', duration:180, recurring:false,
    schedule:'26 September 2026, 11:00–14:00', fee:0, cost:'Free entry.', language:'unknown', languageText:'Session language not stated.', booking:'No registration. Up to 10 clean, undamaged adult garments. No shoes, accessories, underwear, socks, bedding or children’s clothes.',
    description:'Exchange adult clothing at the library. Check the accepted items before packing a bag.', tip:'Use a question about an item as a small conversation starter, without commenting on anyone’s body.', source:wilhelm + 'kleidertauschparty-1425205.php'},
  {id:'language-trail', title:'Try a language: Europa spricht!', original:'Europa spricht! Sprachen-Parcours', place:'pablo', category:'Languages', dates:['2026-09-26'], start:'11:00', end:'14:00', duration:180, recurring:false,
    schedule:'26 September 2026, 11:00–14:00', fee:0, cost:'Free entry.', language:'multi', languageText:'Language tasters; ask about the instruction language.', booking:'No registration or previous language knowledge required.',
    description:'Try activities in languages including Greek, French, Polish, Italian, Spanish, Turkish, Chinese and Japanese with the district adult-education programme.', tip:'Pick one language station and ask another visitor which word they have just learned.', source:pablo + 'europa-spricht-sprachen-parcours-zum-europaeischen-tag-der-sprachen-1604533.php'},
  {id:'board-game-swap', title:'Board-game swap and play', original:'Spielfeld — Tauschbörse & Spieletreff', place:'pablo', category:'Games', dates:['2026-10-17'], start:'15:30', end:'17:30', duration:120, recurring:false,
    schedule:'17 October 2026, 15:30–17:30', fee:0, cost:'Free entry.', language:'unknown', languageText:'Session language not stated.', booking:'Registration requested through the organiser’s page. Bring complete games in good condition; held in the WerkRaum.',
    description:'Swap board games, puzzles or cards and try a shared game. Adult and children’s items are exchanged separately until the open swap at 17:00.', tip:'Ask to join a short game before committing to a long one, and check whether the rules can be explained in your language.', source:pablo + 'spielfeld-tauschboerse-spieletreff-1518189.php'}
];
// Weekday describes the published schedule only; it never creates a session date.
const recurringWeekdays = {'sprachraum-pablo':[2],'sprachraum-wilhelm':[4],'sprachraum-raumer':[1],'english-book-club':[1],'knitting-pablo':[2],'sewing-pablo':[6],'retro-gaming':[5],'smartphone-cafe':[1]};
export const activities = records.map(item => ({...item, ...venues[item.place], checkedOn, weekdays:recurringWeekdays[item.id] || [...new Set(item.dates.map(date=>new Date(date+'T12:00:00Z').getUTCDay()))]}));
export const byId = new Map(activities.map(item => [item.id, item]));
export function berlinToday(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone:berlinZone, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(now).map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function nextDate(item, today = berlinToday()) {
  return item.dates.find(date => date >= today) || null;
}
export function isExpired(item, today = berlinToday()) {
  return !item.recurring && !nextDate(item, today);
}
export function selectedIds(value) {
  return [...new Set(String(value || '').split(','))].filter(id => byId.has(id)).slice(0, 3);
}
export function matchesFilters(item, filters, today = berlinToday()) {
  if (isExpired(item, today)) return false;
  const next = nextDate(item, today);
  if (filters.area && item.area !== filters.area) return false;
  if (filters.category && item.category !== filters.category) return false;
  if (filters.language && item.language !== filters.language) return false;
  if (filters.free && item.fee !== 0) return false;
  if (filters.duration && item.duration > Number(filters.duration)) return false;
  if (filters.weekday !== undefined && filters.weekday !== '' && !item.weekdays.includes(Number(filters.weekday))) return false;
  if (filters.startAfter && item.start < filters.startAfter) return false;
  if (filters.finishBy && item.end > filters.finishBy) return false;
  if (filters.startAfter && filters.finishBy && filters.startAfter >= filters.finishBy) return false;
  if (filters.when === 'unknown' && next) return false;
  if (['7','30'].includes(filters.when)) {
    const days = next ? (Date.parse(next) - Date.parse(today)) / 86400000 : Infinity;
    if (days < 0 || days >= Number(filters.when)) return false;
  }
  const haystack = [item.title,item.original,item.venue,item.description,item.area].join(' ').toLocaleLowerCase();
  return !filters.query || haystack.includes(filters.query.trim().toLocaleLowerCase());
}
export function toComparison(item, today = berlinToday()) {
  return {name:item.title, url:item.source, duration:item.duration, fee:item.materialsUnknown ? null : item.fee,
    travel:null, transport:null, newcomers:'unknown', schedule:'unknown', access:'unknown',
    notes:`Source checked ${item.checkedOn}. ${nextDate(item,today) ? 'Published date: ' + nextDate(item,today) + '.' : 'Ask for the next date.'} ${item.schedule}. ${item.booking} ${item.cost}`.slice(0,400)};
}
