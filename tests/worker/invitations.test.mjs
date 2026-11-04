import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

const source = readFileSync(new URL('../../worker/kindred-push.js', import.meta.url), 'utf8');
const field = value => typeof value === 'string' ? { stringValue: value }
  : { arrayValue: { values: value.map(field) } };
const doc = value => ({ fields: Object.fromEntries(Object.entries(value).map(([k,v]) => [k, field(v)])),
  createTime: '2026-10-29T08:00:00Z' });

function setup() {
  const state = { fcm: [], receipts: new Set(), failure: false, docs: {
    'connections/request': doc({ requestedBy: 'sender', recipientId: 'recipient', participants: ['sender', 'recipient'], status: 'pending' }),
    'profiles/sender': doc({ displayName: 'Nadiia' }),
    'users/recipient': doc({ fcmToken: 'token1', fcmTokens: ['token1', 'token2'], notificationLanguage: 'ru' })
  } };
  const context = vm.createContext({ crypto: webcrypto, TextEncoder, TextDecoder, Response, Request, Headers, URLSearchParams, atob, btoa,
    fetch: async (url, options = {}) => {
      url = String(url);
      if (url.includes('fcm.googleapis.com/')) {
        state.fcm.push(JSON.parse(options.body).message);
        return new Response('{}', { status: state.failure ? 503 : 200 });
      }
      if (url.includes('/documents/')) {
        const path = decodeURIComponent(url.split('/documents/')[1].split('?')[0]);
        if (options.method === 'PATCH') {
          if (state.receipts.has(path)) return new Response('{}', { status: 409 });
          state.receipts.add(path);return new Response('{}');
        }
        if (options.method === 'DELETE') { state.receipts.delete(path);return new Response('{}'); }
        return new Response(JSON.stringify(state.docs[path] || {}), { status: state.docs[path] ? 200 : 404 });
      }
      throw new Error('Unexpected external request: '+url);
    }
  });
  vm.runInContext(source.replace('export default {', 'globalThis.worker = {'), context);
  vm.runInContext("getGoogleAccessToken = async () => 'oauth'; verifyFirebaseIdToken = async token => token === 'valid' ? {uid:'sender'} : null;", context);
  const request = (body, token='valid') => context.worker.fetch(new Request('https://example.test/', {
    method: 'POST', headers: { Authorization: 'Bearer '+token }, body: JSON.stringify(body)
  }), { FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ project_id: 'test' }) });
  return { state, request };
}

test('friend push derives recipient, deduplicates tokens, uses audible high-priority channel', async () => {
  const {state,request}=setup();
  const response=await request({type:'friend_request',connectionId:'request',recipientId:'attacker-target'});
  assert.equal(response.status,200);
  assert.equal((await response.json()).sentCount,2);
  for (const message of state.fcm) {
    assert.equal(message.data.recipientId,'recipient');
    assert.equal(message.android.priority,'HIGH');
    assert.equal(message.android.notification.sound,'default');
    assert.equal(message.android.notification.channel_id,'kindred_friend_invitations');
    assert.match(message.notification.body,/Nadiia.*друзья/);
  }
  assert.equal(state.fcm.length,2);
});

for (const [collection,game] of [['gameRooms','durak'],['arcadeRooms','tic_tac_toe'],['arcadeRooms','connect_four'],['arcadeRooms','memory']]) {
  test('invitation for '+game+' routes to its correct collection',async()=>{
    const {state,request}=setup();
    state.docs[collection+'/room']=doc({player1Id:'sender',player1Name:'Nadiia',player2Id:'recipient',
      participants:['sender','recipient'],mode:'invite',status:'invited',gameType:game});
    const response=await request({type:'game_invite',roomId:'room',roomCollection:collection});
    assert.equal(response.status,200);
    const message=state.fcm[0];
    assert.equal(message.data.roomCollection,collection);
    assert.equal(message.data.roomId,'room');
    assert.equal(message.android.notification.channel_id,'kindred_game_invitations');
    assert.equal(message.android.notification.sound,'default');
    assert.match(message.notification.body,/Nadiia.*приглашает/);
  });
}

test('a recipient cannot resend somebody else\'s request',async()=>{
  const {state,request}=setup();state.docs['connections/request'].fields.requestedBy=field('recipient');
  assert.equal((await request({type:'friend_request',connectionId:'request'})).status,403);
  assert.equal(state.fcm.length,0);
});

test('completed invitations stay silent',async()=>{
  const {state,request}=setup();state.docs['connections/request'].fields.status=field('accepted');
  assert.equal((await (await request({type:'friend_request',connectionId:'request'})).json()).sent,false);
  assert.equal(state.fcm.length,0);
});

test('invalid collections and path injection never reach FCM',async()=>{
  const {state,request}=setup();
  for (const payload of [{type:'game_invite',roomId:'room',roomCollection:'users'},
    {type:'friend_request',connectionId:'a/b'}, {type:'game_invite',roomId:'',roomCollection:'arcadeRooms'}]) {
    assert.equal((await request(payload)).status,400);
  }
  assert.equal(state.fcm.length,0);
});

test('blocks and missing FCM tokens are reported without ringing',async()=>{
  for (const blocked of [true,false]) {
    const {state,request}=setup();
    if(blocked)state.docs['blocks/recipient_sender']=doc({blockerId:'recipient'});
    else state.docs['users/recipient']=doc({});
    const response=await request({type:'friend_request',connectionId:'request'});
    assert.equal((await response.json()).sent,false);assert.equal(state.fcm.length,0);
  }
});

test('replayed requests do not ring twice; new invitation generation rings again',async()=>{
  const {state,request}=setup();const body={type:'friend_request',connectionId:'request'};
  await request(body);
  const replay=await (await request(body)).json();
  assert.equal(replay.duplicate,true);assert.equal(state.fcm.length,2);
  state.docs['connections/request'].createTime='2026-10-29T09:00:00Z';
  await request(body);assert.equal(state.fcm.length,4);
});

test('all-token send failure releases receipt for a safe retry',async()=>{
  const {state,request}=setup();const body={type:'friend_request',connectionId:'request'};
  state.failure=true;assert.equal((await request(body)).status,502);assert.equal(state.receipts.size,0);
  state.failure=false;assert.equal((await request(body)).status,200);
});

test('invalid Firebase identity is rejected before delivery',async()=>{
  const {state,request}=setup();assert.equal((await request({type:'friend_request',connectionId:'request'},'invalid')).status,401);
  assert.equal(state.fcm.length,0);
});
