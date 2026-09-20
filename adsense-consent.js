(() => {
  'use strict';
  // The AdSense tag also delivers the Google CMP message published for this site.
  // Keep ad requests paused during review; loading a CMP is not user consent.
  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.pauseAdRequests = 1;
  window.googlefc = window.googlefc || {};
  window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];

  const controls = [...document.querySelectorAll('[data-google-consent-control]')];
  const status = document.querySelector('[data-google-consent-status]');
  let ready = false;
  const announce = message => {if (status) status.textContent = message;};
  const unavailable = () => {
    if (!ready) announce('Google’s privacy choices are not available for this visit. Advertising remains paused. You can try reloading this page or contact Kindred.');
  };
  const timer = setTimeout(unavailable, 15000);

  controls.forEach(button => button.addEventListener('click', () => {
    window.googlefc.callbackQueue.push({CONSENT_API_READY: () => {
      if (typeof window.googlefc.showRevocationMessage === 'function') {
        window.googlefc.showRevocationMessage();
        announce('Google’s consent message is opening so you can review or change your choice. Advertising remains paused.');
      }
    }});
  }));

  window.googlefc.callbackQueue.push({CONSENT_API_READY: () => {
    if (typeof window.__tcfapi !== 'function') return;
    window.__tcfapi('addEventListener', 0, (data, success) => {
      if (!success || !data || typeof data.gdprApplies !== 'boolean') return;
      ready = true; clearTimeout(timer);
      controls.forEach(button => {button.hidden = !data.gdprApplies;});
      announce(data.gdprApplies
        ? 'Use “Privacy and cookie settings” to review or change your Google consent choices. Advertising remains paused.'
        : 'Google has not requested a European consent message for this visit. Advertising remains paused.');
    });
  }});

  const tag = document.createElement('script');
  tag.async = true;
  tag.crossOrigin = 'anonymous';
  tag.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8272791832669756';
  tag.addEventListener('error', unavailable, {once: true});
  document.head.append(tag);
})();
