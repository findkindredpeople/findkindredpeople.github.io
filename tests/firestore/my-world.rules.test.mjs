import {before,after,beforeEach,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,collection,getDoc,getDocs,setDoc,deleteDoc,serverTimestamp} from 'firebase/firestore';
import {WORLD_THEMES} from '../../world-core.mjs';
let env;
const db=uid=>uid?env.authenticatedContext(uid).firestore():env.unauthenticatedContext().firestore();
const ref=(uid,path)=>doc(db(uid),path);
const code='a'.repeat(24);
const cover=theme=>({portrait:'data:image/webp;base64,AA==',theme,zoom:1,offsetX:0,offsetY:0,updatedAt:serverTimestamp(),headline:'My world',interestLabels:['Coffee','Books']});
async function seed(path,value){await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),path),value));}
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-kindred-world',firestore:{host:'127.0.0.1',port:8088,rules:await readFile(new URL('../../firestore.rules',import.meta.url),'utf8')}});});
after(async()=>{if(env)await env.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await seed('profiles/alice',{active:true});await seed('profiles/bob',{active:true});});
test('all 24 scenes and legacy covers can be saved by the owner',async()=>{
 for(const theme of WORLD_THEMES)await assertSucceeds(setDoc(ref('alice','profileCovers/alice'),cover(theme)));
 const legacy=cover('aquarium');delete legacy.headline;delete legacy.interestLabels;
 await assertSucceeds(setDoc(ref('alice','profileCovers/alice'),legacy));
});
test('cover writes reject impersonation, unexpected fields and oversized captions',async()=>{
 await assertFails(setDoc(ref(null,'profileCovers/alice'),cover('aurora')));
 await assertFails(setDoc(ref('bob','profileCovers/alice'),cover('aurora')));
 for(const patch of [{theme:'unknown'},{headline:'x'.repeat(81)},{interestLabels:['a','b','c','d']},{interestLabels:[1]},{interestLabels:['x'.repeat(25)]},{zoom:3},{secret:'unexpected'}])
  await assertFails(setDoc(ref('alice','profileCovers/alice'),{...cover('aurora'),...patch}));
});
test('blocked members and signed-out visitors cannot read covers or invitations',async()=>{
 await assertSucceeds(setDoc(ref('alice','profileCovers/alice'),cover('aurora')));
 await assertSucceeds(setDoc(ref('alice','worldInvites/'+code),{ownerId:'alice',updatedAt:serverTimestamp()}));
 await assertSucceeds(getDoc(ref('bob','profileCovers/alice')));await assertSucceeds(getDoc(ref('bob','worldInvites/'+code)));
 await assertFails(getDoc(ref(null,'profileCovers/alice')));await assertFails(getDoc(ref(null,'worldInvites/'+code)));
 await seed('blocks/alice_bob',{blockedBy:'alice',blockedUserId:'bob'});
 await assertFails(getDoc(ref('bob','profileCovers/alice')));await assertFails(getDoc(ref('bob','worldInvites/'+code)));
});
test('an invitation cannot be reassigned, enumerated or used to expose an inactive profile',async()=>{
 await assertSucceeds(setDoc(ref('alice','worldInvites/'+code),{ownerId:'alice',updatedAt:serverTimestamp()}));
 await assertFails(setDoc(ref('bob','worldInvites/'+code),{ownerId:'bob',updatedAt:serverTimestamp()}));
 await assertFails(getDocs(collection(db('alice'),'worldInvites')));
 await seed('profiles/alice',{active:false});await assertFails(getDoc(ref('bob','worldInvites/'+code)));
 await assertFails(deleteDoc(ref('bob','worldInvites/'+code)));await assertSucceeds(deleteDoc(ref('alice','worldInvites/'+code)));
 await assertSucceeds(deleteDoc(ref('alice','worldInvites/'+code)));
});
