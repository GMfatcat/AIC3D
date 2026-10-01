"""P4 — narrative and flow: landing page, autoplay, cross-scene links, prev/next, tour bar, visited marks, copy."""
import pathlib
import re

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCENE_FILES = sorted(p for p in (ROOT / "scenes").glob("*.js") if p.name != "_catalog.js")
VISIBLE_LABEL_RECTS = """
  [...document.querySelectorAll('#labels .l3d')].filter(e => e.style.display !== 'none' && e.textContent.trim() && !e.classList.contains('occluded')).map(e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })
"""


def _overlaps(a, b):
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])


# ---------- landing ----------

@pytest.fixture
def fresh(browser, dist_url):
    from conftest import Site
    ctx = browser.new_context(viewport={"width": 1400, "height": 860})
    page = ctx.new_page()
    s = Site(page)
    page.goto(dist_url)
    page.wait_for_function("window.App && !App.routing")
    page.wait_for_timeout(600)
    yield s
    ctx.close()


def test_landing_shows_when_there_is_no_hash(fresh):
    assert fresh.ev("getComputedStyle(document.getElementById('landing')).display") != "none"
    assert fresh.ev("document.querySelectorAll('#landing .tour-card').length") == 6
    assert fresh.ev("document.querySelectorAll('#landing .role-chip').length") == 8
    assert fresh.ev("!!document.querySelector('#landing a[href=\"#cnn\"]')"), "needs a 'browse all scenes' link"
    assert fresh.ev("App.root.children.length") > 0, "landing should have a floating 3D composition behind it"
    assert fresh.ev("document.getElementById('ctrl').childElementCount") == 0
    fresh.assert_clean()


def test_landing_tour_card_starts_the_tour(fresh):
    fresh.page.locator("#landing .tour-card").first.click()
    fresh.page.wait_for_function("!App.routing && App.currentItem && App.currentItem.id === 'residual'")
    assert fresh.ev("location.hash") == "#tour=arch2026&step=1"
    assert fresh.ev("getComputedStyle(document.getElementById('landing')).display") == "none"


def test_brand_links_back_home(site):
    site.goto("residual")
    site.page.locator("#top .brand").click()
    site.page.wait_for_function("!App.routing && getComputedStyle(document.getElementById('landing')).display !== 'none'")
    assert site.ev("location.hash") in ("", "#home")


# ---------- autoplay ----------

def test_stepper_autoplays_once_and_stops_on_interaction(site):
    site.goto("cnn", settle=1400)
    assert "暫停" in site.ev("document.querySelector('#ctrl .btnrow .btn.primary').textContent"), "should be auto-playing after mount"
    site.set_slider("kernel 大小", 5)
    site.page.wait_for_timeout(100)
    assert "播放" in site.ev("document.querySelector('#ctrl .btnrow .btn.primary').textContent"), "touching a control must stop autoplay"


def test_reduced_motion_does_not_autoplay(browser, dist_url):
    from conftest import Site
    ctx = browser.new_context(viewport={"width": 1400, "height": 860}, reduced_motion="reduce")
    page = ctx.new_page(); s = Site(page)
    page.goto(dist_url); page.wait_for_function("window.App && !App.routing")
    s.goto("cnn", settle=1400)
    txt = s.ev("document.querySelector('#ctrl .btnrow .btn.primary').textContent")
    ctx.close()
    assert "播放" in txt


# ---------- links ----------

@pytest.mark.parametrize("path", SCENE_FILES, ids=lambda p: p.name)
def test_notes_link_scenes_instead_of_naming_tabs(path):
    src = path.read_text(encoding="utf-8")
    bad = re.findall(r"Tab [0-9]|基礎架構 Tab|Block Tab|下一個場景|規劃中|在左邊有", src)
    assert not bad, f"{path.name}: use <a href=\"#id\"> links, found {bad}"


def test_kvcache_note_links_to_the_scenes_it_mentions(site):
    site.goto("kvcache")
    hrefs = site.ev("[...document.querySelectorAll('#ctrl .note a')].map(a => a.getAttribute('href'))")
    assert "#kvheads" in hrefs and "#vllm" in hrefs


def test_panel_ends_with_prev_next_links(site):
    site.goto("residual")
    links = site.ev("[...document.querySelectorAll('#ctrl .scenenav a')].map(a => [a.getAttribute('href'), a.textContent])")
    assert [l[0] for l in links] == ["#attention", "#mhc"], links
    assert "Attention" in links[0][1] and "mHC" in links[1][1]
    assert site.ev("document.querySelector('#ctrl').lastElementChild.classList.contains('scenenav')")
    site.goto("cnn")
    assert site.ev("document.querySelector('#ctrl .scenenav a').getAttribute('href')") == "#subagent"


# ---------- tour bar ----------

def test_fit_keeps_labels_clear_of_the_tour_bar(site):
    site.goto("tour=kv&step=3", settle=1400)
    bar = site.ev("(() => { const r = document.getElementById('tourbar').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()")
    hits = [r for r in site.ev(VISIBLE_LABEL_RECTS) if _overlaps(r, bar)]
    assert not hits, f"{len(hits)} labels under the tour bar"


# ---------- visited ----------

def test_sidebar_marks_visited_scenes(site):
    site.goto("residual"); site.goto("mhc")
    visited = site.ev("[...document.querySelectorAll('#items li.visited a')].map(a => a.textContent)")
    assert "Residual Block" in visited and "mHC" in visited
    assert "Attention" not in visited


# ---------- copy ----------

def test_copy_fixes_in_scene_sources():
    crnn = (ROOT / "scenes/arch-cnn-crnn.js").read_text(encoding="utf-8")
    assert re.search(r"TEXT='[^']*3[^']*3[^']*'", crnn), "CRNN sample text should contain a repeated character so CTC merging is visible"
    assert "粗細 = 內容量" not in (ROOT / "scenes/block-attention.js").read_text(encoding="utf-8")
    assert "64 維" in (ROOT / "scenes/block-kvheads.js").read_text(encoding="utf-8"), "explain the 512 + 64 split"
    assert "給 27B bf16 綽綽有餘" not in (ROOT / "scenes/infra-stages.js").read_text(encoding="utf-8")
    assert "slice(1,7)+'…'" not in (ROOT / "scenes/model-minilm.js").read_text(encoding="utf-8")
    mhc = (ROOT / "scenes/block-mhc.js").read_text(encoding="utf-8")
    assert "行和" not in mhc and "行歸一化" not in mhc and "＝" not in mhc
    assert "欄 = 輸入通道" in (ROOT / "scenes/optimize-gguf-qat-imatrix.js").read_text(encoding="utf-8")
    assert "子代理（subagent）" in (ROOT / "scenes/agent-compact-subagent.js").read_text(encoding="utf-8")
    assert "'A (M×K)'" not in (ROOT / "scenes/infra-sglang-tiling.js").read_text(encoding="utf-8")
    assert "'P4 (16)'" not in (ROOT / "scenes/model-vision.js").read_text(encoding="utf-8")
