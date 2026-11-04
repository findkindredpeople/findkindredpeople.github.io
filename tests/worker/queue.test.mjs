import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const source=readFileSync(new URL('../../worker/kindred-push.js',import.meta.url),'utf8');
const field=value=>typeof value==='string'?{stringValue:value}:Array.isArray(value)?{arrayValue:{values:value.map(field)}}:{booleanValue:value};
const doc=values=>({fields:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,field(v)])),createTime:'2026-11-02T09:00:00Z',updateTime:'2026-11-02T09:00:00Z'});
function setup() {
  const state={collections:{},jobs:[],fcm:[],retries:[],acked:0,calls:0,maxCalls:0,revision:0,requestUid:'sender',now:Date.now(),
    fail:new Set(),audience:[],batchSizes:[],docs:{
      'connections/request':doc({requestedBy:'sender',recipientId:'recipient',participants:['sender','recipient'],status:'pending'}),
      'profiles/sender':doc({displayName:'Nadiia'}),
      'users/recipient':doc({fcmToken:'token-a',fcmTokens:['token-a','token-b'],notificationLanguage:'ru'}),
      'groups/group':doc({ownerId:'sender',name:'Friends',memberIds:['sender','recipient'],invitedIds:['recipient']}),
      'groups/group/messages/message':doc({senderId:'sender',senderName:'Nadiia',text:'Hello'}),
      'meetups/meetup':doc({creatorId:'sender',city:'Berlin',type:'Coffee',status:'cancelled'})
    }};
  class Clock extends Date {constructor(...args){super(...(args.length?args:[state.now]));}static now(){return state.now;}}
  const queue={send:async body=>{assert.ok(JSON.stringify(body).length<128*1024);state.jobs.push(structuredClone(body));},sendBatch:async items=>{
    assert.ok(items.length<=100);assert.ok(JSON.stringify(items).length<256*1024);state.batchSizes.push(items.length);
    for(const item of items)state.jobs.push(structuredClone(item.body));
  }};
  const context=vm.createContext({crypto:webcrypto,TextEncoder,TextDecoder,Request,Response,Headers,URLSearchParams,
    atob,btoa,Date:Clock,console:{error:()=>{}},fetch:async(raw,options={})=>{
      state.calls++;assert.ok(state.calls<=48,'External subrequest budget exceeded: '+state.calls);
      const url=new URL(String(raw));
      if(url.hostname==='fcm.googleapis.com'){
        const m=JSON.parse(options.body).message;state.fcm.push(m);
        return new Response('{}',{status:state.fail.has(m.token)?503:200});
      }
      if(url.pathname.endsWith('/documents:commit')){
        for(const w of JSON.parse(options.body).writes){
          if(w.update){
            const path=w.update.name.split('/documents/')[1];const current=state.docs[path]||doc({});
            const fields=w.updateMask?{...current.fields}:{};
            for(const key of w.updateMask?.fieldPaths||[])delete fields[key];
            Object.assign(fields,w.update.fields||{});state.docs[path]={...current,fields};
            for(const t of w.updateTransforms||[])applyTransform(state.docs[path],t);
          }
          if(w.transform){const path=w.transform.document.split('/documents/')[1];state.docs[path]??=doc({});for(const t of w.transform.fieldTransforms)applyTransform(state.docs[path],t);}
        }
        return new Response('{}');
      }
      const path=decodeURIComponent(url.pathname.split('/documents/')[1]||'');
      if(url.searchParams.has('pageSize')){
        const offset=Number(url.searchParams.get('pageToken')||0),size=Number(url.searchParams.get('pageSize'));
        const documents=state.collections[path]?state.collections[path].slice(offset,offset+size):state.audience.slice(offset,offset+size).map(uid=>({...doc({userId:uid}),name:'projects/test/databases/(default)/documents/'+path+'/'+uid}));
        return new Response(JSON.stringify({documents,...(offset+size<(state.collections[path]?.length??state.audience.length)?{nextPageToken:String(offset+size)}:{})}));
      }
      if(options.method==='PATCH'){
        const old=state.docs[path];
        if(url.searchParams.get('currentDocument.exists')==='false'&&old)return new Response('{}',{status:409});
        if(url.searchParams.has('currentDocument.updateTime')&&old?.updateTime!==url.searchParams.get('currentDocument.updateTime'))return new Response('{}',{status:412});
        const body=JSON.parse(options.body);if(url.searchParams.getAll("updateMask.fieldPaths").length)body.fields={...old?.fields,...body.fields};
        const updated={...body,createTime:old?.createTime||new Clock().toISOString(),
          updateTime:new Date(1_000_000+(++state.revision)).toISOString()};
        state.docs[path]=updated;return new Response(JSON.stringify(updated));
      }
      return new Response(JSON.stringify(state.docs[path]||{}),{status:state.docs[path]?200:404});
    }});
  function applyTransform(document,t){
    const existing=(document.fields[t.fieldPath]?.arrayValue?.values||[]).map(x=>x.stringValue);
    if(t.appendMissingElements)document.fields[t.fieldPath]=field([...new Set([...existing,...t.appendMissingElements.values.map(x=>x.stringValue)])]);
    if(t.removeAllFromArray)document.fields[t.fieldPath]=field(existing.filter(x=>!t.removeAllFromArray.values.some(y=>y.stringValue===x)));
  }
  vm.runInContext(source.replace('export default {','globalThis.worker = {'),context);
  context.testUid='sender';
  vm.runInContext("getGoogleAccessToken=async()=> 'oauth';verifyFirebaseIdToken=async()=>({uid:testUid})",context);
  const env={FIREBASE_SERVICE_ACCOUNT:'{"project_id":"test"}',KINDRED_PUSH_QUEUE:queue};
  const send=async body=>{state.calls=0;context.testUid=state.requestUid;const r=await context.worker.fetch(new Request('https://example.test/',{
    method:'POST',headers:{Authorization:'Bearer valid'},body:JSON.stringify(body)}),env);state.maxCalls=Math.max(state.maxCalls,state.calls);return r;};
  const one=async job=>{state.calls=0;let retried=false;await context.worker.queue({messages:[{body:job,attempts:1,ack(){state.acked++;},retry(){retried=true;state.retries.push(job);}}]},env);
    state.maxCalls=Math.max(state.maxCalls,state.calls);return !retried;};
  const drain=async()=>{let processed=0;while(state.jobs.length){assert.ok(processed++<10000,'Queue did not drain');await one(state.jobs.shift());}return processed;};
  return {state,context,send,one,drain};
}

test('saved meeting proposals and ringing calls have useful notification previews',async()=>{
  for(const kind of ['plan','call']) {
    const s=setup();s.state.docs['connections/chat']=doc({participants:['sender','recipient'],status:'accepted'});
    const message=doc({senderId:'sender',text:''});
    message.fields[kind]={mapValue:{fields:kind==='call'?{status:{stringValue:'ringing'}}:{}}};
    s.state.docs['connections/chat/messages/card']=message;
    assert.equal((await s.send({type:'chat_message',connectionId:'chat',messageId:'card'})).status,202);
    await s.drain();assert.equal(s.state.retries.length,0);assert.ok(s.state.fcm.length>0);
    assert.match(s.state.fcm[0].notification.body,kind==='call'?/видеозвонок/:/встрече/);
  }
});

test('calls accepted before the queue catches up no longer produce an incoming-call alert',async()=>{
  const s=setup();s.state.docs['connections/chat']=doc({participants:['sender','recipient'],status:'accepted'});
  const message=doc({senderId:'sender',text:''});message.fields.call={mapValue:{fields:{status:{stringValue:'ringing'}}}};
  s.state.docs['connections/chat/messages/card']=message;
  assert.equal((await s.send({type:'chat_message',connectionId:'chat',messageId:'card'})).status,202);
  message.fields.call.mapValue.fields.status={stringValue:'accepted'};
  await s.drain();assert.equal(s.state.fcm.length,0);assert.equal(s.state.retries.length,0);
});
test('HTTP enqueues an event instead of synchronously fanning out',async()=>{
  const s=setup();const r=await s.send({type:'friend_request',connectionId:'request'});
  assert.equal(r.status,202);assert.equal((await r.json()).queued,true);assert.equal(s.state.fcm.length,0);
  await s.drain();assert.equal(s.state.fcm.length,2);assert.equal(s.state.retries.length,0);
});
test('large group reaches every device across separate budgeted invocations',async()=>{
  const s=setup(),members=Array.from({length:350},(_,n)=>'member-'+n);
  s.state.docs['groups/group'].fields.memberIds=field(['sender',...members]);
  for(const uid of members)s.state.docs['users/'+uid]=doc({fcmTokens:[uid+'-a',uid+'-b']});
  assert.equal((await s.send({type:'group_message',groupId:'group',messageId:'message'})).status,202);
  await s.drain();assert.equal(s.state.fcm.length,700);assert.equal(s.state.retries.length,0);
  assert.ok(s.state.maxCalls<50);assert.ok(s.state.batchSizes.every(size=>size<=100));
  assert.equal(new Set(s.state.fcm.map(m=>m.data.recipientId)).size,350);
});
test('a user with more than one token page receives every device exactly once',async()=>{
  const s=setup();s.state.docs['users/recipient']=doc({fcmTokens:Array.from({length:19},(_,n)=>'token-'+n)});
  await s.send({type:'friend_request',connectionId:'request'});await s.drain();
  assert.equal(s.state.fcm.length,19);assert.equal(new Set(s.state.fcm.map(m=>m.token)).size,19);
  assert.equal(s.state.retries.length,0);assert.ok(s.state.maxCalls<50);
});
test('paginated meetup audience is continued without a fixed recipient cutoff',async()=>{
  const s=setup();s.state.audience=Array.from({length:235},(_,n)=>'guest-'+n);
  for(const uid of s.state.audience){s.state.docs['users/'+uid]=doc({fcmToken:uid+'-token'});s.state.docs['meetups/meetup/interested/'+uid]=doc({userId:uid});}
  await s.send({type:'meetup_cancelled',meetupId:'meetup'});await s.drain();
  assert.equal(s.state.fcm.length,235);assert.equal(s.state.retries.length,0);assert.ok(s.state.maxCalls<50);
});
test('replayed queued events do not create duplicate device deliveries',async()=>{
  const s=setup();await s.send({type:'friend_request',connectionId:'request'});await s.drain();
  await s.send({type:'friend_request',connectionId:'request'});await s.drain();assert.equal(s.state.fcm.length,2);
});
test('temporary FCM failures retain a retry and successfully recover after the lease',async()=>{
  const s=setup();s.state.fail.add('token-a');await s.send({type:'friend_request',connectionId:'request'});await s.drain();
  assert.equal(s.state.retries.length,1);const job=s.state.retries.pop();s.state.fail.clear();s.state.now+=121000;
  assert.equal(await s.one(job),true);assert.equal(s.state.fcm.filter(m=>m.token==='token-b').length,1);
  assert.equal(s.state.fcm.filter(m=>m.token==='token-a').length,2);
});
test('a failed device on the first page does not block healthy later device pages',async()=>{
  const s=setup();s.state.docs['users/recipient']=doc({fcmTokens:Array.from({length:19},(_,n)=>'token-'+n)});
  s.state.fail.add('token-0');await s.send({type:'friend_request',connectionId:'request'});await s.drain();
  assert.equal(s.state.retries.length,1);
  assert.equal(new Set(s.state.fcm.map(m=>m.token)).size,19);
  const failed=s.state.retries.pop();s.state.fail.clear();s.state.now+=121000;
  assert.equal(await s.one(failed),true);await s.drain();
  assert.equal(s.state.retries.length,0);
  assert.equal(s.state.fcm.filter(m=>m.token==='token-0').length,2);
  for(let n=1;n<19;n++)assert.equal(s.state.fcm.filter(m=>m.token==='token-'+n).length,1);
  assert.ok(s.state.maxCalls<50);
});
test('new device registration uses data-only messages with recipient filtering',async()=>{
  const s=setup();s.state.requestUid='recipient';
  assert.equal((await s.send({type:'register_device',token:'registered-device-token'})).status,200);
  s.state.requestUid='sender';await s.send({type:'friend_request',connectionId:'request'});await s.drain();
  const m=s.state.fcm.find(m=>m.token==='registered-device-token');assert.ok(m);
  assert.equal(m.notification,undefined);assert.equal(m.android.notification,undefined);
  assert.equal(m.data.recipientId,'recipient');assert.ok(m.data.title);assert.ok(m.data.body);
});
test('unregister creates a tombstone and removes user token fields',async()=>{
  const s=setup();s.state.requestUid='recipient';const token='registered-device-token';
  await s.send({type:'register_device',token});await s.send({type:'unregister_device',token});
  const id=await s.context.pushHash(token);
  assert.equal(s.state.docs['pushDeviceOwners/'+id].fields.uid.stringValue,'');
  assert.equal(s.state.docs['users/recipient'].fields.fcmToken,undefined);
  assert.ok(!s.state.docs['users/recipient'].fields.fcmTokens.arrayValue.values.some(x=>x.stringValue===token));
});
test('an old account cannot unregister a device transferred to another account',async()=>{
  const s=setup(),token='registered-device-token';s.state.requestUid='recipient';await s.send({type:'register_device',token});
  s.state.requestUid='other';await s.send({type:'register_device',token});
  s.state.requestUid='recipient';await s.send({type:'unregister_device',token});
  const id=await s.context.pushHash(token);assert.equal(s.state.docs['pushDeviceOwners/'+id].fields.uid.stringValue,'other');
  s.state.requestUid='sender';await s.send({type:'friend_request',connectionId:'request'});await s.drain();
  assert.ok(!s.state.fcm.some(m=>m.token===token));
});
test('cancelled or replaced invitations are suppressed when the queue catches up',async()=>{
  for(const scenario of ['status','generation']){
    const s=setup();await s.send({type:'friend_request',connectionId:'request'});
    if(scenario==='status')s.state.docs['connections/request'].fields.status=field('accepted');
    else s.state.docs['connections/request'].createTime='2026-11-02T10:00:00Z';
    await s.drain();assert.equal(s.state.fcm.length,0);
  }
});
test('a later group edit does not cancel a queued valid group invitation',async()=>{
  const s=setup();s.state.docs['groups/group'].fields.memberIds=field(['sender']);
  await s.send({type:'group_invite',groupId:'group',recipientId:'recipient'});
  s.state.docs['groups/group'].updateTime='2026-11-02T10:00:00Z';
  await s.drain();assert.equal(s.state.fcm.length,2);
});
for(const collection of ['gameRooms','arcadeRooms'])test('queued game invitation routes to '+collection,async()=>{
  const s=setup();s.state.docs[collection+'/room']=doc({player1Id:'sender',player2Id:'recipient',player1Name:'Nadiia',
    participants:['sender','recipient'],mode:'invite',status:'invited',gameType:'memory'});
  await s.send({type:'game_invite',roomId:'room',roomCollection:collection});await s.drain();
  assert.equal(s.state.fcm.length,2);assert.equal(s.state.fcm[0].data.roomCollection,collection);
});

const preferences=values=>({mapValue:{fields:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,field(v)]))}});
test('new reply pushes validate stored authors, notify only the post owner and deduplicate replays',async()=>{
 const s=setup();s.state.docs['forumPosts/post']=doc({authorId:'recipient',status:'visible'});s.state.docs['forumPosts/post/replies/reply']=doc({authorId:'sender',status:'visible'});
 assert.equal((await s.send({type:'forum_reply',postId:'post',replyId:'reply'})).status,202);await s.drain();assert.equal(s.state.fcm.length,2);
 assert.ok(s.state.fcm.every(m=>m.data.postId==='post'&&m.data.recipientId==='recipient'));
 await s.send({type:'forum_reply',postId:'post',replyId:'reply'});await s.drain();assert.equal(s.state.fcm.length,2);
 s.state.docs['forumPosts/post/replies/forged']=doc({authorId:'recipient',status:'visible'});
 assert.equal((await s.send({type:'forum_reply',postId:'post',replyId:'forged'})).status,403);
});
test('meeting polls and votes are scoped to accepted connection participants',async()=>{
 const s=setup();s.state.docs['connections/chat']=doc({participants:['sender','recipient'],status:'accepted'});
 s.state.docs['meetingPolls/poll']=doc({creatorId:'sender',participants:['sender','recipient'],connectionId:'chat',status:'open'});
 assert.equal((await s.send({type:'meeting_poll',pollId:'poll'})).status,202);await s.drain();assert.equal(s.state.fcm.length,2);
 s.state.requestUid='outsider';assert.equal((await s.send({type:'meeting_poll',pollId:'poll'})).status,403);
 s.state.requestUid='recipient';s.state.docs['meetingPolls/poll/votes/recipient']=doc({userId:'recipient'});
 s.state.docs['users/sender']=doc({fcmToken:'sender-token'});
 assert.equal((await s.send({type:'meeting_vote',pollId:'poll'})).status,202);await s.drain();assert.equal(s.state.fcm.at(-1).data.recipientId,'sender');
});
test('muting one notification category does not mute the others',async()=>{
 const s=setup();s.state.docs['users/recipient'].fields.notificationPreferences=preferences({friends:false,messages:true});
 await s.send({type:'friend_request',connectionId:'request'});await s.drain();assert.equal(s.state.fcm.length,0);
 s.state.docs['connections/chat']=doc({participants:['sender','recipient'],status:'accepted'});s.state.docs['connections/chat/messages/message']=doc({senderId:'sender',text:'Hello'});
 await s.send({type:'chat_message',connectionId:'chat',messageId:'message'});await s.drain();assert.equal(s.state.fcm.length,2);
});
test('quiet hours use the recipient timezone and do not deliver a stale sound later',async()=>{
 const s=setup();s.state.now=Date.parse('2026-11-04T22:00:00Z');s.state.docs['users/recipient'].fields.notificationPreferences=preferences({quietEnabled:true,quietStart:'22:00',quietEnd:'08:00',timeZone:'Europe/Berlin'});
 await s.send({type:'friend_request',connectionId:'request'});await s.drain();assert.equal(s.state.fcm.length,0);assert.equal(s.state.retries.length,0);
});
test('test notifications are restricted to the authenticated user',async()=>{
 const s=setup();s.state.docs['users/sender']=doc({fcmToken:'sender-token'});
 const r=await s.send({type:'test_notification',messageId:'test-1',recipientId:'recipient'});assert.equal(r.status,200);assert.equal(s.state.fcm.length,1);assert.equal(s.state.fcm[0].data.recipientId,'sender');
});

test('scheduled discovery paginates alerts and profile checks within each queue job budget',async()=>{
 const s=setup(),now='2026-11-04T10:00:00Z';
 const alert=doc({userId:'recipient',enabled:true,city:'Berlin',language:'German',interest:'Books',seenIds:[]});alert.fields.createdAt={timestampValue:'2026-11-03T10:00:00Z'};
 s.state.docs['discoveryAlerts/recipient']=alert;
 const list=[];
 for(let i=0;i<45;i++){
  const p=doc({active:true,adultConfirmed:true,city:i===44?'Bonn':'Berlin',languages:['German'],interests:['Books']});p.fields.updatedAt={timestampValue:now};p.name='projects/test/databases/(default)/documents/profiles/new-'+i;list.push(p);
 }
 s.state.collections.profiles=list;
 assert.equal(await s.one({kind:'discovery_user',uid:'recipient',pageToken:''}),true);
 await s.drain();assert.equal(s.state.retries.length,0);assert.ok(s.state.maxCalls<=48);assert.equal(s.state.fcm.length,6);
 assert.equal(s.state.docs['discoveryAlerts/recipient'].fields.enabled.booleanValue,true);
 const seen=s.state.docs['discoveryAlerts/recipient'].fields.seenIds.arrayValue.values.map(x=>x.stringValue);assert.equal(seen.length,44);assert.ok(!seen.includes('new-44'));
});
test('re-enabling a saved search does not deliver notifications from its previous generation',async()=>{
 const s=setup(),a=doc({userId:'recipient',enabled:true,city:'Berlin',language:'',interest:'',seenIds:[]});a.fields.createdAt={timestampValue:'2026-11-03T10:00:00Z'};s.state.docs['discoveryAlerts/recipient']=a;
 const p=doc({active:true,adultConfirmed:true,city:'Berlin',languages:['German'],interests:['Books']});p.fields.updatedAt={timestampValue:'2026-11-04T10:00:00Z'};p.name='projects/test/databases/(default)/documents/profiles/new-member';s.state.collections.profiles=[p];
 await s.one({kind:'discovery_user',uid:'recipient',pageToken:''});s.state.docs['discoveryAlerts/recipient'].fields.createdAt={timestampValue:'2026-11-04T11:00:00Z'};
 await s.drain();assert.equal(s.state.retries.length,0);assert.equal(s.state.fcm.length,0);
});
