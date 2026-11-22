// "Kuralları gör" ekranlarının içerikleri. Yalnızca metin ve veri; HTML üretimi app.js'te.

export const GUIDES = {
  kut: [
    {
      title: 'Taş dili',
      items: [
        '<b>Küt</b>: aynı sayının farklı renkleri. Örn. kırmızı 7, mavi 7, siyah 7 üçlü küttür.',
        '<b>Seri</b>: aynı renkte ardışık sayılar. Örn. mavi 6–7–8.',
        '<b>Çift</b>: sayısı ve rengi aynı iki taş. Örn. iki kırmızı 5.',
        'İki serili ellerde (4. ve 12. el) her seri kendi içinde tek renktir; iki serinin birbiriyle aynı renkte olması gerekmez.',
      ],
    },
    { title: '13 el', handsTable: true },
    {
      title: 'Bir elin akışı (1–12. eller)',
      items: [
        'Sıra sende: bir taş çek, bir taş at. Tur saat yönünün tersine dolaşır (masanızdaki yön geçerli).',
        'Elin açma şartını tamamlayınca perlerini masaya aç.',
        'Açtıktan sonra masadaki perlere taş işleyebilirsin.',
        'Elindeki son taşı atarak biten oyuncu eli bitirir.',
        'Deste biterse ve kimse bitiremezse el “deste bitti” olarak kapanır.',
      ],
    },
    {
      title: '13. el · Düz okey',
      items: [
        'Ara açış adımı yoktur; açma şartı alanları gösterilmez.',
        '14 taşı geçerli dizilime getirip 15. taşı bırakarak bitirilir.',
        'Puanı serbest giriş ekranından herkes kendi yazar.',
      ],
    },
    {
      title: 'Masaya göre değişenler',
      items: [
        'Taş dağıtımı, gösterge ve joker, yandan taş alma ve işleme ayrıntıları masaya göre değişir. Uygulama bunları dayatmaz; masanızın kuralı geçerlidir.',
      ],
    },
    { title: 'Puan', kutScoring: true },
  ],

  okey101: [
    {
      title: 'Dağıtım',
      items: [
        '4 oyuncu, 106 taş. Başlayan oyuncu 22, diğerleri 21 taş alır.',
        'Gösterge taşının aynı renkte bir sonraki sayısı gerçek okeydir. 13’ten sonra 1 gelir.',
        'Sahte okey, gerçek okeyin yerini tutan taştır.',
      ],
    },
    {
      title: 'Oynanış ve açılış',
      items: [
        'Sırada kapalı desteden çekilir veya koşul uygunsa önceki oyuncunun attığı taş alınır. Tur bir taş atarak kapanır.',
        'Tek seferde en az <b>101</b> değerinde geçerli perle veya en az <b>5 çift</b>le açılır.',
        'Örnek seri açılış: kırmızı 10–11–12–13 (46) + mavi, siyah, sarı 13 (39) + mavi 7–8–9 (24) = <b>109</b>.',
        'Örnek çift açılış: iki kırmızı 4, iki mavi 9, iki siyah 1, iki sarı 12, iki kırmızı 7.',
      ],
    },
    {
      title: 'İşleme',
      items: [
        'Açan oyuncu masadaki uygun perlere taş işleyebilir.',
        'Bu profilde çift açan oyuncu seri açamaz.',
      ],
    },
    {
      title: 'Bitiş türleri',
      items: [
        'Son taş atılarak bitilir. Düşük toplam kazanır.',
        '<b>Elden</b>: bitiren ilk açışını ve bitişini aynı turda yapar, öncesinde kimse açmamıştır.',
        '<b>Deste bitti</b>: kimse bitiremez, bitiren kaydı oluşmaz.',
      ],
    },
    { title: 'Ceza tablosu', okeyTable: true },
    {
      title: 'Eşli oyun',
      items: [
        'Karşılıklı oturan iki oyuncu eştir: 1 ile 3 bir takım, 2 ile 4 bir takım.',
        'Her oyuncu kendi elini ayrı açar; eşinin açması seni açmış saymaz.',
        'Biri bitirince kendi bitiş puanını alır (örn. normal bitişte −101), <b>eşi 0 yazar</b>; eşi açmamış olsa bile ceza almaz.',
        'Rakip takımın iki oyuncusu tabloya göre ayrı ayrı hesaplanır.',
        'Cezalı masada ceza olayları eşe de yazılır.',
        'Maç sonunda eşlerin puanları toplanır; takım toplamı düşük olan kazanır.',
      ],
    },
    {
      title: 'Cezalı masa',
      items: [
        'Seri veya çift açan rakibin T üzerinden çıkan puanına, elde kalan her gerçek okey için çarpandan sonra <b>+101</b> eklenir. Sabit hücreler değişmez.',
        'İşlek taş atma, bitiş harici okey atma, açtığını geri toplama, işlediği okeyi rakibin alması: her olay <b>+101</b>, çarpılmaz, en sonda eklenir.',
        'Cezasız masada bu ekler uygulanmaz.',
      ],
    },
  ],

  king: [
    {
      title: 'Hazırlık',
      items: [
        'Standart 52 kart, jokersiz. Oyuncu başına 13 kart.',
        'Maç <b>20 kontrat</b> sürer. Her kontrat 13 kart elinden (löve) oluşur.',
        'Puanı yüksek olan kazanır. Tam maçta dört oyuncunun toplamı 0 olur.',
      ],
    },
    {
      title: 'Kontrat seçimi',
      items: [
        'Kontrat seçimi sırayla dolaşır; ilk seçici maç kurulumunda belirlenir.',
        'Her oyuncu <b>3 ceza</b> ve <b>2 koz</b> seçer.',
        'Her ceza türü maçta toplam 2 kez, koz toplam 8 kez oynanır.',
        'Koz seçilirse maça, kupa, karo veya sinek söylenir.',
      ],
    },
    {
      title: 'Oynanış',
      items: [
        'Oyuncular çıkılan renge uyar.',
        'Koz kontratında çıkılan renk yoksa ve elde koz varsa koz oynanır. Koz atılmışsa ve daha büyük koz atılabiliyorsa yükseltilir.',
        'Eli en yüksek koz, koz yoksa çıkılan rengin en yüksek kartı alır. Alan oyuncu sonraki eli açar.',
        'Ceza kontratlarında amaç ilgili kartı veya eli almamaktır.',
      ],
    },
    { title: 'Kontratlar ve puanlar', kingTable: true },
  ],
};
