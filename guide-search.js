(() => {
  'use strict';
  const input = document.getElementById('guide-query');
  if (!input) return;
  const cards = [...document.querySelectorAll('#guide-list > .card')];
  const normalise = text => text.toLowerCase().replace(/[–—-]/g, ' ').replace(/\s+/g, ' ').trim();
  document.getElementById('guide-search').hidden = false;
  input.addEventListener('input', () => {
    const terms = normalise(input.value).split(' ').filter(Boolean);
    let count = 0;
    cards.forEach(card => {card.hidden = !terms.every(term => normalise(card.textContent).includes(term)); if (!card.hidden) count++;});
    document.getElementById('guide-count').textContent = count ? `${count} ${count === 1 ? 'guide' : 'guides'} found` : 'No matching guide. Try a shorter phrase, such as “city”, “parent” or “follow up”.';
  });
})();
