(() => {
  'use strict';
  function addPrivacyLink() {
    const footer = document.querySelector('footer .foot');
    if (!footer || footer.querySelector('a[href="privacy.html"]')) return;
    const link = document.createElement('a');
    link.href = 'privacy.html';
    link.textContent = 'Privacy information';
    footer.append(link);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addPrivacyLink, {once: true});
  else addPrivacyLink();
})();
