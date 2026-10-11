const interests = {
  language: {en: 'language practice', de: 'Sprachcafé', queries: ['Sprachcafé regelmäßig', 'Bibliothek Deutsch sprechen', 'vhs Sprachen Konversation']},
  books: {en: 'reading and book discussion', de: 'Bücher und Literatur', queries: ['Bibliothek Lesekreis', 'Buchclub regelmäßig', 'vhs Literatur Gespräch']},
  crafts: {en: 'crafts and making things', de: 'Handarbeiten und kreatives Gestalten', queries: ['Bibliothek Handarbeit Treff', 'Repair Café Termine', 'vhs kreatives Gestalten']},
  walking: {en: 'walking with a group', de: 'gemeinsame Spaziergänge', queries: ['Spaziergruppe regelmäßig', 'Wanderverein Schnuppern', 'Nachbarschaft Spaziergang Treff']},
  volunteering: {en: 'a regular volunteer task', de: 'regelmäßiges Ehrenamt', queries: ['Freiwilligenagentur', 'Ehrenamt regelmäßige Mitarbeit', 'Nachbarschaftshilfe mitmachen']}
};
export const groupInterests = Object.keys(interests);
const directories = {
  vhs: {name:'Find your local vhs',url:'https://www.volkshochschule.de/vhs-welt/meine-vhs-finden/index.php',next:'Search by town, open the provider’s current programme and check the full course fee, places and joining date.'},
  library: {name:'Bibliotheksportal library map',url:'https://bibliotheksportal.de/ueber-bibliotheken/bibliothekslandschaft/bibliothekslandkarte/',next:'Locate a library, then open its own events page. A map entry does not confirm a current group or date.'},
  volunteering: {name:'bagfa volunteer-agency atlas',url:'https://bagfa.de/agenturatlas/',next:'Search by place or federal state. Ask the local agency about a role, induction and the time you can reliably offer.'},
  community: {name:'Mehrgenerationenhaus directory',url:'https://www.mehrgenerationenhaeuser.de/mehrgenerationenhaeuser/haeuser-in-ihrer-naehe',next:'Find a nearby provider and open its current programme. Check the specific activity; a directory entry does not promise childcare or an open session.'}
};
const routes = {language:['library','vhs'],books:['library','vhs'],crafts:['vhs','community'],walking:['community','vhs'],volunteering:['volunteering','community']};
const checks = {
  language: {en:'Is this a taught course, an informal language café or a reciprocal tandem? What level is needed and which language will I practise?',de:'Ist das ein Kurs, ein informelles Sprachcafé oder ein gegenseitiges Tandem? Welches Niveau brauche ich und welche Sprache werde ich üben?'},
  books: {en:'Do I need to read a particular book beforehand? Can I join the discussion in my preferred language?',de:'Muss ich vorher ein bestimmtes Buch lesen? Kann ich in meiner bevorzugten Sprache an der Diskussion teilnehmen?'},
  crafts: {en:'Are beginners welcome, which tools or materials should I bring, and are materials included in the full price?',de:'Sind Anfänger willkommen, welche Werkzeuge oder Materialien soll ich mitbringen und sind die Materialien im Gesamtpreis enthalten?'},
  walking: {en:'What is the route length, pace and terrain? Where does the walk end, and what happens in bad weather?',de:'Wie lang ist die Strecke, welches Tempo und welches Gelände sind geplant? Wo endet der Spaziergang und was passiert bei schlechtem Wetter?'},
  volunteering: {en:'What are the tasks, induction and minimum commitment? Is a trial possible, who supervises the role and are expenses reimbursed?',de:'Welche Aufgaben, Einarbeitung und Mindestverpflichtung gibt es? Ist ein Probetermin möglich, wer betreut die Aufgabe und werden Auslagen erstattet?'}
};
const cleanPlace = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

export function localGroupSearch({place = '', interest = 'language', language = 'en'} = {}) {
  const location = cleanPlace(place), key = Object.hasOwn(interests,interest) ? interest : 'language', selected = interests[key];
  const de = language === 'de', city = location || '[Ort oder Stadtteil]';
  const queries = selected.queries.map(words => `${city} ${words}`);
  const activityQuestion = checks[key][de ? 'de' : 'en'];
  const message = de
    ? `Guten Tag, ich suche in ${city} ein regelmäßiges Angebot für ${selected.de}. Können Erwachsene zum ersten Mal allein teilnehmen? Wann ist der nächste Termin, muss ich mich anmelden und was kostet die Teilnahme? Welche Sprache wird verwendet und an wen kann ich mich bei der Ankunft wenden? ${activityQuestion} Vielen Dank!`
    : `Hello, I am looking for a regular group for ${selected.en} in ${location || '[town or neighbourhood]'}. Can an adult join alone for the first time? What is the next date, do I need to book, and what is the cost? Which language is used, and who should I look for when I arrive? ${activityQuestion} Thank you!`;
  return {place: location, queries, message, activityQuestion, directories:routes[key].map(id=>({...directories[id]})), needsPlace: !location};
}
