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
