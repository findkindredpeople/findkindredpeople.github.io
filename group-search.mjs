const interests = {
  language: {en: 'language practice', de: 'Sprachcafé', queries: ['Sprachcafé regelmäßig', 'Bibliothek Deutsch sprechen', 'vhs Sprachen Konversation']},
  books: {en: 'reading and book discussion', de: 'Bücher und Literatur', queries: ['Bibliothek Lesekreis', 'Buchclub regelmäßig', 'vhs Literatur Gespräch']},
  crafts: {en: 'crafts and making things', de: 'Handarbeiten und kreatives Gestalten', queries: ['Bibliothek Handarbeit Treff', 'Repair Café Termine', 'vhs kreatives Gestalten']},
  walking: {en: 'walking with a group', de: 'gemeinsame Spaziergänge', queries: ['Spaziergruppe regelmäßig', 'Wanderverein Schnuppern', 'Nachbarschaft Spaziergang Treff']},
  volunteering: {en: 'a regular volunteer task', de: 'regelmäßiges Ehrenamt', queries: ['Freiwilligenagentur', 'Ehrenamt regelmäßige Mitarbeit', 'Nachbarschaftshilfe mitmachen']}
};
export const groupInterests = Object.keys(interests);
const cleanPlace = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

export function localGroupSearch({place = '', interest = 'language', language = 'en'} = {}) {
  const location = cleanPlace(place), selected = interests[interest] || interests.language;
  const de = language === 'de', city = location || '[Ort oder Stadtteil]';
  const queries = selected.queries.map(words => `${city} ${words}`);
  const message = de
    ? `Guten Tag, ich suche in ${city} ein regelmäßiges Angebot für ${selected.de}. Können Erwachsene zum ersten Mal allein teilnehmen? Wann ist der nächste Termin, muss ich mich anmelden und was kostet die Teilnahme einschließlich Material? Welche Sprache wird verwendet und an wen kann ich mich bei der Ankunft wenden? Vielen Dank!`
    : `Hello, I am looking for a regular group for ${selected.en} in ${location || '[town or neighbourhood]'}. Can an adult join alone for the first time? What is the next date, do I need to book, and what is the cost including materials? Which language is used, and who should I look for when I arrive? Thank you!`;
  return {place: location, queries, message, needsPlace: !location};
}
