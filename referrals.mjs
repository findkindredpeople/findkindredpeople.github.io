const ORIGIN = "https://findkindredpeople.com";
const STORAGE_KEY = "kindred-pending-referral-v1";
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
export const REFERRAL_LANGUAGES = ["en", "de", "ru", "uk", "ar", "es", "fr", "tr"];

export function normalizeReferralCode(value) {
  return typeof value === "string" && /^[a-f0-9]{24}$/.test(value) ? value : "";
}

export function referralLanguage(value) {
  return REFERRAL_LANGUAGES.includes(value) ? value : "en";
}

export async function referralCodeForUser(uid) {
  if (typeof uid !== "string" || !uid) return "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`kindred-referral-v1:${uid}`));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

export function invitationUrl(code, language = "en") {
  const url = new URL("/invite.html", ORIGIN);
  const safeCode = normalizeReferralCode(code);
  if (safeCode) url.searchParams.set("ref", safeCode);
  url.searchParams.set("lang", referralLanguage(language));
  return url.href;
}

export function invitationDestinations(code, language = "en") {
  const safeCode = normalizeReferralCode(code), lang = referralLanguage(language);
  const web = new URL("/app.html", ORIGIN);
  web.searchParams.set("lang", lang);
  const play = new URL("https://play.google.com/store/apps/details");
  play.searchParams.set("id", "com.findkindredpeople.kindred");
  const native = new URL("kindred://invite");
  native.searchParams.set("lang", lang);
  if (safeCode) {
    web.searchParams.set("ref", safeCode);
    native.searchParams.set("ref", safeCode);
    play.searchParams.set("referrer", new URLSearchParams({ ref: safeCode, utm_source: "kindred", utm_medium: "referral" }).toString());
  }
  return {
    web: web.href, play: play.href,
    android: `intent://invite?${native.searchParams}#Intent;scheme=kindred;package=com.findkindredpeople.kindred;S.browser_fallback_url=${encodeURIComponent(play.href)};end`
  };
}

export function pendingReferral(storage, now = Date.now()) {
  try {
    const item = JSON.parse(storage.getItem(STORAGE_KEY));
    if (normalizeReferralCode(item?.code) && Number.isFinite(item.capturedAt) && item.capturedAt <= now && now - item.capturedAt < MAX_AGE) return item;
    storage.removeItem(STORAGE_KEY);
  } catch { /* Storage can be unavailable in private browsing. */ }
  return null;
}

export function captureReferral(search, storage, now = Date.now()) {
  const previous = pendingReferral(storage, now);
  if (previous) return previous;
  const params = new URLSearchParams(search);
  const code = params.getAll("ref").length === 1 ? normalizeReferralCode(params.get("ref")) : "";
  if (!code) return null;
  const item = { code, capturedAt: now };
  try { storage.setItem(STORAGE_KEY, JSON.stringify(item)); } catch { /* The URL still carries the code to registration. */ }
  return item;
}

export function clearPendingReferral(storage) {
  try { storage.removeItem(STORAGE_KEY); } catch { /* Optional browser storage. */ }
}

export function newReferralAttribution(ownCode, pending, existing, isNewUser) {
  const code = normalizeReferralCode(pending?.code);
  if (!isNewUser || !code || code === ownCode || existing?.referredByCode) return null;
  return { referredByCode: code, referralSource: "invitation" };
}
