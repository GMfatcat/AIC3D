"""P2 — motion and transitions: crossfade, camera ease, number tweens, focus, reduced motion, shortcuts."""
import pytest

STAGE_OPACITY = "parseFloat(getComputedStyle(document.getElementById('stage')).opacity)"
MARKER_ON_NODE = """
  (() => { let marker = null, nodes = [];
    App.root.traverse(o => { if (!o.isMesh) return; const p = o.geometry.parameters;
      if (o.geometry.type === 'SphereGeometry' && Math.abs(p.radius - 0.16) < 1e-6 && !marker) marker = o;
      if (o.geometry.type === 'SphereGeometry' && Math.abs(p.radius - 0.32) < 1e-6) nodes.push(o); });
    return nodes.some(n => Math.hypot(n.position.x - marker.position.x, n.position.z - marker.position.z) < 1e-3);
  })()
"""


# ---------- scene transition ----------

def test_scene_switch_crossfades_the_stage(site):
    site.goto("cnn")
    site.ev("location.hash = 'rnn'")
    site.page.wait_for_function("App.routing === true")  # hashchange is async
    site.page.wait_for_function("parseFloat(getComputedStyle(document.getElementById('stage')).opacity) < 1", timeout=2000)  # fading out
    assert site.ev("App.routing") is True
    site.page.wait_for_timeout(800)
    assert site.ev(STAGE_OPACITY) == 1
    assert site.ev("App.routing") is False
    assert site.ev("document.getElementById('i-title').textContent") == "RNN"


def test_new_scene_settles_in_from_a_wider_shot(site):
    site.goto("cnn")
    site.ev("location.hash = 'residual'")
    site.page.wait_for_function("!App.routing")
    early = site.ev("[App.cam.dist, App.camHome.dist]")
    assert early[0] > early[1] * 1.03, f"camera should start farther than home and ease in: {early}"
    site.page.wait_for_timeout(900)
    late = site.ev("[App.cam.dist, App.camHome.dist]")
    assert late[0] == pytest.approx(late[1], rel=1e-3)


def test_double_click_eases_the_camera_home(site):
    site.goto("residual", settle=1200)
    site.ev("App.autoSpin = false; App.cam.theta = App.camHome.theta + 1.0; App.cam.dist = App.camHome.dist * 1.6; App._placeCamera()")
    site.page.dispatch_event("#gl", "dblclick")
    site.page.wait_for_timeout(60)
    mid = site.ev("[App.cam.theta, App.camHome.theta]")
    assert abs(mid[0] - mid[1]) > 0.2, "double-click should ease, not jump"
    site.page.wait_for_timeout(800)
    end = site.ev("[App.cam.theta, App.camHome.theta, App.cam.dist, App.camHome.dist]")
    assert end[0] == pytest.approx(end[1], abs=1e-3) and end[2] == pytest.approx(end[3], rel=1e-3)


# ---------- numbers ----------

def test_readout_numbers_tween_between_values(site):
    site.goto("kvcache", settle=1000)
    assert site.readout("真實 context 下的 cache").startswith("2.00")
    site.set_slider("真實 context", 128)
    site.page.wait_for_timeout(120)
    mid = float(site.readout_text("真實 context 下的 cache").split()[0])
    assert 2.0 < mid < 32.0, f"number should be mid-tween, got {mid}"
    site.page.wait_for_timeout(600)
    assert site.readout_text("真實 context 下的 cache").startswith("32.00")


# ---------- loop markers ----------

@pytest.mark.parametrize("scene_id", ["goal", "subagent"])
def test_loop_marker_glides_instead_of_jumping(site, scene_id):
    site.goto(scene_id, settle=1000)
    site.ctrl_button("單步").click()
    site.page.wait_for_timeout(40)
    assert not site.ev(MARKER_ON_NODE), "marker jumped straight to the next node"
    site.page.wait_for_timeout(900)
    assert site.ev(MARKER_ON_NODE)


# ---------- unified focus (keyboard / touch reach the hover info) ----------

def test_keyboard_can_focus_3d_hover_targets(site):
    site.goto("cnn", settle=1000)
    n = site.ev("document.querySelectorAll('#stage .focuslist button').length")
    assert n == 36, f"expected one hidden focus button per output cell, got {n}"
    before = site.ev("(() => { let k; App.root.traverse(o => { if (o.isLineSegments && !k) k = o; }); return [k.position.x, k.position.y]; })()")
    site.page.focus("#stage .focuslist button >> nth=20")
    site.page.wait_for_timeout(150)
    after = site.ev("(() => { let k; App.root.traverse(o => { if (o.isLineSegments && !k) k = o; }); return [k.position.x, k.position.y]; })()")
    assert before != after, "focusing a hidden target button should drive the same highlight as hover"


def test_touch_tap_keeps_the_pointer_for_hover(site):
    site.goto("cnn")
    site.ev("""(() => { const c = document.getElementById('gl'); const r = c.getBoundingClientRect();
        c.dispatchEvent(new PointerEvent('pointermove', {clientX: r.left + r.width/2, clientY: r.top + r.height/2, pointerType: 'touch', bubbles: true}));
        c.dispatchEvent(new PointerEvent('pointerleave', {pointerType: 'touch', bubbles: true})); })()""")
    assert site.ev("Math.abs(App.pointer.x) < 0.01 && Math.abs(App.pointer.y) < 0.01"), "touch pointerleave must not discard the tap position"


# ---------- reduced motion ----------

@pytest.fixture
def calm_site(browser, dist_url):
    from conftest import Site
    ctx = browser.new_context(viewport={"width": 1400, "height": 860}, reduced_motion="reduce")
    page = ctx.new_page()
    s = Site(page)
    page.goto(dist_url)
    page.wait_for_function("window.App && App.current")
    yield s
    ctx.close()


def test_reduced_motion_freezes_tower_token_and_expert_blink(calm_site):
    s = calm_site
    s.goto("nemotron", settle=600)
    a = s.ev("(() => { let t; App.root.traverse(o => { if (o.isMesh && o.geometry.type === 'SphereGeometry' && Math.abs(o.geometry.parameters.radius - 0.16) < 1e-6) t = o; }); return t.position.y; })()")
    s.page.wait_for_timeout(500)
    b = s.ev("(() => { let t; App.root.traverse(o => { if (o.isMesh && o.geometry.type === 'SphereGeometry' && Math.abs(o.geometry.parameters.radius - 0.16) < 1e-6) t = o; }); return t.position.y; })()")
    assert a == b
    assert s.ev("(() => { let n = 0; App.root.traverse(o => { if (o.isMesh && Math.abs(o.scale.x - 1.25) < 1e-6) n++; }); return n; })()") > 0, "experts should still be shown, just not blinking"


def test_reduced_motion_keeps_recompute_beams_static_in_kvcache(calm_site):
    s = calm_site
    s.goto("kvcache", settle=600)
    s.ctrl_button("沒有 cache").click()
    for _ in range(3):
        s.ctrl_button("單步").click()
    s.page.wait_for_timeout(1200)
    visible = s.ev("(() => { let n = 0; App.root.traverse(o => { if (o.isMesh && o.geometry.type === 'CylinderGeometry' && o.visible && o.material.color.getHexString() === P.hex('alert').slice(1).toLowerCase()) n++; }); return n; })()")
    assert visible > 0, "with reduced motion the recompute beams should stay visible instead of flashing away"


def test_reduced_motion_disables_gptq_wave_travel(calm_site):
    s = calm_site
    s.goto("gptq", settle=600)
    s.ctrl_button("單步").click()
    a = s.ev("(() => { let w; App.root.traverse(o => { if (o.isMesh && o.geometry.type === 'BoxGeometry' && Math.abs(o.geometry.parameters.width - 0.85) < 1e-6 && Math.abs(o.geometry.parameters.depth - 0.5) < 1e-6) w = o; }); return w.position.x; })()")
    s.page.wait_for_timeout(300)
    b = s.ev("(() => { let w; App.root.traverse(o => { if (o.isMesh && o.geometry.type === 'BoxGeometry' && Math.abs(o.geometry.parameters.width - 0.85) < 1e-6 && Math.abs(o.geometry.parameters.depth - 0.5) < 1e-6) w = o; }); return w.position.x; })()")
    assert a == b


# ---------- keyboard shortcuts ----------

def test_bracket_keys_step_through_scenes_and_digits_switch_tabs(site):
    site.goto("cnn")
    enter = "App.intro.isOpen() && App.intro.enter('free')"  # the first-visit card is modal: shortcuts resume once it is closed
    site.page.keyboard.press("]")
    site.page.wait_for_function("!App.routing && App.currentItem.id === 'rnn'"); site.ev(enter)
    site.page.keyboard.press("[")
    site.page.wait_for_function("!App.routing && App.currentItem.id === 'cnn'"); site.ev(enter)
    site.page.keyboard.press("3")
    site.page.wait_for_function("!App.routing && App.currentItem.id === 'deepseek-v4'")


# ---------- controls react immediately ----------

def test_gdn_slider_change_replays_the_steps(site):
    site.goto("gdn", settle=1000)
    for _ in range(2):
        site.ctrl_button("單步").click()
    before = site.readout("‖S‖（狀態總量）")
    site.set_slider("β 寫入強度", 0.2)
    site.page.wait_for_timeout(600)
    after = site.readout("‖S‖（狀態總量）")
    assert before != after, "changing β after some steps should recompute the state, not wait for the next step"


def test_vllm_share_toggle_rebuilds_and_clear_empties(site):
    site.goto("vllm", settle=1000)
    site.ctrl_button("共享 prefix page").click()
    site.page.wait_for_timeout(600)
    assert site.readout("共享的 prefix") != "—", "toggling sharing should re-run the current requests with the new policy"
    site.ctrl_button("全部清空").click()
    site.page.wait_for_timeout(600)
    assert site.readout("已用 page").startswith("0 /")


def test_embedding_clear_resets_selection_and_note(site):
    site.goto("embedding", settle=600)
    site.ctrl_button("「柴犬」").click()
    assert site.ev("document.querySelectorAll('#ctrl .seg button[aria-pressed=\"true\"]').length") == 1
    site.ctrl_button("清除").click()
    assert site.ev("document.querySelectorAll('#ctrl .seg button[aria-pressed=\"true\"]').length") == 0
    assert site.readout("落點") == "—"
