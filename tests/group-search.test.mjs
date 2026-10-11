import test from 'node:test';
import assert from 'node:assert/strict';
import {groupInterests,localGroupSearch} from '../group-search.mjs';

test('different interests produce relevant German search phrases and both draft languages', () => {
  const phrases = new Set();
  for (const interest of groupInterests) {
    const en = localGroupSearch({place:'Bad Ems',interest});
    const de = localGroupSearch({place:'Bad Ems',interest,language:'de'});
    assert.equal(en.needsPlace,false);
    assert.ok(en.queries.every(q=>q.startsWith('Bad Ems ')));
    assert.deepEqual(de.queries,en.queries);
    assert.match(en.message,/next date/);
    assert.match(de.message,/nächste Termin/);
    phrases.add(en.queries.join('|'));
  }
  assert.equal(phrases.size,groupInterests.length);
  assert.match(localGroupSearch({interest:'books'}).queries[0],/Lesekreis/);
  assert.match(localGroupSearch({interest:'volunteering'}).queries[0],/Freiwilligenagentur/);
});

test('missing, long and multiline locations cannot imply a verified event or complete draft', () => {
  const blank = localGroupSearch({place:' \n '});
  assert.equal(blank.needsPlace,true);
  assert.match(blank.message,/\[town or neighbourhood\]/);
  assert.match(blank.queries[0],/\[Ort oder Stadtteil\]/);
  assert.equal(localGroupSearch({place:' Köln\n Ehrenfeld\t '}).place,'Köln Ehrenfeld');
  assert.equal(localGroupSearch({place:'x'.repeat(200)}).place.length,80);
  assert.deepEqual(localGroupSearch({interest:'unrecognised'}).queries,localGroupSearch().queries);
});

test('activity-specific questions expose preparation, terrain and volunteering commitments', () => {
  assert.match(localGroupSearch({interest:'books'}).message,/read a particular book beforehand/);
  assert.match(localGroupSearch({interest:'crafts'}).message,/materials included in the full price/);
  assert.match(localGroupSearch({interest:'walking'}).message,/route length, pace and terrain/);
  assert.match(localGroupSearch({interest:'volunteering',language:'de'}).message,/Einarbeitung und Mindestverpflichtung/);
  assert.match(localGroupSearch({interest:'language',language:'de'}).message,/gegenseitiges Tandem/);
});

test('directories route volunteers to agencies and keep arbitrary interest keys safe', () => {
  const volunteers = localGroupSearch({interest:'volunteering'});
  assert.equal(volunteers.directories[0].url,'https://bagfa.de/agenturatlas/');
  for (const interest of [...groupInterests,'__proto__','constructor','toString']) {
    const search = localGroupSearch({interest});
    assert.equal(search.directories.length,2);
    assert.ok(search.directories.every(d=>d.url.startsWith('https://') && d.next));
    assert.ok(search.activityQuestion.length>30);
  }
  assert.deepEqual(localGroupSearch({interest:'__proto__'}),localGroupSearch());
});
