import test from 'node:test';
import assert from 'node:assert/strict';
import {sendKindredPush,flushKindredPushOutbox} from '../push-client.mjs';
function setup() {
  const items = new Map(), requests = [];
  const user = {uid:'user',getIdToken:async(force)=>force?'fresh-token':'current-token'};
  const store={put:async item=>items.set(item.id,item),all:async()=>[...items.values()],remove:async id=>items.delete(id)};
  const fetchImpl=async(url,options)=>{requests.push({url,options});return new Response('{"ok":true,"queued":true}',{status:202});};
  return {user,items,requests,store,fetchImpl};
}
test('persists event references before sending; accepts queued server responses',async()=>{
  const s=setup();const result=await sendKindredPush(s.user,{type:'friend_request',connectionId:'pair',text:'private text'},{...s,
    fetchImpl:async(url,options)=>{assert.equal(s.items.size,1);s.requests.push({url,options});return new Response('{"ok":true,"queued":true}',{status:202});}});
  assert.equal(result.accepted,true);assert.equal(s.items.size,0);
  assert.deepEqual(JSON.parse(s.requests[0].options.body),{type:'friend_request',connectionId:'pair'});
});
test('temporary network failures retain an event and retry it later',async()=>{
  const s=setup();await sendKindredPush(s.user,{type:'chat_message',connectionId:'pair',messageId:'message'},{...s,fetchImpl:async()=>{throw Error('offline');}});
  assert.equal(s.items.size,1);await flushKindredPushOutbox(s.user,s);assert.equal(s.items.size,0);assert.equal(s.requests.length,1);
});
test('refreshes authorization once on a 401 and then sends the same event',async()=>{
  const s=setup(),headers=[];
  await sendKindredPush(s.user,{type:'chat_message',connectionId:'pair',messageId:'message'},{...s,fetchImpl:async(url,options)=>{
    headers.push(options.headers.Authorization);return headers.length===1?new Response('{}',{status:401}):new Response('{"ok":true}');}});
  assert.deepEqual(headers,['Bearer current-token','Bearer fresh-token']);assert.equal(s.items.size,0);
});
test('does not send another account\'s queued event',async()=>{
  const s=setup();await s.store.put({id:'old',uid:'old-user',payload:{type:'friend_request',connectionId:'old'}});
  await flushKindredPushOutbox(s.user,s);assert.equal(s.requests.length,0);assert.equal(s.items.size,1);
});
test('rate limits remain queued; permanently invalid references are removed',async()=>{
  for(const status of [429,503,400,403,404]){
    const s=setup();await sendKindredPush(s.user,{type:'friend_request',connectionId:'pair'},{...s,fetchImpl:async()=>new Response('{}',{status})});
    assert.equal(s.items.size,[400,429,503].includes(status)?1:0);
  }
});
test('drains every event without imposing a recipient or outbox count cutoff',async()=>{
  const s=setup();for(let n=0;n<350;n++)await s.store.put({id:String(n),uid:s.user.uid,payload:{type:'chat_message',connectionId:'pair',messageId:String(n)}});
  await flushKindredPushOutbox(s.user,s);assert.equal(s.requests.length,350);assert.equal(s.items.size,0);
});
test('a new request using the same reference survives acknowledgement of an earlier request',async()=>{
  const s=setup();let complete,started;
  const ready=new Promise(resolve=>{started=resolve;});
  const response=new Promise(resolve=>{complete=resolve;});
  const options={...s,fetchImpl:async()=>{started();return response;}};
  const payload={type:'friend_request',connectionId:'pair'};
  const first=sendKindredPush(s.user,payload,options);await ready;
  const second=sendKindredPush(s.user,payload,options);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(s.items.size,2);
  complete(new Response('{"ok":true,"queued":true}',{status:202}));await first;await second;
  assert.equal(s.items.size,1);await flushKindredPushOutbox(s.user,s);assert.equal(s.items.size,0);
});

test('a late send callback cannot resume the previous account outbox after sign-out',async()=>{
  const client=await import('../push-client.mjs?auth-transition');
  const s=setup();client.setKindredPushUser(s.user);
  client.setKindredPushUser(null);
  const result=await client.sendKindredPush(s.user,{type:'chat_message',connectionId:'pair',messageId:'late'},s);
  assert.equal(result.accepted,false);assert.equal(s.requests.length,0);assert.equal(s.items.size,1);
  client.setKindredPushUser({...s.user,uid:'other-user'});
  await client.flushKindredPushOutbox(s.user,s);assert.equal(s.requests.length,0);
  client.setKindredPushUser(s.user);await client.flushKindredPushOutbox(s.user,s);
  assert.equal(s.requests.length,1);assert.equal(s.items.size,0);
});
