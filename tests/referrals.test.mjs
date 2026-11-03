import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { referralCodeForUser, invitationUrl, invitationDestinations, captureReferral, pendingReferral, clearPendingReferral, newReferralAttribution, normalizeReferralCode } from "../referrals.mjs";
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const A = "a".repeat(24), B = "b".repeat(24);
const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};

test("one account gets the same opaque invitation code on each device", async () => {
  assert.equal(await referralCodeForUser("test-user-123"), "fdda97a6e5c5e1799065ac57");
  assert.notEqual(await referralCodeForUser("alice"), await referralCodeForUser("bob"));
  const link = invitationUrl(await referralCodeForUser("private-email@example.com"), "ru");
  assert.equal(new URL(link).pathname, "/invite.html");
  assert.ok(!link.includes("private-email"));
});

test("the website, Play installation and installed app carry the same code", () => {
  const links = invitationDestinations(A, "uk");
  assert.equal(new URL(links.web).searchParams.get("ref"), A);
  assert.equal(new URLSearchParams(new URL(links.play).searchParams.get("referrer")).get("ref"), A);
  assert.match(links.android, new RegExp(`ref=${A}#Intent;scheme=kindred;package=com.findkindredpeople.kindred;`));
  assert.equal(new URL(links.web).searchParams.get("lang"), "uk");
  const fallback = links.android.match(/S.browser_fallback_url=([^;]+)/)[1];
  assert.equal(decodeURIComponent(fallback), links.play);
});

test("malformed codes cannot inject a destination, HTML or extra referrer fields", () => {
  for (const code of ["", "abc", "A".repeat(24), "../users", `${A}&admin=true`, "<script>alert(1)</script>"]) {
    assert.equal(normalizeReferralCode(code), "");
    const links = invitationDestinations(code, "javascript:alert(1)");
    assert.equal(new URL(links.web).origin, "https://findkindredpeople.com");
    assert.equal(new URL(links.web).searchParams.has("ref"), false);
    assert.equal(new URL(links.play).searchParams.has("referrer"), false);
    assert.equal(new URL(links.web).searchParams.get("lang"), "en");
  }
});

test("a pending invitation survives the landing-to-registration transition without replacement", () => {
  const store = storage();
  assert.equal(captureReferral(`?ref=${A}`, store, 100).code, A);
  assert.equal(captureReferral(`?ref=${B}`, store, 200).code, A);
  assert.equal(captureReferral("", store, 300).code, A);
  clearPendingReferral(store);
  assert.equal(pendingReferral(store, 400), null);
});

test("pending invitations expire and duplicate parameters are rejected", () => {
  const store = storage();
  captureReferral(`?ref=${A}`, store, 100);
  assert.equal(pendingReferral(store, 100 + 7 * 86400000), null);
  assert.equal(captureReferral(`?ref=${A}&ref=${B}`, store, 200), null);
  assert.equal(captureReferral(`?ref=${B}`, store, 300).code, B);
});

test("blocked browser storage does not break the invitation page", () => {
  const store = { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); }, removeItem() { throw Error("blocked"); } };
  assert.equal(captureReferral(`?ref=${A}`, store, 1).code, A);
  assert.equal(captureReferral(`?ref=${A}`, undefined, 1).code, A);
  assert.doesNotThrow(() => clearPendingReferral(store));
});

test("only a new account can be attributed and the original inviter cannot be overwritten", () => {
  assert.deepEqual(newReferralAttribution(B, { code: A }, {}, true), { referredByCode: A, referralSource: "invitation" });
  assert.equal(newReferralAttribution(B, { code: A }, {}, false), null);
  assert.equal(newReferralAttribution(B, { code: B }, {}, true), null);
  assert.equal(newReferralAttribution(B, { code: A }, { referredByCode: B }, true), null);
  assert.equal(newReferralAttribution(B, null, {}, true), null);
});

// Exercise the actual click handlers without signing into a production Firebase account.
import vm from "node:vm";
import fs from "node:fs";
const appSource = fs.readFileSync(new URL("../kindred-app.js", import.meta.url), "utf8");
function sharingContext(navigator) {
  const events = [], field = { value: "", focus() {}, select() {}, setSelectionRange() {} };
  const context = vm.createContext({ navigator, state: { referralCode: A }, locale: "ru", invitationUrl,
    inviteText: () => ({ message: "Join Kindred", copied: "copied", manual: "manual" }),
    $: () => field, document: { execCommand: () => true }, toast: message => events.push(message) });
  vm.runInContext(appSource.slice(appSource.indexOf("function invitationPayload()"), appSource.indexOf("let referralStorage;")), context);
  return { context, events };
}

test("Copy link copies the personal URL and Share passes a real URL to the phone", async () => {
  let copied, shared;
  const { context } = sharingContext({ clipboard: { writeText: async value => { copied = value; } }, share: async value => { shared = value; } });
  await vm.runInContext("copyInvitation()", context);
  assert.equal(copied, invitationUrl(A, "ru"));
  await vm.runInContext("shareInvitation()", context);
  assert.equal(shared.url, copied);
  assert.equal(shared.text, "Join Kindred");
});

test("no system share uses Copy link; cancelling the share sheet leaves the clipboard alone", async () => {
  let copies = 0;
  const clip = { writeText: async () => { copies++; } };
  await vm.runInContext("shareInvitation()", sharingContext({ clipboard: clip }).context);
  assert.equal(copies, 1);
  await vm.runInContext("shareInvitation()", sharingContext({ clipboard: clip, share: async () => { const error = new Error(); error.name = "AbortError"; throw error; } }).context);
  assert.equal(copies, 1);
});

test("denied clipboard falls back to selecting and copying the visible link", async () => {
  const { context, events } = sharingContext({ clipboard: { writeText: async () => { throw Error("denied"); } } });
  await vm.runInContext("copyInvitation()", context);
  assert.deepEqual(events, ["copied"]);
});
