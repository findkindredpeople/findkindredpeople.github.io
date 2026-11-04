import{before,after,beforeEach,test}from'node:test';
import{readFile}from'node:fs/promises';
import{initializeTestEnvironment,assertSucceeds,assertFails}from'@firebase/rules-unit-testing';
import{doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc,query,where,limit,serverTimestamp,Timestamp}from'firebase/firestore';
let env;const db=uid=>uid?env.authenticatedContext(uid).firestore():env.unauthenticatedContext().firestore();
const ref=(uid,path)=>doc(db(uid),path);
async function seed(path,value){await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),path),value));}
const connection={participants:['alice','bob'],requestedBy:'alice',recipientId:'bob',status:'accepted'};
const poll=()=>({connectionId:'alice_bob',participants:['alice','bob'],creatorId:'alice',activity:'Coffee',place:'Public café',options:['2027-01-02T12:00:00.000Z','2027-01-03T12:00:00.000Z'],status:'open',selectedSlot:-1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-kindred-arcade',firestore:{host:'127.0.0.1',port:8088,rules:await readFile(new URL('../../firestore.rules',import.meta.url),'utf8')}});});
after(async()=>{if(env)await env.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await seed('connections/alice_bob',connection);});
test('only accepted participants create date polls; recipients and creator cannot be forged',async()=>{
 await assertFails(setDoc(ref(null,'meetingPolls/p'),poll()));await assertFails(setDoc(ref('carol','meetingPolls/p'),poll()));
 await assertFails(setDoc(ref('alice','meetingPolls/p'),{...poll(),participants:['alice','carol']}));
 await assertFails(setDoc(ref('alice','meetingPolls/p'),{...poll(),creatorId:'bob'}));
 await assertSucceeds(setDoc(ref('alice','meetingPolls/p'),poll()));
 await assertSucceeds(getDocs(query(collection(db('bob'),'meetingPolls'),where('connectionId','==','alice_bob'),limit(20))));
 await assertFails(getDoc(ref('carol','meetingPolls/p')));
});
test('a member cannot vote for the other person or for a nonexistent slot',async()=>{
 await assertSucceeds(setDoc(ref('alice','meetingPolls/p'),poll()));
 const vote={userId:'alice',choices:[0],updatedAt:serverTimestamp()};
 await assertFails(setDoc(ref('alice','meetingPolls/p/votes/bob'),{...vote,userId:'bob'}));
 await assertFails(setDoc(ref('alice','meetingPolls/p/votes/alice'),{...vote,choices:[2]}));
 await assertFails(setDoc(ref('alice','meetingPolls/p/votes/alice'),{...vote,choices:[0,0]}));
 await assertSucceeds(setDoc(ref('alice','meetingPolls/p/votes/alice'),vote));
});
test('confirmation requires both votes and only the creator can finalize it',async()=>{
 await assertSucceeds(setDoc(ref('alice','meetingPolls/p'),poll()));
 const confirm={status:'confirmed',selectedSlot:0,updatedAt:serverTimestamp()};
 await assertFails(updateDoc(ref('alice','meetingPolls/p'),confirm));
 await assertSucceeds(setDoc(ref('alice','meetingPolls/p/votes/alice'),{userId:'alice',choices:[0],updatedAt:serverTimestamp()}));
 await assertSucceeds(setDoc(ref('bob','meetingPolls/p/votes/bob'),{userId:'bob',choices:[1],updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(ref('alice','meetingPolls/p'),confirm));
 await assertSucceeds(updateDoc(ref('bob','meetingPolls/p/votes/bob'),{choices:[0],updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(ref('bob','meetingPolls/p'),confirm));
 await assertSucceeds(updateDoc(ref('alice','meetingPolls/p'),confirm));
 await assertFails(updateDoc(ref('bob','meetingPolls/p/votes/bob'),{choices:[1],updatedAt:serverTimestamp()}));
});
test('blocking or removing the connection stops new date polls',async()=>{
 await seed('blocks/alice_bob',{blockerId:'alice',blockedId:'bob'});await assertFails(setDoc(ref('alice','meetingPolls/p'),poll()));
 await env.withSecurityRulesDisabled(c=>deleteDoc(doc(c.firestore(),'blocks/alice_bob')));
 await seed('connections/alice_bob',{...connection,status:'removed'});await assertFails(setDoc(ref('alice','meetingPolls/p'),poll()));
});
test('public replies must have a real author and be attached to a visible post',async()=>{
 await seed('forumPosts/post',{authorId:'alice',status:'visible'});
 const reply={authorId:'bob',authorName:'Bob',text:'Thanks for sharing!',status:'visible',adultConfirmed:true,createdAt:serverTimestamp()};
 await assertFails(setDoc(ref(null,'forumPosts/post/replies/r'),reply));
 await assertFails(setDoc(ref('alice','forumPosts/post/replies/r'),reply));
 await assertSucceeds(setDoc(ref('bob','forumPosts/post/replies/r'),reply));
 await assertSucceeds(getDocs(query(collection(db(null),'forumPosts/post/replies'),where('status','==','visible'),limit(100))));
 await assertFails(updateDoc(ref('bob','forumPosts/post/replies/r'),{status:'hidden'}));
 await seed('forumPosts/post',{authorId:'alice',status:'hidden'});await assertFails(getDoc(ref(null,'forumPosts/post/replies/r')));
});
test('discovery alerts are private, opt-in and have bounded input',async()=>{
 const a={userId:'alice',enabled:true,city:'Berlin',language:'German',interest:'Books',seenIds:[],createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
 await assertFails(setDoc(ref('bob','discoveryAlerts/alice'),a));await assertSucceeds(setDoc(ref('alice','discoveryAlerts/alice'),a));
 await assertFails(getDoc(ref('bob','discoveryAlerts/alice')));await assertFails(updateDoc(ref('alice','discoveryAlerts/alice'),{seenIds:Array(251).fill('x'),updatedAt:serverTimestamp()}));
 await assertSucceeds(deleteDoc(ref('alice','discoveryAlerts/alice')));
});
