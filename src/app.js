// Ekranlar ve etkileşim. Puan hesabı engines.js / model.js'te; burada yalnız gösterim ve girdi.

import {
  GAMES, KUT_HANDS, TILE_COLORS, OKEY101_FINISHES, OKEY101_EVENTS, KING_CONTRACTS, KING_CEZA_IDS,
  KING_SUITS, KING_LIMITS, KUT_DEFAULT_TABLE,
} from './rules.js';
import { GUIDES } from './guides.js';
import {
  fmt, ranking, kingChooser, kingRights, kingChoiceError, parseIntStrict,
} from './engines.js';
import {
  createMatch, targetHands, isDone, names, lowWins, matchTotals, isManualEntry, computeHand,
  appendHand, replaceHand, undoLast, uid,
} from './model.js';
import { loadState, saveState } from './store.js';

const S = loadState();
const ui = { toast: null, openRow: null, error: null };
const app = document.getElementById('app');
const clone = (o) => JSON.parse(JSON.stringify(o));
const persist = () => saveState(S);

// ------------------------------------------------------------ yardımcılar
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pts = (n) => {
  if (n === null || n === undefined) return '<span class="pts">—</span>';
  const cls = n > 0 ? 'pos' : n < 0 ? 'neg' : 'zero';
  const txt = n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';
  return `<span class="pts ${cls}">${txt}</span>`;
};
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, p, v) {
  const ks = p.split('.'); let a = o;
  for (let i = 0; i < ks.length - 1; i++) a = a[ks[i]];
  a[ks[ks.length - 1]] = v;
}
const dateTR = (iso) => new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function chip(label, active, attrs = '', disabled = false, extraCls = '') {
  return `<button type="button" class="chip ${active ? 'on' : ''} ${extraCls}" ${attrs} ${disabled ? 'disabled' : ''} aria-pressed="${active ? 'true' : 'false'}">${active ? '<span class="tick" aria-hidden="true">✓</span>' : ''}${label}</button>`;
}
const setAttrs = (f, v, type = 'int') => `data-act="set" data-f="${f}" data-v="${v}" data-type="${type}"`;

function numInput(f, value, { signed = false, placeholder = '', label = '' } = {}) {
  return `<div class="num ${signed ? 'signed' : ''}">
    ${signed ? `<button type="button" class="sign" data-act="neg" data-f="${f}" aria-label="İşareti değiştir">±</button>` : ''}
    <input type="text" inputmode="numeric" pattern="-?[0-9]*" autocomplete="off" data-f="${f}" value="${esc(value)}" placeholder="${esc(placeholder)}" aria-label="${esc(label)}">
  </div>`;
}
function stepper(f, value, label) {
  return `<div class="stepper">
    <button type="button" data-act="step" data-f="${f}" data-d="-1" aria-label="${esc(label)} azalt">−</button>
    <input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-f="${f}" value="${esc(value)}" aria-label="${esc(label)}">
    <button type="button" data-act="step" data-f="${f}" data-d="1" aria-label="${esc(label)} artır">+</button>
  </div>`;
}

function tile(t) {
  const c = TILE_COLORS[t.c];
  return `<span class="tile c-${t.c}" title="${c.name} ${t.n}"><b>${t.n}</b><i>${c.short}</i></span>`;
}
function tiles(groups) {
  return `<div class="tiles">${groups.map((g) => `<div class="tgroup">${g.map(tile).join('')}</div>`).join('')}</div>`;
}
const legend = () => `<p class="legend">${Object.entries(TILE_COLORS).map(([k, v]) => `<span class="tile mini c-${k}"><i>${k}</i></span> ${v.name}`).join(' · ')}</p>`;

function header(title, sub = '') {
  return `<header class="bar">
    <button type="button" class="back" data-act="back" aria-label="Geri">‹</button>
    <div class="ttl"><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>
  </header>`;
}

// ------------------------------------------------------------ gezinme
function go(view, push = true) {
  S.view = view; ui.error = null; ui.openRow = null;
  persist();
  if (push) history.pushState({ v: 1 }, '');
  render();
  window.scrollTo(0, 0);
}
function back(push = false) {
  const v = S.view; const m = S.matches[v.matchId];
  switch (v.name) {
    case 'rules': return go(v.from || { name: 'home' }, push);
    case 'entry':
      if (v.editIndex != null) { S.edit = null; return go({ name: 'score', matchId: v.matchId }, push); }
      return go({ name: 'play', matchId: v.matchId }, push);
    case 'score':
      if (v.from) return go(v.from, push);
      return go(m && m.status === 'active' && !isDone(m) ? { name: 'play', matchId: v.matchId } : { name: 'home' }, push);
    default: return go({ name: 'home' }, push);
  }
}
window.addEventListener('popstate', () => { if (S.view.name !== 'home') back(false); });

function toast(msg) {
  ui.toast = msg; render();
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { ui.toast = null; const el = document.querySelector('.toast'); if (el) el.remove(); }, 2600);
}

function confirmBox(text, ok = 'Evet', danger = false) {
  return new Promise((resolve) => {
    const d = document.createElement('div');
    d.className = 'modal';
    d.innerHTML = `<div class="box" role="dialog" aria-modal="true"><p>${text}</p>
      <div class="row"><button type="button" class="btn ghost" data-r="0">Vazgeç</button>
      <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${esc(ok)}</button></div></div>`;
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-r]');
      if (!b && e.target !== d) return;
      d.remove(); resolve(b ? b.dataset.r === '1' : false);
    });
    document.body.appendChild(d);
    d.querySelector('[data-r="1"]').focus();
  });
}

// ------------------------------------------------------------ ANA EKRAN
function viewHome() {
  const cards = Object.values(GAMES).map((g) => {
    const am = S.matches[S.active[g.id]];
    const live = am && am.status === 'active' && !isDone(am);
    const count = Object.values(S.matches).filter((m) => m.game === g.id).length;
    const progress = live ? `<p class="prog">${g.id === 'king' ? 'Kontrat' : 'El'} ${am.hands.length + 1}/${targetHands(am)} · ${am.players.map((p) => esc(p.name)).join(', ')}</p>` : '';
    return `<section class="card game g-${g.id}">
      <div class="gh"><h2>${g.name}</h2><p>${g.sub}</p></div>
      ${progress}
      <div class="acts">
        ${live ? `<button type="button" class="btn primary" data-act="resume" data-game="${g.id}">Devam et</button>` : ''}
        <button type="button" class="btn ${live ? 'ghost' : 'primary'}" data-act="new" data-game="${g.id}">Yeni maç</button>
        <button type="button" class="btn ghost" data-act="rules" data-game="${g.id}">Kuralları gör</button>
      </div>
      ${count ? `<button type="button" class="link" data-act="historyList" data-game="${g.id}">Geçmiş maçlar (${count})</button>` : ''}
    </section>`;
  }).join('');
  return `<header class="hero"><h1>Küt · 101 · King</h1><p>Masada gerçek taş ve kartla oynayın; şart, kural ve skor burada.</p></header>
    <main class="wrap">${cards}<p class="foot">Veriler yalnızca bu cihazda saklanır.</p></main>`;
}

function viewHistoryList() {
  const g = GAMES[S.view.game];
  const list = Object.values(S.matches).filter((m) => m.game === g.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rows = list.map((m) => {
    const tot = matchTotals(m);
    const rk = ranking(tot, lowWins(m));
    const lead = m.hands.length ? `${esc(m.players[rk[0].player].name)} ${fmt(rk[0].score)}` : 'Kayıt yok';
    const st = m.status === 'done' ? 'Bitti' : S.active[g.id] === m.id ? 'Devam ediyor' : 'Yarım kaldı';
    return `<button type="button" class="card listrow" data-act="openMatch" data-id="${m.id}">
      <b>${dateTR(m.createdAt)}</b> <span class="badge">${st}</span>
      <span class="small">${m.players.map((p) => esc(p.name)).join(', ')} · ${m.hands.length}/${targetHands(m)}</span>
      <span class="small">${m.status === 'done' ? 'Kazanan' : 'Önde'}: ${lead}</span></button>`;
  }).join('');
  return header(`${g.name} · Geçmiş`) + `<main class="wrap">${rows || '<p>Henüz maç yok.</p>'}</main>`;
}

// ------------------------------------------------------------ KURALLAR
function guideHandsTable() {
  return `${legend()}<ol class="hands">${KUT_HANDS.map((h) => `<li class="${h.tag ? 'tagged' : ''}">
    <div class="hn">${h.no}</div><div><b>${h.req}</b>${h.tag ? ` <span class="badge warn">${h.tag}</span>` : ''}
    ${h.groups.length ? tiles(h.groups) : ''}<p class="small">${h.text}</p></div></li>`).join('')}</ol>`;
}
function kutScoringGuide() {
  const t = S.prefs.kutTable || KUT_DEFAULT_TABLE;
  return `<ul>
    <li><b>Elle skor</b> her elde çalışır: dört oyuncunun puanı yazılır. Boş alan ile 0 farklıdır.</li>
    <li><b>Masa ayarıyla</b> (onaylanınca): bitiren ${t.finisherScore}, açamayan ${t.notOpenedPenalty}, açıp bitiremeyen elinde kalan taş toplamı kadar yazar. Okeyle bitişte rakiplerin puanı ×${t.okeyMultiplier}.</li>
    <li>Deste biterse kazanan ve çarpan yoktur; açamayan ${t.notOpenedPenalty}, açan kalan taş toplamı kadar yazar.</li>
    <li>10. el <span class="badge warn">cezasız</span>: anlamı masada teyit edilmedi; bu el serbest puanla girilir.</li>
    <li>13. el (düz okey): serbest puan ekranı.</li>
    <li>Varsayılan: düşük toplam kazanır.</li></ul>`;
}
function okeyTableGuide() {
  const cell = (f, k) => {
    if (f.fixed) return k === 'acmadi' ? f.fixed : f.fixed;
    if (k === 'acmadi') return f.notOpened;
    const m = (k === 'cift' ? 2 : 1) * f.mult;
    return m === 1 ? 'T' : `${m} × T`;
  };
  return `<div class="scroll"><table class="grid"><thead><tr><th>Sonuç</th><th>Bitiren</th><th>Açmayan</th><th>Seri açan</th><th>Çift açan</th></tr></thead>
    <tbody>${OKEY101_FINISHES.map((f) => `<tr><th>${f.label}</th><td>${f.winner === null ? '—' : `−${Math.abs(f.winner)}`}</td><td>${cell(f, 'acmadi')}</td><td>${cell(f, 'seri')}</td><td>${cell(f, 'cift')}</td></tr>`).join('')}</tbody></table></div>
    <p class="small">T: elde kalan sayılı taşların toplamı; sahte okey temsil ettiği taşın değeriyle sayılır.</p>`;
}
function kingTableGuide() {
  return `<div class="scroll"><table class="grid"><thead><tr><th>Kontrat</th><th>Sayılan</th><th>Birim</th><th>Toplam</th></tr></thead><tbody>
    ${Object.values(KING_CONTRACTS).map((c) => `<tr><th>${c.name}</th><td>${c.what} (${c.total})</td><td>${pts(c.unit)}</td><td>${pts(c.unit * c.total)}</td></tr>`).join('')}
    </tbody></table></div>`;
}
function viewRules() {
  const g = GAMES[S.view.game];
  const body = GUIDES[g.id].map((s) => {
    let inner = '';
    if (s.items) inner = `<ul>${s.items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
    if (s.handsTable) inner = guideHandsTable();
    if (s.kutScoring) inner = kutScoringGuide();
    if (s.okeyTable) inner = okeyTableGuide();
    if (s.kingTable) inner = kingTableGuide();
    return `<section class="card"><h2>${s.title}</h2>${inner}</section>`;
  }).join('');
  return header(`${g.name} · Kurallar`) + `<main class="wrap rules">${body}</main>`;
}

// ------------------------------------------------------------ MAÇ KURULUMU
function startSetup(game) {
  S.setup = {
    game,
    names: S.prefs.names.slice(),
    kutMode: 'manual',
    table: clone(S.prefs.kutTable || KUT_DEFAULT_TABLE),
    tableConfirmed: false,
    lowWins: true,
    handCount: 7,
    customCount: '',
    penalized: true,
    firstChooser: 0,
  };
  go({ name: 'setup' });
}

function profileSummary(su) {
  if (su.game === 'kut') {
    return su.kutMode === 'auto'
      ? `13 el · masa ayarıyla otomatik hesap (bitiren ${su.table.finisherScore}, açamayan ${su.table.notOpenedPenalty}, açan kalan taş toplamı, okeyle ×${su.table.okeyMultiplier}). 10. ve 13. el serbest giriş. ${su.lowWins ? 'Düşük' : 'Yüksek'} toplam kazanır.`
      : `13 el · her elde elle puan girişi. ${su.lowWins ? 'Düşük' : 'Yüksek'} toplam kazanır.`;
  }
  if (su.game === 'okey101') return `Katlamasız, bireysel · ${su.handCount} el · ${su.penalized ? 'cezalı masa (okey ve olay başına +101)' : 'cezasız masa'} · düşük toplam kazanır.`;
  return `20 kontrat · her oyuncu 3 ceza + 2 koz · ilk seçici ${esc(su.names[su.firstChooser] || `Oyuncu ${su.firstChooser + 1}`)} · yüksek toplam kazanır.`;
}

function viewSetup() {
  const su = S.setup; const g = GAMES[su.game];
  const nameRows = su.names.map((n, i) => `<div class="pname">
    <span class="seat">${i + 1}</span>
    <input type="text" data-sf="names.${i}" value="${esc(n)}" placeholder="Oyuncu ${i + 1}" maxlength="16" aria-label="${i + 1}. oyuncu adı" autocomplete="off">
    <button type="button" class="mini" data-act="moveUp" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Yukarı taşı">↑</button>
    <button type="button" class="mini" data-act="moveDown" data-i="${i}" ${i === 3 ? 'disabled' : ''} aria-label="Aşağı taşı">↓</button>
  </div>`).join('');

  let extra = '';
  if (su.game === 'kut') {
    extra = `<section class="card"><h2>Hesaplama</h2>
      <div class="chips">${chip('Elle skor', su.kutMode === 'manual', 'data-act="su" data-k="kutMode" data-v="manual"')}${chip('Masa ayarıyla', su.kutMode === 'auto', 'data-act="su" data-k="kutMode" data-v="auto"')}</div>
      ${su.kutMode === 'auto' ? `<div class="tablecfg">
        <label>Açamayan oyuncu cezası ${numInput('table.notOpenedPenalty', su.table.notOpenedPenalty, { label: 'Açamayan cezası' }).replace('data-f=', 'data-sf=')}</label>
        <label>Okeyle bitiş çarpanı (×) ${numInput('table.okeyMultiplier', su.table.okeyMultiplier, { label: 'Okey çarpanı' }).replace('data-f=', 'data-sf=')}</label>
        <label>Bitirenin puanı ${numInput('table.finisherScore', su.table.finisherScore, { label: 'Bitiren puanı' }).replace('data-f=', 'data-sf=')}</label>
        <p class="small">Açıp bitiremeyen oyuncu elinde kalan taşların toplamını yazar. 10. el (cezasız) ve 13. el (düz okey) serbest puanla girilir.</p>
        <label class="check"><input type="checkbox" data-act="toggleConfirm" ${su.tableConfirmed ? 'checked' : ''}> Bu masa ayarını onaylıyorum</label>
      </div>` : '<p class="small">Her elde dört oyuncunun puanını siz yazarsınız.</p>'}
      <h3>Kazanan</h3>
      <div class="chips">${chip('Düşük toplam', su.lowWins, 'data-act="su" data-k="lowWins" data-v="1"')}${chip('Yüksek toplam', !su.lowWins, 'data-act="su" data-k="lowWins" data-v="0"')}</div>
    </section>`;
  } else if (su.game === 'okey101') {
    extra = `<section class="card"><h2>El sayısı</h2>
      <div class="chips">${[3, 5, 7, 9, 11].map((n) => chip(String(n), su.handCount === n && !su.customCount, `data-act="su" data-k="handCount" data-v="${n}"`)).join('')}</div>
      <label class="inline">Başka: <input type="text" inputmode="numeric" class="short" data-sf="customCount" value="${esc(su.customCount)}" placeholder="—" aria-label="Özel el sayısı"></label>
      <h3>Masa</h3>
      <div class="chips">${chip('Cezalı masa', su.penalized, 'data-act="su" data-k="penalized" data-v="1"')}${chip('Cezasız masa', !su.penalized, 'data-act="su" data-k="penalized" data-v="0"')}</div>
    </section>`;
  } else {
    extra = `<section class="card"><h2>İlk kontrat seçicisi</h2>
      <div class="chips">${su.names.map((n, i) => chip(esc(n || `Oyuncu ${i + 1}`), su.firstChooser === i, `data-act="su" data-k="firstChooser" data-v="${i}"`)).join('')}</div>
      <p class="small">Seçim oturma sırasıyla dolaşır.</p></section>`;
  }

  const blocked = su.game === 'kut' && su.kutMode === 'auto' && !su.tableConfirmed;
  return header(`${g.name} · Yeni maç`) + `<main class="wrap">
    <section class="card"><h2>Oyuncular</h2><p class="small">Oturma sırasıyla yaz; okları kullanarak sırayı değiştir.</p>${nameRows}</section>
    ${extra}
    <section class="card summary"><h2>Profil özeti</h2><p id="profileSummary">${profileSummary(su)}</p></section>
    ${ui.error ? `<p class="err">${esc(ui.error)}</p>` : ''}
    <button type="button" class="btn primary big" data-act="startMatch" ${blocked ? 'disabled' : ''}>Maçı başlat</button>
    ${blocked ? '<p class="small center">Otomatik hesap için masa ayarını onayla.</p>' : ''}
  </main>`;
}

async function startMatch() {
  const su = S.setup;
  const nm = su.names.map((n, i) => n.trim() || `Oyuncu ${i + 1}`);
  if (new Set(nm.map((n) => n.toLocaleLowerCase('tr'))).size < 4) { ui.error = 'Oyuncu adları farklı olmalı.'; return render(); }
  let config;
  if (su.game === 'kut') {
    if (su.kutMode === 'auto') {
      const t = {};
      for (const k of ['notOpenedPenalty', 'okeyMultiplier', 'finisherScore']) {
        const v = parseIntStrict(su.table[k]);
        if (v === null || Number.isNaN(v)) { ui.error = 'Masa ayarındaki bütün alanlar tam sayı olmalı.'; return render(); }
        t[k] = v;
      }
      if (t.okeyMultiplier < 1) { ui.error = 'Okey çarpanı en az 1 olmalı.'; return render(); }
      config = { lowWins: su.lowWins, table: { mode: 'auto', ...t, manualHands: [10, 13] } };
      S.prefs.kutTable = { ...KUT_DEFAULT_TABLE, ...t };
    } else config = { lowWins: su.lowWins, table: { mode: 'manual' } };
  } else if (su.game === 'okey101') {
    const c = su.customCount ? parseIntStrict(su.customCount) : su.handCount;
    if (!Number.isInteger(c) || c < 1 || c > 50) { ui.error = 'El sayısı 1 ile 50 arasında olmalı.'; return render(); }
    config = { handCount: c, penalized: su.penalized, lowWins: true };
  } else config = { firstChooser: su.firstChooser };

  const cur = S.matches[S.active[su.game]];
  if (cur && cur.status === 'active' && !isDone(cur)) {
    const ok = await confirmBox(`Devam eden ${GAMES[su.game].name} maçı “Yarım kaldı” olarak geçmişe kaydedilecek. Yeni maç başlasın mı?`, 'Yeni maçı başlat');
    if (!ok) return;
  }
  const m = createMatch(su.game, nm, config);
  S.matches[m.id] = m;
  S.active[su.game] = m.id;
  S.prefs.names = nm;
  S.setup = null;
  go({ name: 'play', matchId: m.id });
}

// ------------------------------------------------------------ TASLAK
function emptyInput(m, handNo) {
  if (m.game === 'kut') {
    if (isManualEntry(m, handNo)) return { scores: ['', '', '', ''], winner: null, note: '' };
    return { finish: 'normal', winner: null, players: [0, 1, 2, 3].map(() => ({ state: null, T: '', extra: '' })), note: '' };
  }
  if (m.game === 'okey101') return { finish: 'normal', winner: null, players: [0, 1, 2, 3].map(() => ({ state: null, T: '', okeys: '', events: '' })), note: '' };
  return { contract: null, suit: null, counts: ['', '', '', ''], player: null, p12: null, p13: null };
}
function ensureDraft(m) {
  const no = m.hands.length + 1;
  if (!m.draft || m.draft.handNo !== no) {
    m.draft = { draftId: uid(), handNo: no, input: emptyInput(m, no), preview: null, previewKey: null };
    persist();
  }
  return m.draft;
}
function entryCtx() {
  const m = S.matches[S.view.matchId];
  if (S.view.editIndex != null) return { m, edit: true, index: S.view.editIndex, handNo: S.view.editIndex + 1, d: S.edit };
  return { m, edit: false, handNo: m.hands.length + 1, d: ensureDraft(m) };
}

// ------------------------------------------------------------ AKTİF EL
function totalsStrip(m, extra = null) {
  const tot = matchTotals(m);
  const rk = ranking(tot, lowWins(m));
  const rankOf = Object.fromEntries(rk.map((r) => [r.player, r.rank]));
  return `<div class="strip">${m.players.map((p, i) => `<div class="tcell ${rankOf[i] === 1 && m.hands.length ? 'lead' : ''}">
    <span class="nm">${esc(p.name)}</span>${pts(tot[i])}${extra ? `<span class="dl">${extra[i] === null ? '' : `→ ${pts(tot[i] + extra[i])}`}</span>` : ''}
    ${m.hands.length ? `<span class="rk">${rankOf[i]}.</span>` : ''}</div>`).join('')}</div>`;
}

function kutPlayBody(m, no) {
  const h = KUT_HANDS[no - 1];
  const manual = isManualEntry(m, no);
  const t = m.config.table;
  const scoring = manual
    ? (no === 10 ? 'Serbest puan girişi. “Cezasız” ibaresinin anlamı masada teyit edilmedi; puanları masada nasıl yazıyorsanız öyle girin.'
      : no === 13 ? 'Serbest puan girişi: bitiren ve rakipler puanlarını kendileri yazar.'
        : 'Elle skor: dört oyuncunun puanını yazın.')
    : `Bitiren ${t.finisherScore} · Açamayan ${t.notOpenedPenalty} · Açan: kalan taş toplamı · Okeyle bitiş ×${t.okeyMultiplier}`;
  return `<section class="card req ${h.straight ? 'straight' : ''}">
      <p class="eyebrow">${h.straight ? 'El türü · açma adımı yok' : 'Açma şartı'}</p>
      <h2 class="big">${h.req}${h.tag ? ` <span class="badge warn">${h.tag}</span>` : ''}</h2>
      ${h.groups.length ? tiles(h.groups) : ''}
      <p>${h.straight ? h.text : `Örnek: ${h.text}`}</p>
      ${h.groups.length ? legend() : ''}
    </section>
    <section class="card"><p class="eyebrow">Puanlama</p><p>${scoring}</p></section>
    <section class="card"><p class="eyebrow">Sıradaki eller</p><p class="small">${KUT_HANDS.slice(no, no + 3).map((x) => `${x.no}. ${x.req}${x.tag && !x.straight ? ` (${x.tag})` : ''}`).join(' · ') || 'Bu son el.'}</p></section>`;
}

function okeyPlayBody(m) {
  return `<section class="card req"><p class="eyebrow">Açılış</p>
      <h2 class="big">En az 101 değerinde per veya en az 5 çift</h2>
      <p class="small">Açan oyuncu uygun perlere taş işleyebilir. Çift açan oyuncu bu profilde seri açamaz. Son taş atılarak bitilir.</p></section>
    <section class="card"><p class="eyebrow">Puanlama · ${m.config.penalized ? 'cezalı masa' : 'cezasız masa'}</p>${okeyTableGuide()}
      ${m.config.penalized ? '<p class="small">Kalan her gerçek okey +101 (çarpandan sonra). Ceza olayları +101, çarpılmaz.</p>' : ''}</section>`;
}

function kingRightsTable(m, list) {
  const r = kingRights(list, m.config.firstChooser);
  return `<div class="scroll"><table class="grid rights"><thead><tr><th></th>${m.players.map((p) => `<th>${esc(p.name)}</th>`).join('')}</tr></thead><tbody>
    <tr><th>Ceza</th>${r.ceza.map((n) => `<td>${n}/3</td>`).join('')}</tr>
    <tr><th>Koz</th>${r.koz.map((n) => `<td>${n}/2</td>`).join('')}</tr></tbody></table></div>
    <p class="small">Kalan ceza hakları: ${KING_CEZA_IDS.map((id) => `${KING_CONTRACTS[id].name} ${KING_LIMITS.perCezaType - r.typeUsed[id]}`).join(' · ')} · Koz ${KING_LIMITS.kozTotal - r.kozTotal}</p>`;
}

function contractPicker(m, list, input, chooser) {
  const opts = Object.values(KING_CONTRACTS).map((c) => {
    const reason = kingChoiceError(list, m.config.firstChooser, c.id, 'x');
    return chip(c.name, input.contract === c.id, `data-act="set" data-f="contract" data-v="${c.id}" data-type="str" ${reason ? `title="${esc(reason)}"` : ''}`, !!reason, c.kind === 'koz' ? 'koz' : '');
  }).join('');
  const blocked = Object.values(KING_CONTRACTS).map((c) => [c, kingChoiceError(list, m.config.firstChooser, c.id, 'x')]).filter(([, r]) => r);
  return `<p class="eyebrow">Seçen: <b>${esc(m.players[chooser].name)}</b></p>
    <div class="chips">${opts}</div>
    ${blocked.length ? `<p class="small muted">Kapalı: ${blocked.map(([c, r]) => `${c.name} (${r})`).join(' · ')}</p>` : ''}
    ${input.contract === 'koz' ? `<h3>Koz rengi</h3><div class="chips">${KING_SUITS.map((s) => chip(`<span class="suit s-${s.id}">${s.sym}</span> ${s.name}`, input.suit === s.id, `data-act="set" data-f="suit" data-v="${s.id}" data-type="str"`)).join('')}</div>` : ''}`;
}

function kingPlayBody(m, d) {
  const list = m.hands.map((h) => ({ contract: h.input.contract, suit: h.input.suit }));
  const chooser = kingChooser(m.config.firstChooser, m.hands.length);
  const c = KING_CONTRACTS[d.input.contract];
  return `<section class="card req"><p class="eyebrow">Kontrat seçimi</p>${contractPicker(m, list, d.input, chooser)}
    ${c ? `<p class="goal"><b>Hedef:</b> ${c.goal}</p>` : ''}</section>
    <section class="card"><p class="eyebrow">Kontrat hakları</p>${kingRightsTable(m, list)}</section>`;
}

function viewPlay() {
  const m = S.matches[S.view.matchId];
  if (m.status !== 'active' || isDone(m)) return viewEnd();
  const d = ensureDraft(m);
  const no = m.hands.length + 1; const total = targetHands(m);
  const g = GAMES[m.game];
  let body = ''; let canEnter = true;
  if (m.game === 'kut') body = kutPlayBody(m, no);
  else if (m.game === 'okey101') body = okeyPlayBody(m);
  else {
    body = kingPlayBody(m, d);
    canEnter = !kingChoiceError(m.hands.map((h) => ({ contract: h.input.contract, suit: h.input.suit })), m.config.firstChooser, d.input.contract, d.input.suit);
  }
  const unit = m.game === 'king' ? 'Kontrat' : 'El';
  return header(g.name, `<b>${unit} ${no}/${total}</b>`) + `<main class="wrap">
    ${totalsStrip(m)}
    ${body}
    <div class="dock">
      <button type="button" class="btn primary big" data-act="enter" ${canEnter ? '' : 'disabled'}>${m.game === 'king' ? 'Kontrat sonucunu gir' : 'El sonucunu gir'}</button>
      <div class="row"><button type="button" class="btn ghost" data-act="score">Skor ve geçmiş</button>
      <button type="button" class="btn ghost" data-act="rulesFrom" data-game="${m.game}">Kurallar</button></div>
    </div></main>`;
}

// ------------------------------------------------------------ SONUÇ GİRİŞİ
function playerChips(m, f, value, { none = false, exclude = null } = {}) {
  return `<div class="chips">${m.players.map((p, i) => (i === exclude ? '' : chip(esc(p.name), value === i, setAttrs(f, i)))).join('')}
    ${none ? chip('Kimse bitirmedi', value === 'none', setAttrs(f, 'none', 'str')) : ''}</div>`;
}

function fieldsManual(m, inp, no) {
  const h = KUT_HANDS[no - 1];
  const note = no === 10 ? '<p class="note">10. el <span class="badge warn">cezasız</span>: anlamı teyit edilmedi. Puanları masadaki gibi yazın.</p>'
    : no === 13 ? '<p class="note">13. el düz okey: bitiren ve rakipler puanlarını kendileri yazar.</p>' : '';
  return `${note}<section class="card"><h3>Bitiren</h3>${playerChips(m, 'winner', inp.winner, { none: true })}</section>
    <section class="card"><h3>Puanlar <span class="small">(± ile işaret değiştir, boş ≠ 0)</span></h3>
    ${m.players.map((p, i) => `<div class="prow"><span class="nm">${esc(p.name)}${inp.winner === i ? ' <span class="badge">bitirdi</span>' : ''}</span>${numInput(`scores.${i}`, inp.scores[i], { signed: true, label: `${p.name} puanı` })}</div>`).join('')}
    </section>
    <section class="card"><label>El notu (isteğe bağlı)<input type="text" data-f="note" value="${esc(inp.note)}" maxlength="80" placeholder="${esc(h.req)}"></label></section>`;
}

function fieldsKutAuto(m, inp) {
  const t = m.config.table;
  const deste = inp.finish === 'deste';
  return `<section class="card"><h3>Bitiş</h3>
      <div class="chips">${chip('Normal', inp.finish === 'normal', setAttrs('finish', 'normal', 'str'))}${chip(`Okeyle (×${t.okeyMultiplier})`, inp.finish === 'okey', setAttrs('finish', 'okey', 'str'))}${chip('Deste bitti', deste, setAttrs('finish', 'deste', 'str'))}</div>
      ${deste ? '<p class="small">Kazanan yok, çarpan yok.</p>' : `<h3>Bitiren</h3>${playerChips(m, 'winner', inp.winner)}`}
    </section>
    <section class="card"><h3>Diğer oyuncular</h3>
    ${m.players.map((p, i) => {
    if (!deste && inp.winner === i) return `<div class="prow"><span class="nm">${esc(p.name)} <span class="badge">bitirdi</span></span><span class="small">${t.finisherScore} puan</span></div>`;
    const pl = inp.players[i];
    return `<div class="pblock"><div class="nm">${esc(p.name)}</div>
        <div class="chips">${chip(`Açamadı (${t.notOpenedPenalty})`, pl.state === 'acmadi', setAttrs(`players.${i}.state`, 'acmadi', 'str'))}${chip('Açtı', pl.state === 'acti', setAttrs(`players.${i}.state`, 'acti', 'str'))}</div>
        ${pl.state === 'acti' ? `<label class="inline">Elde kalan taş toplamı ${numInput(`players.${i}.T`, pl.T, { label: `${p.name} taş toplamı` })}</label>` : ''}
        <details ${pl.extra ? 'open' : ''}><summary>Ek puan</summary><label class="inline">Ek (±) ${numInput(`players.${i}.extra`, pl.extra, { signed: true, label: `${p.name} ek puan` })}</label></details>
      </div>`;
  }).join('')}
    <details ${inp.winner != null && inp.players[inp.winner]?.extra ? 'open' : ''}><summary class="small">Bitirene ek puan</summary>
      ${!deste && Number.isInteger(inp.winner) ? `<label class="inline">Ek (±) ${numInput(`players.${inp.winner}.extra`, inp.players[inp.winner].extra, { signed: true, label: 'Bitiren ek puan' })}</label>` : '<p class="small">Önce bitireni seç.</p>'}
    </details></section>
    <section class="card"><label>El notu (isteğe bağlı)<input type="text" data-f="note" value="${esc(inp.note)}" maxlength="80"></label></section>`;
}

function fields101(m, inp) {
  const f = OKEY101_FINISHES.find((x) => x.id === inp.finish);
  const deste = inp.finish === 'deste';
  const pen = m.config.penalized;
  return `<section class="card"><h3>Bitiş türü</h3>
      <div class="chips">${OKEY101_FINISHES.map((x) => chip(x.label, inp.finish === x.id, setAttrs('finish', x.id, 'str'))).join('')}</div>
      ${deste ? '<p class="small">Bitiren kaydı oluşmaz.</p>' : `<h3>Bitiren</h3>${playerChips(m, 'winner', inp.winner)}`}
      ${f && f.fixed ? `<p class="small">Elden: rakipler sabit ${f.fixed} yazar, açma alanları kapalı.</p>` : ''}
    </section>
    <section class="card"><h3>${deste ? 'Oyuncular' : 'Rakipler'}</h3>
    ${m.players.map((p, i) => {
    const pl = inp.players[i];
    const ev = pen ? `<label class="inline">Ceza olayı (+101) ${stepper(`players.${i}.events`, pl.events, `${p.name} ceza olayı`)}</label>` : '';
    if (!deste && inp.winner === i) return `<div class="pblock"><div class="nm">${esc(p.name)} <span class="badge">bitirdi</span> ${f ? pts(f.winner) : ''}</div>${ev}</div>`;
    if (f && f.fixed) return `<div class="pblock"><div class="nm">${esc(p.name)} · sabit ${f.fixed}</div>${ev}</div>`;
    return `<div class="pblock"><div class="nm">${esc(p.name)}</div>
        <div class="chips">${chip('Açmadı', pl.state === 'acmadi', setAttrs(`players.${i}.state`, 'acmadi', 'str'))}${chip('Seri açtı', pl.state === 'seri', setAttrs(`players.${i}.state`, 'seri', 'str'))}${chip('Çift açtı', pl.state === 'cift', setAttrs(`players.${i}.state`, 'cift', 'str'))}</div>
        ${pl.state === 'seri' || pl.state === 'cift' ? `<label class="inline">T · eldeki taş toplamı ${numInput(`players.${i}.T`, pl.T, { label: `${p.name} T` })}</label>
          ${pen ? `<label class="inline">Elde kalan gerçek okey ${stepper(`players.${i}.okeys`, pl.okeys, `${p.name} gerçek okey`)}</label>` : ''}` : ''}
        ${ev}</div>`;
  }).join('')}</section>`;
}

function fieldsKing(m, inp, ctx) {
  const c = KING_CONTRACTS[inp.contract];
  let picker = '';
  if (ctx.edit) {
    picker = `<section class="card"><h3>Kontrat</h3><div class="chips">${Object.values(KING_CONTRACTS).map((x) => chip(x.name, inp.contract === x.id, setAttrs('contract', x.id, 'str'))).join('')}</div>
      ${inp.contract === 'koz' ? `<div class="chips">${KING_SUITS.map((s) => chip(`${s.sym} ${s.name}`, inp.suit === s.id, setAttrs('suit', s.id, 'str'))).join('')}</div>` : ''}
      <p class="small">Seçen: ${esc(m.players[kingChooser(m.config.firstChooser, ctx.index)].name)}</p></section>`;
  }
  if (!c) return picker;
  let body = '';
  if (c.input === 'count') {
    const sum = inp.counts.reduce((a, v) => a + (parseIntStrict(v) || 0), 0);
    body = `<h3>${c.what} · birim ${pts(c.unit)}</h3>
      ${m.players.map((p, i) => `<div class="prow"><span class="nm">${esc(p.name)}</span>${stepper(`counts.${i}`, inp.counts[i], `${p.name} ${c.what}`)}</div>`).join('')}
      <p class="sum ${sum === c.total ? 'okk' : ''}" id="kingSum">Toplam ${sum}/${c.total}</p>`;
  } else if (c.input === 'one') {
    body = `<h3>Kupa papazını (Rıfkı) alan</h3>${playerChips(m, 'player', inp.player)}`;
  } else {
    body = `<h3>12. eli alan</h3>${playerChips(m, 'p12', inp.p12)}<h3>13. eli alan</h3>${playerChips(m, 'p13', inp.p13)}
      <p class="small">İki eli aynı oyuncu alabilir (−360).</p>`;
  }
  return `${picker}<section class="card"><p class="eyebrow">${c.name}${c.id === 'koz' && inp.suit ? ` · ${KING_SUITS.find((s) => s.id === inp.suit).sym} ${KING_SUITS.find((s) => s.id === inp.suit).name}` : ''}</p>${body}</section>`;
}

function previewPanel(ctx) {
  const { m, d } = ctx;
  const key = JSON.stringify(d.input);
  if (!d.preview) return '<section class="card preview muted" id="preview"><p>Puanları görmek için <b>Önizle</b>’ye bas.</p></section>';
  const stale = d.previewKey !== key;
  if (!d.preview.ok) return `<section class="card preview bad" id="preview"><h3>Eksik veya hatalı</h3><ul>${d.preview.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></section>`;
  const base = matchTotals(m);
  const old = ctx.edit ? m.hands[ctx.index].scores : [0, 0, 0, 0];
  return `<section class="card preview ${stale ? 'stale' : ''}" id="preview">
    <h3>Önizleme ${stale ? '<span class="badge warn">girdi değişti, tekrar önizle</span>' : ''}</h3>
    <table class="grid"><thead><tr><th>Oyuncu</th><th>Kural</th><th>Puan</th><th>Toplam</th></tr></thead><tbody>
    ${m.players.map((p, i) => `<tr><th>${esc(p.name)}</th><td class="small">${esc(d.preview.breakdown[i])}</td><td>${pts(d.preview.scores[i])}</td><td>${pts(base[i] - old[i] + d.preview.scores[i])}</td></tr>`).join('')}
    </tbody></table>
    ${m.game === 'king' ? `<p class="small">Kontrat toplamı: ${pts(d.preview.scores.reduce((a, b) => a + b, 0))}</p>` : ''}
  </section>`;
}

function viewEntry() {
  const ctx = entryCtx();
  const { m, d, handNo } = ctx;
  if (!ctx.edit && (m.status !== 'active' || isDone(m))) return viewEnd();
  if (ctx.edit && !d) { S.view = { name: 'score', matchId: m.id }; return viewScore(); }
  const inp = d.input;
  let fields;
  if (m.game === 'kut') fields = isManualEntry(m, handNo) ? fieldsManual(m, inp, handNo) : fieldsKutAuto(m, inp);
  else if (m.game === 'okey101') fields = fields101(m, inp);
  else fields = fieldsKing(m, inp, ctx);
  const unit = m.game === 'king' ? 'Kontrat' : 'El';
  const title = ctx.edit ? `${unit} ${handNo} · düzeltme` : `${unit} ${handNo} · sonuç`;
  const sub = m.game === 'kut' ? esc(KUT_HANDS[handNo - 1].req) : m.game === 'king' && KING_CONTRACTS[inp.contract] ? KING_CONTRACTS[inp.contract].name : '';
  const canSave = d.preview && d.preview.ok && d.previewKey === JSON.stringify(inp);
  return header(title, sub) + `<main class="wrap entry">
    ${fields}
    ${previewPanel(ctx)}
    ${ui.error ? `<p class="err">${esc(ui.error)}</p>` : ''}
    <div class="dock row">
      <button type="button" class="btn ghost big" data-act="preview">Önizle</button>
      <button type="button" class="btn primary big" data-act="${ctx.edit ? 'saveEdit' : 'save'}" id="saveBtn" ${canSave ? '' : 'disabled'}>${ctx.edit ? 'Düzeltmeyi kaydet' : m.game === 'king' ? 'Kontratı kaydet' : 'Eli kaydet'}</button>
    </div></main>`;
}

// ------------------------------------------------------------ SKOR VE GEÇMİŞ
function scoreTable(m, interactive = true) {
  const tot = matchTotals(m);
  const unit = m.game === 'king' ? 'K' : 'El';
  const rows = m.hands.map((h, idx) => {
    const open = interactive && ui.openRow === idx;
    return `<tr class="hrow ${open ? 'open' : ''}" ${interactive ? `data-act="row" data-i="${idx}" tabindex="0"` : ''}>
      <th><b>${unit} ${h.no}</b><span class="small">${esc(h.label)}${h.editedAt ? ' · düzeltildi' : ''}</span></th>
      ${h.scores.map((s) => `<td>${pts(s)}</td>`).join('')}</tr>
      ${open ? `<tr class="detail"><td colspan="5">
        <ul>${m.players.map((p, i) => `<li><b>${esc(p.name)}</b>: ${esc(h.breakdown[i])}</li>`).join('')}</ul>
        ${h.input.note ? `<p class="small">Not: ${esc(h.input.note)}</p>` : ''}
        <button type="button" class="btn ghost" data-act="edit" data-i="${idx}">Bu sonucu düzelt</button></td></tr>` : ''}`;
  }).join('');
  return `<div class="scroll"><table class="grid score"><thead><tr><th>${m.game === 'king' ? 'Kontrat' : 'El'}</th>${m.players.map((p) => `<th>${esc(p.name)}</th>`).join('')}</tr></thead>
    <tbody>${rows || '<tr><td colspan="5" class="small">Henüz kayıt yok.</td></tr>'}</tbody>
    <tfoot><tr><th>Toplam</th>${tot.map((t) => `<td>${pts(t)}</td>`).join('')}</tr></tfoot></table></div>`;
}

function viewScore() {
  const m = S.matches[S.view.matchId];
  const g = GAMES[m.game];
  const done = m.status === 'done' || isDone(m);
  const tot = matchTotals(m);
  const sum = tot.reduce((a, b) => a + b, 0);
  return header(`${g.name} · Skor`, `${m.hands.length}/${targetHands(m)} ${m.game === 'king' ? 'kontrat' : 'el'} · ${dateTR(m.createdAt)}`) + `<main class="wrap">
    ${totalsStrip(m)}
    <p class="small">Satıra dokununca puan kırılımı ve düzeltme açılır.</p>
    ${scoreTable(m)}
    ${m.game === 'king' ? `<p class="small">Dört oyuncu toplamı: ${pts(sum)} ${done ? (sum === 0 ? '✓ kayıt kontrolü tamam' : '⚠ sıfır olmalı') : ''}</p>` : ''}
    <div class="dock">
      ${m.hands.length ? '<button type="button" class="btn danger" data-act="undo">Son kaydı geri al</button>' : ''}
      ${done ? '<button type="button" class="btn primary" data-act="toEnd">Maç sonu</button>'
    : S.active[m.game] === m.id ? '<button type="button" class="btn primary" data-act="toPlay">Maça dön</button>' : ''}
    </div></main>`;
}

// ------------------------------------------------------------ MAÇ SONU
function viewEnd() {
  const m = S.matches[S.view.matchId];
  const g = GAMES[m.game];
  const tot = matchTotals(m);
  const rk = ranking(tot, lowWins(m));
  const shared = rk.filter((r) => r.rank === 1).length > 1;
  S.view = { name: 'end', matchId: m.id };
  return header(`${g.name} · Maç sonu`, `${lowWins(m) ? 'Düşük' : 'Yüksek'} toplam kazanır`) + `<main class="wrap">
    <section class="card podium"><h2>${shared ? 'Ortak birincilik' : `Kazanan: ${esc(m.players[rk[0].player].name)}`}</h2>
    <ol class="rank">${rk.map((r) => `<li class="r${r.rank}"><span class="place">${r.rank}.</span><span class="nm">${esc(m.players[r.player].name)}</span>${pts(r.score)}</li>`).join('')}</ol>
    ${m.game === 'king' ? `<p class="small">Dört oyuncu toplamı ${pts(tot.reduce((a, b) => a + b, 0))}</p>` : ''}</section>
    <section class="card"><h2>El dökümü</h2>${scoreTable(m)}</section>
    <div class="dock">
      <button type="button" class="btn primary big" data-act="new" data-game="${m.game}">Yeni maç</button>
      <div class="row"><button type="button" class="btn ghost" data-act="undo">Son kaydı geri al</button>
      <button type="button" class="btn ghost" data-act="home">Ana ekran</button></div>
    </div></main>`;
}

// ------------------------------------------------------------ RENDER
function render() {
  const v = S.view;
  if (v.matchId && !S.matches[v.matchId]) S.view = { name: 'home' };
  if (S.view.name === 'setup' && !S.setup) S.view = { name: 'home' };
  let html;
  switch (S.view.name) {
    case 'rules': html = viewRules(); break;
    case 'setup': html = viewSetup(); break;
    case 'play': html = viewPlay(); break;
    case 'entry': html = viewEntry(); break;
    case 'score': html = viewScore(); break;
    case 'end': html = viewEnd(); break;
    case 'historyList': html = viewHistoryList(); break;
    default: html = viewHome();
  }
  app.innerHTML = html + (ui.toast ? `<div class="toast" role="status">${esc(ui.toast)}</div>` : '');
  document.body.dataset.view = S.view.name;
  const cm = S.matches[S.view.matchId];
  document.body.dataset.low = cm && !lowWins(cm) ? '0' : '1';
}

// ------------------------------------------------------------ OLAYLAR
function currentInputHolder() {
  if (S.view.name !== 'entry' && S.view.name !== 'play') return null;
  const m = S.matches[S.view.matchId];
  if (!m) return null;
  if (S.view.name === 'entry' && S.view.editIndex != null) return S.edit;
  return ensureDraft(m);
}

function onInputChanged() {
  persist();
  const d = currentInputHolder();
  const btn = document.getElementById('saveBtn');
  if (d && btn) {
    const ok = d.preview && d.preview.ok && d.previewKey === JSON.stringify(d.input);
    btn.disabled = !ok;
    const pv = document.getElementById('preview');
    if (pv && d.preview && !ok) pv.classList.add('stale');
  }
  const sumEl = document.getElementById('kingSum');
  if (sumEl && d) {
    const c = KING_CONTRACTS[d.input.contract];
    const sum = d.input.counts.reduce((a, v) => a + (parseIntStrict(v) || 0), 0);
    sumEl.textContent = `Toplam ${sum}/${c.total}`;
    sumEl.classList.toggle('okk', sum === c.total);
  }
}

app.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.sf && S.setup) {
    setPath(S.setup, el.dataset.sf, el.value);
    persist();
    const ps = document.getElementById('profileSummary');
    if (ps) ps.innerHTML = profileSummary(S.setup);
    return;
  }
  if (el.dataset.f) {
    const d = currentInputHolder();
    if (!d) return;
    let v = el.value;
    if (el.inputMode === 'numeric') {
      v = v.replace('−', '-').replace(/[^0-9-]/g, '').replace(/(?!^)-/g, '');
      if (v !== el.value) el.value = v;
    }
    setPath(d.input, el.dataset.f, v);
    onInputChanged();
  }
});

app.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.act === 'row') { e.preventDefault(); e.target.click(); }
});

const ACTIONS = {
  back: () => back(true),
  home: () => go({ name: 'home' }),
  new: (b) => startSetup(b.dataset.game),
  resume: (b) => go({ name: 'play', matchId: S.active[b.dataset.game] }),
  rules: (b) => go({ name: 'rules', game: b.dataset.game, from: { name: 'home' } }),
  rulesFrom: (b) => go({ name: 'rules', game: b.dataset.game, from: { ...S.view } }),
  historyList: (b) => go({ name: 'historyList', game: b.dataset.game }),
  openMatch: (b) => go({ name: 'score', matchId: b.dataset.id, from: { name: 'historyList', game: S.matches[b.dataset.id].game } }),
  su: (b) => {
    const k = b.dataset.k; let v = b.dataset.v;
    if (k === 'lowWins' || k === 'penalized') v = v === '1';
    if (k === 'handCount' || k === 'firstChooser') v = Number(v);
    S.setup[k] = v;
    if (k === 'handCount') S.setup.customCount = '';
    persist(); render();
  },
  toggleConfirm: (b) => { S.setup.tableConfirmed = b.checked; persist(); render(); },
  moveUp: (b) => { const i = +b.dataset.i; const n = S.setup.names; [n[i - 1], n[i]] = [n[i], n[i - 1]]; persist(); render(); },
  moveDown: (b) => { const i = +b.dataset.i; const n = S.setup.names; [n[i + 1], n[i]] = [n[i], n[i + 1]]; persist(); render(); },
  startMatch: () => startMatch(),
  set: (b) => {
    const d = currentInputHolder(); if (!d) return;
    const raw = b.dataset.v;
    const v = b.dataset.type === 'int' ? Number(raw) : raw;
    setPath(d.input, b.dataset.f, v);
    if (b.dataset.f === 'contract' && v !== 'koz') d.input.suit = null;
    if (b.dataset.f === 'finish' || b.dataset.f === 'winner') ui.error = null;
    persist(); render();
  },
  neg: (b) => {
    const d = currentInputHolder(); if (!d) return;
    const cur = String(getPath(d.input, b.dataset.f) ?? '');
    const nv = cur.startsWith('-') ? cur.slice(1) : `-${cur}`;
    setPath(d.input, b.dataset.f, nv);
    const inp = b.parentElement.querySelector('input'); inp.value = nv; inp.focus();
    onInputChanged();
  },
  step: (b) => {
    const d = currentInputHolder(); if (!d) return;
    const cur = parseIntStrict(getPath(d.input, b.dataset.f));
    const nv = Math.max(0, (Number.isInteger(cur) ? cur : 0) + Number(b.dataset.d));
    setPath(d.input, b.dataset.f, String(nv));
    b.parentElement.querySelector('input').value = String(nv);
    onInputChanged();
  },
  enter: () => go({ name: 'entry', matchId: S.view.matchId }),
  preview: () => {
    const ctx = entryCtx();
    let r = computeHand(ctx.m, ctx.handNo, ctx.d.input);
    if (ctx.m.game === 'king' && !ctx.edit) {
      const err = kingChoiceError(ctx.m.hands.map((h) => ({ contract: h.input.contract, suit: h.input.suit })), ctx.m.config.firstChooser, ctx.d.input.contract, ctx.d.input.suit);
      if (err) r = { ok: false, errors: [err] };
    }
    ctx.d.preview = { ok: r.ok, errors: r.errors, scores: r.scores, breakdown: r.breakdown };
    ctx.d.previewKey = JSON.stringify(ctx.d.input);
    ui.error = null;
    persist(); render();
    const pv = document.getElementById('preview'); if (pv) pv.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  },
  save: (b) => {
    b.disabled = true;
    const ctx = entryCtx();
    if (!(ctx.d.preview && ctx.d.preview.ok && ctx.d.previewKey === JSON.stringify(ctx.d.input))) { ui.error = 'Önce önizle.'; return render(); }
    const res = appendHand(ctx.m, ctx.d.draftId, ctx.d.input);
    if (res.error) { ui.error = res.error; return render(); }
    S.matches[ctx.m.id] = res.match;
    const unit = ctx.m.game === 'king' ? 'Kontrat' : 'El';
    ui.toast = `${unit} ${ctx.handNo} kaydedildi.`;
    go({ name: res.match.status === 'done' ? 'end' : 'play', matchId: ctx.m.id });
    setTimeout(() => { ui.toast = null; const el = document.querySelector('.toast'); if (el) el.remove(); }, 2600);
  },
  saveEdit: async () => {
    const ctx = entryCtx();
    if (!(ctx.d.preview && ctx.d.preview.ok && ctx.d.previewKey === JSON.stringify(ctx.d.input))) { ui.error = 'Önce önizle.'; return render(); }
    const ok = await confirmBox(`${ctx.m.game === 'king' ? 'Kontrat' : 'El'} ${ctx.handNo} sonucu değiştirilsin mi? Toplamlar yeniden hesaplanır.`, 'Düzelt');
    if (!ok) return;
    const res = replaceHand(ctx.m, ctx.index, ctx.d.input);
    if (res.error) { ui.error = res.error; return render(); }
    S.matches[ctx.m.id] = res.match; S.edit = null;
    go({ name: 'score', matchId: ctx.m.id });
    toast('Düzeltme kaydedildi, toplamlar güncellendi.');
  },
  score: () => go({ name: 'score', matchId: S.view.matchId, from: { ...S.view } }),
  toPlay: () => go({ name: 'play', matchId: S.view.matchId }),
  toEnd: () => go({ name: 'end', matchId: S.view.matchId }),
  row: (b) => { const i = +b.dataset.i; ui.openRow = ui.openRow === i ? null : i; render(); },
  edit: (b) => {
    const m = S.matches[S.view.matchId]; const i = +b.dataset.i;
    S.edit = { matchId: m.id, index: i, input: clone(m.hands[i].input), preview: null, previewKey: null };
    go({ name: 'entry', matchId: m.id, editIndex: i });
  },
  undo: async () => {
    const m = S.matches[S.view.matchId];
    const last = m.hands[m.hands.length - 1];
    if (!last) return;
    const ok = await confirmBox(`Son kayıt (${m.game === 'king' ? 'Kontrat' : 'El'} ${last.no} · ${esc(last.label)}) silinsin mi?`, 'Geri al', true);
    if (!ok) return;
    const res = undoLast(m);
    S.matches[m.id] = res.match;
    // Geri alınan maç yeniden aktif maç olur
    if (S.active[m.game] === m.id || !S.active[m.game] || S.matches[S.active[m.game]]?.status === 'done') S.active[m.game] = m.id;
    persist();
    if (S.view.name === 'end') go({ name: 'score', matchId: m.id });
    else render();
    toast('Son kayıt geri alındı.');
  },
};

app.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  if (b.tagName === 'INPUT' && b.type === 'checkbox') { ACTIONS[b.dataset.act]?.(b); return; }
  e.preventDefault();
  ACTIONS[b.dataset.act]?.(b);
});

history.replaceState({ v: 1 }, '');
if (S.view.name !== 'home') history.pushState({ v: 1 }, '');
render();
