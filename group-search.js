import {localGroupSearch} from './group-search.mjs?v=20261011-2';

const form = document.getElementById('local-group-form');
if (form) {
  const result = document.getElementById('local-group-result');
  const list = document.getElementById('local-group-queries');
  const directories = document.getElementById('local-group-directories');
  const message = document.getElementById('local-group-message');
  const status = document.getElementById('local-group-status');
  function render() {
    const search = localGroupSearch({place: form.elements.place.value, interest: form.elements.interest.value, language: form.elements.language.value});
    list.replaceChildren();
    for (const query of search.queries) {
      const item = document.createElement('li'), text = document.createElement('code');
      text.textContent = query; item.append(text); list.append(item);
    }
    directories.replaceChildren();
    for (const directory of search.directories) {
      const item = document.createElement('li'), link = document.createElement('a'), detail = document.createElement('p');
      link.href = directory.url; link.textContent = directory.name; link.target = '_blank'; link.rel = 'noopener noreferrer';
      detail.textContent = directory.next; item.append(link,detail); directories.append(item);
    }
    message.value = search.message;
    result.hidden = false;
    status.textContent = search.needsPlace ? 'Add your town or neighbourhood, or replace the location in the draft yourself.' : 'Directories, search phrases and activity-specific questions are ready. Check the organiser’s current programme before choosing a visit.';
  }
  form.hidden = false;
  form.addEventListener('submit', event => {event.preventDefault(); render();});
  form.addEventListener('input', () => {result.hidden = true; status.textContent = 'Details changed. Create a new search draft.';});
  document.getElementById('copy-group-draft').addEventListener('click', async () => {
    const links = [...directories.querySelectorAll('a')].map(link=>`${link.textContent}: ${link.href}`).join('\n');
    const text = links + '\n\n' + [...list.querySelectorAll('code')].map(item => item.textContent).join('\n') + '\n\n' + message.value;
    try {await navigator.clipboard.writeText(text); status.textContent = 'Directory links, search phrases and questions copied.';}
    catch {message.focus(); message.select(); status.textContent = 'Select and copy your question draft. The search phrases are listed above.';}
  });
}
