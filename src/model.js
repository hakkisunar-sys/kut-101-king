// Maç modeli: maç oluşturma, el hesaplama, kaydetme, geri alma, düzeltme.
// Saf fonksiyonlar: maçın kopyasını döner, depoya dokunmaz.

import {
  scoreManual, scoreKutAuto, score101, scoreKing, kutIsManualHand, kingSequenceError,
  kingChoiceError, okey101Finish, totals, teamTotals,
} from './engines.js';
import { KING_CONTRACTS, KING_SUITS, KING_LIMITS } from './rules.js';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function createMatch(game, playerNames, config) {
  return {
    id: uid(),
    game,
    createdAt: new Date().toISOString(),
    players: playerNames.map((name, i) => ({ id: uid(), name: name.trim() || `Oyuncu ${i + 1}` })),
    config: JSON.parse(JSON.stringify(config)), // profil maça kopyalanır: sonraki ayar değişiklikleri etkilemez
    hands: [],
    draft: null,
    status: 'active',
  };
}

export function targetHands(m) {
  if (m.game === 'kut') return 13;
  if (m.game === 'king') return KING_LIMITS.contracts;
  return m.config.handCount;
}

export const isDone = (m) => m.hands.length >= targetHands(m);
export const names = (m) => m.players.map((p) => p.name);
export const lowWins = (m) => (m.game === 'king' ? false : m.config.lowWins !== false);
export const matchTotals = (m) => totals(m.hands, m.players.length);
export const isTeams = (m) => m.game === 'okey101' && !!m.config.teams;
export const teamNames = (m) => [`${m.players[0].name} & ${m.players[2].name}`, `${m.players[1].name} & ${m.players[3].name}`];
export const matchTeamTotals = (m) => teamTotals(matchTotals(m));

/** Bu el serbest puan girişiyle mi? (yalnız Küt) */
export function isManualEntry(m, handNo) {
  return m.game === 'kut' && kutIsManualHand(handNo, m.config.table);
}

/** El sonucunu hesaplar. handNo 1'den başlar. history: King için bu elden önceki kontratlar. */
export function computeHand(m, handNo, input) {
  const nm = names(m);
  if (m.game === 'kut') {
    if (isManualEntry(m, handNo)) return { ...scoreManual(input, nm), label: winnerLabel(m, input.winner) };
    const r = scoreKutAuto(input, m.config.table, nm);
    const lbl = input.finish === 'deste' ? 'Deste bitti' : `${input.finish === 'okey' ? 'Okeyle' : 'Normal'} · ${nm[input.winner] ?? '?'}`;
    return { ...r, label: lbl };
  }
  if (m.game === 'okey101') {
    const r = score101(input, m.config, nm);
    const f = okey101Finish(input.finish);
    return { ...r, label: f ? (f.id === 'deste' ? f.label : `${f.label} · ${nm[input.winner] ?? '?'}`) : '' };
  }
  // king
  const r = scoreKing(input.contract, input, nm);
  const c = KING_CONTRACTS[input.contract];
  const suit = KING_SUITS.find((s) => s.id === input.suit);
  return { ...r, label: c ? `${c.name}${c.id === 'koz' && suit ? ` ${suit.sym} ${suit.name}` : ''}` : '' };
}

function winnerLabel(m, w) {
  if (w === 'none') return 'Kimse bitirmedi';
  if (Number.isInteger(w)) return `Bitiren: ${m.players[w].name}`;
  return '';
}

const kingList = (hands) => hands.map((h) => ({ contract: h.input.contract, suit: h.input.suit }));

/** Yeni el kaydı. Aynı taslak iki kez kaydedilemez. */
export function appendHand(m, draftId, input) {
  if (m.status !== 'active' || isDone(m)) return { error: 'Maç tamamlandı, yeni el açılamaz.' };
  if (m.hands.some((h) => h.draftId === draftId)) return { error: 'Bu el zaten kaydedildi.' };
  const no = m.hands.length + 1;
  if (m.game === 'king') {
    const err = kingChoiceError(kingList(m.hands), m.config.firstChooser, input.contract, input.suit);
    if (err) return { error: err };
  }
  const r = computeHand(m, no, input);
  if (!r.ok) return { error: r.errors.join(' ') };
  const hand = {
    no, draftId, input: JSON.parse(JSON.stringify(input)), scores: r.scores, breakdown: r.breakdown,
    label: r.label, savedAt: new Date().toISOString(),
  };
  const next = { ...m, hands: [...m.hands, hand], draft: null };
  if (isDone(next)) next.status = 'done';
  return { match: next };
}

/** Geçmiş eli düzeltir; toplamlar ellerden yeniden türetildiği için kendiliğinden güncellenir. */
export function replaceHand(m, index, input) {
  const old = m.hands[index];
  if (!old) return { error: 'El bulunamadı.' };
  if (m.game === 'king') {
    const list = kingList(m.hands);
    list[index] = { contract: input.contract, suit: input.suit };
    const err = kingSequenceError(list, m.config.firstChooser);
    if (err) return { error: `${err.error} Bu değişiklik sonraki seçimleri bozuyor; kayıt değiştirilmedi.` };
  }
  const r = computeHand(m, index + 1, input);
  if (!r.ok) return { error: r.errors.join(' ') };
  const hands = m.hands.slice();
  hands[index] = {
    ...old, input: JSON.parse(JSON.stringify(input)), scores: r.scores, breakdown: r.breakdown,
    label: r.label, editedAt: new Date().toISOString(),
  };
  return { match: { ...m, hands } };
}

export function undoLast(m) {
  if (!m.hands.length) return { error: 'Geri alınacak kayıt yok.' };
  return { match: { ...m, hands: m.hands.slice(0, -1), status: 'active', draft: null } };
}
