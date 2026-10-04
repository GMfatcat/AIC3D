"""i18n — two languages, Traditional Chinese (source strings) and English, toggled from the top bar.
The choice is remembered in localStorage and applied on reload. Covered: UI chrome, tabs, scene titles / questions /
what-you-see / what-you-do, tour titles, the desk and its visitors. Scene panels and glossary entries are a later pass."""
import pathlib
import re

import pytest

from conftest import Site

ROOT = pathlib.Path(__file__).resolve().parents[1]
EN = (ROOT / "core" / "i18n-en.js").read_text(encoding="utf-8")
TAB_EN = ["Architectures", "Building blocks", "Full models", "Training", "Evaluation", "Compression & quantization", "Inference infra", "Agent"]


@pytest.fixture
def en(browser, dist_url):
    ctx = browser.new_context(viewport={"width": 1400, "height": 860})
    page = ctx.new_page()
    page.add_init_script("try { localStorage.setItem('lang', 'en'); } catch (e) {}")
    s = Site(page)
    page.goto(dist_url)
    page.wait_for_function("window.App && !App.routing && App.home && App.desk.ready")
    yield s
    ctx.close()


def test_default_is_chinese_with_a_toggle_in_the_top_bar(site):
    assert site.ev("I18N.lang") == "zh"
    assert site.ev("document.documentElement.lang") == "zh-Hant"
    assert site.ev("document.getElementById('langbtn').textContent") == "EN"
    assert site.ev("document.querySelector('#tabs button').textContent") == "基礎架構"


def test_toggle_reloads_into_english_and_back(site):
    site.goto("cnn")
    site.page.locator("#langbtn").click()
    site.page.wait_for_function("window.App && I18N && I18N.lang === 'en' && App.currentItem && App.currentItem.id === 'cnn'")
    assert site.ev("location.hash") == "#cnn", "the place is kept across the reload"
    assert site.ev("document.documentElement.lang") == "en"
    assert site.ev("document.getElementById('langbtn').textContent") == "中"
    site.page.locator("#langbtn").click()
    site.page.wait_for_function("window.App && I18N && I18N.lang === 'zh'")
    assert site.ev("document.querySelector('#tabs button').textContent") == "基礎架構"


def test_english_chrome_tabs_landing_and_scene_copy(en):
    assert en.ev("[...document.querySelectorAll('#tabs button')].map(b => b.textContent)") == TAB_EN
    assert en.ev("document.title") == "AI Concepts in 3D"
    assert "AI Concepts in 3D" in en.ev("document.querySelector('#top .brand').textContent")
    assert en.ev("document.querySelector('#landing h1').textContent") == "AI Concepts in 3D"
    assert "Browse all" in en.ev("document.querySelector('#landing a.browse').textContent")
    assert "Guided tours" in en.ev("document.querySelector('#landing a[href=\"#tab=tours\"]').textContent")
    assert en.ev("document.querySelectorAll('#landing .role-chip').length") == 8 and "signal" in en.ev("document.querySelector('#landing .role-chip').textContent")
    en.page.evaluate("location.hash = 'transformer'")
    en.page.wait_for_function("App.currentItem && App.currentItem.id === 'transformer' && !App.routing")
    assert en.ev("document.querySelector('#intro .intro-card h2').textContent") == "Transformer family"
    assert en.ev("document.querySelector('#intro .intro-dl dt').textContent") == "What this page shows"
    assert "Query tokens on top" in en.ev("document.querySelector('#intro .intro-dl dd').textContent")
    assert "Start the walkthrough" in en.ev("document.querySelector('#intro .intro-actions').textContent")
    en.ev("App.intro.enter('free')")
    assert en.ev("document.getElementById('i-title').textContent") == "Transformer family"
    assert en.ev("document.getElementById('i-q').textContent").startswith("How do the encoder")
    assert en.ev("[...document.querySelectorAll('#items a .t')].map(a => a.textContent)")[3] == "Transformer family"
    assert "Next →" in en.ev("document.querySelector('#ctrl .scenenav').textContent")
    en.page.evaluate("location.hash = 'cnn'")
    en.page.wait_for_function("App.currentItem && App.currentItem.id === 'cnn' && !App.routing")
    en.ev("App.intro.enter('free')")
    btns = en.ev("[...document.querySelectorAll('#ctrl .btn')].map(b => b.textContent).join('|')")
    assert "Step" in btns and ("Play" in btns or "Pause" in btns) and "Reset" in btns, btns
    assert "How to play" in en.ev("document.querySelector('#ctrl .howto h3').textContent")
    en.assert_clean()


def test_english_desk_tours_visitors_and_glossary_chrome(en):
    assert en.ev("Object.values(App.desk.fixtures).map(f => f.label.el.textContent)") == ["Guided tours", "Glossary", "About"]
    assert en.ev("App.TABS.map(t => App.desk.stations[t.id].label.el.textContent)") == TAB_EN
    en.page.evaluate("location.hash = 'tab=train'")
    en.page.wait_for_function("App.desk.focused === 'train' && App.desk.ready")
    bar = en.ev("document.getElementById('deskbar').textContent")
    assert "Training" in bar and "scenes" in bar and "Back to the desk" in bar
    assert en.ev("document.querySelector('#deskbar .dlist button .t').textContent") == "One training step"
    en.page.locator("#deskbar .dlist button").first.click()
    en.page.wait_for_function("App.desk.selected && App.desk.ready")
    assert "Open scene" in en.ev("document.querySelector('#deskbar .dcard a.enter').textContent")
    en.page.evaluate("location.hash = 'tab=tours'")
    en.page.wait_for_function("App.desk.focused === 'tours' && App.desk.ready")
    assert en.ev("document.querySelector('#deskbar .dlist button .t').textContent") == "Why 2026 models look like this"
    en.page.evaluate("location.hash = 'home'")
    en.page.wait_for_function("App.desk.focused === null && App.desk.ready")
    en.ev("App.desk.messenger.arrive('cls-metrics')")
    en.page.wait_for_function("App.desk.messenger.state === 'landed'")
    en.ev("App.desk.messenger.ask()")
    msg = en.ev("document.getElementById('messenger').textContent")
    assert "The messenger brought a question" in msg and "Why does precision go up" in msg and "Classification metrics" in msg
    en.ev("App.desk.messenger.leave()")
    en.page.evaluate("location.hash = 'glossary'")
    en.page.wait_for_function("App.page === 'glossary' && App.glossary.ready")
    assert en.ev("document.querySelector('#glossary input[type=search]').placeholder") == "Search terms…"
    assert en.ev("document.querySelector('#glossary .gl-list h3 button').textContent").strip().endswith("23") and "Architectures" in en.ev("document.querySelector('#glossary .gl-list h3 button').textContent")
    assert en.ev("document.querySelector('#glossary .gl-head h1').textContent") == "Glossary"
    assert "Pick a term" in en.ev("document.querySelector('#glossary .gl-empty p').textContent")


def test_every_catalog_string_and_tour_title_has_an_english_entry():
    src = (ROOT / "scenes" / "_catalog.js").read_text(encoding="utf-8")
    keys = set(re.findall(r"'((?:[^'\\]|\\.)*)':", EN))
    cjk = re.compile(r"[一-鿿]")
    missing = []
    for m in re.finditer(r"\{id:'([\w-]+)', tab:'\w+', title:'([^']*)', show:'([^']*)', interact:'([^']*)', question:'([^']*)'", src):
        for field in m.groups()[1:]:
            if cjk.search(field) and field not in keys:
                missing.append((m.group(1), field[:30]))
    tours = (ROOT / "core" / "tours.js").read_text(encoding="utf-8")
    for t in re.findall(r"\{ id:'\w+', title:'([^']*)'", tours):
        if t not in keys:
            missing.append(("tour", t))
    assert not missing, missing


def test_phone_top_bar_fits_with_the_language_button(phone_site):
    phone_site.goto("residual")
    widths = phone_site.ev("[document.documentElement.scrollWidth, document.getElementById('top').scrollWidth]")
    assert max(widths) <= 390, widths
    assert phone_site.ev("document.getElementById('langbtn').getBoundingClientRect().right") <= 390


# ---- glossary entries (second batch) ----
def _en_keys():
    txt = EN + (ROOT / "core" / "i18n-en-glossary.js").read_text(encoding="utf-8")
    return set(re.findall(r"'((?:[^'\\]|\\.)*)':", txt))


def test_every_glossary_term_has_english_title_short_and_body():
    src = (ROOT / "core" / "glossary.js").read_text(encoding="utf-8")
    keys = _en_keys()
    cjk = re.compile(r"[一-鿿]")
    missing = []
    terms = re.findall(r"\{id:'([\w-]+)', tab:'\w+', title:'([^']*)', aka:\[[^\]]*\], short:'([^']*)', body:'([^']*)'", src)
    assert len(terms) >= 120, len(terms)
    for tid, *fields in terms:
        for f in fields:
            if cjk.search(f) and f not in keys:
                missing.append((tid, f[:24]))
    assert not missing, missing


def test_english_glossary_term_toc_search_and_tooltips(en):
    en.page.evaluate("location.hash = 'term=kv-cache'")
    en.page.wait_for_function("App.page === 'glossary' && App.glossary.ready && document.querySelector('#glossary .gl-term')")
    assert en.ev("document.querySelector('#glossary .gl-term h2').textContent") == "KV cache"
    assert en.ev("document.querySelector('#glossary .gl-term .short').textContent").startswith("Store the K and V")
    body = en.ev("document.querySelector('#glossary .gl-term .body').textContent")
    assert "memory" in body and not re.search(r"[一-鿿]", body), body
    assert "Weights" not in en.ev("document.querySelector('#glossary .gl-term .see').textContent")
    tip = en.ev("document.querySelector('#glossary .gl-term .body a.term').title")
    assert not re.search(r"[一-鿿]", tip), tip
    assert en.ev("document.querySelector('#glossary .gl-list li.cur b').textContent") == "KV cache"
    cur_short = en.ev("document.querySelector('#glossary .gl-list li.cur span').textContent")
    assert not re.search(r"[一-鿿]", cur_short), cur_short
    en.page.evaluate("location.hash = 'term=receptive-field'")
    en.page.wait_for_function("document.querySelector('#glossary .gl-term h2') && document.querySelector('#glossary .gl-term h2').textContent === 'Receptive field'")
    aka = en.ev("(document.querySelector('#glossary .gl-term .aka') || {}).textContent || ''")
    assert not re.search(r"[一-鿿]", aka), aka
    en.page.fill("#glossary input[type=search]", "receptive")
    assert en.ev("[...document.querySelectorAll('#glossary .gl-list li')].filter(li => li.style.display !== 'none').map(li => li.querySelector('b').textContent)") == ["Receptive field"]
    assert en.ev("I18N.missing()") == []

