"""Tarayıcıda uçtan uca kabul testi.
Kullanım: python3 -m http.server 8080 & ; python3 test/e2e.py [http://localhost:8080/] [ekran_görüntüsü_klasörü]
"""
import sys, os, re
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8080/'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else None
errors = []
results = []


def check(name, cond):
    results.append((name, bool(cond)))
    print(('✓ ' if cond else '✗ ') + name)


def shot(page, name):
    if SHOTS:
        os.makedirs(SHOTS, exist_ok=True)
        page.screenshot(path=f'{SHOTS}/{name}.png', full_page=True)


def act(page, a, **kw):
    sel = f'[data-act="{a}"]' + ''.join(f'[data-{k}="{v}"]' for k, v in kw.items())
    page.locator(sel).first.click()


def chip(page, text, nth=0):
    page.locator('.chip', has_text=re.compile('^(✓)?' + re.escape(text) + '$')).nth(nth).click()


def setup(page, game, names=('Ali', 'Ayşe', 'Can', 'Deniz')):
    act(page, 'new', game=game)
    for i, n in enumerate(names):
        page.fill(f'[data-sf="names.{i}"]', n)


def fill(page, f, v):
    page.fill(f'input[data-f="{f}"]', str(v))


def preview_save(page):
    act(page, 'preview')
    page.locator('#saveBtn:not([disabled])').click()


def totals(page):
    return [t.inner_text().replace('−', '-').replace('+', '') for t in page.locator('.strip .tcell .pts').all()]


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='tr-TR')
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(URL)
    page.evaluate('localStorage.clear()')
    page.reload()

    # 1 · Ana ekran
    check('Ana ekranda üç oyun kartı', page.locator('.card.game').count() == 3)
    shot(page, '01-ana-ekran')
    for g in ('kut', 'okey101', 'king'):
        act(page, 'rules', game=g)
        check(f'{g} kuralları açılıyor', page.locator('.rules .card').count() >= 4)
        if g == 'kut':
            check('Kurallarda 13 el listesi', page.locator('.hands li').count() == 13)
            shot(page, '02-kut-kurallar')
        act(page, 'back')

    # 2 · Küt elle skor
    setup(page, 'kut')
    shot(page, '03-kut-kurulum')
    act(page, 'startMatch')
    check('Küt 1. el şartı', '1 üçlü küt' in page.inner_text('.req'))
    shot(page, '04-kut-aktif-el')
    act(page, 'enter')
    chip(page, 'Ali')
    fill(page, 'scores.0', '0'); fill(page, 'scores.1', '45'); fill(page, 'scores.2', '')
    act(page, 'preview')
    check('Boş alan kaydedilmez', page.locator('#saveBtn[disabled]').count() == 1 and 'boş' in page.inner_text('#preview'))
    fill(page, 'scores.2', '12'); fill(page, 'scores.3', '7')
    page.locator('[data-act="neg"][data-f="scores.3"]').click()
    act(page, 'preview')
    shot(page, '05-kut-onizleme')
    page.locator('#saveBtn:not([disabled])').click()
    check('Negatif/sıfır/pozitif toplam', totals(page) == ['0', '45', '12', '-7'])
    # Taslak yenilemede korunur, iki kez yazılmaz
    act(page, 'enter'); chip(page, 'Ayşe'); fill(page, 'scores.0', '33')
    page.reload()
    check('Yenileme sonrası taslak geri geldi', page.input_value('input[data-f="scores.0"]') == '33')
    act(page, 'back')
    check('Yenileme puanı iki kez yazmadı', totals(page) == ['0', '45', '12', '-7'])
    for i in range(2, 14):
        hand_txt = page.inner_text('.req')
        if i == 10:
            check('10. elde "cezasız" etiketi', 'cezasız' in hand_txt and '4 çift' in hand_txt)
            shot(page, '06-kut-el10')
        if i == 13:
            check('13. el düz okey, açma şartı yok', 'Düz okey' in hand_txt and 'Açma şartı' not in hand_txt)
            shot(page, '07-kut-el13')
        act(page, 'enter')
        chip(page, 'Kimse bitirmedi')
        for k in range(4):
            fill(page, f'scores.{k}', k)
        preview_save(page)
    check('13 el sonunda maç sonu', page.locator('.podium').count() == 1)
    shot(page, '08-kut-mac-sonu')
    act(page, 'home')
    check('Tamamlanan Küt için Devam et yok', page.locator('[data-act="resume"][data-game="kut"]').count() == 0)

    # 3 · Küt otomatik: onaysız kapalı
    setup(page, 'kut')
    chip(page, 'Masa ayarıyla')
    check('Otomatik mod onaysız başlatılamaz', page.locator('[data-act="startMatch"][disabled]').count() == 1)
    page.locator('label.check input').check()
    act(page, 'startMatch')
    act(page, 'enter')
    chip(page, 'Okeyle (×2)')
    chip(page, 'Can')
    page.locator('.pblock').nth(0).locator('.chip', has_text='Açtı').click()
    page.locator('.pblock').nth(1).locator('.chip', has_text='Açtı').click()
    page.locator('.pblock').nth(2).locator('.chip', has_text='Açamadı').click()
    fill(page, 'players.0.T', '12'); fill(page, 'players.1.T', '5')
    act(page, 'preview')
    shot(page, '09-kut-otomatik')
    page.locator('#saveBtn:not([disabled])').click()
    check('Küt okeyle ×2: 24, 10, 0, 200', totals(page) == ['24', '10', '0', '200'])
    act(page, 'back')

    # 4 · 101
    setup(page, 'okey101')
    chip(page, '3')
    act(page, 'startMatch')
    act(page, 'enter')
    chip(page, 'Çift + okey')
    chip(page, 'Ali')
    blocks = page.locator('.pblock')
    blocks.nth(1).locator('.chip', has_text='Çift açtı').click()
    fill(page, 'players.1.T', '10')
    page.locator('[data-act="step"][data-f="players.1.okeys"][data-d="1"]').click()
    page.locator('.pblock').nth(2).locator('.chip', has_text='Seri açtı').click()
    fill(page, 'players.2.T', '10')
    page.locator('.pblock').nth(3).locator('.chip', has_text='Açmadı').click()
    act(page, 'preview')
    pv = page.inner_text('#preview').replace('−', '-')
    check('101 çift+okey, T=10, 1 okey → 181', '+181' in pv and '-404' in pv and '+808' in pv)
    shot(page, '10-101-onizleme')
    page.locator('#saveBtn:not([disabled])').click()
    act(page, 'enter')
    chip(page, 'Deste bitti')
    check('Deste bitti: bitiren alanı kapalı', page.locator('h3', has_text='Bitiren').count() == 0)
    for i in range(4):
        page.locator('.pblock').nth(i).locator('.chip', has_text='Açmadı').click()
    preview_save(page)
    check('101 deste: herkes +202', totals(page) == ['-202', '383', '242', '1010'])
    act(page, 'enter')
    chip(page, 'Elden')
    chip(page, 'Deniz')
    check('Elden: rakip açma alanı yok', page.locator('.chip', has_text='Seri açtı').count() == 0)
    preview_save(page)
    check('101 3 el sonunda maç sonu', page.locator('.podium').count() == 1)
    shot(page, '11-101-mac-sonu')
    # Geçmiş düzeltme
    page.locator('.hrow').nth(1).click()
    act(page, 'edit', i='1')
    page.locator('.pblock').nth(0).locator('.chip', has_text='Seri açtı').click()
    fill(page, 'players.0.T', '3')
    act(page, 'preview')
    page.locator('#saveBtn:not([disabled])').click()
    page.locator('.modal [data-r="1"]').click()
    check('Düzeltme toplamı değiştirdi', totals(page)[0] == '3')
    act(page, 'back')

    # 4b · Eşli 101
    setup(page, 'okey101')
    chip(page, 'Eşli')
    chip(page, '3')
    check('Eşli kurulumda takım açıklaması', '1 ile 3' in page.inner_text('main') and 'Ali & Can' in page.inner_text('#profileSummary'))
    shot(page, '15-esli-kurulum')
    act(page, 'startMatch')
    check('Eşli aktif elde takım toplamları', page.locator('.teams .tcell').count() == 2)
    act(page, 'enter')
    chip(page, 'Normal bitiş')
    chip(page, 'Ayşe')
    check('Bitirenin eşi "eşi bitirdi"', 'eşi bitirdi' in page.locator('.pblock', has_text='Deniz').text_content())
    page.locator('.pblock', has_text='Ali').locator('.chip', has_text='Seri açtı').click()
    fill(page, 'players.0.T', '17')
    page.locator('.pblock', has_text='Can').locator('.chip', has_text='Çift açtı').click()
    fill(page, 'players.2.T', '8')
    act(page, 'preview')
    shot(page, '16-esli-onizleme')
    page.locator('#saveBtn:not([disabled])').click()
    check('Eşli: oyuncu puanları 17, −101, 16, 0', totals(page) == ['17', '-101', '16', '0'])
    team = [t.inner_text().replace('−', '-').replace('+', '') for t in page.locator('.teams .pts').all()]
    check('Eşli: takım toplamları 33 ve −101', team == ['33', '-101'])
    for _ in range(2):
        act(page, 'enter')
        chip(page, 'Elden')
        chip(page, 'Ali')
        preview_save(page)
    check('Eşli maç sonu takım sıralaması', 'Kazanan: Ali & Can' in page.inner_text('.podium'))
    shot(page, '17-esli-mac-sonu')
    act(page, 'home')

    # 5 · King
    setup(page, 'king')
    act(page, 'startMatch')
    shot(page, '12-king-aktif')
    plan = (['el', 'kupa', 'erkek', 'kiz'] * 1 + ['rifki', 'soniki', 'el', 'kupa'] + ['erkek', 'kiz', 'rifki', 'soniki'] + ['koz'] * 8)
    names = {'el': 'El Almaz', 'kupa': 'Kupa Almaz', 'erkek': 'Erkek Almaz', 'kiz': 'Kız Almaz', 'rifki': 'Rıfkı', 'soniki': 'Son İki', 'koz': 'Koz'}
    counts = {'el': [4, 3, 3, 3], 'kupa': [0, 13, 0, 0], 'erkek': [2, 2, 2, 2], 'kiz': [1, 0, 1, 2], 'koz': [6, 4, 2, 1]}
    for idx, c in enumerate(plan):
        chip(page, names[c])
        if c == 'koz':
            page.locator('.chip', has_text='Maça').click()
        act(page, 'enter')
        if c in counts:
            if idx == 0:
                for k, v in enumerate([4, 3, 3, 2]):
                    fill(page, f'counts.{k}', v)
                act(page, 'preview')
                check('King: hatalı birim toplamı reddedilir', 'Toplam 13 olmalı' in page.inner_text('#preview'))
                shot(page, '13-king-hatali-toplam')
            for k, v in enumerate(counts[c]):
                fill(page, f'counts.{k}', v)
        elif c == 'rifki':
            chip(page, 'Can')
        else:
            page.locator('.chip', has_text='Deniz').nth(0).click()
            page.locator('.chip', has_text='Deniz').nth(1).click()
        preview_save(page)
        if idx == 7:
            check('King: üçüncü Kupa Almaz kapalı', page.locator('.chip:disabled', has_text='Kupa Almaz').count() == 1)
    check('King 20 kontrat sonunda maç sonu', page.locator('.podium').count() == 1)
    tot = [int(t.inner_text().replace('−', '-').replace('+', '')) for t in page.locator('.rank .pts').all()]
    check('King dört oyuncu toplamı 0', sum(tot) == 0)
    shot(page, '14-king-mac-sonu')

    # 6 · Geri alma ve geçmiş korunumu
    act(page, 'undo')
    page.locator('.modal [data-r="1"]').click()
    check('Geri alma onay sonrası 19 kontrat', '19/20' in page.inner_text('.bar'))
    act(page, 'back')
    act(page, 'back')
    page.reload()
    check('Diğer oyunların geçmişi duruyor', page.locator('[data-act="historyList"]').count() == 3)
    act(page, 'historyList', game='kut')
    check('Küt geçmişinde 2 maç', page.locator('.listrow').count() == 2)

    check('Konsol hatası yok', not errors)
    if errors:
        print('\n'.join(errors[:10]))
    b.close()

failed = [n for n, ok in results if not ok]
print(f'\n{len(results) - len(failed)}/{len(results)} kontrol geçti')
sys.exit(1 if failed else 0)
