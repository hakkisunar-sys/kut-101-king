// Kural verileri: yalnızca veri, hesap yok.

export const TILE_COLORS = {
  K: { name: 'Kırmızı', short: 'K' },
  M: { name: 'Mavi', short: 'M' },
  S: { name: 'Siyah', short: 'S' },
  Y: { name: 'Sarı', short: 'Y' },
};

const t = (c, n) => ({ c, n });
const run = (c, from, to) => Array.from({ length: to - from + 1 }, (_, i) => t(c, from + i));
const set = (n, colors) => colors.split('').map((c) => t(c, n));

// ---------------------------------------------------------------- KÜT OKEY
export const KUT_HANDS = [
  { no: 1, req: '1 üçlü küt', groups: [set(3, 'KMS')], text: 'Kırmızı 3 + mavi 3 + siyah 3' },
  { no: 2, req: '1 üçlü seri', groups: [run('M', 1, 3)], text: 'Mavi 1–2–3' },
  { no: 3, req: '2 üçlü küt', groups: [set(3, 'KMS'), set(8, 'KMY')], text: 'Üç farklı renkte 3’ler + üç farklı renkte 8’ler' },
  { no: 4, req: '2 üçlü seri', groups: [run('M', 1, 3), run('M', 6, 8)], text: 'Mavi 1–2–3 ve mavi 6–7–8' },
  { no: 5, req: '1 üçlü seri + 1 üçlü küt', groups: [run('M', 6, 8), set(3, 'KMS')], text: 'Mavi 6–7–8 ve üç farklı renkte 3’ler' },
  { no: 6, req: '1 dörtlü küt', groups: [set(7, 'KMSY')], text: 'Dört farklı renkte 7’ler' },
  { no: 7, req: '1 dörtlü seri', groups: [run('M', 1, 4)], text: 'Mavi 1–2–3–4' },
  { no: 8, req: '1 dörtlü küt + 1 dörtlü seri', groups: [set(7, 'KMSY'), run('M', 6, 9)], text: 'Dört farklı renkte 7’ler ve mavi 6–7–8–9' },
  { no: 9, req: '1 beşli seri', groups: [run('M', 7, 11)], text: 'Mavi 7–8–9–10–11' },
  {
    no: 10, req: '4 çift', tag: 'cezasız',
    groups: [[t('K', 5), t('K', 5)], [t('M', 8), t('M', 8)], [t('S', 2), t('S', 2)], [t('Y', 11), t('Y', 11)]],
    text: 'İki kırmızı 5, iki mavi 8, iki siyah 2 ve iki sarı 11',
  },
  { no: 11, req: '2 dörtlü küt', groups: [set(7, 'KMSY'), set(8, 'KMSY')], text: 'Dört farklı renkte 7’ler + dört farklı renkte 8’ler' },
  { no: 12, req: '2 dörtlü seri', groups: [run('M', 1, 4), run('M', 6, 9)], text: 'Mavi 1–2–3–4 ve mavi 6–7–8–9' },
  {
    no: 13, req: 'Düz okey', tag: 'düz okey', straight: true, groups: [],
    text: 'Ara açış adımı yok. 14 taşı geçerli dizilime getirip 15. taşı bırakarak bitir.',
  },
];

// Masa sahibinin onayladığı puan tarifesi (ilk teklif). Maç başında maça kopyalanır.
export const KUT_DEFAULT_TABLE = {
  notOpenedPenalty: 100, // Açamayan sabit ceza
  okeyMultiplier: 2, // Okeyle bitişte rakiplerin puan çarpanı
  finisherScore: 0, // Bitirenin taban puanı
  manualHands: [10, 13], // Bu eller her zaman serbest puan girişiyle
};

// ---------------------------------------------------------------- 101 OKEY
export const OKEY101_FINISHES = [
  { id: 'normal', label: 'Normal bitiş', winner: -101, notOpened: 202, mult: 1 },
  { id: 'okey', label: 'Okeyle bitiş', winner: -202, notOpened: 404, mult: 2 },
  { id: 'cift', label: 'Çiftle bitiş', winner: -202, notOpened: 404, mult: 2 },
  { id: 'cift_okey', label: 'Çift + okey', winner: -404, notOpened: 808, mult: 4 },
  { id: 'elden', label: 'Elden', winner: -202, fixed: 404 },
  { id: 'elden_okey', label: 'Elden + okey', winner: -404, fixed: 808 },
  { id: 'deste', label: 'Deste bitti', winner: null, notOpened: 202, mult: 1 },
];

export const OKEY101_EVENTS = [
  'İşlek taş atma',
  'Bitiş harici okey atma',
  'Açtığını geri toplama',
  'İşlediği okeyi rakibin alması',
];

// ---------------------------------------------------------------- KING
export const KING_CONTRACTS = {
  el: { id: 'el', goal: 'Hiç el almamaya çalış. Alınan her el −50.', name: 'El Almaz', kind: 'ceza', unit: -50, total: 13, input: 'count', what: 'Aldığı el' },
  kupa: { id: 'kupa', goal: 'Kupa kartı almamaya çalış. Her kupa −30.', name: 'Kupa Almaz', kind: 'ceza', unit: -30, total: 13, input: 'count', what: 'Aldığı kupa kartı' },
  erkek: { id: 'erkek', goal: 'Papaz ve vale almamaya çalış. Her biri −60.', name: 'Erkek Almaz', kind: 'ceza', unit: -60, total: 8, input: 'count', what: 'Aldığı papaz ve vale' },
  kiz: { id: 'kiz', goal: 'Kız (dam) almamaya çalış. Her biri −100.', name: 'Kız Almaz', kind: 'ceza', unit: -100, total: 4, input: 'count', what: 'Aldığı kız (dam)' },
  rifki: { id: 'rifki', goal: 'Kupa papazını alma. Alan −320.', name: 'Rıfkı', kind: 'ceza', unit: -320, total: 1, input: 'one', what: 'Kupa papazını alan' },
  soniki: { id: 'soniki', goal: 'Son iki eli (12. ve 13.) alma. Her biri −180.', name: 'Son İki', kind: 'ceza', unit: -180, total: 2, input: 'two', what: '12. ve 13. eli alan' },
  koz: { id: 'koz', goal: 'Olabildiğince çok el al. Her el +50.', name: 'Koz', kind: 'koz', unit: 50, total: 13, input: 'count', what: 'Aldığı el' },
};

export const KING_CEZA_IDS = ['el', 'kupa', 'erkek', 'kiz', 'rifki', 'soniki'];
export const KING_SUITS = [
  { id: 'maca', name: 'Maça', sym: '♠' },
  { id: 'kupa', name: 'Kupa', sym: '♥' },
  { id: 'karo', name: 'Karo', sym: '♦' },
  { id: 'sinek', name: 'Sinek', sym: '♣' },
];

export const KING_LIMITS = {
  contracts: 20,
  cezaPerPlayer: 3,
  kozPerPlayer: 2,
  perCezaType: 2,
  kozTotal: 8,
};

export const GAMES = {
  kut: { id: 'kut', name: 'Küt Okey', sub: '13 el · ceza puanı, düşük kazanır' },
  okey101: { id: 'okey101', name: '101 Okey', sub: 'Katlamasız · bireysel veya eşli · düşük kazanır' },
  king: { id: 'king', name: 'King', sub: '20 kontrat · yüksek kazanır' },
};
