const PUSH_URL = 'https://kindred-push.nadiiahonda34.workers.dev/';
const transient = status => status === 400 || status === 401 || status === 408 || status === 429 || status >= 500;
let activeUser = null, retryTimer, opening, authObserved = false;

export function setKindredPushUser(user) {
  authObserved = true;
  activeUser = user;
  clearTimeout(retryTimer);
}
const running = new Map(), fallback = new Map();

function database() {
  if (!globalThis.indexedDB) return null;
  if (!opening) opening = new Promise((resolve, reject) => {
    const request = indexedDB.open('kindred-push-outbox', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('events', {keyPath:'id'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {opening = null; resolve(null);};
  }).catch(() => {opening = null;return null;});
  return opening;
}

export const pushOutbox = {
  async put(item) {
    const db = await database();
    if (!db) {fallback.set(item.id, item); return;}
    return new Promise((resolve, reject) => {
      const tx = db.transaction('events', 'readwrite');
      tx.objectStore('events').put(item);
      tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error);
    });
  },
  async remove(id) {
    const db = await database();
    if (!db) {fallback.delete(id); return;}
    return new Promise((resolve, reject) => {
      const tx = db.transaction('events', 'readwrite');
      tx.objectStore('events').delete(id);
      tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error);
    });
  },
  async all() {
    const db = await database();
    if (!db) return [...fallback.values()];
    return new Promise((resolve, reject) => {
      const tx = db.transaction('events', 'readonly');
      const request = tx.objectStore('events').getAll();
      request.onsuccess = () => resolve(request.result);request.onerror = () => reject(request.error);
    });
  }
};

function scheduleRetry(user) {
  clearTimeout(retryTimer);
  if (globalThis.window && activeUser?.uid === user?.uid) {
    retryTimer = setTimeout(() => {void flushKindredPushOutbox(activeUser);}, 30000);
  }
}

export async function flushKindredPushOutbox(user, options = {}) {
  if (authObserved && user?.uid !== activeUser?.uid) return;
  if (!authObserved) activeUser = user;
  if (!user?.uid) {clearTimeout(retryTimer);return;}
  if (running.has(user.uid)) return running.get(user.uid);
  const store = options.store || pushOutbox, fetchImpl = options.fetchImpl || globalThis.fetch;
  const operation = (async () => {
    let pending = false;
    for (const item of await store.all()) {
      if (item.uid !== user.uid || activeUser?.uid !== user.uid) continue;
      try {
        let response;
        for (let attempt = 0; attempt < 2; attempt++) {
          const token = await user.getIdToken(attempt > 0);
          if (activeUser?.uid !== user.uid) return;
          response = await fetchImpl(PUSH_URL, {method:'POST',headers:{
            'Authorization':'Bearer '+token,'Content-Type':'application/json'
          },body:JSON.stringify(item.payload)});
          if (response.status !== 401) break;
        }
        if (response.ok) {
          const result = await response.json();
          if (result.ok !== false) await store.remove(item.id); else pending = true;
        } else if (transient(response.status)) pending = true;
        else await store.remove(item.id);
      } catch {pending = true;}
    }
    if (pending || (await store.all()).some(item => item.uid === user.uid)) scheduleRetry(user);
  })().catch(() => {scheduleRetry(user);}).finally(() => running.delete(user.uid));
  running.set(user.uid, operation);
  return operation;
}

export async function sendKindredPush(user, payload, options = {}) {
  if (!user?.uid) return {accepted:false};
  const clean = Object.fromEntries(Object.entries(payload).filter(([key,value]) =>
    ['type','connectionId','groupId','meetupId','messageId','roomId','roomCollection','recipientId','pollId','postId','replyId'].includes(key) && typeof value === 'string'));
  const id = user.uid + ':' + (globalThis.crypto?.randomUUID?.() || Date.now()+':'+Math.random());
  const store = options.store || pushOutbox;
  await store.put({id,uid:user.uid,payload:clean,createdAt:Date.now()});
  await flushKindredPushOutbox(user, options);
  return {accepted:!(await store.all()).some(item=>item.id===id)};
}

if (globalThis.window) {
  window.addEventListener('online', () => {if (activeUser) void flushKindredPushOutbox(activeUser);});
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && activeUser) void flushKindredPushOutbox(activeUser);
  });
}
