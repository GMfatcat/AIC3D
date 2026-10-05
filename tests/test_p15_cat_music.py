"""P15 — the resident cat and the background music.
The cat lives on the desk: it wanders between free spots, sits, naps; a tap makes it meow, three taps put it to sleep. It has no other job.
Music: off by default, a ♪ button in the top bar, plays only on the desk (home / glossary), fades out in scenes, remembered in localStorage,
and the mp3 is not fetched while it is off."""
import pytest

CAT = "App.desk.cat"
BGM = "document.getElementById('bgm')"


@pytest.fixture
def fresh(browser, dist_url):
    from conftest import Site
    ctx = browser.new_context(viewport={"width": 1400, "height": 860})
    page = ctx.new_page()
    s = Site(page)
    page.goto(dist_url)
    page.wait_for_function("window.App && !App.routing && App.home && App.desk.ready")
    page.wait_for_timeout(500)
    yield s
    ctx.close()


# ---------- the cat ----------

def test_cat_is_on_the_desk_and_clickable_in_every_view(fresh):
    assert fresh.ev(CAT + ".state") in ("sit", "walk", "sleep")
    assert fresh.ev(CAT + ".model.group.parent === App.root")
    assert fresh.ev("App._hoverWatch[0].objects.includes(" + CAT + ".hit())"), "wide view: the cat is one of the things you can point at"
    assert fresh.ev(CAT + ".hit().userData.msg") == "貓：桌上的住客，點牠看看"
    fresh.page.evaluate("location.hash = 'tab=train'")
    fresh.page.wait_for_function("App.desk.focused === 'train' && App.desk.ready")
    assert fresh.ev("App._hoverWatch[0].objects.includes(" + CAT + ".hit())"), "focused on a toy: the cat still wanders and can still be tapped"
    fresh.page.evaluate("location.hash = 'tab=about'")
    fresh.page.wait_for_function("App.desk.focused === 'about' && App.desk.ready")
    assert fresh.ev("App._hoverWatch[0].objects.includes(" + CAT + ".hit())"), "panel fixture: no parts, but the cat"
    fresh.assert_clean()


def test_cat_walks_between_free_spots_without_crossing_a_toy(fresh):
    before = fresh.ev(CAT + ".pos().toArray()")
    fresh.ev(CAT + "._go()")
    assert fresh.ev(CAT + ".state") == "walk"
    fresh.page.wait_for_function(CAT + ".state !== 'walk'", timeout=15000)
    after = fresh.ev(CAT + ".pos().toArray()")
    assert after != before and fresh.ev(CAT + ".state") == "sit"
    assert abs(after[1]) < 1e-6, "walks on the desk top"
    # every spot pair it may pick keeps clear of the toys' coasters and the fixtures
    bad = fresh.ev("""() => {
        const SP = [[-11.8,0.1],[-5.6,0.1],[0,0.1],[5.6,0.1],[-11.8,3.4],[-11.8,-3.2],[0,6.4],[-2.8,6.2],[2.8,6.2],[-5.6,-6.2],[5.6,-6.2],[0,-6.4]];
        const BL = [[-8.4,-3],[-2.8,-3],[2.8,-3],[8.4,-3],[-8.4,3.2],[-2.8,3.2],[2.8,3.2],[8.4,3.2],[12.7,4],[12.7,-0.9],[12.7,-5.3]];
        return SP.filter(s => BL.some(c => Math.hypot(s[0]-c[0], s[1]-c[1]) < 2.6)).length; }""")
    assert bad == 0, "no spot sits on a toy"
    fresh.assert_clean()


def test_tapping_the_cat_makes_it_meow_and_three_taps_put_it_to_sleep(fresh):
    fresh.ev(CAT + "._sit(60); " + CAT + ".pokes = 0; " + CAT + "._lastPoke = -99")
    fresh.ev(CAT + ".poke()")
    assert fresh.ev(CAT + ".saying()") == "喵"
    fresh.page.wait_for_function("[...document.querySelectorAll('#labels .l3d')].some(l => l.textContent === '喵')", timeout=2000)  # the label lands in the DOM on the next frame
    fresh.page.wait_for_function("!" + CAT + ".saying()", timeout=4000)
    fresh.ev(CAT + ".poke(); " + CAT + ".poke()")
    assert fresh.ev(CAT + ".state") == "sleep"
    assert fresh.ev(CAT + ".saying()") == "z z"
    fresh.ev(CAT + ".poke()")
    assert fresh.ev(CAT + ".state") == "sit", "a tap wakes it"
    fresh.assert_clean()


def test_cat_survives_leaving_and_returning_and_the_owl_avoids_it(fresh):
    fresh.page.evaluate("location.hash = 'cnn'")
    fresh.page.wait_for_function("App.currentItem && App.currentItem.id === 'cnn' && !App.routing")
    assert fresh.ev(CAT + ".model") is None, "disposed with the desk"
    assert fresh.ev("document.querySelectorAll('#labels .l3d').length") >= 0
    fresh.goto("home")
    assert fresh.ev(CAT + ".model.group.parent === App.root")
    # the owl never lands on top of the cat
    fresh.ev(CAT + ".spot = 2; " + CAT + "._place([0, 0.1]); " + CAT + "._sit(60)")
    for _ in range(6):
        fresh.ev("App.desk.messenger.arrive(null, 'owl')")
        fresh.page.wait_for_function("App.desk.messenger.state === 'landed'")
        d = fresh.ev("Math.hypot(App.desk.messenger._spot.x - " + CAT + ".pos().x, App.desk.messenger._spot.z - " + CAT + ".pos().z)")
        assert d > 2.0, d
        fresh.ev("App.desk.messenger.leave(); App.desk.messenger._gone()")
    fresh.assert_clean()


def test_cat_strings_have_english(fresh):
    missing = fresh.ev("['貓：桌上的住客，點牠看看', '喵', '呼嚕', '背景音樂：開', '背景音樂：關'].filter(k => !I18N.dict.en[k])")
    assert missing == []


# ---------- music ----------

def test_music_is_off_by_default_and_nothing_is_fetched(fresh):
    assert fresh.ev("!!document.getElementById('musicbtn')")
    assert fresh.ev("App.music.wanted") is False
    assert fresh.ev("document.getElementById('musicbtn').getAttribute('aria-pressed')") == "false"
    assert fresh.ev(BGM + ".getAttribute('src')") is None, "the mp3 is only requested once you turn it on"
    assert fresh.ev(BGM + ".preload") == "none"
    fresh.assert_clean()


def test_music_button_plays_on_the_desk_fades_out_in_a_scene_and_is_remembered(fresh):
    fresh.page.click("#musicbtn")
    assert fresh.ev("App.music.wanted") is True
    assert fresh.ev("localStorage.getItem('music')") == "1"
    assert fresh.ev(BGM + ".getAttribute('src')") == "music.mp3"
    fresh.page.wait_for_function("App.music.playing || App.music.blocked", timeout=8000)
    assert fresh.ev("App.music.playing") is True, "a click is a user gesture, so it plays"
    fresh.page.wait_for_function(BGM + ".volume > 0.3", timeout=4000)
    # a scene: fades to silence and pauses
    fresh.goto("cnn")
    fresh.page.wait_for_function(BGM + ".paused", timeout=4000)
    assert fresh.ev(BGM + ".volume") == 0
    # the glossary is the same desk: music comes back
    fresh.page.evaluate("location.hash = 'glossary'")
    fresh.page.wait_for_function("App.page === 'glossary' && !App.routing")
    fresh.page.wait_for_function("!" + BGM + ".paused", timeout=4000)
    fresh.goto("home")
    fresh.page.wait_for_function(BGM + ".volume > 0.3", timeout=4000)
    # off again
    fresh.page.click("#musicbtn")
    assert fresh.ev("localStorage.getItem('music')") == "0"
    fresh.page.wait_for_function(BGM + ".paused", timeout=4000)
    fresh.assert_clean()


def test_music_preference_survives_a_reload_and_waits_for_the_first_gesture(fresh):
    fresh.page.click("#musicbtn")
    fresh.page.wait_for_function("App.music.playing", timeout=8000)
    fresh.page.reload()
    fresh.page.wait_for_function("window.App && !App.routing && App.home && App.desk.ready")
    assert fresh.ev("App.music.wanted") is True
    fresh.page.wait_for_function("App.music.playing || App.music.blocked", timeout=8000)
    if fresh.ev("App.music.blocked"):  # autoplay refused: the button shows it, the first click anywhere starts it
        assert fresh.ev("document.getElementById('musicbtn').classList.contains('blocked')")
        fresh.page.mouse.click(700, 500)
        fresh.page.wait_for_function("App.music.playing", timeout=8000)
    assert fresh.ev("!" + BGM + ".paused")
    fresh.assert_clean()


def test_about_panel_credits_the_music(fresh):
    fresh.page.evaluate("location.hash = 'tab=about'")
    fresh.page.wait_for_function("App.desk.focused === 'about' && App.desk.ready")
    foot = fresh.ev("[...document.querySelectorAll('#deskbar .about-foot')].map(p => p.textContent).join(' ')")
    assert "Sappheiros" in foot and "Embrace" in foot and "CC BY 3.0" in foot
    fresh.assert_clean()
