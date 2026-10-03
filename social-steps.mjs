// Fixed suggestions, never live listings, matching scores or automatic messages.
const step = (id, minutes, energy, goal, title, actions, message, guide) => ({id, minutes, energy, goal, title, actions, message, guide});
export const socialSteps = [
  step('save-group',8,'low','join','Shortlist one recurring group', ['Find one group around an interest you already have.','Record its public contact, next date and joining requirements.','Leave unknown details as questions for the organiser.'], 'Hello, I am interested in [activity]. Can a newcomer join [session/date], and is booking required?', 'guide-find-recurring-groups.html'),
  step('prepare-opening',5,'low','join','Prepare an opening and an exit', ['Choose a public activity you could revisit.','Write one question about the shared setting.','Prepare a polite way to leave when your time is up.'], 'Hi, is this your first time at this activity too?\nI need to go now. It was nice talking with you.', 'guide-conversations.html'),
  step('short-invitation',10,'medium','follow','Make one specific invitation', ['Choose someone who welcomed contact with you.','Offer a short public plan, a day and an easy way to decline.','Wait for their answer before treating the plan as agreed.'], 'I enjoyed talking about [topic]. Would you like a 20-minute coffee at [public place] on [day/time]? No problem if it does not suit you.', 'guide-follow-up.html'),
  step('relevant-follow-up',5,'medium','follow','Follow up on something you discussed', ['Use one ordinary detail from your conversation.','Send one short message if further contact was welcome.','Let them answer in their own time; do not send a chain of reminders.'], 'It was nice meeting you at [activity]. I found [the book/place/resource] we talked about. Would you like me to send the link?', 'guide-follow-up.html'),
  step('brief-check-in',10,'high','keep','Arrange a ten-minute check-in', ['Ask an existing friend whether a brief call suits them.','Keep the call within the time you agreed.','Listen as well as sharing your own news.'], 'Would a ten-minute call sometime this week work for you? I can do [option 1] or [option 2]; another time is fine too.', 'guide-friendship-busy-schedules.html'),
  step('repair-cancellation',8,'high','keep','Offer an alternative after cancelling', ['Acknowledge the plan you could not keep.','Offer two times you can genuinely manage.','Leave the next decision with the other person.'], 'I am sorry I had to cancel our [plan]. I could do [option 1] or [option 2] instead. Would either suit you?', 'guide-maintain-new-friendships.html'),
  step('familiar-place',25,'low','join','Make a short visit to a familiar public place', ['Check opening hours and the journey before leaving.','Spend a manageable amount of time there; talking is optional.','Note whether it is a place you would want to return to.'], '', 'guide-first-30-days.html'),
  step('low-pressure-follow-up',15,'low','follow','Prepare a short plan after a shared activity', ['Choose a person you already met at a group.','Offer coffee after the next session rather than a separate evening.','Check that the next session and public venue are actually available.'], 'If you are at [next session], would you like to have a quick coffee afterwards at [public place]?', 'guide-follow-up.html'),
  step('short-public-walk',30,'medium','keep','Suggest a short public walk to an existing friend', ['Agree a busy public starting point and a clear finish time.','Check the route, weather and travel separately.','Keep the route adaptable so either person can finish early.'], 'Would you like a 30-minute walk from [public starting point] at [day/time]? We can keep it short.', 'guide-friendship-busy-schedules.html'),
  step('ask-organiser',30,'medium','join','Ask the organiser how a newcomer can take part', ['Choose one recurring group from a public listing.','Ask about the next session, cost, language and access needs that matter to you.','Use the reply to decide whether to book; do not assume a place is reserved.'], 'Hello, I am new to [activity]. Is the next session open to newcomers? What does it cost, and do I need to register?', 'guide-find-recurring-groups.html'),
  step('after-class-coffee',40,'high','follow','Invite a classmate for a short coffee', ['Choose a person with whom conversation has felt mutual.','Suggest a nearby public venue after your shared session.','Agree a short duration; accept a decline without pressing.'], 'I enjoyed our conversation today. Would you like a quick coffee at [nearby public place] after the next session?', 'guide-acquaintance-to-friend.html'),
  step('small-meetup-draft',35,'high','join','Draft a clear invitation for a small public meetup', ['Choose an activity, a public venue and an end time.','Check cost, booking and access before announcing it.','Explain how people can decline or cancel; avoid sharing anyone else’s contact details.'], 'Small [coffee/walk/games] meetup at [public venue], [day/time], for about [duration]. Cost: [confirmed amount]. Please check [booking detail] before joining.', 'guide-host-small-meetup.html'),
  step('quiet-repeat-visit',55,'low','join','Return to one manageable public setting', ['Check the actual session details and reserve only if required.','Choose an activity where participation can be quiet or structured.','Decide afterwards whether to return or try a different setting.'], '', 'guide-introverts-new-city.html'),
  step('prepare-language-plan',50,'low','keep','Plan a balanced language exchange', ['Ask your existing practice partner what each person wants to practise.','Choose equal practice time and agree how corrections should work.','Prepare a shared topic and a public venue; confirm the date separately.'], 'For our next exchange, shall we split the time equally between [language 1] and [language 2]? Would you prefer corrections during speaking or afterwards?', 'guide-language-exchange.html'),
  step('attend-structured-group',60,'medium','join','Try one structured recurring session', ['Check current dates, capacity, cost and travel before booking.','Choose a class or group with a shared task rather than relying on mingling.','Learn one practical detail about returning; an invitation is optional.'], 'I am new here. How does the session work, and is there another one I could join?', 'guide-find-recurring-groups.html'),
  step('language-exchange-visit',60,'medium','keep','Meet for a balanced language exchange', ['Agree a public place and a finish time with your existing partner.','Split practice time and ask what correction style each person prefers.','Before leaving, discuss whether another session would suit both people.'], 'Shall we do 25 minutes in each language and use the final ten minutes to choose our next topic?', 'guide-language-exchange.html'),
  step('host-short-meetup',60,'high','join','Host a short meetup you have already arranged', ['Use a confirmed public venue and respect any booking requirements.','Welcome participants and explain the activity and finish time.','Offer a next meeting only if people are interested; ask before collecting contact details.'], 'Welcome! We will spend about an hour on [activity]. You can leave earlier if you need to. Would anyone like to discuss another date afterwards?', 'guide-host-small-meetup.html'),
  step('shared-public-activity',75,'high','follow','Suggest a shared public activity', ['Choose an exhibition, game session or other activity you both expressed interest in.','Confirm tickets, access, timing and separate travel before committing.','Leave time for a short conversation, without expecting immediate closeness.'], 'You mentioned liking [interest]. Would you be interested in [public activity] on [day]? Let us check the cost and timing before deciding.', 'guide-acquaintance-to-friend.html')
];
export function eligibleSteps(minutes, energy = null, goal = null) {
  if (![10,45,90].includes(minutes) || energy !== null && !['low','medium','high'].includes(energy) || goal !== null && !['join','follow','keep'].includes(goal)) throw new RangeError('Invalid step options');
  return socialSteps.filter(s => s.minutes <= minutes && (energy === null || s.energy === energy) && (goal === null || s.goal === goal));
}
export function chooseStep(minutes, energy, previousId = '', random = Math.random()) {
  let choices = eligibleSteps(minutes, energy);
  const lowerBound = minutes === 90 ? 45 : minutes === 45 ? 10 : 0;
  const inBand = choices.filter(s => s.minutes > lowerBound);
  if (inBand.length) choices = inBand;
  if (choices.length > 1) choices = choices.filter(s => s.id !== previousId);
  const fraction = Number.isFinite(random) ? Math.min(Math.max(random,0),0.999999) : 0;
  return choices[Math.floor(fraction * choices.length)];
}
export function localDayKey(date = new Date()) {
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
function validDate(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const date = new Date(key+'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === key;
}
export function dailyStep(goal, minutes, key, offset = 0) {
  if (!validDate(key)) throw new RangeError('Invalid day');
  const choices = eligibleSteps(minutes, null, goal);
  const seed = [...key].reduce((total,c)=>total+c.charCodeAt(0),0);
  return choices[(seed + Math.max(0,Math.floor(offset)||0)) % choices.length];
}
export function emptyDailyState(legacyCount = 0, legacyLast = '', today = localDayKey()) {
  const total = Number.isInteger(legacyCount) && legacyCount >= 0 && legacyCount <= 1000000 ? legacyCount : 0;
  const days = {};
  if (total && validDate(legacyLast) && legacyLast <= today) days[legacyLast] = {id:'legacy',title:'An earlier Kindred Daily step'};
  return {version:2,total,days};
}
export function validDailyState(raw, today = localDayKey()) {
  if (!raw || raw.version !== 2 || !Number.isInteger(raw.total) || raw.total < 0 || raw.total > 1000000 || !raw.days || typeof raw.days !== 'object' || Array.isArray(raw.days)) return null;
  const entries = Object.entries(raw.days);
  if (entries.length > 90 || raw.total < entries.length) return null;
  if (entries.some(([key,value]) => !validDate(key) || key > today || !value || value.id !== 'legacy' && !socialSteps.some(s=>s.id===value.id) || typeof value.title !== 'string' || value.title.length > 180)) return null;
  return {version:2,total:raw.total,days:Object.fromEntries(entries.map(([key,value])=>[key,{id:value.id,title:value.title}]))};
}
export function markDaily(state, key, selected) {
  if (!validDailyState(state,key) || !validDate(key) || !socialSteps.some(s=>s.id===selected?.id)) throw new RangeError('Invalid daily record');
  if (state.days[key]) return state;
  const days = {...state.days,[key]:{id:selected.id,title:selected.title}};
  const trimmed = Object.fromEntries(Object.entries(days).sort(([a],[b])=>a.localeCompare(b)).slice(-90));
  return {version:2,total:state.total+1,days:trimmed};
}
export function undoDaily(state, key) {
  if (!state.days[key]) return state;
  const days={...state.days};delete days[key];
  return {version:2,total:Math.max(0,state.total-1),days};
}
export function recentDays(date = new Date(), length = 7) {
  return Array.from({length},(_,i)=>{const d=new Date(date);d.setDate(d.getDate()-length+1+i);return localDayKey(d);});
}
export const preferenceLabels = {
  pace:{weekly:'Weekly plans',spontaneous:'Spontaneous plans',occasional:'Occasional catch-ups'},
  setting:{one:'One-to-one',small:'Small group',large:'Large group'},
  style:{talk:'Conversation',activity:'Shared activities',mix:'A mix of both'}
};
export function friendshipPlan(first, second = null) {
  if (!first || typeof first !== 'object') throw new RangeError('Invalid preferences');
  for (const p of [first,second].filter(Boolean)) for (const key of Object.keys(preferenceLabels)) if (!Object.hasOwn(preferenceLabels[key],p[key])) throw new RangeError('Invalid preferences');
  const mixed = key => second && first[key] !== second[key];
  const pace = mixed('pace') ? 'Ask what frequency each person can keep. Try one agreed date before promising a weekly rhythm.' : first.pace==='weekly' ? 'Ask whether the same day each week would work; confirm each date until that rhythm is agreed.' : first.pace==='spontaneous' ? 'Agree how much notice each person needs and accept that a same-day invitation may not work.' : 'Offer one date this month and ask whether occasional contact suits both people.';
  const setting = mixed('setting') ? 'Ask whether a short public coffee before or after a group activity would suit you both. Either person can prefer another plan.' : first.setting==='one' ? 'Choose a busy public place for a short one-to-one meeting, with independent transport.' : first.setting==='small' ? 'Choose a small public activity with a clear task and finish time; check the organiser’s joining rules.' : 'Choose an organised public group activity; agree how to find each other and whether to talk afterwards.';
  const style = mixed('style') ? 'Ask about combining a short activity with conversation. Do not assume someone wants a personal discussion.' : first.style==='talk' ? 'Prepare one ordinary topic you both mentioned. Keep personal questions optional.' : first.style==='activity' ? 'Agree an activity and check its cost and availability; conversation can grow around the shared task.' : 'Allow a shared activity and some time to talk, without requiring either part to feel intense.';
  let activity = mixed('setting') ? 'a short coffee before or after a public group activity' : first.setting==='large' ? 'an organised public group activity' : first.style==='activity' ? 'a short walk or game at a public venue' : first.setting==='small' ? 'a small public group activity with time to talk' : 'a short coffee at a busy public café';
  const invitation = `Would you like to try ${activity} on [day/time]? Let us check the cost and details first. We can keep the first meeting short; another plan is fine if this does not suit you.`;
  return {pace,setting,style,activity,invitation,rows:Object.keys(preferenceLabels).map(key=>({key,first:preferenceLabels[key][first[key]],second:second?preferenceLabels[key][second[key]]:'Ask the other person',question:({pace,setting,style})[key]}))};
}
