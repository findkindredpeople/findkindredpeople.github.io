(() => {
  'use strict';
  const form = document.getElementById('planner-form');
  if (!form) return;
  const $ = id => document.getElementById(id);
  const budgets = {30: [5, 5, 0, 15, 0, 0, 5], 60: [5, 10, 0, 30, 5, 0, 10], 120: [10, 15, 0, 60, 10, 15, 10]};
  const titles = {start: 'Find one place worth returning to', follow: 'Turn one good conversation into a next step', keep: 'Give an existing friendship a realistic rhythm'};
  let current;
  function makePlan() {
    const goal = $('goal').value, budget = Number($('budget').value);
    const online = $('setting').value === 'online', quiet = $('style').value === 'quiet', german = $('message-language').value === 'de';
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
      const deProposal = online ? (quiet ? 'kurz zu telefonieren' : '[gemeinsame Online-Aktivität] zu machen') : (quiet ? 'uns kurz bei [öffentlicher Ort] zu treffen' : '[gemeinsame Aktivität] bei [öffentlicher Ort] zu machen');
      invitation = german
        ? `${goal === 'follow' ? 'Hallo [Name], unser Gespräch über [Thema] bei [Anlass] hat mir gefallen.' : 'Hallo [Name], wie geht es dir mit [Thema aus unserem letzten Gespräch]?'} Hast du am [Tag] um [Uhrzeit${online ? ' und Zeitzone' : ''}] Lust, ${deProposal}? Ich hätte ungefähr ${minutes[3]} Minuten Zeit. Wenn es nicht passt, ist das auch völlig in Ordnung.`
        : `${goal === 'follow' ? 'Hi [name], I enjoyed talking about [topic] at [where we met].' : 'Hi [name], how has [something they mentioned] been going?'} Would you be up for ${proposal} on [day] at [time${online ? ' and time zone' : ''}]? I have about ${minutes[3]} minutes. No problem if it does not fit your week.`;
    }
    return {title: titles[goal], summary: `${budget} minutes across the week · ${online ? 'Online, without travel' : 'In person; add travel time separately'} · ${quiet ? 'Quiet conversation' : 'Shared activity'}`, boundary: online ? 'Use a moderated or agreed meeting space. Check time zones and recording rules; keep personal details private. A call happens only after both people agree.' : 'Choose a public place and check the organiser, cost, access and next date before going. Keep your own way home. A meeting happens only after both people agree.', tasks, minutes, invitation, note: 'Replace every bracketed detail before sending. This page does not send messages or book activities.'};
  }
  function render(announce) {
    current = makePlan();
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
  render(false);
})();
