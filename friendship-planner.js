import {byId,selectedIds,nextDate} from './berlin-activities-data.mjs';
import {downloadCalendar} from './calendar.mjs';
import {storageKey,invitationFields,calendarFields,validSavedPlan} from './planner-storage.mjs';
(() => {
  'use strict';
  const form = document.getElementById('planner-form');
  if (!form) return;
  const $ = id => document.getElementById(id);
  const budgets = {30: [5, 5, 0, 15, 0, 0, 5], 60: [5, 10, 0, 30, 5, 0, 10], 120: [10, 15, 0, 60, 10, 15, 10]};
  const titles = {start: 'Find one place worth returning to', follow: 'Turn one good conversation into a next step', keep: 'Give an existing friendship a realistic rhythm'};
  let current, importedActivity;
  function personalize(invitation) {
    const values = {
      '[name]': 'invite-name', '[Name]': 'invite-name',
      '[activity]': 'invite-activity', '[Aktivität]': 'invite-activity',
      '[shared online activity]': 'invite-activity', '[shared activity]': 'invite-activity',
      '[gemeinsame Online-Aktivität]': 'invite-activity', '[gemeinsame Aktivität]': 'invite-activity',
      '[topic]': 'invite-topic', '[Thema]': 'invite-topic',
      '[something they mentioned]': 'invite-topic', '[Thema aus unserem letzten Gespräch]': 'invite-topic',
      '[where we met]': 'invite-met', '[Anlass]': 'invite-met',
      '[public place]': 'invite-place', '[öffentlicher Ort]': 'invite-place',
      '[day]': 'invite-day', '[Tag]': 'invite-day',
      '[time]': 'invite-time', '[time and time zone]': 'invite-time',
      '[Uhrzeit]': 'invite-time', '[Uhrzeit und Zeitzone]': 'invite-time'
    };
    return invitation.replace(/\[[^\]]+\]/g, token => values[token] ? ($(values[token]).value.trim() || token) : token);
  }
  function makePlan(options) {
    options = options || {goal: $('goal').value, budget: Number($('budget').value), online: $('setting').value === 'online', quiet: $('style').value === 'quiet', german: $('message-language').value === 'de'};
    const {goal, budget, online, quiet, german} = options;
    const minutes = budgets[budget];
    const activity = online ? (quiet ? 'a short voice or text conversation' : 'an online game, reading group or language exchange') : (quiet ? 'a quiet library or neighbourhood group' : 'a walking, craft or other shared-interest group');
    const reserve = budget === 30 ? 'Keep it to 15 minutes. If the activity is longer, use this slot to arrange a future session instead.' : `Allow up to ${minutes[3]} minutes. If the full activity will not fit, ask about a shorter visit or choose a future date.`;
    const rest = 'Rest or continue your ordinary routine. No social task is required today.';
    let tasks;
    if (goal === 'start') tasks = [
      `Choose one interest and one time you can repeat. ${online ? 'Note the time zone you can attend in.' : 'Set a realistic travel limit, including the return journey.'}`,
      `Shortlist two options for ${activity}. Check the next date, cost, organiser and how newcomers join.`,
      rest,
      `Try one confirmed ${online ? 'online session' : 'public drop-in session'} or contact the organiser first. ${reserve}`,
      minutes[4] ? 'Note one welcoming detail and one practical obstacle. Decide whether you would want to return.' : rest,
      minutes[5] ? 'If you met someone and agreed to exchange details, send one specific follow-up. Otherwise use the time to check the next session.' : rest,
      'Choose a next date or replace the unsuitable option. A confirmed place to return is a useful result even without a new friend.'
    ];
    if (goal === 'follow') tasks = [
      'Recall one detail from your conversation. Check that you have an agreed way to contact the person.',
      `Adapt the invitation below for ${online ? (quiet ? 'a short call or text conversation' : 'one shared online activity') : (quiet ? 'a short conversation in a quiet public place' : 'a small shared activity in a public place')}. Offer one time and an easy way to decline.`,
      'Leave room for a reply. A silent day is not a reason to send another message.',
      `Only after mutual agreement, meet or connect. ${reserve} If there is no agreement, keep your own routine; do not arrive uninvited.`,
      minutes[4] ? 'If you connected, note whether you both asked questions and felt comfortable. If not, keep the time for yourself.' : rest,
      minutes[5] ? 'After a good conversation, send one brief thank-you. If they declined or have not replied, do not use this slot to chase an answer.' : rest,
      'A yes with a time can become a plan. A no deserves acceptance. After silence, decide whether one later follow-up is appropriate, then leave the next step with them.'
    ];
    if (goal === 'keep') tasks = [
      'Choose one friend you want to stay in touch with. Think of something specific you would like to ask them.',
      `Offer one manageable ${online ? (quiet ? 'call or text catch-up' : 'online activity') : (quiet ? 'public-place catch-up near an existing routine' : 'shared activity near an existing routine')}. Ask what pace also works for them.`,
      rest,
      `If both of you agree, use this slot to connect and listen. ${reserve} If schedules do not match, offer a future date rather than an obligation.`,
      minutes[4] ? 'Note one thing they shared that you want to remember. Avoid recording sensitive details about them.' : rest,
      minutes[5] ? 'If welcome, share one relevant article, photo or small update. Do not turn contact into a daily duty.' : rest,
      'Agree on a possible next contact, or leave room for a quieter week. Ask whether the rhythm feels manageable for both of you.'
    ];
    let invitation;
    if (goal === 'start') invitation = german
      ? `Hallo, ich interessiere mich für [Aktivität]. Können neue Teilnehmende beim nächsten Termin ${online ? 'online ' : ''}mitmachen? Wann findet er statt, was kostet die Teilnahme und muss ich mich anmelden?`
      : `Hi, I’m interested in [activity]. Is your next ${online ? 'online ' : ''}session open to newcomers? Could you confirm the time, cost and whether I need to book?`;
    else {
      const proposal = online ? (quiet ? 'a short call' : '[shared online activity]') : (quiet ? 'a short catch-up at [public place]' : '[shared activity] at [public place]');
      const deProposal = online ? (quiet ? 'ein kurzes Telefonat' : '[gemeinsame Online-Aktivität]') : (quiet ? 'ein kurzes Treffen bei [öffentlicher Ort]' : '[gemeinsame Aktivität] bei [öffentlicher Ort]');
      invitation = german
        ? `${goal === 'follow' ? 'Hallo [Name], unser Gespräch über [Thema] bei [Anlass] hat mir gefallen.' : 'Hallo [Name], wie geht es dir mit [Thema aus unserem letzten Gespräch]?'} Hast du am [Tag] um [Uhrzeit${online ? ' und Zeitzone' : ''}] Lust auf ${deProposal}? Ich hätte ungefähr ${minutes[3]} Minuten Zeit. Wenn es nicht passt, ist das auch völlig in Ordnung.`
        : `${goal === 'follow' ? 'Hi [name], I enjoyed talking about [topic] at [where we met].' : 'Hi [name], how has [something they mentioned] been going?'} Would you be up for ${proposal} on [day] at [time${online ? ' and time zone' : ''}]? I have about ${minutes[3]} minutes. No problem if it does not fit your week.`;
    }
    invitation = personalize(invitation);
    const note = /\[[^\]]+\]/.test(invitation) ? 'Some bracketed details are still missing. Fill them in below or edit your copied message before sending.' : 'Your details are included. Check the wording, day, time and place before sending.';
    return {options, title: titles[goal], summary: `${budget} minutes across the week · ${online ? 'Online, without travel' : 'In person; add travel time separately'} · ${quiet ? 'Quiet conversation' : 'Shared activity'}`, boundary: online ? 'Use a moderated or agreed meeting space. Check time zones and recording rules; keep personal details private. A call happens only after both people agree.' : 'Choose a public place and check the organiser, cost, access and next date before going. Keep your own way home. A meeting happens only after both people agree.', tasks, minutes, invitation, note: note + ' This page does not send messages or book activities.'};
  }
  function render(announce, options) {
    current = makePlan(options);
    $('plan-heading').textContent = current.title;
    $('plan-summary').textContent = current.summary;
    $('plan-boundary').textContent = current.boundary;
    $('invitation').textContent = current.invitation;
    $('message-note').textContent = current.note;
    $('plan-steps').replaceChildren();
    current.tasks.forEach((task, i) => {
      const li = document.createElement('li'), label = document.createElement('label'), input = document.createElement('input'), text = document.createElement('span'), p = document.createElement('p');
      input.type = 'checkbox';
      input.setAttribute('aria-label', `Mark day ${i + 1} as complete`);
      text.textContent = `Day ${i + 1} · ${current.minutes[i] ? `${current.minutes[i]} min` : 'Rest'}`;
      p.id = `day-description-${i + 1}`;
      p.textContent = task;
      input.setAttribute('aria-describedby', p.id);
      label.append(input, text); li.append(label, p); $('plan-steps').append(li);
    });
    $('copy-fallback').hidden = true;
    $('planner-status').textContent = announce ? 'Your plan is ready. Check off steps as you go, or keep a copy.' : '';
    if (announce) $('plan-heading').focus();
  }
  function planText() {
    const checked = [...$('plan-steps').querySelectorAll('input')];
    return `KINDRED — ${current.title}\n${current.summary}\n\n${current.boundary}\n\n` + current.tasks.map((t, i) => `[${checked[i].checked ? 'x' : ' '}] Day ${i + 1} (${current.minutes[i] ? current.minutes[i] + ' min' : 'Rest'}): ${t}`).join('\n\n') + `\n\nA MESSAGE TO ADAPT\n${current.note}\n\n${current.invitation}\n\nhttps://findkindredpeople.com/friendship-planner.html\n`;
  }
  form.hidden = false;
  $('plan-actions').hidden = false;
  $('invitation-details').hidden = false;
  $('invitation-form').addEventListener('submit', event => {
    event.preventDefault();
    // Keep the plan and ticks unchanged while personalising its invitation.
    const next = makePlan(current.options);
    current.invitation = next.invitation; current.note = next.note;
    $('invitation').textContent = current.invitation; $('message-note').textContent = current.note;
    $('planner-status').textContent = 'Invitation updated. Your checklist is unchanged.';
  });
  form.addEventListener('submit', event => {event.preventDefault(); render(true);});
  form.addEventListener('change', () => {$('planner-status').textContent = 'Choices changed. Select “Build my week” to update the plan.';});
  $('copy-plan').addEventListener('click', async () => {
    const text = planText();
    try {if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(text); $('planner-status').textContent = 'Plan copied.';}
    catch { $('copy-fallback').hidden = false; $('plan-text').value = text; $('plan-text').focus(); $('plan-text').select(); $('planner-status').textContent = 'Automatic copying is unavailable. Copy the selected text below.'; }
  });
  $('download-plan').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([planText()], {type: 'text/plain;charset=utf-8'}));
    const link = document.createElement('a');link.href = url;link.download = 'kindred-friendship-plan.txt';document.body.append(link);link.click();link.remove();setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('planner-status').textContent = 'Your text download has started.';
  });
  $('print-plan').addEventListener('click', () => window.print());
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (deviceZone && !['Europe/Berlin','UTC'].includes(deviceZone)) {
    const option = document.createElement('option'); option.value = deviceZone; option.textContent = deviceZone + ' · this device'; $('calendar-zone').append(option);
  }
  $('calendar-zone').value = deviceZone || 'Europe/Berlin';
  function showImportedActivity() {
    const notice = $('planner-import'); notice.replaceChildren(); notice.hidden = !importedActivity;
    if (!importedActivity) return;
    const link = document.createElement('a'); link.href = importedActivity.source; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Check the organiser’s details';
    notice.append(`${importedActivity.title} · full session window ${importedActivity.duration} minutes. This is separate from your weekly planning budget. Confirm the date, cost and booking before going. `,link);
  }
  importedActivity = byId.get(selectedIds(new URLSearchParams(location.search).get('berlin'))[0]);
  if (importedActivity) {
    const item = importedActivity, date = nextDate(item);
    $('invite-activity').value = item.title; $('invite-place').value = item.venue; $('invite-time').value = item.start + ' Berlin time';
    if (date) $('invite-day').value = date;
    $('calendar-title').value = item.title; $('calendar-place').value = `${item.venue}, ${item.address}`;
    $('calendar-date').value = date || ''; $('calendar-time').value = item.start; $('calendar-duration').value = item.duration; $('calendar-zone').value = 'Europe/Berlin';
    showImportedActivity();
  }
  $('saved-plan-controls').hidden = false; $('calendar-section').hidden = false;
  function savedState() {
    try {
      const raw = localStorage.getItem(storageKey), saved = validSavedPlan(JSON.parse(raw || 'null'));
      $('restore-plan').disabled = !saved; $('delete-plan').disabled = !raw;
      $('saved-plan-info').textContent = saved ? `A plan was saved in this browser on ${new Date(saved.savedAt).toLocaleString()}. It is not loaded automatically.` : raw ? 'The saved plan could not be read. Delete it or replace it with your current plan.' : 'No plan saved in this browser.';
    } catch {$('restore-plan').disabled = true; $('delete-plan').disabled = false; $('saved-plan-info').textContent = 'Browser storage is unavailable or the saved plan could not be read. You can still download a copy.';}
  }
  $('save-plan').addEventListener('click',() => {
    const snapshot = {version:1,options:current.options,checked:[...$('plan-steps').querySelectorAll('input')].map(input=>input.checked),invitation:current.invitation,note:current.note,savedAt:new Date().toISOString(),fields:Object.fromEntries(invitationFields.map(key=>[key,$('invite-'+key).value])),calendar:Object.fromEntries(calendarFields.map(key=>[key,$('calendar-'+key).value])),activityId:importedActivity?.id || ''};
    try {localStorage.setItem(storageKey,JSON.stringify(snapshot)); savedState(); $('planner-status').textContent = 'Displayed plan, ticks, invitation drafts and calendar fields saved on this device. Later edits are not saved automatically.';}
    catch {$('planner-status').textContent = 'The browser could not save this plan. Use Download .txt to keep a copy.';}
  });
  $('restore-plan').addEventListener('click',() => {
    try {
      const saved = validSavedPlan(JSON.parse(localStorage.getItem(storageKey) || 'null'));
      if (!saved) throw new Error('No valid saved plan');
      const o = saved.options; $('goal').value = o.goal; $('budget').value = o.budget; $('setting').value = o.online ? 'online' : 'nearby'; $('style').value = o.quiet ? 'quiet' : 'activity'; $('message-language').value = o.german ? 'de' : 'en';
      invitationFields.forEach(key => {$('invite-'+key).value = saved.fields[key];});
      calendarFields.forEach(key => {$('calendar-'+key).value = saved.calendar[key];});
      if (!$('calendar-zone').value) $('calendar-zone').value = 'Europe/Berlin';
      render(false,o); current.invitation = saved.invitation; current.note = saved.note; $('invitation').textContent = current.invitation; $('message-note').textContent = current.note;
      [...$('plan-steps').querySelectorAll('input')].forEach((input,i)=>{input.checked = saved.checked[i];});
      importedActivity = byId.get(saved.activityId); showImportedActivity();
      $('planner-status').textContent = 'Saved plan restored. Check saved dates before using them; later edits need Save on this device again.'; $('plan-heading').focus();
    } catch {$('planner-status').textContent = 'The saved plan could not be restored. You can delete it and save a new one.';}
  });
  $('delete-plan').addEventListener('click',() => {try {localStorage.removeItem(storageKey); savedState(); $('planner-status').textContent = 'Saved plan deleted from this browser. The currently displayed plan stays open.';} catch {$('planner-status').textContent = 'Browser storage is unavailable. Clear this site’s data in your browser settings to remove stored plans.';}});
  $('calendar-form').addEventListener('submit',event => {
    event.preventDefault();
    try {downloadCalendar({title:$('calendar-title').value,location:$('calendar-place').value,date:$('calendar-date').value,time:$('calendar-time').value,duration:$('calendar-duration').value,timeZone:$('calendar-zone').value,description:'Your Kindred visit plan. Include travel time separately.',source:importedActivity?.source || ''}); $('calendar-status').textContent = 'Calendar download started. Import the .ics file into your calendar. This does not send an invitation or reserve a place.';}
    catch (error) {$('calendar-status').textContent = error.message;}
  });
  render(false);
  savedState();
})();
