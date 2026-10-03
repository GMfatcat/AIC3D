"""P7 — glossary: terms inside the intro card / guide steps / howto card become links to a glossary page
(#term=<id>); the page's 回上一步 puts you back where you were, guide step and intro card included."""
import pytest

from conftest import Site

PRIMARY = "document.querySelector('#ctrl .btnrow .btn.primary').textContent"


@pytest.fixture
def raw(browser, dist_url):
    ctx = browser.new_context(viewport={"width": 1400, "height": 860})
    page = ctx.new_page()
    s = Site(page)
    page.goto(dist_url)
    page.wait_for_function("window.App && !App.routing")
    yield s
    ctx.close()


def _goto_scene(s, hash_, settle=300):
    s.page.evaluate("h => { location.hash = h; }", hash_)
    s.page.wait_for_function("h => App.currentItem && !App.routing && App.currentItem.id === h", arg=hash_)
    s.page.wait_for_timeout(settle)


def _goto_glossary(s, hash_):
    s.page.evaluate("h => { location.hash = h; }", hash_)
    s.page.wait_for_function("App.page === 'glossary' && !App.routing")
    s.page.wait_for_timeout(200)


# ---------- data ----------

def test_glossary_data_is_consistent(site):
    assert site.ev("App.glossary.terms.length") >= 40
    bad = site.ev("App.glossary.terms.filter(t => !t.id || !t.title || !t.short || !t.body || !t.tab || !(t.aka || []).length || !(t.see || []).length || t.see.some(id => !App.catalog.some(i => i.id === id))).map(t => t.id)")
    assert bad == [], bad
    ids = site.ev("App.glossary.terms.map(t => t.id)")
    assert len(ids) == len(set(ids))
    assert site.ev("App.glossary.terms.every(t => App.TABS.some(x => x.id === t.tab))")


# ---------- auto-linking ----------

def test_intro_card_links_terms_once_per_block(raw):
    _goto_scene(raw, "cnn")
    links = raw.ev("[...document.querySelectorAll('#intro a.term')].map(a => [a.textContent, a.getAttribute('href')])")
    assert ["感受野", "#term=receptive-field"] in links, links
    per_block = raw.ev("[...document.querySelectorAll('#intro .intro-dl dd')].map(dd => [...dd.querySelectorAll('a.term')].map(a => a.getAttribute('href')))")
    for block in per_block:
        assert len(block) == len(set(block)), f"a term is linked twice in one block: {block}"


def test_guide_and_howto_link_terms_but_readouts_do_not(site):
    site.goto("cnn")
    assert site.ev("document.querySelectorAll('#ctrl .howto a.term').length") >= 1
    assert site.ev("document.querySelectorAll('#ctrl .readouts a.term, #labels a.term').length") == 0
    site.ev("App.guide.start()")
    site.page.wait_for_timeout(200)
    assert site.ev("document.querySelectorAll('#guidebar .gb-say a.term').length") >= 1
    assert site.ev("[...document.querySelectorAll('#guidebar .gb-say a.term')].every(a => /^#term=[\\w-]+$/.test(a.getAttribute('href')))")


def test_ascii_aliases_only_match_whole_words(site):
    html = site.ev("App.termify('TPU 和 TP 不一樣；HBM3 不是 HBM；shared memory 是')")
    assert "TPU" in html and 'href="#term=tp-dp"' in html and ">TP</a>" in html and ">TPU</a>" not in html
    assert "HBM3" in html and html.count('href="#term=hbm"') == 1
    assert 'href="#term=shared-memory"' in html


# ---------- the page ----------

def test_term_page_shows_definition_related_scenes_and_the_full_list(raw):
    _goto_glossary(raw, "term=receptive-field")
    assert raw.ev("document.body.classList.contains('glossary')")
    assert raw.ev("getComputedStyle(document.getElementById('ctrl')).display") == "none"
    assert raw.ev("document.querySelector('#glossary .gl-term h2').textContent") == "感受野"
    assert raw.ev("!!document.querySelector('#glossary .gl-term .see a[href=\"#cnn\"]')"), "links to the scenes where the term shows up"
    assert raw.ev("document.querySelectorAll('#glossary .gl-list li').length") >= 40
    assert raw.ev("document.querySelectorAll('#glossary .gl-term a.term').length") >= 0  # related terms inside a body may link too
    assert not raw.ev("!!document.querySelector('#glossary .gl-term a.term[href=\"#term=receptive-field\"]')"), "a term does not link to itself"
    raw.page.fill("#glossary input[type=search]", "KV")
    raw.page.wait_for_timeout(100)
    shown = raw.ev("[...document.querySelectorAll('#glossary .gl-list li')].filter(li => li.style.display !== 'none').map(li => li.querySelector('b').textContent)")
    assert any("KV cache" in t for t in shown) and len(shown) < 20, shown


def test_glossary_index_is_reachable_from_the_top_bar_and_the_landing_page(site):
    site.goto("residual")
    site.page.locator("#top button", has_text="詞彙").click()
    site.page.wait_for_function("App.page === 'glossary' && !App.routing")
    assert site.ev("location.hash") == "#glossary"
    assert not site.ev("!!document.querySelector('#glossary .gl-term')"), "no term selected: just the list"
    site.goto("home")
    assert site.ev("!!document.querySelector('#landing a[href=\"#glossary\"]')")


# ---------- back ----------

def test_back_restores_the_scene_and_the_guide_step(site):
    site.goto("residual")
    site.ev("App.guide.start(); App.guide.go(2)")
    site.page.wait_for_timeout(300)
    site.page.locator("#guidebar a.term").first.click()
    site.page.wait_for_function("App.page === 'glossary' && !App.routing")
    site.page.locator("#glossary button", has_text="回上一步").click()
    site.page.wait_for_function("App.currentItem && App.currentItem.id === 'residual' && !App.routing")
    site.page.wait_for_timeout(400)
    assert site.ev("App.guide.active") and site.ev("App.guide.n") == 2
    assert not site.ev("App.intro.isOpen()")


def test_back_reopens_the_intro_card_without_starting_autoplay(raw):
    _goto_scene(raw, "cnn")
    raw.page.locator("#intro a.term", has_text="感受野").click()
    raw.page.wait_for_function("App.page === 'glossary' && !App.routing")
    raw.page.locator("#glossary button", has_text="回上一步").click()
    raw.page.wait_for_function("App.currentItem && App.currentItem.id === 'cnn' && !App.routing")
    raw.page.wait_for_timeout(1200)
    assert raw.ev("App.intro.isOpen()"), "the card the term was clicked from is back"
    assert "播放" in raw.ev(PRIMARY), "nothing autoplays behind the card"
    raw.ev("App.intro.enter('free')")
    raw.page.wait_for_timeout(1000)
    assert "暫停" in raw.ev(PRIMARY)


def test_back_without_a_return_point_goes_home(raw):
    _goto_glossary(raw, "term=moe")
    raw.page.locator("#glossary button", has_text="回上一步").click()
    raw.page.wait_for_function("!App.routing && App.home")


def test_landing_glossary_link_seen_count_and_reset_share_the_browse_button_background(raw):
    raw.page.evaluate("localStorage.setItem('visited', JSON.stringify(['cnn']))")
    raw.page.evaluate("location.hash='home'")
    raw.page.wait_for_function("!App.routing && App.home")
    raw.page.wait_for_timeout(200)
    raw.ev("App._landingFoot()")
    bg = raw.ev("sel => getComputedStyle(document.querySelector(sel)).backgroundColor", "#landing a.browse")
    assert bg not in ("rgba(0, 0, 0, 0)", "transparent")
    for sel in ("#landing a[href=\"#glossary\"]", "#landing .land-foot .seen", "#landing .land-foot button"):
        assert raw.ev("sel => getComputedStyle(document.querySelector(sel)).backgroundColor", sel) == bg, sel
        assert raw.ev("sel => getComputedStyle(document.querySelector(sel)).borderTopWidth", sel) != "0px", sel
