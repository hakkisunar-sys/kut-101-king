// Yerel kalıcılık. Tarayıcı deposu yoksa veya hata verirse bellekte çalışmaya devam eder.

const KEY = 'kut101king.v1';

export function freshState() {
  return {
    version: 1,
    matches: {},
    active: { kut: null, okey101: null, king: null },
    view: { name: 'home' },
    setup: null,
    edit: null,
    prefs: { names: ['', '', '', ''], kutTable: null },
  };
}

export function loadState() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return freshState();
    const s = JSON.parse(raw);
    if (!s || s.version !== 1) return freshState();
    return { ...freshState(), ...s };
  } catch {
    return freshState();
  }
}

export function saveState(s) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}
