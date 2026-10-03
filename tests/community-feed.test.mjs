import test from 'node:test';
import assert from 'node:assert/strict';
import {filterDiscussions, filterMeetups, localDateKey} from '../community-feed.mjs';

test('public discussions omit the known demonstration without hiding ordinary questions', () => {
  const posts = [
    {id:'demo', text:'Hello Kindred! This is a test post.', city:'Berlin', country:'Germany', category:'New in Town'},
    {id:'question', text:'How can I test whether a group fits my schedule?', city:'Berlin', country:'Germany', category:'New in Town'},
    {id:'other', text:'Anyone interested in walking?', city:'Cologne', country:'Germany', category:'Activities'}
  ];
  assert.deepEqual(filterDiscussions(posts).map(p=>p.id), ['question','other']);
  assert.deepEqual(filterDiscussions(posts,{place:' germany ',category:'Activities'}).map(p=>p.id), ['other']);
  assert.deepEqual(filterDiscussions(posts,{place:'BERLIN'}).map(p=>p.id), ['question']);
  assert.equal(posts.length,3);
});

test('meetup filters keep today, omit old and undated entries, and sort by date and time', () => {
  const entries = [
    {id:'later',date:'2026-10-03',time:'18:00',city:'Berlin',country:'Germany',type:'Walk'},
    {id:'old',date:'2026-10-02',time:'18:00',city:'Berlin',country:'Germany',type:'Walk'},
    {id:'early',date:'2026-10-03',time:'10:00',city:'Berlin',country:'Germany',type:'Coffee'},
    {id:'undated',city:'Berlin',country:'Germany',type:'Walk'}
  ];
  assert.deepEqual(filterMeetups(entries,{},'2026-10-03').map(p=>p.id), ['early','later']);
  assert.deepEqual(filterMeetups(entries,{place:' germany ',type:'Walk'},'2026-10-03').map(p=>p.id), ['later']);
  assert.equal(entries.length,4);
});

test('a local calendar day changes at local midnight rather than UTC midnight', () => {
  const old = process.env.TZ;
  process.env.TZ = 'Europe/Berlin';
  try { assert.equal(localDateKey(new Date('2026-10-03T22:30:00Z')), '2026-10-04'); }
  finally { if(old === undefined) delete process.env.TZ; else process.env.TZ=old; }
});
