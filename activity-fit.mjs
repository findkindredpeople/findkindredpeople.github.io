// Compare practical constraints, never the quality or safety of a group.
export function evaluateActivity(activity, limits) {
  const known = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const total = (a, b) => known(a) && known(b) ? a + b : null;
  const minutes = total(activity.duration, activity.travel);
  const cost = total(activity.fee, activity.transport);
  const blockers = [], questions = [];
  if (minutes === null) {
    questions.push('Confirm the session length and return travel time.');
    const knownMinutes = [activity.duration, activity.travel].filter(known).reduce((sum,value)=>sum+value,0);
    if (knownMinutes > limits.minutes) blockers.push(`Known time already exceeds your limit by ${knownMinutes - limits.minutes} minutes, before adding the missing time.`);
  }
  else if (minutes > limits.minutes) blockers.push(`${minutes - limits.minutes} minutes beyond your available time.`);
  if (cost === null) {
    questions.push('Confirm the visit fee, materials and return transport cost.');
    const knownCost = [activity.fee, activity.transport].filter(known).reduce((sum,value)=>sum+value,0);
    if (Math.round(knownCost * 100) > Math.round(limits.cost * 100)) blockers.push('The known cost already exceeds your limit, before adding the missing cost.');
  }
  else if (Math.round(cost * 100) > Math.round(limits.cost * 100)) blockers.push('The total visit cost is above your limit.');
  for (const [key, no, unknown] of [
    ['newcomers', 'Newcomers cannot join this session.', 'Ask whether this session accepts newcomers.'],
    ['schedule', 'The session or return journey does not fit your schedule.', 'Confirm the date, start time and return journey.'],
    ['access', 'The language or access arrangements do not meet your needs.', 'Check the language and access arrangements you need.']
  ]) {
    if (activity[key] === 'no') blockers.push(no);
    else if (activity[key] !== 'yes') questions.push(unknown);
  }
  return {minutes, cost, blockers, questions, status: blockers.length ? 'Does not fit yet' : questions.length ? 'More to check' : 'Fits your entered limits'};
}
