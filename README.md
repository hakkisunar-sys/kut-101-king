# Küt · 101 · King — Skor Defteri

Masada gerçek taşlarla ve kartlarla oynanan **Küt Okey**, **101 Okey** ve **King** için Türkçe kural rehberi ve dijital skor defteri. Uygulama o anki elin şartını veya kontratını gösterir, el sonucunu alır, puanı kuralıyla birlikte önizletir ve toplamı tutar. Tek telefonda çalışır. Hesap, sunucu ve internet bağlantısı gerektirmez; veriler o cihazın tarayıcısında saklanır.

**Uygulama:** https://hakkisunar-sys.github.io/kut-101-king/

## GitHub Pages'te yayınlama (bir kez yapılır)

1. Repo'da **Settings → Pages** bölümünü aç.
2. Source: **Deploy from a branch** · Branch: **main** · klasör **/(root)** → **Save**.
3. 1–2 dakika sonra uygulama yukarıdaki adreste açılır. Linki paylaştığın herkes telefonundan kullanabilir.

## Oyun profilleri

| Oyun | Profil |
|---|---|
| Küt Okey | 13 el. Elle skor her elde çalışır. **Masa ayarıyla** modu onaylanınca otomatik hesap yapar: bitiren 0, açamayan 100, açıp bitiremeyen elde kalan taş toplamı, okeyle bitişte rakipler ×2, deste bittiğinde çarpan yok. 10. el (*cezasız*) ve 13. el (*düz okey*) her zaman serbest puanla girilir. Düşük toplam kazanır. |
| 101 Okey | Katlamasız, bireysel. El sayısı maç başında seçilir. Normal, okeyle, çiftle, çift + okey, elden, elden + okey ve deste bitti sonuçları. Cezalı masada kalan her gerçek okey ve her ceza olayı +101. Düşük toplam kazanır. |
| King | 20 kontrat. Her oyuncu 3 ceza ve 2 koz seçer, her ceza türü 2 kez oynanır. Birim toplamı tutmayan kontrat kaydedilmez. Tam maçta toplam 0. Yüksek toplam kazanır. |

## Yerelde çalıştırma

```bash
python3 -m http.server 8080   # veya: npm start
# tarayıcıda http://localhost:8080/
```

## Testler

```bash
npm test                                   # puan motorları ve maç modeli (node:test)
python3 test/e2e.py http://localhost:8080/ # tarayıcıda uçtan uca kabul testi (Playwright)
```

## Yapı

```
index.html          giriş sayfası
src/rules.js        kural verileri (Küt elleri, 101 tablosu, King kontratları)
src/guides.js       "Kuralları gör" metinleri
src/engines.js      saf puan hesaplama fonksiyonları
src/model.js        maç modeli: el kaydı, geri alma, düzeltme
src/store.js        yerel kalıcılık (localStorage)
src/app.js          ekranlar ve etkileşim
src/style.css       mobil öncelikli tasarım
test/               birim ve uçtan uca testler
```

Her maç oyun tipini, oyuncuları, kural profilini, tarihi ve sıralı el kayıtlarını saklar. El kaydı ham girdiyi ve puan kırılımını tutar. Toplamlar her zaman kayıtlı ellerden yeniden hesaplanır.
