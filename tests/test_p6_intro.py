"""P6 — per-page flow: the intro card on first visit, a banner afterwards, enter prefs (play / spin),
the in-page guide (導讀) with spotlighted controls, and the two small fixes bundled with it (Jev labels, phone sidebar)."""
import pytest

from conftest import Site

PRIMARY = "document.querySelector('#ctrl .btnrow .btn.primary').textContent"
INTRO_OPEN = "App.intro.isOpen()"


def _overlaps(a, b):
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])


@pytest.fixture
def raw(browser, dist_url):
    """A page where nothing auto-dismisses the intro card (site.goto does)."""
    ctx = browser.new_context(viewport={"width": 1400, "height": 860})
    page = ctx.new_page()
    s = Site(page)
    page.goto(dist_url)
    page.wait_for_function("window.App && !App.routing")
    yield s
    ctx.close()


def _raw_goto(s, hash_, settle=300):
    s.page.evaluate("h => { location.hash = h; }", hash_)
    s.page.wait_for_function("h => App.currentItem && !App.routing && (h.startsWith('tour=') || App.currentItem.id === h)", arg=hash_)
    s.page.wait_for_timeout(settle)


# ---------- intro card ----------

def test_first_visit_opens_the_intro_card_over_a_blurred_page(raw):
    _raw_goto(raw, "residual")
    assert raw.ev(INTRO_OPEN)
    assert raw.ev("document.body.classList.contains('intro')")
    assert raw.ev("['top','side','stage','ctrl'].every(id => document.getElementById(id).inert)"), "the rest of the page is inert while the card is up"
    assert raw.ev("document.querySelector('#intro [role=dialog]').getAttribute('aria-modal')") == "true"
    txt = raw.ev("document.querySelector('#intro').textContent")
    assert "Residual Block" in txt and "旁路為什麼" in txt
    assert "這頁在看什麼" in txt and "你會動到什麼" in txt
    assert raw.ev("App.root.children.length") > 0, "the scene is mounted behind the card (teaser)"
    assert raw.ev("App.autoSpin"), "it spins behind the card"
    assert raw.ev("document.activeElement.closest('#intro') !== null"), "focus moves into the dialog"
    raw.assert_clean()


def test_card_shows_the_play_toggle_only_for_stepper_scenes(raw):
    _raw_goto(raw, "residual")
    assert raw.ev("document.querySelectorAll('#intro input[data-pref]').length") == 1
    assert raw.ev("!document.querySelector('#intro input[data-pref=play]')")
    raw.ev("App.intro.enter('free')")
    _raw_goto(raw, "cnn")
    assert raw.ev("document.querySelectorAll('#intro input[data-pref]').length") == 2
    assert raw.ev("document.querySelector('#intro input[data-pref=play]').checked")


def test_entering_closes_the_card_and_applies_the_prefs(raw):
    _raw_goto(raw, "cnn")
    raw.ev("document.querySelector('#intro input[data-pref=spin]').click()")  # cnn defaults to no spin; turn it on
    raw.ev("document.querySelector('#intro input[data-pref=play]').click()")  # and no autoplay
    raw.page.locator("#intro button", has_text="直接操作").click()
    raw.page.wait_for_timeout(100)
    assert not raw.ev(INTRO_OPEN)
    assert not raw.ev("document.getElementById('ctrl').inert")
    assert raw.ev("App.autoSpin") is True
    raw.page.wait_for_timeout(1200)
    assert "播放" in raw.ev(PRIMARY), "play toggle off: no autoplay"
    assert raw.ev("JSON.parse(localStorage.getItem('prefs')).cnn") == {"play": False, "spin": True}


def test_catalog_defaults_drive_the_toggles(raw):
    _raw_goto(raw, "cnn")
    assert not raw.ev("document.querySelector('#intro input[data-pref=spin]').checked"), "cnn reads left to right: no spin by default"
    raw.page.locator("#intro button", has_text="直接操作").click()
    raw.page.wait_for_timeout(100)
    assert raw.ev("App.autoSpin") is False


def test_stepper_autoplay_waits_for_enter(raw):
    _raw_goto(raw, "cnn", settle=1400)
    assert "播放" in raw.ev(PRIMARY), "nothing should autoplay behind the card"
    raw.page.locator("#intro button", has_text="直接操作").click()
    raw.page.wait_for_timeout(1000)
    assert "暫停" in raw.ev(PRIMARY), "autoplay starts 600ms after entering"


def test_escape_enters_free_mode(raw):
    _raw_goto(raw, "residual")
    raw.page.keyboard.press("Escape")
    raw.page.wait_for_timeout(100)
    assert not raw.ev(INTRO_OPEN)


def test_second_visit_shows_a_banner_instead_of_the_card(raw):
    _raw_goto(raw, "residual")
    raw.ev("App.intro.enter('free')")
    _raw_goto(raw, "cnn")
    raw.ev("App.intro.enter('free')")
    _raw_goto(raw, "residual", settle=200)
    assert not raw.ev(INTRO_OPEN)
    assert raw.ev("document.getElementById('introbanner').classList.contains('on')")
    assert "旁路" in raw.ev("document.getElementById('introbanner').textContent")
    raw.page.wait_for_timeout(3200)
    assert not raw.ev("document.getElementById('introbanner').classList.contains('on')"), "the banner goes away by itself"
    raw.page.locator("#info button", has_text="說明").click()
    raw.page.wait_for_timeout(100)
    assert raw.ev(INTRO_OPEN), "the ⓘ button reopens the card"
    assert not raw.ev("!!document.querySelector('#intro button[data-act=back]')"), "no 'back' when reopened by hand"


def test_prefs_persist_per_scene(raw):
    _raw_goto(raw, "residual")
    raw.ev("document.querySelector('#intro input[data-pref=spin]').click()")
    raw.ev("App.intro.enter('free')")
    _raw_goto(raw, "cnn"); raw.ev("App.intro.enter('free')")
    _raw_goto(raw, "residual")
    assert raw.ev("App.autoSpin") is False, "the saved pref applies on the next visit without the card"


def test_back_goes_to_the_previous_tour_step_or_home(raw):
    _raw_goto(raw, "tour=kv&step=2")
    raw.page.locator("#intro button[data-act=back]").click()
    raw.page.wait_for_function("location.hash === '#tour=kv&step=1'")
    raw.ev("App.intro.enter('free')")
    _raw_goto(raw, "tour=kv&step=2")
    assert not raw.ev(INTRO_OPEN), "kvheads was already seen in step 1 → no card"


def test_back_from_a_direct_link_goes_home(raw):
    _raw_goto(raw, "mhc")
    raw.page.locator("#intro button[data-act=back]").click()
    raw.page.wait_for_function("!App.routing && App.home")


def test_site_goto_enters_for_the_existing_tests(site):
    site.goto("cnn")
    assert not site.ev(INTRO_OPEN)


# ---------- guide (導讀) ----------

@pytest.mark.parametrize("scene_id", ["residual", "cnn", "agent-loop"])
def test_pilot_scenes_register_a_guide_and_a_howto_card(site, scene_id):
    site.goto(scene_id)
    assert site.ev("App.guide.steps.length") >= 4, "3+ steps plus the hand-off"
    assert site.ev("App.guide.steps[App.guide.steps.length - 1].hand"), "the last step hands over"
    assert site.ev("document.querySelectorAll('#ctrl .howto li').length") == 3
    assert not site.ev("!!document.querySelector('#ctrl .note')"), "the long note moved into the guide"
    assert site.ev("!!document.querySelector('#info button[data-act=guide]')")


def test_first_visit_primary_button_starts_the_guide(raw):
    _raw_goto(raw, "residual")
    assert "導讀" in raw.ev("document.querySelector('#intro .btn.primary').textContent")
    raw.page.locator("#intro .btn.primary").click()
    raw.page.wait_for_timeout(300)
    assert raw.ev("App.guide.active")
    assert raw.ev("document.body.classList.contains('guiding')")
    assert raw.ev("document.getElementById('guidebar').classList.contains('on')")
    assert raw.ev("App.autoSpin") is False
    assert "F(x)" in raw.ev("document.querySelector('#guidebar .gb-say').textContent")


def test_guide_steps_spotlight_controls_and_change_the_scene(site):
    site.goto("residual")
    site.ev("App.guide.start()")
    site.page.wait_for_timeout(200)
    site.page.locator("#guidebar button", has_text="下一步").click()
    site.page.wait_for_timeout(300)
    assert site.ev("App.guide.n") == 1
    spot = site.ev("[...document.querySelectorAll('#ctrl .spot')].map(e => e.textContent)")
    assert len(spot) == 1 and "skip connection" in spot[0]
    assert site.ev("document.querySelector('#ctrl .seg button[aria-pressed=true]').textContent") == "沒有（純堆疊）", "the step turned the skip path off"
    assert "bad" in site.ev("document.querySelector('#ctrl .readouts dd:nth-of-type(3)').className")
    site.page.keyboard.press("]")
    site.page.wait_for_timeout(300)
    assert site.ev("App.guide.n") == 2
    assert site.ev("[...document.querySelectorAll('#ctrl .ctl label')].find(l => l.textContent.includes('增益')).querySelector('output').textContent") == "1.30"


def test_guide_hand_off_returns_to_free_mode(site):
    site.goto("cnn")
    site.ev("App.guide.start()")
    site.page.wait_for_timeout(200)
    n = site.ev("App.guide.steps.length")
    for _ in range(n - 1):
        site.page.keyboard.press("]"); site.page.wait_for_timeout(120)
    assert site.ev("App.guide.n") == n - 1
    txt = site.ev("document.querySelector('#guidebar .gb-say').textContent")
    assert "換你試試" in txt
    site.page.locator("#guidebar button", has_text="開始操作").click()
    site.page.wait_for_timeout(200)
    assert not site.ev("App.guide.active")
    assert not site.ev("document.body.classList.contains('guiding')")
    assert site.ev("document.querySelectorAll('#ctrl .spot').length") == 0


def test_skip_leaves_the_guide_and_guide_hides_the_tour_bar(site):
    site.goto("tour=agent&step=1")
    site.ev("App.guide.start()")
    site.page.wait_for_timeout(200)
    assert site.ev("getComputedStyle(document.getElementById('tourbar')).display") == "none"
    site.page.locator("#guidebar button", has_text="跳過").click()
    site.page.wait_for_timeout(200)
    assert not site.ev("App.guide.active")
    assert site.ev("getComputedStyle(document.getElementById('tourbar')).display") != "none"
    assert site.ev("location.hash") == "#tour=agent&step=1", "] inside the guide must not advance the tour"


def test_agent_loop_guide_step_walks_the_script(site):
    site.goto("agent-loop")
    site.ev("App.guide.start()")
    site.page.wait_for_timeout(100)
    site.ev("App.guide.go(2)")
    site.page.wait_for_timeout(800)
    assert "1" in site.readout("compact 次數"), "the compact step should have happened"


# ---------- the two small fixes ----------

def test_jev_option_labels_do_not_overlap(site):
    site.goto("jev", settle=1200)
    site.ev("App.autoSpin = false; App.cam.theta = App.camHome.theta; App.cam.phi = App.camHome.phi; App._placeCamera()")
    site.page.wait_for_timeout(300)
    rects = site.ev("[...document.querySelectorAll('#labels .l3d')].filter(e => ['平靜','不滿','憤怒'].includes(e.textContent.trim())).map(e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })")
    assert len(rects) == 3
    for i in range(3):
        for j in range(i + 1, 3):
            assert not _overlaps(rects[i], rects[j]), f"option labels overlap: {rects}"


def test_phone_sidebar_items_stay_on_one_line_and_show_the_current_one(phone_site):
    phone_site.goto("kvheads", settle=600)
    heights = phone_site.ev("[...document.querySelectorAll('#items a')].map(a => a.offsetHeight)")
    assert max(heights) <= 36, f"an item wrapped onto two lines: {heights}"
    assert phone_site.ev("(() => { const l = document.getElementById('items'); const a = l.querySelector('a[aria-current=page]'); const r = a.getBoundingClientRect(), p = l.getBoundingClientRect(); return r.left >= p.left - 1 && r.right <= p.right + 1; })()"), "the current item must be scrolled into view"
    assert phone_site.ev("getComputedStyle(document.getElementById('side')).maskImage || getComputedStyle(document.getElementById('side')).webkitMaskImage") not in ("none", ""), "a fade on the right edge hints that the list scrolls"
