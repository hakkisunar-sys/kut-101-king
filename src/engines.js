// Puan motorları: saf fonksiyonlar. Girdi alır, { ok, errors, scores, breakdown } döner.
// Hiçbiri durum değiştirmez, tarayıcıya veya depoya dokunmaz.

import {
  KUT_HANDS, OKEY101_FINISHES, KING_CONTRACTS, KING_CEZA_IDS, KING_LIMITS,
} from './rules.js';

export const N = 4;

/** '' / null / undefined → null; geçerli işaretli tam sayı → sayı; diğerleri → NaN */
export function parseIntStrict(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isInteger(v) ? v : NaN;
  const s = String(v).trim().replace(/^\+/, '').replace('−', '-');
  if (s === '') return null;
  if (!/^-?\d+$/.test(s)) return NaN;
  return Number(s);
}

const sign = (n) => (n > 0 ? `+${n}` : `${n}`);
export const fmt = sign;

function result(errors, scores, breakdown) {
  return errors.length ? { ok: false, errors, scores: null, breakdown: null } : { ok: true, errors: [], scores, breakdown };
}

// ============================================================ ORTAK
export function totals(hands, n = N) {
  const sum = Array(n).fill(0);
  for (const h of hands) h.scores.forEach((s, i) => { sum[i] += s; });
  return sum;
}

/** Eşit puana ortak sıra verir. lowWins=true ise düşük toplam önde. */
export function ranking(tot, lowWins) {
  const order = tot.map((score, i) => ({ i, score }))
    .sort((a, b) => (lowWins ? a.score - b.score : b.score - a.score) || a.i - b.i);
  let rank = 0; let prev;
  return order.map((o, k) => {
    if (k === 0 || o.score !== prev) rank = k + 1;
    prev = o.score;
    return { player: o.i, score: o.score, rank };
  });
}

// ============================================================ SERBEST GİRİŞ (Küt elle mod, 10. ve 13. el)
export function scoreManual(input, names = []) {
  const errors = [];
  const scores = (input.scores || []).slice(0, N);
  const parsed = [];
  for (let i = 0; i < N; i++) {
    const v = parseIntStrict(scores[i]);
    if (v === null) errors.push(`${names[i] || `Oyuncu ${i + 1}`}: puan boş. 0 ise 0 yaz.`);
    else if (Number.isNaN(v)) errors.push(`${names[i] || `Oyuncu ${i + 1}`}: tam sayı gir.`);
    parsed.push(v);
  }
  if (input.winner === undefined || input.winner === '' || input.winner === null) {
    errors.push('Bitireni veya “Kimse bitirmedi”yi seç.');
  }
  return result(errors, parsed, parsed.map(() => 'Elle girildi'));
}

// ============================================================ KÜT OKEY
export function kutHand(no) { return KUT_HANDS[no - 1]; }

export function kutIsManualHand(no, table) {
  return !table || table.mode !== 'auto' || (table.manualHands || []).includes(no);
}

/**
 * Masa ayarıyla otomatik Küt hesabı.
 * input: { finish: 'normal'|'okey'|'deste', winner: index|null,
 *          players: [{ state: 'acmadi'|'acti', T: sayı, extra: sayı }] }
 */
export function scoreKutAuto(input, table, names = []) {
  const errors = [];
  const nm = (i) => names[i] || `Oyuncu ${i + 1}`;
  const finish = input.finish;
  if (!['normal', 'okey', 'deste'].includes(finish)) errors.push('Bitiş türünü seç.');
  const deste = finish === 'deste';
  const winner = deste ? null : input.winner;
  if (!deste && !(Number.isInteger(winner) && winner >= 0 && winner < N)) errors.push('Bitireni seç.');
  const mult = finish === 'okey' ? table.okeyMultiplier : 1;

  const scores = []; const breakdown = [];
  for (let i = 0; i < N; i++) {
    const p = (input.players && input.players[i]) || {};
    const extra = parseIntStrict(p.extra);
    if (Number.isNaN(extra)) errors.push(`${nm(i)}: ek puan tam sayı olmalı.`);
    const ex = extra || 0;
    const exTxt = ex ? ` ${ex > 0 ? '+' : '−'} ${Math.abs(ex)} ek` : '';
    if (i === winner) {
      scores.push(table.finisherScore + ex);
      breakdown.push(`Bitirdi: ${table.finisherScore}${exTxt}`);
      continue;
    }
    if (p.state === 'acmadi') {
      const base = table.notOpenedPenalty * mult;
      scores.push(base + ex);
      breakdown.push(mult > 1
        ? `Açamadı: ${table.notOpenedPenalty} × ${mult} = ${base}${exTxt}`
        : `Açamadı: ${table.notOpenedPenalty}${exTxt}`);
    } else if (p.state === 'acti') {
      const T = parseIntStrict(p.T);
      if (T === null) { errors.push(`${nm(i)}: elde kalan taş toplamını yaz.`); scores.push(0); breakdown.push(''); continue; }
      if (Number.isNaN(T) || T < 0) { errors.push(`${nm(i)}: taş toplamı 0 veya pozitif tam sayı olmalı.`); scores.push(0); breakdown.push(''); continue; }
      const base = T * mult;
      scores.push(base + ex);
      breakdown.push(mult > 1 ? `Açtı, kalan ${T} × ${mult} = ${base}${exTxt}` : `Açtı, kalan taş ${T}${exTxt}`);
    } else {
      errors.push(`${nm(i)}: açtı mı, açamadı mı seç.`);
      scores.push(0); breakdown.push('');
    }
  }
  return result(errors, scores, breakdown);
}

// ============================================================ 101 OKEY
export function okey101Finish(id) { return OKEY101_FINISHES.find((f) => f.id === id); }

/**
 * input: { finish, winner, players: [{ state: 'acmadi'|'seri'|'cift', T, okeys, events }] }
 * profile: { penalized: boolean }
 */
export function score101(input, profile, names = []) {
  const errors = [];
  const nm = (i) => names[i] || `Oyuncu ${i + 1}`;
  const f = okey101Finish(input.finish);
  if (!f) return result(['Bitiş türünü seç.'], null, null);
  const deste = f.id === 'deste';
  const winner = deste ? null : input.winner;
  if (!deste && !(Number.isInteger(winner) && winner >= 0 && winner < N)) errors.push('Bitireni seç.');
  const pen = !!profile.penalized;

  const scores = []; const breakdown = [];
  for (let i = 0; i < N; i++) {
    const p = (input.players && input.players[i]) || {};
    let ev = 0;
    if (pen) {
      const e = parseIntStrict(p.events);
      if (Number.isNaN(e) || (e !== null && e < 0)) errors.push(`${nm(i)}: ceza olayı sayısı 0 veya pozitif olmalı.`);
      else ev = e || 0;
    }
    const evTxt = ev ? ` + ${ev} olay × 101` : '';
    const evPts = ev * 101;

    if (i === winner) {
      scores.push(f.winner + evPts);
      breakdown.push(`${f.label}, bitirdi: ${f.winner}${evTxt}`);
      continue;
    }
    if (f.fixed) {
      scores.push(f.fixed + evPts);
      breakdown.push(`${f.label}: sabit ${f.fixed}${evTxt}`);
      continue;
    }
    if (p.state === 'acmadi') {
      scores.push(f.notOpened + evPts);
      breakdown.push(`Açmadı: sabit ${f.notOpened}${evTxt}`);
      continue;
    }
    if (p.state !== 'seri' && p.state !== 'cift') {
      errors.push(`${nm(i)}: açmadı, seri açtı veya çift açtı seç.`);
      scores.push(0); breakdown.push(''); continue;
    }
    const T = parseIntStrict(p.T);
    if (T === null || Number.isNaN(T) || T < 0) {
      errors.push(`${nm(i)}: T (eldeki taş toplamı) 0 veya pozitif tam sayı olmalı.`);
      scores.push(0); breakdown.push(''); continue;
    }
    let ok = 0;
    if (pen) {
      const o = parseIntStrict(p.okeys);
      if (Number.isNaN(o) || (o !== null && (o < 0 || o > 2))) errors.push(`${nm(i)}: elde kalan gerçek okey 0, 1 veya 2 olabilir.`);
      else ok = o || 0;
    }
    const factor = (p.state === 'cift' ? 2 : 1) * f.mult;
    const base = T * factor;
    const okPts = ok * 101;
    scores.push(base + okPts + evPts);
    const kind = p.state === 'cift' ? 'Çift açtı' : 'Seri açtı';
    breakdown.push(`${kind}: ${factor > 1 ? `${factor} × ${T} = ${base}` : `T = ${T}`}${ok ? ` + ${ok} okey × 101` : ''}${evTxt}`);
  }
  return result(errors, scores, breakdown);
}

// ============================================================ KING
export function kingChooser(firstChooser, index) { return (firstChooser + index) % N; }

/** history: [{ contract, suit }] (sıra = kontrat sırası). Kalan hakları döner. */
export function kingRights(history, firstChooser) {
  const ceza = Array(N).fill(0); const koz = Array(N).fill(0);
  const typeUsed = Object.fromEntries(KING_CEZA_IDS.map((id) => [id, 0]));
  let kozTotal = 0;
  history.forEach((h, idx) => {
    const p = kingChooser(firstChooser, idx);
    if (h.contract === 'koz') { koz[p]++; kozTotal++; } else { ceza[p]++; typeUsed[h.contract]++; }
  });
  return { ceza, koz, typeUsed, kozTotal };
}

/** Bu oyuncu bu kontratı seçebilir mi? Hata metni ya da null. */
export function kingChoiceError(history, firstChooser, contract, suit) {
  const c = KING_CONTRACTS[contract];
  if (!c) return 'Kontrat seç.';
  if (history.length >= KING_LIMITS.contracts) return 'Maçtaki 20 kontrat tamamlandı.';
  const p = kingChooser(firstChooser, history.length);
  const r = kingRights(history, firstChooser);
  if (contract === 'koz') {
    if (r.koz[p] >= KING_LIMITS.kozPerPlayer) return 'Bu oyuncu 2 koz hakkını kullandı.';
    if (!suit) return 'Koz rengini seç.';
  } else {
    if (r.ceza[p] >= KING_LIMITS.cezaPerPlayer) return 'Bu oyuncu 3 ceza hakkını kullandı.';
    if (r.typeUsed[contract] >= KING_LIMITS.perCezaType) return `${c.name} maçta 2 kez oynandı.`;
  }
  return null;
}

/** Seçici için seçilebilir kontrat listesi { id, allowed, reason } */
export function kingOptions(history, firstChooser) {
  return Object.keys(KING_CONTRACTS).map((id) => {
    const reason = kingChoiceError(history, firstChooser, id, 'x');
    return { id, allowed: !reason, reason };
  });
}

/** Bütün kontrat dizisi geçerli mi? (geçmiş düzeltmede kullanılır) */
export function kingSequenceError(list, firstChooser) {
  for (let i = 0; i < list.length; i++) {
    const err = kingChoiceError(list.slice(0, i), firstChooser, list[i].contract, list[i].suit);
    if (err) return { index: i, error: `Kontrat ${i + 1}: ${err}` };
  }
  return null;
}

/**
 * input: count → { counts: [4] }, one → { player }, two → { p12, p13 }
 */
export function scoreKing(contract, input, names = []) {
  const c = KING_CONTRACTS[contract];
  if (!c) return result(['Kontrat seç.'], null, null);
  const nm = (i) => names[i] || `Oyuncu ${i + 1}`;
  const errors = [];
  let counts = Array(N).fill(0);

  if (c.input === 'count') {
    for (let i = 0; i < N; i++) {
      const v = parseIntStrict(input.counts ? input.counts[i] : null);
      if (v === null) errors.push(`${nm(i)}: sayı boş. Almadıysa 0 yaz.`);
      else if (Number.isNaN(v) || v < 0) errors.push(`${nm(i)}: 0 veya pozitif tam sayı gir.`);
      else counts[i] = v;
    }
    if (!errors.length) {
      const sum = counts.reduce((a, b) => a + b, 0);
      if (sum !== c.total) errors.push(`Toplam ${c.total} olmalı, şu an ${sum}.`);
    }
  } else if (c.input === 'one') {
    if (!(Number.isInteger(input.player) && input.player >= 0 && input.player < N)) errors.push('Kupa papazını alanı seç.');
    else counts[input.player] = 1;
  } else {
    if (!(Number.isInteger(input.p12) && input.p12 >= 0 && input.p12 < N)) errors.push('12. eli alanı seç.');
    if (!(Number.isInteger(input.p13) && input.p13 >= 0 && input.p13 < N)) errors.push('13. eli alanı seç.');
    if (!errors.length) { counts[input.p12]++; counts[input.p13]++; }
  }
  if (errors.length) return result(errors, null, null);
  const scores = counts.map((n) => (n ? n * c.unit : 0));
  const breakdown = counts.map((n) => `${n} × ${c.unit} = ${n ? n * c.unit : 0}`);
  return result([], scores, breakdown);
}
