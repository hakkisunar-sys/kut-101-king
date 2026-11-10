import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseIntStrict, scoreManual, scoreKutAuto, score101, scoreKing, kingChoiceError,
  kingSequenceError, kingRights, totals, ranking, kutIsManualHand,
} from '../src/engines.js';
import { KUT_HANDS, KUT_DEFAULT_TABLE } from '../src/rules.js';

const table = { mode: 'auto', ...KUT_DEFAULT_TABLE };

test('tam sayı ayrıştırma: boş ≠ 0', () => {
  assert.equal(parseIntStrict(''), null);
  assert.equal(parseIntStrict('0'), 0);
  assert.equal(parseIntStrict('-12'), -12);
  assert.equal(parseIntStrict('+7'), 7);
  assert.ok(Number.isNaN(parseIntStrict('3.5')));
});

test('Küt: 13 el doğru sırada, 10 cezasız, 13 düz okey', () => {
  assert.equal(KUT_HANDS.length, 13);
  assert.deepEqual(KUT_HANDS.map((h) => h.no), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  assert.equal(KUT_HANDS[9].tag, 'cezasız');
  assert.equal(KUT_HANDS[9].req, '4 çift');
  assert.equal(KUT_HANDS[12].req, 'Düz okey');
  assert.equal(KUT_HANDS[12].straight, true);
  assert.equal(KUT_HANDS[7].req, '1 dörtlü küt + 1 dörtlü seri');
});

test('Küt: elle mod boş alanı reddeder, 0 kabul eder', () => {
  const bad = scoreManual({ scores: ['0', '', '5', '-3'], winner: 0 });
  assert.equal(bad.ok, false);
  const ok = scoreManual({ scores: ['0', '0', '5', '-3'], winner: 'none' });
  assert.deepEqual(ok.scores, [0, 0, 5, -3]);
});

test('Küt: otomatik hesap onaysız profilde kapalı, 10 ve 13 her zaman elle', () => {
  assert.equal(kutIsManualHand(3, { mode: 'manual' }), true);
  assert.equal(kutIsManualHand(3, table), false);
  assert.equal(kutIsManualHand(10, table), true);
  assert.equal(kutIsManualHand(13, table), true);
});

test('Küt otomatik: normal bitiş', () => {
  const r = scoreKutAuto({
    finish: 'normal', winner: 0,
    players: [{}, { state: 'acmadi' }, { state: 'acti', T: '23' }, { state: 'acti', T: '0' }],
  }, table);
  assert.deepEqual(r.scores, [0, 100, 23, 0]);
});

test('Küt otomatik: okeyle bitiş ×2 (açamayan 200)', () => {
  const r = scoreKutAuto({
    finish: 'okey', winner: 2,
    players: [{ state: 'acti', T: '12' }, { state: 'acmadi' }, {}, { state: 'acti', T: '30', extra: '10' }],
  }, table);
  assert.deepEqual(r.scores, [24, 200, 0, 70]);
});

test('Küt otomatik: deste bitti, kazanan yok, çarpan yok', () => {
  const r = scoreKutAuto({
    finish: 'deste', winner: 1,
    players: [{ state: 'acmadi' }, { state: 'acti', T: '15' }, { state: 'acmadi' }, { state: 'acti', T: '4' }],
  }, table);
  assert.deepEqual(r.scores, [100, 15, 100, 4]);
});

test('Küt otomatik: açan oyuncuda taş toplamı zorunlu', () => {
  const r = scoreKutAuto({ finish: 'normal', winner: 0, players: [{}, { state: 'acti', T: '' }, { state: 'acmadi' }, { state: 'acmadi' }] }, table);
  assert.equal(r.ok, false);
});

// ------------------------------------------------------------ 101
const P = { penalized: true };
const F = { penalized: false };

test('101: brif örneği normal bitiş −101, +17, +16, +202', () => {
  const r = score101({
    finish: 'normal', winner: 0,
    players: [{}, { state: 'seri', T: 17 }, { state: 'cift', T: 8 }, { state: 'acmadi' }],
  }, F);
  assert.deepEqual(r.scores, [-101, 17, 16, 202]);
});

test('101: çift + okey, T=10 çift açan, cezalı masada 1 gerçek okey → 181', () => {
  const r = score101({
    finish: 'cift_okey', winner: 0,
    players: [{}, { state: 'cift', T: 10, okeys: 1 }, { state: 'seri', T: 10 }, { state: 'acmadi' }],
  }, P);
  assert.deepEqual(r.scores, [-404, 181, 40, 808]);
});

test('101: cezasız masada okey eki uygulanmaz', () => {
  const r = score101({ finish: 'cift_okey', winner: 0, players: [{}, { state: 'cift', T: 10, okeys: 1 }, { state: 'acmadi' }, { state: 'acmadi' }] }, F);
  assert.equal(r.scores[1], 80);
});

test('101: tüm sonuç türleri', () => {
  const pl = [{}, { state: 'acmadi' }, { state: 'seri', T: 20 }, { state: 'cift', T: 20 }];
  const exp = {
    normal: [-101, 202, 20, 40],
    okey: [-202, 404, 40, 80],
    cift: [-202, 404, 40, 80],
    cift_okey: [-404, 808, 80, 160],
    elden: [-202, 404, 404, 404],
    elden_okey: [-404, 808, 808, 808],
  };
  for (const [finish, s] of Object.entries(exp)) {
    assert.deepEqual(score101({ finish, winner: 0, players: pl }, F).scores, s, finish);
  }
});

test('101: deste bitti → bitiren kaydı yok', () => {
  const r = score101({
    finish: 'deste', winner: 0,
    players: [{ state: 'acmadi' }, { state: 'seri', T: 30 }, { state: 'cift', T: 5 }, { state: 'seri', T: 0 }],
  }, F);
  assert.deepEqual(r.scores, [202, 30, 10, 0]);
  assert.ok(r.breakdown.every((b) => !b.includes('bitirdi')));
});

test('101: cezalı olay +101 çarpılmadan, bitirene de eklenir; sabit hücre sabit', () => {
  const r = score101({
    finish: 'okey', winner: 0,
    players: [{ events: 1 }, { state: 'acmadi', okeys: 2, events: 0 }, { state: 'seri', T: 10, events: 2 }, { state: 'cift', T: 5 }],
  }, P);
  assert.deepEqual(r.scores, [-202 + 101, 404, 20 + 202, 20]);
});

// ------------------------------------------------------------ KING
test('King: birim toplamı hatalı kontrat reddedilir', () => {
  assert.equal(scoreKing('koz', { counts: [6, 4, 2, 0] }).ok, false);
  assert.equal(scoreKing('koz', { counts: [6, 4, '', 1] }).ok, false);
  assert.deepEqual(scoreKing('koz', { counts: [6, 4, 2, 1] }).scores, [300, 200, 100, 50]);
});

test('King: Rıfkı ve Son İki', () => {
  assert.deepEqual(scoreKing('rifki', { player: 2 }).scores, [0, 0, -320, 0]);
  assert.deepEqual(scoreKing('soniki', { p12: 1, p13: 1 }).scores, [0, -360, 0, 0]);
  assert.deepEqual(scoreKing('soniki', { p12: 1, p13: 3 }).scores, [0, -180, 0, -180]);
});

test('King: üçüncü Kupa Almaz ve üçüncü koz engellenir', () => {
  // ilk seçici 0. Sıra: 0,1,2,3,0,1,...
  const h = [{ contract: 'kupa' }, { contract: 'kupa' }];
  assert.match(kingChoiceError(h, 0, 'kupa'), /2 kez/);
  const k = [{ contract: 'koz', suit: 'maca' }, { contract: 'el' }, { contract: 'el' }, { contract: 'kiz' }, { contract: 'koz', suit: 'kupa' }, { contract: 'kiz' }, { contract: 'erkek' }, { contract: 'erkek' }];
  assert.equal(kingSequenceError(k, 0), null);
  assert.match(kingChoiceError(k, 0, 'koz', 'karo'), /2 koz/);
});

function fullKingMatch() {
  // Her oyuncu 3 ceza + 2 koz; her ceza türü 2 kez.
  const cezas = ['el', 'kupa', 'erkek', 'kiz', 'rifki', 'soniki', 'el', 'kupa', 'erkek', 'kiz', 'rifki', 'soniki'];
  const list = [];
  let ci = 0;
  for (let round = 0; round < 5; round++) {
    for (let p = 0; p < 4; p++) {
      list.push(round < 3 ? { contract: cezas[ci++] } : { contract: 'koz', suit: 'maca' });
    }
  }
  return list;
}

test('King: geçerli 20 kontrat sonunda toplam 0', () => {
  const list = fullKingMatch();
  assert.equal(kingSequenceError(list, 1), null);
  const inputs = {
    el: { counts: [4, 3, 3, 3] }, kupa: { counts: [13, 0, 0, 0] }, erkek: { counts: [2, 2, 2, 2] },
    kiz: { counts: [0, 1, 1, 2] }, rifki: { player: 3 }, soniki: { p12: 0, p13: 0 }, koz: { counts: [6, 4, 2, 1] },
  };
  const hands = list.map((c) => scoreKing(c.contract, inputs[c.contract]));
  assert.ok(hands.every((h) => h.ok));
  const tot = totals(hands);
  assert.equal(tot.reduce((a, b) => a + b, 0), 0);
  const r = kingRights(list, 1);
  assert.deepEqual(r.ceza, [3, 3, 3, 3]);
  assert.deepEqual(r.koz, [2, 2, 2, 2]);
  assert.match(kingChoiceError(list, 1, 'koz', 'maca'), /20 kontrat/);
});

test('Sıralama: eşit puanda ortak sıra, yön seçimi', () => {
  const low = ranking([10, -5, 10, 30], true);
  assert.deepEqual(low.map((r) => [r.player, r.rank]), [[1, 1], [0, 2], [2, 2], [3, 4]]);
  const high = ranking([100, 200, 200, -500], false);
  assert.deepEqual(high.map((r) => r.rank), [1, 1, 3, 4]);
});

test('Negatif, sıfır, pozitif toplamlar doğru taşınır', () => {
  const t = totals([{ scores: [-101, 0, 17, 202] }, { scores: [5, -202, 0, 0] }]);
  assert.deepEqual(t, [-96, -202, 17, 202]);
});
