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
  let waitingForMessage = false;
  let timer;
  const announce = message => {if (status) status.textContent = message;};
  const unavailable = () => {
    clearTimeout(timer);
    waitingForMessage = false;
    announce('Google’s consent message is not available right now. Advertising remains paused. You can try again later or contact Kindred.');
  };
  const startTimer = () => {
    clearTimeout(timer);
    timer = setTimeout(unavailable, 15000);
  };
  startTimer();

  controls.forEach(button => button.addEventListener('click', () => {
    waitingForMessage = true;
    announce('Requesting your privacy options from Google. Advertising remains paused.');
    startTimer();
    window.googlefc.callbackQueue.push({CONSENT_API_READY: () => {
      if (typeof window.googlefc.showRevocationMessage === 'function') {
        try {window.googlefc.showRevocationMessage();} catch {unavailable();}
      } else unavailable();
    }});
  }));

  window.googlefc.callbackQueue.push({CONSENT_API_READY: () => {
    if (typeof window.__tcfapi !== 'function') return;
    window.__tcfapi('addEventListener', 0, (data, success) => {
      if (!success || !data || data.cmpStatus === 'error') {
        controls.forEach(button => {button.hidden = true;});
        unavailable();
        return;
      }
      if (typeof data.gdprApplies !== 'boolean') return;
      controls.forEach(button => {button.hidden = !data.gdprApplies;});
      if (!data.gdprApplies) {
        clearTimeout(timer);
        waitingForMessage = false;
        announce('Google has not requested a European consent message for this visit. Advertising remains paused.');
      } else if (data.eventStatus === 'cmpuishown') {
        clearTimeout(timer);
        waitingForMessage = false;
        announce('You can review your choices in Google’s consent message. Advertising remains paused.');
      } else if (data.eventStatus === 'useractioncomplete') {
        clearTimeout(timer);
        waitingForMessage = false;
        announce('Google has recorded your choices. You can change them using the button above. Advertising remains paused.');
      } else if (data.eventStatus === 'tcloaded' && !waitingForMessage) {
        clearTimeout(timer);
        announce('Use “Privacy and cookie settings” to review or change your Google consent choices. Advertising remains paused.');
      }
    });
  }});

  const tag = document.createElement('script');
  tag.async = true;
  tag.crossOrigin = 'anonymous';
  tag.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8272791832669756';
  tag.addEventListener('error', unavailable, {once: true});
  document.head.append(tag);
})();
