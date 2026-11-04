import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc,query,limit,where,
  serverTimestamp,Timestamp,arrayRemove,arrayUnion,writeBatch,deleteField,onSnapshot} from 'firebase/firestore';
let env;
const db=uid=>uid?env.authenticatedContext(uid).firestore():env.unauthenticatedContext().firestore();
const ref=(uid,path)=>doc(db(uid),path);
const group=()=>({name:'Coffee group',topic:'Coffee',description:'A friendly group to meet for coffee.',
  ownerId:'alice',ownerName:'Alice',memberIds:['alice','bob'],invitedIds:['carol'],createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
const connection=(status='accepted')=>({participants:['alice','bob'],requestedBy:'alice',recipientId:'bob',status,
  createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
const message=()=>({senderId:'bob',senderName:'Bob',text:'Hello',createdAt:serverTimestamp()});
async function seed(path,value){await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),path),value));}
const close=uid=>updateDoc(ref(uid,'groups/coffee'),{deleting:true,updatedAt:serverTimestamp()});
async function seedGroupMessages(count){
  await seed('groups/coffee',group());
  await env.withSecurityRulesDisabled(async c=>{
    for(let start=0;start<count;start+=200){
      const batch=writeBatch(c.firestore());
      for(let i=start;i<Math.min(count,start+200);i++) batch.set(doc(c.firestore(),`groups/coffee/messages/m${String(i).padStart(4,'0')}`),
        {senderId:'bob',senderName:'Bob',text:'Hello',createdAt:Timestamp.now()});
      await batch.commit();
    }
  });
}
async function deletePage(){
  const client=db('alice');
  const page=await getDocs(query(collection(client,'groups/coffee/messages'),limit(200)));
  if(page.empty)return 0;
  const batch=writeBatch(client);page.docs.forEach(d=>batch.delete(d.ref));await batch.commit();return page.size;
}
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-kindred-arcade',firestore:{host:'127.0.0.1',port:8088,
  rules:await readFile(new URL('../../firestore.rules',import.meta.url),'utf8')}});});
after(async()=>{if(env)await env.cleanup();});
beforeEach(async()=>{await env.clearFirestore();});

test('either friend can remove a connection; outsiders cannot alter it or other metadata',async()=>{
  await seed('connections/alice_bob',connection());
  for(const uid of [null,'carol']) await assertFails(updateDoc(ref(uid,'connections/alice_bob'),{status:'removed',updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref('alice','connections/alice_bob'),{status:'removed',participants:['alice','carol'],updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref('alice','connections/alice_bob'),{status:'removed',updatedAt:Timestamp.fromMillis(1)}));
  await assertSucceeds(updateDoc(ref('alice','connections/alice_bob'),{status:'removed',updatedAt:serverTimestamp()}));
  assert.equal((await getDoc(ref('bob','connections/alice_bob'))).data().status,'removed');
  await seed('connections/alice_bob',connection());
  await assertSucceeds(updateDoc(ref('bob','connections/alice_bob'),{status:'removed',updatedAt:serverTimestamp()}));
});

test('removed friends cannot send messages; a fresh accepted request restores contact without deleting history',async()=>{
  await seed('connections/alice_bob',connection('removed'));
  await seed('connections/alice_bob/messages/old',{senderId:'bob',text:'Old hello',type:'text',audioUrl:'',durationMillis:0,createdAt:Timestamp.now()});
  const text={senderId:'alice',text:'New hello',type:'text',audioUrl:'',durationMillis:0,createdAt:serverTimestamp()};
  await assertFails(setDoc(ref('alice','connections/alice_bob/messages/new'),text));
  await assertSucceeds(deleteDoc(ref('alice','connections/alice_bob')));
  await assertSucceeds(setDoc(ref('alice','connections/alice_bob'),{...connection('pending'),createdAt:serverTimestamp(),updatedAt:serverTimestamp()}));
  await assertFails(setDoc(ref('alice','connections/alice_bob/messages/new'),text));
  await assertSucceeds(updateDoc(ref('bob','connections/alice_bob'),{status:'accepted',updatedAt:serverTimestamp()}));
  await assertSucceeds(setDoc(ref('alice','connections/alice_bob/messages/new'),text));
  assert.equal((await getDoc(ref('bob','connections/alice_bob/messages/old'))).data().text,'Old hello');
});

test('both clients receive the friendship removal in real time',async()=>{
  await seed('connections/alice_bob',connection());
  function observe(uid){let stop;const next=new Promise((resolve,reject)=>{
    stop=onSnapshot(query(collection(db(uid),'connections'),where('participants','array-contains',uid)),snap=>{
      if(snap.docs.some(d=>d.data().status==='removed'))resolve(snap.docs.filter(d=>d.data().status==='accepted').length);
    },reject);
  });return {next,stop:()=>stop()};}
  const a=observe('alice'),b=observe('bob');
  try{
    await updateDoc(ref('alice','connections/alice_bob'),{status:'removed',updatedAt:serverTimestamp()});
    assert.deepEqual(await Promise.all([a.next,b.next]),[0,0]);
  }finally{a.stop();b.stop();}
});

test('only the owner can close a group and closing cannot rewrite members or owner',async()=>{
  await seed('groups/coffee',group());
  for(const uid of [null,'bob','carol'])await assertFails(close(uid));
  await assertFails(updateDoc(ref('alice','groups/coffee'),{deleting:true,ownerId:'bob',updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref('alice','groups/coffee'),{deleting:true,memberIds:['alice'],updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref('alice','groups/coffee'),{deleting:'true',updatedAt:serverTimestamp()}));
  await assertSucceeds(close('alice'));
});

test('closed groups reject new messages, joins, invites and attempts to reopen them',async()=>{
  await seed('groups/coffee',group());await close('alice');
  await assertFails(setDoc(ref('bob','groups/coffee/messages/new'),message()));
  await assertFails(setDoc(ref('alice','groups/coffee/messages/owner'),{...message(),senderId:'alice'}));
  await assertFails(updateDoc(ref('carol','groups/coffee'),{memberIds:arrayUnion('carol'),invitedIds:arrayRemove('carol'),updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref('alice','groups/coffee'),{invitedIds:arrayUnion('dave'),updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref('alice','groups/coffee'),{deleting:false,updatedAt:serverTimestamp()}));
});

test('owner removes 405 messages in bounded batches before deleting the parent',async()=>{
  await seedGroupMessages(405);await close('alice');
  assert.deepEqual([await deletePage(),await deletePage(),await deletePage(),await deletePage()],[200,200,5,0]);
  await assertSucceeds(deleteDoc(ref('alice','groups/coffee')));
  await env.withSecurityRulesDisabled(async c=>{
    assert.equal((await getDocs(collection(c.firestore(),'groups/coffee/messages'))).size,0);
    assert.equal((await getDoc(doc(c.firestore(),'groups/coffee'))).exists(),false);
  });
});

test('interrupted deletion keeps the closed parent and owner can resume safely',async()=>{
  await seedGroupMessages(201);await close('alice');await deletePage();
  assert.equal((await getDoc(ref('alice','groups/coffee'))).data().deleting,true);
  assert.equal((await getDocs(collection(db('alice'),'groups/coffee/messages'))).size,1);
  await assertFails(setDoc(ref('bob','groups/coffee/messages/late'),message()));
  assert.equal(await deletePage(),1);assert.equal(await deletePage(),0);
  await assertSucceeds(deleteDoc(ref('alice','groups/coffee')));
});

test('a concurrent send is either included before close or rejected; cleanup leaves no orphan messages',async()=>{
  await seed('groups/coffee',group());
  const [closed]=await Promise.allSettled([close('alice'),setDoc(ref('bob','groups/coffee/messages/race'),message())]);
  assert.equal(closed.status,'fulfilled');
  while(await deletePage()){}
  await deleteDoc(ref('alice','groups/coffee'));
  await env.withSecurityRulesDisabled(async c=>assert.equal((await getDocs(collection(c.firestore(),'groups/coffee/messages'))).size,0));
});

test('a member can leave while other members, creator and invitations are preserved',async()=>{
  await seed('groups/coffee',group());
  await assertFails(updateDoc(ref('alice','groups/coffee'),{memberIds:arrayRemove('alice'),updatedAt:serverTimestamp()}));
  await assertFails(updateDoc(ref('carol','groups/coffee'),{memberIds:arrayRemove('bob'),updatedAt:serverTimestamp()}));
  await assertSucceeds(updateDoc(ref('bob','groups/coffee'),{memberIds:arrayRemove('bob'),updatedAt:serverTimestamp()}));
  const data=(await getDoc(ref('alice','groups/coffee'))).data();
  assert.deepEqual(data.memberIds,['alice']);assert.deepEqual(data.invitedIds,['carol']);assert.equal(data.ownerId,'alice');
  await assertFails(deleteDoc(ref('bob','groups/coffee')));
});

test('conversation hiding is private, merges with user settings and can be restored independently',async()=>{
  await seed('users/alice',{fcmToken:'test-token',hiddenConversations:{other:Timestamp.fromMillis(1)}});
  const preference={hiddenConversations:{alice_bob:serverTimestamp()}};
  await assertFails(setDoc(ref('bob','users/alice'),preference,{merge:true}));
  await assertFails(getDoc(ref('bob','users/alice')));
  await assertFails(setDoc(ref(null,'users/alice'),preference,{merge:true}));
  await assertSucceeds(setDoc(ref('alice','users/alice'),preference,{merge:true}));
  const hidden=(await getDoc(ref('alice','users/alice'))).data();
  assert.equal(hidden.fcmToken,'test-token');assert.equal(hidden.hiddenConversations.other.toMillis(),1);
  assert.ok(hidden.hiddenConversations.alice_bob.toMillis()>1);
  await assertSucceeds(updateDoc(ref('alice','users/alice'),{'hiddenConversations.alice_bob':deleteField()}));
  const restored=(await getDoc(ref('alice','users/alice'))).data();
  assert.equal(restored.hiddenConversations.alice_bob,undefined);assert.equal(restored.fcmToken,'test-token');
  assert.equal(restored.hiddenConversations.other.toMillis(),1);
});
