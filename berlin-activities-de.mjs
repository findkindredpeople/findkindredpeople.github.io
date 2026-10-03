// German editorial wording. Dates, costs and sources remain in the shared dataset.
export const categoryLabels = {Crafts:'Handarbeit',Music:'Musik',Languages:'Sprachen',Books:'Bücher',Games:'Spiele','Everyday skills':'Alltagshilfe',Swaps:'Tauschen'};
const translations = {
  'crochet-tiergarten': {
    title:'Gemeinsam häkeln in Tiergarten',
    description:'An einem gemeinsamen Tisch häkeln, ein begonnenes Projekt mitbringen oder mit den Materialien der Bibliothek anfangen.',
    schedule:'Veröffentlichte Dienstage, 15:00–17:30 Uhr',
    cost:'Preis nicht angegeben; Materialien werden bereitgestellt.',
    languageText:'Sprache der Veranstaltung nicht angegeben.',
    booking:'Keine Anmeldung. Für Anfänger und Fortgeschrittene; gemischte Altersgruppe ab 8 Jahren.',
    tip:'Eine Frage zu Garn oder einer Masche gibt euch ein gemeinsames Thema, während ihr an euren Projekten arbeitet.'
  },
  'singing-hansa': {
    title:'Gemeinsam singen in der Hansabibliothek',
    description:'Singen in einer Gruppe mit Nicole Rubinstein-Gross. Trinkwasser mitbringen und vor der Anfahrt nach freien Plätzen fragen.',
    schedule:'Veröffentlichte Dienstage, 11:00–12:30 Uhr',
    cost:'Preis nicht angegeben.',
    languageText:'Sprache der Veranstaltung nicht angegeben.',
    booking:'Anmeldung erforderlich; begrenzte Plätze. Kontakt auf der Veranstalterseite. Keine Singerfahrung nötig.',
    tip:'Wenn die Vorstellung in einer Gruppe schwerfällt, frage die Leitung, wie die erste Stunde beginnt.'
  },
  'sprachraum-pablo': {title:'SprachRaum in der Pablo-Neruda-Bibliothek',schedule:'Dienstags, 16:00–18:00 Uhr'},
  'sprachraum-wilhelm': {title:'SprachRaum in der Wilhelm-Liebknecht / Namık-Kemal-Bibliothek',schedule:'Donnerstags, 15:00–16:30 Uhr'},
  'sprachraum-raumer': {title:'SprachRaum in der Friedrich-von-Raumer-Bibliothek',schedule:'Montags, 11:30–13:00 Uhr, ab Oktober 2026'},
  'english-book-club': {
    title:'Englischsprachiger Buchclub',
    description:'Zeitgenössische Literatur auf Englisch besprechen. Für den Herbst sind konkrete Termine veröffentlicht; vor der Anmeldung nach dem ausgewählten Buch fragen.',
    schedule:'Zweiter Montag im Monat, 17:30–19:00 Uhr; ausgewähltes Buch erfragen',
    cost:'Preis nicht angegeben.',
    languageText:'Englisch; mit und ohne Englisch als Muttersprache willkommen.',
    booking:'Anmeldung erforderlich. Das ausgewählte Buch vorher lesen; aktuellen Titel beim Veranstalter erfragen.',
    tip:'Notiere vorher eine Textstelle oder eine Frage. Eine vollständige literarische Analyse brauchst du nicht.'
  },
  'silent-book-club': {
    title:'Silent Book Club Xhain',
    description:'Eine ruhige Lesestunde zwischen einer freiwilligen Vorstellungsrunde und Zeit zum Ausklang. Jede Person wählt ihr eigenes Buch.',
    schedule:'Veröffentlichte Dienstage, 18:30–20:30 Uhr',
    cost:'Eintritt frei.',
    languageText:'Lesen in der eigenen Sprache; Gesprächssprache nicht angegeben.',
    booking:'Keine Anmeldung. Eigenes Buch mitbringen oder eines ausleihen; die Vorstellungsrunde ist freiwillig.',
    tip:'Eine mögliche erste Begegnung, wenn du gern in Gesellschaft bist, ohne ständig ein Gespräch führen zu müssen.'
  },
  'knitting-pablo': {
    title:'Strick- und Häkeltreff',
    description:'Am eigenen Strick- oder Häkelprojekt arbeiten und mit anderen Erfahrungen und Hilfe austauschen.',
    schedule:'Erster Dienstag im Monat; ab November auch dritter Dienstag, 15:30–17:30 Uhr',
    cost:'Eintritt frei; eigenes Projekt mitbringen. Materialkosten nicht angegeben.',
    languageText:'Sprache der Veranstaltung nicht angegeben.',
    booking:'Keine Anmeldung. Anfänger und Fortgeschrittene willkommen. Am ersten Dienstag unterstützt das Bibliotheksteam; am dritten Dienstag ab November trifft sich eine selbstständige offene Gruppe.',
    tip:'Nimm ein kleines, gut transportierbares Projekt mit und frage, ob dir jemand eine Technik zeigen kann.'
  },
  'sewing-pablo': {
    title:'Nähcafé',
    description:'Ein eigenes Nähprojekt mitbringen und in einer gemeinsamen Werkstattumgebung daran arbeiten.',
    schedule:'Erster und dritter Samstag im Monat, 10:30–14:30 Uhr',
    cost:'Eintritt frei; Stoff und Schnittmuster mitbringen. Materialkosten nicht angegeben.',
    languageText:'Sprache der Veranstaltung nicht angegeben.',
    booking:'Keine Anmeldung. Anfänger willkommen. Im WerkRaum.',
    tip:'Frage vor einem größeren Projekt, welche Geräte vorhanden sind und ob ein kurzer erster Besuch möglich ist.'
  },
  'retro-gaming': {
    title:'RetroGaming mit dem Computerspielemuseum',
    description:'Ältere Videospiele gemeinsam mit dem Computerspielemuseum in der Bibliothek ausprobieren.',
    schedule:'Zweiter Freitag im Monat, 14:30–16:30 Uhr',
    cost:'Eintritt frei.',
    languageText:'Sprache der Veranstaltung nicht angegeben.',
    booking:'Keine Anmeldung; für alle Altersgruppen. Im WerkRaum.',
    tip:'Frage eine andere Person nach einer Spielempfehlung und vereinbart, wie ihr euch abwechselt.'
  },
  'electronic-jam': {
    title:'Electronic Music Jam',
    description:'Mit vorhandenen Geräten oder eigener Ausrüstung gemeinsam elektronische Musik machen. Der zuletzt ausdrücklich genannte Termin war am 16. September 2026.',
    schedule:'Monatlich, 18:30–20:30 Uhr; nächsten Termin erfragen',
    cost:'Eintritt frei; Geräte der Bibliothek stehen zur Verfügung.',
    languageText:'Sprache der Veranstaltung nicht angegeben.',
    booking:'Anmeldung über die Veranstalterseite. Ab 16 Jahren; Anfänger willkommen. Im Musikraum.',
    tip:'Frage, wie du als Anfänger mit einem einfachen Beitrag einsteigen kannst, bevor du eigene Geräte mitbringst.'
  },
  'smartphone-cafe': {
    title:'Smartphone-Café',
    description:'Alltägliche Fragen zum Smartphone in entspannter Café-Atmosphäre gemeinsam besprechen.',
    schedule:'Montags, 11:00–12:00 Uhr',
    cost:'Eintritt frei.',
    languageText:'Sprache der Veranstaltung nicht angegeben.',
    booking:'Keine Anmeldung. Smartphone mitbringen; Café im Erdgeschoss.',
    tip:'Bring eine konkrete Frage mit. Zeige auf einem gemeinsam betrachteten Bildschirm keine Passwörter, Bankdaten oder privaten Nachrichten.'
  },
  'clothing-swap': {
    title:'Kleidertausch für Erwachsene',description:'Kleidung für Erwachsene in der Bibliothek tauschen. Vor dem Packen die Regeln für erlaubte Kleidungsstücke prüfen.',schedule:'26. September 2026, 11:00–14:00 Uhr',cost:'Eintritt frei.',languageText:'Sprache der Veranstaltung nicht angegeben.',booking:'Keine Anmeldung. Bis zu zehn saubere, unbeschädigte Kleidungsstücke für Erwachsene. Keine Schuhe, Accessoires, Unterwäsche, Socken, Bettwäsche oder Kinderkleidung.',tip:'Eine Frage zu einem Kleidungsstück kann ein Gespräch beginnen; vermeide Kommentare über den Körper einer anderen Person.'
  },
  'language-trail': {
    title:'Europa spricht! Sprachen-Parcours',description:'Sprachen wie Griechisch, Französisch, Polnisch, Italienisch, Spanisch, Türkisch, Chinesisch und Japanisch mit der Volkshochschule ausprobieren.',schedule:'26. September 2026, 11:00–14:00 Uhr',cost:'Eintritt frei.',languageText:'Sprachstationen; Sprache der Anleitung erfragen.',booking:'Keine Anmeldung oder Sprachvorkenntnisse nötig.',tip:'Wähle eine Sprachstation und frage eine andere Person, welches Wort sie gerade gelernt hat.'
  },
  'board-game-swap': {
    title:'Spielfeld: Brettspiele tauschen und spielen',
    description:'Brettspiele, Puzzles oder Karten tauschen und gemeinsam ein Spiel ausprobieren. Erwachsenen- und Kinderartikel werden bis zum offenen Tausch um 17:00 Uhr getrennt getauscht.',
    schedule:'17. Oktober 2026, 15:30–17:30 Uhr',
    cost:'Eintritt frei.',
    languageText:'Sprache der Veranstaltung nicht angegeben.',
    booking:'Anmeldung über die Veranstalterseite erbeten. Vollständige Spiele in gutem Zustand mitbringen; im WerkRaum.',
    tip:'Frage zunächst nach einem kurzen Spiel und ob die Regeln in einer Sprache erklärt werden können, die du verstehst.'
  }
};
const languageGroup = {description:'In ungezwungener Atmosphäre mit anderen Deutsch üben, auch auf unterschiedlichen Sprachniveaus.',cost:'Eintritt frei.',languageText:'Deutsch üben; Anfänger willkommen.',booking:'Keine Anmeldung.',tip:'Bereite eine Frage aus dem Alltag vor, die du auf Deutsch stellen möchtest.'};
export function localizeActivity(item, language='de') {
  if (language !== 'de') return item;
  const translated = translations[item.id];
  if (!translated) throw new Error('Missing German translation: '+item.id);
  return {...item,...(item.id.startsWith('sprachraum-') ? languageGroup : {}),...translated};
}
