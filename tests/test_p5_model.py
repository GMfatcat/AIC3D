"""P5 — 完整模型 tab: click a layer to jump, thinking mode in 3D, GLM tok/s, YOLO matching steps, MiniLM opens with content."""
import pytest

FOCUS_BTN = "#stage .focuslist button"
SCREEN_OF = """mesh => { const v = mesh.getWorldPosition(new THREE.Vector3()).project(App.camera); const r = document.getElementById('gl').getBoundingClientRect();
  return [r.left + (v.x + 1) / 2 * r.width, r.top + (-v.y + 1) / 2 * r.height]; }"""


def test_app_supports_click_targets(site):
    site.goto("qwen3-27b")
    assert site.ev("typeof App.clickTarget") == "function"


def test_clicking_a_tower_layer_jumps_to_its_scene(site):
    site.goto("qwen3-27b", settle=1000)
    site.ev("App.autoSpin = false")
    pos = site.ev("(() => { let m; App.root.traverse(o => { if (o.isMesh && o.userData && o.userData.type === 'attn' && !m) m = o; }); return (" + SCREEN_OF + ")(m); })()")
    site.page.mouse.move(pos[0], pos[1]); site.page.wait_for_timeout(100)
    picked = site.ev("(() => { const p = App._pickClick(); return p ? p.obj.userData.type : null; })()")  # thin layers: take whatever the ray actually hits
    assert picked in ("attn", "gdn"), picked
    expected = {"attn": "kvheads", "gdn": "gdn"}[picked]
    site.page.mouse.click(pos[0], pos[1])
    site.page.wait_for_function(f"!App.routing && App.currentItem && App.currentItem.id === '{expected}'", timeout=5000)


def test_enter_on_a_focused_layer_jumps_too(site):
    site.goto("nemotron", settle=800)
    site.page.focus(f"{FOCUS_BTN} >> nth=0")  # layer 1 of Nemotron is mamba
    site.page.keyboard.press("Enter")
    site.page.wait_for_function("!App.routing && App.currentItem && App.currentItem.id === 'mamba'", timeout=5000)


def test_qwen_thinking_mode_shows_think_tokens_in_3d(site):
    site.goto("qwen3-27b", settle=800)
    count = "(() => { let n = 0; App.root.traverse(o => { if (o.userData && o.userData.think && o.visible) n++; }); return n; })()"
    assert site.ev(count) == 0
    site.ctrl_button("開").click()
    site.page.wait_for_timeout(300)
    assert site.ev(count) > 0, "thinking mode should add visible <think> tokens to the scene"
    site.set_slider("thinking budget", 2)
    site.page.wait_for_timeout(300)
    assert site.ev(count) == 2
    assert "2" in site.readout("thinking")


def test_glm_has_a_tokens_per_second_gauge(site):
    site.goto("glm-flash", settle=800)
    h100 = site.readout("decode 上限（單 stream）")
    site.ctrl_button("DGX Spark").click()
    site.page.wait_for_timeout(300)
    spark = site.readout("decode 上限（單 stream）")
    assert h100 != spark and "tok/s" in spark


def test_yolo_matching_can_be_stepped(site):
    site.goto("yolo-v10", settle=600)
    site.ctrl_button("重置").click()
    assert site.readout("配對步驟").startswith("0")
    dots = "(() => { let n = 0; App.root.traverse(o => { if (o.userData && o.userData.cand && o.visible) n++; }); return n; })()"
    site.ctrl_button("單步").click(); site.page.wait_for_timeout(100)
    assert site.ev(dots) > 10, "step 1 should show the candidate points"
    for _ in range(2):
        site.ctrl_button("單步").click(); site.page.wait_for_timeout(100)
    assert site.readout("配對步驟").startswith("3")
    assert site.readout("輸出框數").startswith("3 個")


def test_minilm_opens_with_a_sentence_already_running(site):
    site.goto("minilm", settle=1800)
    assert site.readout("token 數") == "7"
    assert site.ev("document.querySelectorAll('#ctrl .seg button[aria-pressed=\"true\"]').length") == 1
