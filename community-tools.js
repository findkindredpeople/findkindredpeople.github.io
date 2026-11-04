import {getApp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {getFirestore,collection,doc,getDoc,addDoc,setDoc,updateDoc,onSnapshot,query,where,limit,serverTimestamp,deleteDoc} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {communityCopy,notificationDefaults,validClock,normalizeSlots,agreedSlots,meetingCalendar} from './community-upgrade.mjs';
import {sendKindredPush} from './push-client.mjs?v=20261104-1';
const context=()=>({auth:getAuth(getApp()),db:getFirestore(getApp())});
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const preferences=new Map();
export const currentNotificationPreferences=()=>preferences.get(context().auth.currentUser?.uid)||notificationDefaults;
export function mountNotificationSettings(host,language='en') {
  const {auth,db}=context(),c=communityCopy(language);let stop=()=>{};
  const authStop=onAuthStateChanged(auth,user=>{
    stop();host.replaceChildren();if(!user)return;
    host.className='community-tools';
    host.innerHTML=`<details><summary>${safe(c.notification)}</summary><form>${['messages','friends','games','community'].map(key=>`<label><input type="checkbox" name="${key}" checked>${safe(c[key])}</label>`).join('')}<label><input type="checkbox" name="quietEnabled">${safe(c.quiet)}</label><label>${safe(c.from)}<input name="quietStart" type="time" required value="22:00"></label><label>${safe(c.until)}<input name="quietEnd" type="time" required value="08:00"></label><p class="tool-note" data-timezone></p><div class="tool-actions"><button type="submit" class="primary">${safe(c.save)}</button><button type="button" data-system>${safe(c.system)}</button><button type="button" data-test>${safe(c.test)}</button></div><p class="tool-status" role="status"></p></form></details>`;
    const form=host.querySelector('form'),status=host.querySelector('[role=status]');
    stop=onSnapshot(doc(db,'users',user.uid),snap=>{
      const p={...notificationDefaults,...snap.data()?.notificationPreferences};preferences.set(user.uid,p);
      for(const key of ['messages','friends','games','community','quietEnabled'])form.elements[key].checked=p[key]!==false&&(key!=='quietEnabled'||p[key]===true);
      for(const key of ['quietStart','quietEnd'])form.elements[key].value=p[key];
      host.querySelector('[data-timezone]').textContent=Intl.DateTimeFormat().resolvedOptions().timeZone;
    },()=>{status.textContent=c.loadError;});
    form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;
      try {const p={timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'};
        for(const key of ['messages','friends','games','community','quietEnabled'])p[key]=form.elements[key].checked;
        for(const key of ['quietStart','quietEnd']){p[key]=form.elements[key].value;if(!validClock(p[key]))throw Error('clock');}
        if(p.quietEnabled&&p.quietStart===p.quietEnd)throw Error('clock');
        await setDoc(doc(db,'users',user.uid),{notificationPreferences:p},{merge:true});preferences.set(user.uid,p);status.textContent=c.saved;
      }catch {status.textContent=c.error;}finally{button.disabled=false;}
    };
    host.querySelector('[data-system]').onclick=async()=>{if(!('Notification'in window))return status.textContent=c.loadError;const permission=await Notification.requestPermission();status.textContent=permission==='granted'?c.saved:c.system;};
    host.querySelector('[data-test]').onclick=async()=>{status.textContent='…';try{const result=await sendKindredPush(user,{type:'test_notification',messageId:crypto.randomUUID()});status.textContent=result.accepted?c.saved:c.loadError;if('Notification'in window&&Notification.permission==='granted')new Notification('Kindred',{body:c.test});}catch{status.textContent=c.error;}};
  });
  return()=>{authStop();stop();};
}
export function mountMeetingPolls(host,connection,language='en') {
  const {auth,db}=context(),user=auth.currentUser,c=communityCopy(language);if(!user)return()=>{};
  let pollUnsub=()=>{},voteUnsubs=[],disposed=false;host.className='community-tools';
  const stopVotes=()=>{voteUnsubs.forEach(fn=>fn());voteUnsubs=[];};
  const fail=error=>{console.error(error?.code||'meeting-poll');const s=host.querySelector('[role=status]');if(s)s.textContent=c.error;};
  host.innerHTML=`<details><summary>🗓 ${safe(c.poll)}</summary><p class="tool-note">${safe(c.emptyPoll)}</p><div data-polls></div><form data-create><label>${safe(c.activity)}<input name="activity" required minlength="2" maxlength="120"></label><label>${safe(c.place)}<input name="place" required minlength="2" maxlength="160"></label><p>${safe(c.slots)}</p>${[0,1,2].map(i=>`<label>${i+1}<input name="slot${i}" type="datetime-local"${i===0?' required':''}></label>`).join('')}<button class="primary">${safe(c.create)}</button></form><p class="tool-status" role="status"></p></details>`;
  const list=host.querySelector('[data-polls]'),form=host.querySelector('[data-create]');
  form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;
    try {const options=normalizeSlots([0,1,2].map(i=>form.elements['slot'+i].value));if(!options.length)throw Error('dates');
      const created=await addDoc(collection(db,'meetingPolls'),{connectionId:connection.id,participants:connection.participants,creatorId:user.uid,activity:form.elements.activity.value.trim(),place:form.elements.place.value.trim(),options,status:'open',selectedSlot:-1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      await setDoc(doc(db,'meetingPolls',created.id,'votes',user.uid),{userId:user.uid,choices:options.map((_,i)=>i),updatedAt:serverTimestamp()});
      void sendKindredPush(user,{type:'meeting_poll',pollId:created.id});form.reset();host.querySelector('[role=status]').textContent=c.saved;
    }catch(error){if(error.message==='dates')host.querySelector('[role=status]').textContent=c.dateError;else fail(error);}finally{button.disabled=false;}
  };
  pollUnsub=onSnapshot(query(collection(db,'meetingPolls'),where('connectionId','==',connection.id),limit(20)),snap=>{
    if(disposed)return;stopVotes();list.replaceChildren();
    const polls=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0));
    form.hidden=polls.some(p=>p.status==='open');
    for(const p of polls.slice(0,6)){
      const card=document.createElement('article');list.append(card);let votes=[];
      const render=()=>{
        const mine=votes.find(v=>v.userId===user.uid)?.choices||[],agreed=agreedSlots(p,votes);
        card.innerHTML=`<h4>${safe(p.activity)}</h4><p>${safe(p.place)}</p><p class="tool-note">${safe(p.status==='confirmed'?c.confirmed:p.status==='cancelled'?c.closed:c.choose)}</p>${p.options.map((slot,i)=>`<label class="poll-option"><input type="checkbox" data-choice="${i}"${mine.includes(i)?' checked':''}${p.status!=='open'?' disabled':''}>${safe(new Intl.DateTimeFormat(language,{dateStyle:'medium',timeStyle:'short'}).format(new Date(slot)))} · ${votes.filter(v=>v.choices.includes(i)).length}/${p.participants.length}${p.status==='open'&&p.creatorId===user.uid&&agreed.includes(i)?` <button type="button" data-confirm="${i}">${safe(c.confirm)}</button>`:''}</label>`).join('')}<div class="tool-actions">${p.status==='open'?`<button type="button" data-vote>${safe(c.vote)}</button>`:''}${p.status==='open'&&p.creatorId===user.uid?`<button type="button" data-cancel>${safe(c.cancel)}</button>`:''}${p.status==='confirmed'?`<button type="button" data-calendar>${safe(c.calendar)}</button>`:''}</div>`;
        card.querySelector('[data-vote]')?.addEventListener('click',async e=>{e.target.disabled=true;try{const choices=[...card.querySelectorAll('[data-choice]:checked')].map(x=>Number(x.dataset.choice));await setDoc(doc(db,'meetingPolls',p.id,'votes',user.uid),{userId:user.uid,choices,updatedAt:serverTimestamp()});void sendKindredPush(user,{type:'meeting_vote',pollId:p.id});}catch(error){fail(error);}finally{e.target.disabled=false;}});
        card.querySelectorAll('[data-confirm]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await updateDoc(doc(db,'meetingPolls',p.id),{status:'confirmed',selectedSlot:Number(button.dataset.confirm),updatedAt:serverTimestamp()});void sendKindredPush(user,{type:'meeting_poll',pollId:p.id});}catch(error){fail(error);button.disabled=false;}});
        card.querySelector('[data-cancel]')?.addEventListener('click',async()=>{try{await updateDoc(doc(db,'meetingPolls',p.id),{status:'cancelled',updatedAt:serverTimestamp()});void sendKindredPush(user,{type:'meeting_poll',pollId:p.id});}catch(error){fail(error);}});
        card.querySelector('[data-calendar]')?.addEventListener('click',()=>downloadCalendar({id:p.id,title:p.activity,when:p.options[p.selectedSlot],place:p.place}));
      };
      render();voteUnsubs.push(onSnapshot(collection(db,'meetingPolls',p.id,'votes'),s=>{votes=s.docs.map(d=>d.data());render();},fail));
    }
  },fail);
  return()=>{disposed=true;pollUnsub();stopVotes();};
}
export function downloadCalendar(meeting) {
  const url=URL.createObjectURL(new Blob([meetingCalendar(meeting)],{type:'text/calendar;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='kindred-meeting.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export async function toggleDiscoveryAlert(criteria,knownIds=[]) {
  const {auth,db}=context(),user=auth.currentUser;if(!user)throw Error('signin');const ref=doc(db,'discoveryAlerts',user.uid),snap=await getDoc(ref);
  if(snap.data()?.enabled){await deleteDoc(ref);return false;}
  await setDoc(ref,{userId:user.uid,enabled:true,city:String(criteria.city||'').slice(0,80),language:String(criteria.language||'').slice(0,80),interest:String(criteria.interest||'').slice(0,80),seenIds:knownIds.slice(0,250),createdAt:serverTimestamp(),updatedAt:serverTimestamp()});return true;
}
export function mountForumReplies(host,post,userGetter,language='en') {
  const {auth,db}=context(),c=communityCopy(language);let stop=()=>{},opened=false;
  host.className='community-tools';host.innerHTML=`<details><summary>${safe(c.replies)}</summary><div data-replies></div><form><label>${safe(c.reply)}<textarea name="reply" rows="2" maxlength="1200" minlength="2" required></textarea></label><label><input name="adult" type="checkbox" required>I confirm that I am at least 18 years old.</label><button>${safe(c.send)}</button><p role="status"></p></form></details>`;
  const details=host.querySelector('details'),list=host.querySelector('[data-replies]'),form=host.querySelector('form'),status=host.querySelector('[role=status]');
  details.ontoggle=()=>{if(!details.open||opened)return;opened=true;stop=onSnapshot(query(collection(db,'forumPosts',post.id,'replies'),where('status','==','visible'),limit(100)),snap=>{
      list.innerHTML='';const rows=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.createdAt?.toMillis?.()||0)-(b.createdAt?.toMillis?.()||0));
      if(!rows.length)list.textContent=c.noReplies;
      for(const r of rows){const row=document.createElement('div');row.className='reply-row';row.innerHTML=`<strong>${safe(r.authorName)}</strong><p>${safe(r.text)}</p><button type="button">Report</button>`;
        row.querySelector('button').onclick=async()=>{const user=userGetter();if(!user)return status.textContent=c.signin;const reason=prompt('Reason');if(!reason||reason.trim().length<5)return;try{await addDoc(collection(db,'forumReports'),{reporterId:user.uid,postId:post.id,replyId:r.id,reason:reason.trim().slice(0,500),status:'open',createdAt:serverTimestamp()});status.textContent=c.saved;}catch{status.textContent=c.error;}};list.append(row);}
    },()=>{status.textContent=c.loadError;});};
  if(location.hash==='#post_'+post.id){details.open=true;setTimeout(()=>host.scrollIntoView({block:'center'}),0);}
  form.onsubmit=async event=>{event.preventDefault();const user=userGetter();if(!user||auth.currentUser?.uid!==user.uid)return status.textContent=c.signin;const button=form.querySelector('button');button.disabled=true;
    try{const text=form.elements.reply.value.trim();if(text.length<2||!form.elements.adult.checked)return;
      const reply=await addDoc(collection(db,'forumPosts',post.id,'replies'),{authorId:user.uid,authorName:(user.displayName||'Kindred member').slice(0,50),text,status:'visible',adultConfirmed:true,createdAt:serverTimestamp()});
      void sendKindredPush(user,{type:'forum_reply',postId:post.id,replyId:reply.id});form.reset();status.textContent=c.saved;
    }catch{status.textContent=c.error;}finally{button.disabled=false;}
  };
  return()=>stop();
}
