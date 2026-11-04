import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

const source = readFileSync(new URL('../../worker/kindred-push.js', import.meta.url), 'utf8');
const field = value => typeof value === 'string' ? {stringValue:value}
  : {arrayValue:{values:value.map(field)}};
const doc = values => ({fields:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,field(v)]))});

function setup() {
  const state = {fcm:[], calls:[], commits:[], fail:new Set(), crash:new Set(), pages:[], docs:{
    'connections/pair':doc({participants:['sender','recipient'],status:'accepted'}),
    'connections/pair/messages/message':doc({senderId:'sender',text:'Hello'}),
    'groups/group':doc({ownerId:'sender',name:'Friends',memberIds:['sender','recipient','recipient','other'],invitedIds:['invited']}),
    'groups/group/messages/message':doc({senderId:'sender',senderName:'Nadiia',text:'Hello group'}),
    'users/recipient':doc({fcmToken:'token-a',fcmTokens:['token-a',' token-a ','token-b']}),
    'users/other':doc({fcmToken:'token-c'}),
    'users/invited':doc({fcmToken:'token-d'}),
    'users/organizer':doc({fcmToken:'token-e'}),
    'meetups/meetup':doc({creatorId:'organizer',city:'Berlin',type:'Coffee',status:'visible'}),
    'meetups/meetup/interested/sender':doc({userId:'sender',userName:'Nadiia'}),
    'meetups/meetup/messages/message':doc({authorId:'sender',authorName:'Nadiia',text:'See you'})
  }};
  const context=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Request,Response,Headers,
    URLSearchParams,atob,btoa,console:{error:()=>{}},fetch:async(url,options={})=>{
      url=String(url);state.calls.push({url,method:options.method||'GET'});
      if(url.includes('fcm.googleapis.com/')){
        const message=JSON.parse(options.body).message;state.fcm.push(message);
        if(state.crash.has(message.token))throw Error('Network unavailable');
        return new Response('{}',{status:state.fail.has(message.token)?503:200});
      }
      if(url.endsWith('/documents:commit')){
        state.commits.push(JSON.parse(options.body));return new Response('{}');
      }
      if(url.includes('/documents/')){
        const tail=url.split('/documents/')[1];
        if(tail.includes('?pageSize=')){
          const query=new URLSearchParams(tail.split('?')[1]);
          const index=Number(query.get('pageToken')||0);
          return new Response(JSON.stringify(state.pages[index]||{documents:[]}));
        }
        const path=decodeURIComponent(tail.split('?')[0]);
        return new Response(JSON.stringify(state.docs[path]||{}),{status:state.docs[path]?200:404});
      }
      throw Error('Unexpected request '+url);
    }});
  vm.runInContext(source.replace('export default {','globalThis.worker = {'),context);
  vm.runInContext("getGoogleAccessToken = async()=> 'oauth'; verifyFirebaseIdToken = async token=>token==='valid'?{uid:'sender'}:null",context);
  const send=(body,options={})=>context.worker.fetch(new Request('https://example.test/',{
    method:'POST',headers:{Authorization:'Bearer valid',...options.headers},body:JSON.stringify(body)
  }),{FIREBASE_SERVICE_ACCOUNT:'{"project_id":"test"}'});
  return {state,context,send};
}

function audible(message,recipient,type) {
  assert.equal(message.android.priority,'HIGH');
  assert.equal(message.android.notification.notification_priority,'PRIORITY_HIGH');
  assert.equal(message.android.notification.sound,'default');
  assert.equal(message.android.notification.default_vibrate_timings,true);
  assert.equal(message.android.notification.channel_id,'kindred_messages');
  assert.equal(message.data.recipientId,recipient);assert.equal(message.data.type,type);
}

test('website preflight allows authorization and JSON without contacting Firebase',async()=>{
  const {context,state}=setup();
  for(const origin of ['https://findkindredpeople.com','https://www.findkindredpeople.com','https://findkindredpeople.github.io']){
    const r=await context.worker.fetch(new Request('https://example.test/',{method:'OPTIONS',headers:{
      Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'
    }}),{});
    assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),origin);
    assert.match(r.headers.get('access-control-allow-headers'),/Authorization/);
  }
  assert.equal(state.calls.length,0);
});
test('unknown origins and unexpected preflight headers are refused',async()=>{
  const {context,state}=setup();
  assert.equal((await context.worker.fetch(new Request('https://example.test/',{headers:{Origin:'https://example.invalid'}}),{})).status,403);
  assert.equal((await context.worker.fetch(new Request('https://example.test/',{method:'OPTIONS',headers:{
    Origin:'https://findkindredpeople.com','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'x-unexpected'
  }}),{})).status,400);assert.equal(state.calls.length,0);
});
test('website success and validation errors both return CORS headers',async()=>{
  const {send}=setup();
  for(const body of [{connectionId:'pair',messageId:'message'},{type:'unknown'}]){
    const r=await send(body,{headers:{Origin:'https://findkindredpeople.com'}});
    assert.equal(r.headers.get('access-control-allow-origin'),'https://findkindredpeople.com');
  }
});
test('null, array, unknown types and invalid paths never reach FCM',async()=>{
  const {send,state}=setup();
  for(const body of [null,[],{type:'toString'},{type:'typo',connectionId:'pair',messageId:'message'},
    {type:'group_invite',groupId:'a/b',recipientId:'invited'}, {type:'chat_message',connectionId:'pair',messageId:'../other'}]){
    assert.equal((await send(body)).status,400);
  }
  assert.equal(state.fcm.length,0);
});
test('private message goes only to peer unique tokens with sound and routing data',async()=>{
  const {send,state}=setup();const r=await send({connectionId:'pair',messageId:'message',recipientId:'attacker'});
  assert.equal(r.status,200);assert.equal((await r.json()).sentCount,2);
  for(const m of state.fcm){audible(m,'recipient','chat_message');assert.equal(m.data.connectionId,'pair');}
});
test('voice messages from both Android and website use the voice notification text',async()=>{
  for(const fields of [{type:'audio',text:''},{audioData:'data:audio/webm;base64,test',text:''}]){
    const {send,state}=setup();state.docs['connections/pair/messages/message']=doc({senderId:'sender',...fields});
    await send({connectionId:'pair',messageId:'message'});assert.match(state.fcm[0].notification.body,/Голосовое/);
  }
});
test('private messages reject wrong author and nonparticipants; suppress removed connections',async()=>{
  for(const [key,value] of [['participants',['other','recipient']],['status','removed']]){
    const {send,state}=setup();state.docs['connections/pair'].fields[key]=field(value);
    assert.equal((await send({connectionId:'pair',messageId:'message'})).status,403);assert.equal(state.fcm.length,0);
  }
  const {send,state}=setup();state.docs['connections/pair/messages/message'].fields.senderId=field('other');
  assert.equal((await send({connectionId:'pair',messageId:'message'})).status,403);assert.equal(state.fcm.length,0);
});
test('a block suppresses private notifications in both directions',async()=>{
  for(const path of ['blocks/sender_recipient','blocks/recipient_sender']){
    const {send,state}=setup();state.docs[path]=doc({});
    assert.equal((await (await send({connectionId:'pair',messageId:'message'})).json()).sent,false);
    assert.equal(state.fcm.length,0);
  }
});
test('stored group invitations go only to invited user, with correct channel',async()=>{
  const {send,state}=setup();const r=await send({type:'group_invite',groupId:'group',recipientId:'invited'});
  assert.equal(r.status,200);assert.equal(state.fcm.length,1);audible(state.fcm[0],'invited','group_invite');
});
test('group invitations require owner and saved invitation, and respect blocks',async()=>{
  for(const scenario of ['owner','saved','block','member']){
    const {send,state}=setup();
    if(scenario==='owner')state.docs['groups/group'].fields.ownerId=field('other');
    if(scenario==='saved')state.docs['groups/group'].fields.invitedIds=field([]);
    if(scenario==='block')state.docs['blocks/invited_sender']=doc({});
    if(scenario==='member')state.docs['groups/group'].fields.memberIds=field(['sender','invited']);
    const r=await send({type:'group_invite',groupId:'group',recipientId:'invited'});
    assert.equal(r.status,scenario==='owner'||scenario==='saved'?403:200);assert.equal(state.fcm.length,0);
  }
});
test('group message excludes sender and duplicate members, preserving each target recipient',async()=>{
  const {send,state}=setup();const r=await send({type:'group_message',groupId:'group',messageId:'message'});
  assert.equal(r.status,200);assert.equal(state.fcm.length,3);
  for(const m of state.fcm)audible(m,m.token==='token-c'?'other':'recipient','group_message');
});
test('one FCM network failure does not discard successful group deliveries',async()=>{
  const {send,state}=setup();state.crash.add('token-c');
  const r=await send({type:'group_message',groupId:'group',messageId:'message'});const body=await r.json();
  assert.equal(r.status,200);assert.equal(body.sentCount,2);assert.equal(body.failed.length,1);
});
test('all rejected group tokens produce failure instead of false success',async()=>{
  const {send,state}=setup();for(const t of ['token-a','token-b','token-c'])state.fail.add(t);
  const r=await send({type:'group_message',groupId:'group',messageId:'message'});
  assert.equal(r.status,502);assert.equal((await r.json()).sent,false);
});
test('meetup interest notifies organizer only after the interest is saved',async()=>{
  const {send,state}=setup();const r=await send({type:'meetup_interest',meetupId:'meetup'});
  assert.equal(r.status,200);audible(state.fcm[0],'organizer','meetup_interest');
  delete state.docs['meetups/meetup/interested/sender'];state.fcm.length=0;
  assert.equal((await send({type:'meetup_interest',meetupId:'meetup'})).status,403);assert.equal(state.fcm.length,0);
});
test('meetup messages read every Firestore page and deduplicate participants',async()=>{
  const {send,state}=setup();state.pages=[
    {documents:[doc({userId:'sender'}),doc({userId:'recipient'})],nextPageToken:'1'},
    {documents:[doc({userId:'other'}),doc({userId:'recipient'})]}
  ];
  const r=await send({type:'meetup_message',meetupId:'meetup',messageId:'message'});
  assert.equal(r.status,200);assert.equal(state.fcm.length,4);
  assert.deepEqual(new Set(state.fcm.map(m=>m.data.recipientId)),new Set(['organizer','recipient','other']));
  for(const m of state.fcm)audible(m,m.data.recipientId,'meetup_message');
});
test('meetup cancellation requires organizer and saved cancelled status',async()=>{
  const {send,state}=setup();state.pages=[{documents:[doc({userId:'recipient'})]}];
  assert.equal((await send({type:'meetup_cancelled',meetupId:'meetup'})).status,403);
  state.docs['meetups/meetup'].fields.creatorId=field('sender');
  assert.equal((await send({type:'meetup_cancelled',meetupId:'meetup'})).status,403);
  state.docs['meetups/meetup'].fields.status=field('cancelled');
  assert.equal((await send({type:'meetup_cancelled',meetupId:'meetup'})).status,200);
  assert.equal(state.fcm.length,2);audible(state.fcm[0],'recipient','meetup_cancelled');
});
test('all rejected meetup tokens are reported as failed',async()=>{
  const {send,state}=setup();state.fail.add('token-e');
  const r=await send({type:'meetup_interest',meetupId:'meetup'});
  assert.equal(r.status,502);assert.equal((await r.json()).ok,false);
});
test('read receipts update Firestore without generating notifications',async()=>{
  for(const type of ['mark_read','group_mark_read']){
    const {send,state}=setup();
    const path=type==='mark_read'?'connections/pair/messages/message':'groups/group/messages/message';
    state.docs[path].fields.senderId=field('other');
    const r=await send(type==='mark_read'?{type,connectionId:'pair',messageId:'message'}:{type,groupId:'group',messageId:'message'});
    assert.equal(r.status,200);assert.equal(state.commits.length,1);assert.equal(state.fcm.length,0);
    assert.equal(state.commits[0].writes[0].transform.fieldTransforms[0].fieldPath,'readBy');
  }
});
