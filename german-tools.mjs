// German wording for the public worksheets. No translation service or personal-data transfer.
import {localizeActivity} from './berlin-activities-de.mjs';
import {toComparison,nextDate} from './berlin-activities-data.mjs';
const messages = {
 'Your plan is ready. Check off steps as you go, or keep a copy.':'Dein Plan ist bereit. Hake Schritte ab oder bewahre eine Kopie auf.',
 'Invitation updated. Your checklist is unchanged.':'Nachricht aktualisiert. Deine Häkchen bleiben erhalten.',
 'Choices changed. Select “Build my week” to update the plan.':'Auswahl geändert. Klicke auf „Meine Woche planen“, um den Plan zu aktualisieren.',
 'Plan copied.':'Plan kopiert.',
 'Automatic copying is unavailable. Copy the selected text below.':'Automatisches Kopieren ist nicht verfügbar. Kopiere den markierten Text unten.',
 'Your text download has started.':'Der Textdownload wurde gestartet.',
 'Check the organiser’s details':'Angaben beim Veranstalter prüfen',
 'The saved plan could not be read. Delete it or replace it with your current plan.':'Der gespeicherte Plan konnte nicht gelesen werden. Du kannst ihn löschen oder durch den aktuellen Plan ersetzen.',
 'No plan saved in this browser.':'In diesem Browser ist kein Plan gespeichert.',
 'Browser storage is unavailable or the saved plan could not be read. You can still download a copy.':'Der Browserspeicher ist nicht verfügbar oder der Plan konnte nicht gelesen werden. Du kannst weiterhin eine Kopie herunterladen.',
 'Displayed plan, ticks, invitation drafts and calendar fields saved on this device. Later edits are not saved automatically.':'Angezeigter Plan, Häkchen, Nachrichtenentwürfe und Kalenderfelder auf diesem Gerät gespeichert. Spätere Änderungen werden nicht automatisch gespeichert.',
 'The browser could not save this plan. Use Download .txt to keep a copy.':'Der Browser konnte den Plan nicht speichern. Nutze „Als Text herunterladen“, um eine Kopie zu behalten.',
 'Saved plan restored. Check saved dates before using them; later edits need Save on this device again.':'Gespeicherter Plan geladen. Prüfe gespeicherte Termine; spätere Änderungen musst du erneut speichern.',
 'The saved plan could not be restored. You can delete it and save a new one.':'Der gespeicherte Plan konnte nicht geladen werden. Du kannst ihn löschen und einen neuen speichern.',
 'Saved plan deleted from this browser. The currently displayed plan stays open.':'Gespeicherter Plan aus diesem Browser gelöscht. Der angezeigte Plan bleibt geöffnet.',
 'Browser storage is unavailable. Clear this site’s data in your browser settings to remove stored plans.':'Der Browserspeicher ist nicht verfügbar. Zum Entfernen gespeicherter Pläne kannst du die Daten dieser Website in den Browsereinstellungen löschen.',
 'Your Kindred visit plan. Include travel time separately.':'Dein Kindred-Besuchsplan. Hin- und Rückweg zusätzlich einplanen.',
 'Calendar download started. Import the .ics file into your calendar. This does not send an invitation or reserve a place.':'Kalenderdownload gestartet. Importiere die .ics-Datei in deinen Kalender. Es wird keine Einladung gesendet und kein Platz reserviert.',
 'Choose a complete date and time.':'Wähle ein vollständiges Datum und eine Uhrzeit.',
 'Choose a valid date and time between 2000 and 2100.':'Wähle ein gültiges Datum und eine Uhrzeit zwischen 2000 und 2100.',
 'This time occurs twice because the clocks change. Choose another time or use UTC.':'Diese Uhrzeit kommt bei der Zeitumstellung zweimal vor. Wähle eine andere Uhrzeit oder UTC.',
 'This local time does not exist because the clocks change. Choose another time.':'Diese Uhrzeit gibt es bei der Zeitumstellung nicht. Wähle eine andere Uhrzeit.',
 'Give the calendar entry a title.':'Gib dem Kalendereintrag einen Titel.',
 'Choose a duration between 1 and 1440 minutes.':'Wähle eine Dauer zwischen 1 und 1440 Minuten.',
 'Use a web link for the source.':'Nutze einen Weblink für die Quelle.',
 'Give at least two activities a name before comparing.':'Gib mindestens zwei Angeboten einen Namen, bevor du sie vergleichst.',
 'Your practical comparison':'Dein praktischer Vergleich',
 'Fictional example: these are not real listings or verified prices.':'Erfundenes Beispiel: keine echten Angebote oder geprüften Preise.',
 'Starts with published Berlin listing details, plus your edits. Source checks are dated; confirm current conditions with each organiser.':'Ausgangspunkt sind veröffentlichte Berliner Angebote und deine Änderungen. Beachte das Datum der Quellenprüfung und bestätige aktuelle Bedingungen beim Veranstalter.',
 'Based only on the details you entered. Check them with each organiser.':'Grundlage sind nur deine eingegebenen Angaben. Prüfe sie beim jeweiligen Veranstalter.',
 'KINDRED — ACTIVITY COMPARISON':'KINDRED — ANGEBOTE VERGLEICHEN',
 'Fictional example, not real listings.':'Erfundenes Beispiel, keine echten Angebote.',
 'Published Berlin listing details plus user edits. See dated source notes and confirm current conditions.':'Veröffentlichte Berliner Angaben und eigene Änderungen. Quellenprüfdatum beachten und aktuelle Bedingungen bestätigen.',
 'User-entered information; not verified by Kindred.':'Eigene Angaben; nicht von Kindred geprüft.',
 'A possible next step is to confirm the next date and booking terms. This result does not verify safety or guarantee a good experience.':'Als Nächstes Termin und Anmeldebedingungen bestätigen. Dieses Ergebnis prüft keine Sicherheit und garantiert kein gutes Erlebnis.',
 'Open your saved listing':'Angebotsseite öffnen',
 'Comparison updated. You can copy, download or print these results.':'Vergleich aktualisiert. Du kannst die Ergebnisse kopieren, herunterladen oder drucken.',
 'Details changed. Select “Compare activities” to update your results.':'Angaben geändert. Klicke auf „Angebote vergleichen“, um die Ergebnisse zu aktualisieren.',
 'All activity details cleared. Nothing was saved by this tool.':'Alle Angebotsangaben geleert. Dieses Werkzeug hat nichts gespeichert.',
 'Comparison copied.':'Vergleich kopiert.',
 'Copy the selected text below.':'Kopiere den markierten Text unten.',
 'Your comparison download has started.':'Der Vergleichsdownload wurde gestartet.'
};
export const toolText = (text,language='en') => language==='de' ? (messages[text] || text) : text;
export function comparisonData(item,language='en',today) {
 const data=toComparison(item,today);
 if(language!=='de')return data;
 const a=localizeActivity(item),date=nextDate(item,today);
 return {...data,name:a.title,notes:`Quelle geprüft ${a.checkedOn}. ${date?'Veröffentlichter Termin: '+date+'.':'Nächsten Termin erfragen.'} ${a.schedule}. ${a.booking} ${a.cost}`.slice(0,400)};
}
export function germanPlan(options,invitation) {
 const {goal,budget,online,quiet}=options;
 const minutes={30:[5,5,0,15,0,0,5],60:[5,10,0,30,5,0,10],120:[10,15,0,60,10,15,10]}[budget];
 if(!minutes||!['start','follow','keep'].includes(goal))throw new Error('Ungültige Planauswahl.');
 const reserve=budget===30?'Bleibe bei 15 Minuten. Dauert das Angebot länger, nutze diese Zeit zum Klären eines späteren Besuchs.':`Plane bis zu ${minutes[3]} Minuten ein. Passt die gesamte Veranstaltung nicht hinein, frage nach einem kürzeren Besuch oder wähle einen späteren Termin.`;
 const rest='Erhole dich oder bleibe bei deinem Alltag. Heute ist keine Kontaktaufgabe nötig.';
 let tasks;
 if(goal==='start')tasks=[
  `Wähle ein Interesse und eine Zeit, die du wiederholen kannst. ${online?'Notiere die passende Zeitzone.':'Lege eine realistische Grenze für Hin- und Rückweg fest.'}`,
  `Wähle zwei Möglichkeiten für ${online?(quiet?'ein kurzes Gespräch per Sprache oder Text':'ein Online-Spiel, eine Lesegruppe oder einen Sprachaustausch'):(quiet?'eine ruhige Bibliotheks- oder Nachbarschaftsgruppe':'eine Spaziergangs-, Handarbeits- oder andere Interessengruppe')}. Prüfe Termin, Kosten, Veranstalter und Teilnahme für Neue.`,
  rest,
  `Besuche eine bestätigte ${online?'Online-Veranstaltung':'offene Veranstaltung an einem öffentlichen Ort'} oder frage zuerst beim Veranstalter nach. ${reserve}`,
  minutes[4]?'Notiere eine einladende Eigenschaft und ein praktisches Hindernis. Möchtest du wiederkommen?':rest,
  minutes[5]?'Wenn ihr Kontaktdaten freiwillig ausgetauscht habt, schicke eine konkrete Nachricht. Sonst prüfe den nächsten Termin.':rest,
  'Wähle einen nächsten Termin oder ersetze ein unpassendes Angebot. Ein bestätigter Ort zum Wiederkommen ist auch ohne neue Freundschaft ein nützliches Ergebnis.'
 ];
 if(goal==='follow')tasks=[
  'Erinnere dich an ein Detail eures Gesprächs. Prüfe, ob ihr einen Kontaktweg vereinbart habt.',
  `Passe die Nachricht unten für ${online?(quiet?'ein kurzes Telefonat oder Textgespräch':'eine gemeinsame Online-Aktivität'):(quiet?'ein kurzes Gespräch an einem ruhigen öffentlichen Ort':'eine kleine gemeinsame Aktivität an einem öffentlichen Ort')} an. Schlage eine Zeit vor und mache eine Absage leicht.`,
  'Lass Zeit für eine Antwort. Ein stiller Tag ist kein Grund für eine weitere Nachricht.',
  `Trefft oder sprecht euch erst nach gegenseitiger Zustimmung. ${reserve} Ohne Vereinbarung bleibst du bei deinem Alltag; erscheine nicht unangekündigt.`,
  minutes[4]?'Wenn ihr gesprochen habt, überlege, ob beide Fragen stellen konnten und sich wohlfühlten. Sonst behalte die Zeit für dich.':rest,
  minutes[5]?'Nach einem guten Gespräch kannst du kurz Danke sagen. Nach einer Absage oder ohne Antwort ist diese Zeit kein Anlass zum Nachhaken.':rest,
  'Eine Zusage mit Uhrzeit kann ein Plan werden. Akzeptiere eine Absage. Bei Schweigen kann später eine einzelne Nachfrage passend sein; danach liegt der nächste Schritt bei der anderen Person.'
 ];
 if(goal==='keep')tasks=[
  'Wähle eine befreundete Person, mit der du in Kontakt bleiben möchtest. Überlege dir eine konkrete Frage.',
  `Schlage ${online?(quiet?'ein überschaubares Telefonat oder Textgespräch':'eine gemeinsame Online-Aktivität'):(quiet?'ein kurzes Treffen an einem öffentlichen Ort nahe eurem Alltag':'eine gemeinsame Aktivität nahe eurem Alltag')} vor. Frage, welcher Rhythmus auch für die andere Person passt.`,
  rest,
  `Wenn beide zustimmen, nutze diese Zeit für Kontakt und Zuhören. ${reserve} Passen eure Zeiten nicht zusammen, vereinbart einen späteren Termin statt einer Verpflichtung.`,
  minutes[4]?'Notiere etwas, an das du dich erinnern möchtest. Halte keine sensiblen Informationen über die andere Person fest.':rest,
  minutes[5]?'Wenn willkommen, teile einen passenden Artikel, ein Foto oder eine kleine Neuigkeit. Kontakt muss keine tägliche Pflicht sein.':rest,
  'Vereinbart einen möglichen nächsten Kontakt oder lasst Raum für eine ruhigere Woche. Frage, ob der Rhythmus für beide gut machbar ist.'
 ];
 const incomplete=/\[[^\]]+\]/.test(invitation);
 return {options,minutes,tasks,invitation,
 title:{start:'Finde einen Ort, an den du zurückkehren möchtest',follow:'Mach aus einem guten Gespräch einen nächsten Schritt',keep:'Gib einer Freundschaft einen realistischen Rhythmus'}[goal],
 summary:`${budget} Minuten über die Woche · ${online?'Online, ohne Fahrt':'Vor Ort; Fahrtzeit zusätzlich einplanen'} · ${quiet?'Ruhiges Gespräch':'Gemeinsame Aktivität'}`,
 boundary:online?'Nutze einen moderierten oder vereinbarten Treffpunkt. Prüfe Zeitzonen und Aufzeichnungsregeln. Persönliche Angaben bleiben privat. Ein Gespräch findet erst statt, wenn beide zustimmen.':'Wähle einen öffentlichen Ort. Prüfe Veranstalter, Kosten, Zugang und nächsten Termin. Behalte deinen eigenen Heimweg. Ein Treffen findet erst statt, wenn beide zustimmen.',
 note:(incomplete?'Einige Angaben in eckigen Klammern fehlen noch. Ergänze sie unten oder bearbeite die kopierte Nachricht.':'Deine Angaben sind eingefügt. Prüfe Formulierung, Datum, Uhrzeit und Ort.')+' Diese Seite sendet keine Nachrichten und bucht keine Angebote.'};
}
