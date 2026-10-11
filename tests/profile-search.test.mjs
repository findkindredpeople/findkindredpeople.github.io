import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesProfileCity} from '../profile-search.mjs';

test('an explicit city restricts Global and New City searches', () => {
  for (const mode of ['global','newcity']) {
    assert.equal(matchesProfileCity('Berlin',{mode,city:'Berlin'}),true);
    assert.equal(matchesProfileCity('Frankfurt',{mode,city:'Berlin'}),false);
    assert.equal(matchesProfileCity('',{mode,city:'Berlin'}),false);
  }
});

test('a blank global city keeps other cities eligible even when the member has a home city', () => {
  assert.equal(matchesProfileCity('Frankfurt',{mode:'global',homeCity:'Berlin'}),true);
  assert.equal(matchesProfileCity('Frankfurt',{mode:'newcity',homeCity:'Berlin'}),true);
});

test('Nearby defaults to the home city but an explicit destination takes priority', () => {
  assert.equal(matchesProfileCity('Berlin',{mode:'nearby',homeCity:'Berlin'}),true);
  assert.equal(matchesProfileCity('Frankfurt',{mode:'nearby',homeCity:'Berlin'}),false);
  assert.equal(matchesProfileCity('Frankfurt',{mode:'nearby',homeCity:'Berlin',city:'Frankfurt'}),true);
});

test('city search ignores case and surrounding space while preserving partial town search', () => {
  assert.equal(matchesProfileCity('Köln Ehrenfeld',{city:' KÖLN '}),true);
  assert.equal(matchesProfileCity('Bad Ems',{city:'bad'}),true);
  assert.equal(matchesProfileCity(null,{city:'Köln'}),false);
});
