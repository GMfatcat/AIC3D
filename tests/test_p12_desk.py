"""P12 — 工作桌 (desk hub): the landing page is a desk with one toy object per tab.
Clicking a tab flies the camera to its object, the object opens, and the tab's scenes are parts of it.
Objects start as grey clay and get painted step by step as scenes in that tab are visited."""
import re

import pytest

FOCUS_BTN = "#stage .focuslist button"
TABS = ["arch", "block", "model", "train", "eval", "optimize", "infra", "agent"]


@pytest.fixture
def fresh(browser, dist_url):
    from conftest import Site
    ctx = browser.new_context(viewport={"width": 1400, "height": 860})
    page = ctx.new_page()
    s = Site(page)
    page.goto(dist_url)
    page.wait_for_function("window.App && !App.routing && App.home")
    page.wait_for_timeout(600)
    yield s
    ctx.close()


def _focus(site, tab):
    site.page.evaluate("h => { location.hash = h; }", "tab=" + tab)
    site.page.wait_for_function("t => !App.routing && App.home && App.desk.focused === t && App.desk.ready", arg=tab)
    site.page.wait_for_timeout(300)


# ---------- the desk ----------

def test_desk_has_one_station_per_tab_with_its_label(fresh):
    assert fresh.ev("Object.keys(App.desk.stations)") == TABS
    labels = fresh.ev("App.TABS.map(t => App.desk.stations[t.id].label.el.textContent)")
    assert labels == fresh.ev("App.TABS.map(t => t.label)")
    assert fresh.ev("App.desk.focused") is None
    assert fresh.ev("document.body.classList.contains('desk-focus')") is False
    fresh.assert_clean()


def test_every_station_can_be_focused_and_lists_its_scenes(fresh):
    for tab in TABS:
        _focus(fresh, tab)
        ids = fresh.ev("App.desk.slots.map(s => s.id)")
        assert ids == fresh.ev("t => App.catalog.filter(i => i.tab === t).map(i => i.id)", tab), tab
        # no numbers on the object until a part is selected; the full names are in the list at the top left
        assert fresh.ev("App.desk.slots.every(s => !s.label)")
        titles = fresh.ev("App.desk.slots.map(s => s.li.textContent)")
        for s, title in zip(fresh.ev("t => App.catalog.filter(i => i.tab === t).map(i => i.title)", tab), titles):
            assert s in title, (tab, s, title)
        assert fresh.ev("document.querySelectorAll('#deskbar .dlist button').length") == len(ids)
    fresh.assert_clean()


def test_hovering_a_list_item_lifts_the_part_on_the_object(fresh):
    _focus(fresh, "train")
    fresh.page.hover("#deskbar .dlist li >> nth=1")
    fresh.page.wait_for_function("App.desk.slots[1].li.classList.contains('hot') && App.desk.slots[1].node.userData.lift === 1")
    assert fresh.ev("!App.desk.slots[1].label"), "hover only lifts; the name appears when the part is selected"
    fresh.page.hover("#deskbar b")
    fresh.page.wait_for_function("App.desk.slots[1].node.userData.lift === 0")


def test_selecting_a_part_zooms_in_names_it_and_escape_steps_back(fresh):
    _focus(fresh, "model")
    far = fresh.ev("App.cam.dist")
    fresh.page.locator("#deskbar .dlist button", has_text="YOLO-V10").click()
    fresh.page.wait_for_function("App.desk.selected && App.desk.selected.id === 'yolo-v10' && App.desk.ready")
    assert fresh.ev("App.cam.dist") < far * 0.6, "camera moved in on the piece"
    assert "YOLO-V10" in fresh.ev("App.desk.selected.label.el.textContent")
    card = fresh.ev("document.querySelector('#deskbar .dcard').textContent")
    assert "YOLO-V10" in card and "進入場景" in card
    assert fresh.ev("document.querySelector('#deskbar .dcard a.enter').getAttribute('href')") == "#yolo-v10"
    assert fresh.ev("App.desk.slots[3].li.classList.contains('current')")
    assert fresh.ev("App.home") and fresh.ev("App.desk.focused") == "model", "not in the scene yet"
    fresh.page.keyboard.press("Escape")
    fresh.page.wait_for_function("!App.desk.selected && App.desk.ready")
    assert fresh.ev("App.desk.focused") == "model" and fresh.ev("App.cam.dist") > far * 0.9, "first Escape only steps back to the whole object"
    assert fresh.ev("document.querySelector('#deskbar .dcard').classList.contains('on')") is False


def test_enter_button_and_second_click_both_open_the_scene(fresh):
    _focus(fresh, "train")
    fresh.page.locator("#deskbar .dlist button", has_text="SFT").click()
    fresh.page.wait_for_function("App.desk.selected && App.desk.selected.id === 'sft' && App.desk.ready")
    fresh.page.locator("#deskbar .dcard a.enter").click()
    fresh.page.wait_for_function("!App.routing && App.currentItem && App.currentItem.id === 'sft'")
    fresh.goto("tab=train")
    fresh.page.locator("#deskbar .dlist button", has_text="Optimizers").click()
    fresh.page.wait_for_function("App.desk.selected && App.desk.selected.id === 'optimizers' && App.desk.ready")
    fresh.page.locator("#deskbar .dlist button", has_text="Optimizers").click()  # same part again = enter
    fresh.page.wait_for_function("!App.routing && App.currentItem && App.currentItem.id === 'optimizers'")


def test_phone_home_page_has_a_visible_stage(phone_site):
    phone_site.goto("home")
    assert phone_site.ev("document.getElementById('stage').getBoundingClientRect().height") > 300
    assert phone_site.ev("document.querySelector('#landing h1').getBoundingClientRect().height") > 0
    _focus(phone_site, "train")
    assert phone_site.ev("document.getElementById('deskbar').getBoundingClientRect().height") > 0


def test_focusing_a_tab_hides_the_landing_text_and_shows_the_desk_bar(fresh):
    _focus(fresh, "train")
    assert fresh.ev("document.body.classList.contains('desk-focus')")
    assert fresh.ev("getComputedStyle(document.querySelector('#landing .land-in')).visibility") == "hidden"
    bar = fresh.ev("document.getElementById('deskbar').textContent")
    assert "訓練" in bar and "6" in bar
    assert fresh.ev("document.querySelector('#tabs button[aria-selected=\"true\"]').dataset.tab") == "train"
    fresh.page.locator("#deskbar button", has_text="回工作桌").click()
    fresh.page.wait_for_function("!App.routing && App.home && App.desk.focused === null")
    assert fresh.ev("location.hash") in ("", "#home")
    fresh.page.wait_for_function("getComputedStyle(document.querySelector('#landing .land-in')).visibility === 'visible'")  # fades back in
    fresh.assert_clean()


def test_escape_returns_to_the_wide_desk(fresh):
    _focus(fresh, "model")
    fresh.page.keyboard.press("Escape")
    fresh.page.wait_for_function("!App.routing && App.home && App.desk.focused === null")


def test_keyboard_activating_a_part_selects_it_then_enters(fresh):
    _focus(fresh, "train")
    # the parts are also the keyboard focus list: the second button is the second scene of the tab
    btns = fresh.page.locator(FOCUS_BTN)
    assert btns.count() == 6
    assert "SFT" in btns.nth(1).text_content()
    fresh.page.focus(f"{FOCUS_BTN} >> nth=1")
    fresh.page.keyboard.press("Enter")
    fresh.page.wait_for_function("App.desk.selected && App.desk.selected.id === 'sft' && App.desk.ready")
    assert fresh.ev("App.home"), "first activation only selects the part"
    fresh.page.focus(f"{FOCUS_BTN} >> nth=1")
    fresh.page.keyboard.press("Enter")
    fresh.page.wait_for_function("!App.routing && App.currentItem && App.currentItem.id === 'sft'")
    assert fresh.ev("App.home") is False
    fresh.assert_clean()


def test_wide_desk_stations_are_keyboard_reachable_and_clickable(fresh):
    btns = fresh.page.locator(FOCUS_BTN)
    assert btns.count() == 8
    assert "完整模型" in btns.nth(2).text_content()
    fresh.page.focus(f"{FOCUS_BTN} >> nth=2")
    fresh.page.keyboard.press("Enter")
    fresh.page.wait_for_function("!App.routing && App.home && App.desk.focused === 'model'")
    assert fresh.ev("location.hash") == "#tab=model"


# ---------- tab bar flies through the desk ----------

def test_tab_click_from_a_scene_flies_to_the_object_then_second_click_enters(site):
    site.goto("cnn")
    site.page.locator("#tabs button", has_text="訓練").click()
    site.page.wait_for_function("!App.routing && App.home && App.desk.focused === 'train'")
    assert site.ev("location.hash") == "#tab=train"
    site.page.locator("#tabs button", has_text="訓練").click()
    site.page.wait_for_function("!App.routing && App.currentItem && App.currentItem.id === 'train-step'")


def test_tab_click_on_the_desk_switches_focus_between_objects(fresh):
    fresh.page.locator("#tabs button", has_text="Agent").click()
    fresh.page.wait_for_function("!App.routing && App.home && App.desk.focused === 'agent'")
    fresh.page.locator("#tabs button", has_text="壓縮與量化").click()
    fresh.page.wait_for_function("!App.routing && App.home && App.desk.focused === 'optimize'")
    assert fresh.ev("App.desk.slots.map(s => s.id)[0]") == "kvcache"


def test_digit_keys_still_jump_straight_into_a_scene(site):
    site.goto("cnn")
    site.page.keyboard.press("4")
    site.page.wait_for_function("!App.routing && App.currentItem && App.currentItem.id === 'train-step'")


# ---------- paint by progress ----------

def test_objects_start_as_grey_clay_and_get_painted_as_scenes_are_visited(fresh):
    total = fresh.ev("App.desk.parts('model')")
    assert total >= 11, "the chess set has at least one part per scene"
    assert fresh.ev("App.desk.painted('model')") == 0
    assert fresh.ev("App.desk.painted('train')") == 0
    # two of eleven model scenes seen → some parts painted, not all
    fresh.ev("App.visited = new Set(['yolo-v10', 'ocr']); App.desk.repaint()")
    fresh.page.wait_for_function("!App.desk.painting")  # newly painted parts tween in one by one
    p2 = fresh.ev("App.desk.painted('model')")
    assert 0 < p2 < total
    fresh.ev("App.visited = new Set(App.catalog.filter(i => i.tab === 'model').map(i => i.id)); App.desk.repaint()")
    fresh.page.wait_for_function("!App.desk.painting")
    assert fresh.ev("App.desk.painted('model')") == total
    assert fresh.ev("App.desk.painted('train')") == 0, "other objects untouched"


def test_visiting_one_scene_paints_part_of_its_object(fresh):
    fresh.goto("train-step")
    fresh.goto("home")
    fresh.page.wait_for_function("!App.desk.painting")
    assert fresh.ev("App.desk.painted('train')") > 0
    assert fresh.ev("App.desk.painted('train')") < fresh.ev("App.desk.parts('train')")
    # a painted part has colour; an unpainted one is grey (r ≈ g ≈ b)
    sat = fresh.ev("""() => { const st = App.desk.stations.train; const f = p => { const c = p.mesh.material.color; return Math.max(c.r,c.g,c.b) - Math.min(c.r,c.g,c.b); };
        return { on: Math.max(...st.parts.filter(p => p.k >= 1).map(f)), off: Math.max(...st.parts.filter(p => p.k <= 0).map(f)) }; }""")
    assert sat["on"] > 0.15 and sat["off"] < 0.08


def test_paint_ratio_is_visible_in_the_desk_bar(fresh):
    fresh.ev("App.visited = new Set(['train-step', 'sft'])")
    _focus(fresh, "train")
    assert re.search(r"2\s*/\s*6", fresh.ev("document.getElementById('deskbar').textContent"))


def test_reset_on_the_landing_page_strips_the_paint(fresh):
    fresh.ev("App.visited = new Set(['train-step']); localStorage.setItem('visited', JSON.stringify([...App.visited])); App.desk.repaint(); App._landingFoot()")
    fresh.page.wait_for_function("!App.desk.painting")
    assert fresh.ev("App.desk.painted('train')") > 0
    fresh.page.locator("#landing .land-foot button").click()
    assert fresh.ev("App.desk.painted('train')") == 0
