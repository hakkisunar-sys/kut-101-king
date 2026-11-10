import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, appendHand, replaceHand, undoLast, matchTotals, isDone } from '../src/model.js';
import { KUT_DEFAULT_TABLE } from '../src/rules.js';

const P = ['Ali', 'Ayşe', 'Can', 'Deniz'];

test('aynı taslak iki kez kaydedilemez', () => {
  let m = createMatch('okey101', P, { handCount: 3, penalized: false, lowWins: true });
  const inp = { finish: 'normal', winner: 0, players: [{}, { state: 'acmadi' }, { state: 'seri', T: 5 }, { state: 'cift', T: 5 }] };
  const a = appendHand(m, 'd1', inp); m = a.match;
  const b = appendHand(m, 'd1', inp);
  assert.match(b.error, /zaten/);
  assert.equal(m.hands.length, 1);
});

test('tamamlanan maç yeni el açmaz, geri alma yeniden açar', () => {
  let m = createMatch('okey101', P, { handCount: 1, penalized: false, lowWins: true });
  m = appendHand(m, 'a', { finish: 'elden', winner: 2, players: [] }).match;
  assert.equal(m.status, 'done');
  assert.ok(isDone(m));
  assert.match(appendHand(m, 'b', { finish: 'elden', winner: 1, players: [] }).error, /tamamlandı/);
  m = undoLast(m).match;
  assert.equal(m.status, 'active');
  assert.equal(m.hands.length, 0);
});

test('geçmiş düzeltme toplamları değiştirir', () => {
  let m = createMatch('kut', P, { lowWins: true, table: { mode: 'auto', ...KUT_DEFAULT_TABLE } });
  m = appendHand(m, 'a', { finish: 'normal', winner: 0, players: [{}, { state: 'acmadi' }, { state: 'acti', T: '10' }, { state: 'acti', T: '3' }] }).match;
  assert.deepEqual(matchTotals(m), [0, 100, 10, 3]);
  m = replaceHand(m, 0, { finish: 'okey', winner: 0, players: [{}, { state: 'acmadi' }, { state: 'acti', T: '10' }, { state: 'acti', T: '3' }] }).match;
  assert.deepEqual(matchTotals(m), [0, 200, 20, 6]);
});

test('Küt 10. el otomatik modda da elle girilir', () => {
  let m = createMatch('kut', P, { lowWins: true, table: { mode: 'auto', ...KUT_DEFAULT_TABLE } });
  for (let i = 0; i < 9; i++) m = appendHand(m, `h${i}`, { finish: 'deste', players: P.map(() => ({ state: 'acmadi' })) }).match;
  const bad = appendHand(m, 'h9', { finish: 'deste', players: P.map(() => ({ state: 'acmadi' })) });
  assert.ok(bad.error);
  const ok = appendHand(m, 'h9', { scores: ['0', '0', '-5', '12'], winner: 'none' });
  assert.deepEqual(ok.match.hands[9].scores, [0, 0, -5, 12]);
});

test('King: sonraki seçimleri bozan geçmiş düzeltme reddedilir', () => {
  let m = createMatch('king', P, { firstChooser: 0 });
  const add = (id, contract, extra) => { m = appendHand(m, id, { contract, suit: contract === 'koz' ? 'maca' : null, ...extra }).match; };
  add('1', 'kupa', { counts: [13, 0, 0, 0] });
  add('2', 'el', { counts: [4, 3, 3, 3] });
  add('3', 'kupa', { counts: [0, 13, 0, 0] });
  const r = replaceHand(m, 1, { contract: 'kupa', counts: [0, 0, 13, 0] });
  assert.match(r.error, /kayıt değiştirilmedi/);
  assert.equal(m.hands[1].input.contract, 'el');
  const ok = replaceHand(m, 1, { contract: 'kiz', counts: [1, 1, 1, 1] });
  assert.equal(ok.match.hands[1].scores[0], -100);
});
