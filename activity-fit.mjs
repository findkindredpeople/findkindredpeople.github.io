// Compare practical constraints, never the quality or safety of a group.
export function evaluateActivity(activity, limits, language='en') {
  const t=(en,de)=>language==='de'?de:en;
  const known = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const total = (a, b) => known(a) && known(b) ? a + b : null;
  const minutes = total(activity.duration, activity.travel);
  const cost = total(activity.fee, activity.transport);
  const blockers = [], questions = [];
  if (minutes === null) {
    questions.push(t('Confirm the session length and return travel time.','Dauer der Veranstaltung und Hin- und Rückweg bestätigen.'));
    const knownMinutes = [activity.duration, activity.travel].filter(known).reduce((sum,value)=>sum+value,0);
    if (knownMinutes > limits.minutes) blockers.push(t(`Known time already exceeds your limit by ${knownMinutes - limits.minutes} minutes, before adding the missing time.`,`Die bekannte Zeit liegt bereits ${knownMinutes-limits.minutes} Minuten über deiner Grenze; weitere Zeit fehlt noch.`));
  }
  else if (minutes > limits.minutes) blockers.push(t(`${minutes - limits.minutes} minutes beyond your available time.`,`${minutes-limits.minutes} Minuten über deiner verfügbaren Zeit.`));
  if (cost === null) {
    questions.push(t('Confirm the visit fee, materials and return transport cost.','Teilnahmekosten, Material und Fahrtkosten für Hin- und Rückweg bestätigen.'));
    const knownCost = [activity.fee, activity.transport].filter(known).reduce((sum,value)=>sum+value,0);
    if (Math.round(knownCost * 100) > Math.round(limits.cost * 100)) blockers.push(t('The known cost already exceeds your limit, before adding the missing cost.','Die bekannten Kosten liegen bereits über deiner Grenze; weitere Kosten fehlen noch.'));
  }
  else if (Math.round(cost * 100) > Math.round(limits.cost * 100)) blockers.push(t('The total visit cost is above your limit.','Die Gesamtkosten des Besuchs liegen über deiner Grenze.'));
  for (const [key, no, unknown] of [
    ['newcomers', t('Newcomers cannot join this session.','Neue Teilnehmende können bei dieser Veranstaltung nicht mitmachen.'), t('Ask whether this session accepts newcomers.','Frage, ob neue Teilnehmende mitmachen können.')],
    ['schedule', t('The session or return journey does not fit your schedule.','Die Veranstaltung oder der Heimweg passt zeitlich nicht.'), t('Confirm the date, start time and return journey.','Datum, Beginn und Heimweg bestätigen.')],
    ['access', t('The language or access arrangements do not meet your needs.','Sprache oder Zugang passen nicht zu deinen Anforderungen.'), t('Check the language and access arrangements you need.','Prüfe die für dich erforderliche Sprache und den Zugang.')]
  ]) {
    if (activity[key] === 'no') blockers.push(no);
    else if (activity[key] !== 'yes') questions.push(unknown);
  }
  return {minutes, cost, blockers, questions, status: blockers.length ? t('Does not fit yet','Passt noch nicht') : questions.length ? t('More to check','Noch zu klären') : t('Fits your entered limits','Passt zu deinen Angaben')};
}
