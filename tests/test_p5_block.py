"""P5 — 模型積木 tab: drag the Query vector, hover feedback on every slider scene."""
import pytest

FOCUS_BTN = "#stage .focuslist button"


def test_app_supports_3d_drag_targets(site):
    site.goto("attention")
    assert site.ev("typeof App.dragTarget") == "function"


def test_attention_query_arrow_can_be_dragged_without_orbiting(site):
    site.goto("attention", settle=1000)
    site.ev("App.autoSpin = false")
    theta = site.ev("App.cam.theta")
    before = site.ev("[...document.querySelectorAll('#ctrl .slider output')][1].textContent")
    head = site.ev("""(() => { let h; App.root.traverse(o => { if (o.isMesh && o.geometry.type === 'ConeGeometry' && o.material.color.getHexString() === P.hex('signal').slice(1).toLowerCase() && !h) h = o; });
        const v = h.getWorldPosition(new THREE.Vector3()).project(App.camera); const r = document.getElementById('gl').getBoundingClientRect();
        return [r.left + (v.x + 1) / 2 * r.width, r.top + (-v.y + 1) / 2 * r.height]; })()""")
    site.page.mouse.move(head[0], head[1]); site.page.mouse.down()
    site.page.mouse.move(head[0] - 90, head[1] + 10, steps=6); site.page.mouse.up()
    site.page.wait_for_timeout(200)
    after = site.ev("[...document.querySelectorAll('#ctrl .slider output')][1].textContent")
    assert before != after, "dragging the arrow head should change the Query direction"
    assert site.ev("App.cam.theta") == pytest.approx(theta, abs=1e-6), "dragging the arrow must not orbit the camera"


def test_attention_token_focus_sets_the_query(site):
    site.goto("attention", settle=800)
    site.page.focus(f"{FOCUS_BTN} >> nth=1")
    site.page.wait_for_timeout(200)
    assert site.ev("[...document.querySelectorAll('#ctrl .slider output')][0].textContent") == "在"


def test_kvheads_hovering_a_q_head_names_its_kv_group(site):
    site.goto("kvheads", settle=800)
    site.set_slider("KV 設計", 1)  # GQA
    site.page.focus(f"{FOCUS_BTN} >> nth=5")
    site.page.wait_for_timeout(200)
    txt = site.readout("滑到的頭")
    assert "Q 頭 6" in txt and "第 2 組" in txt, txt


def test_residual_hovering_a_block_reports_its_layer(site):
    site.goto("residual", settle=800)
    site.page.focus(f"{FOCUS_BTN} >> nth=3")
    site.page.wait_for_timeout(200)
    txt = site.readout("滑到的層")
    assert txt.startswith("第 4 層"), txt


def test_engram_token_focus_selects_it(site):
    site.goto("engram", settle=800)
    site.page.focus(f"{FOCUS_BTN} >> nth=8")
    site.page.wait_for_timeout(200)
    assert "重新" in site.readout("這個 token 的 n-gram")


def test_mhc_hovering_a_segment_reports_layer_stream_and_amplitude(site):
    site.goto("mhc", settle=800)
    site.page.focus(f"{FOCUS_BTN} >> nth=9")  # layer 2, stream 2 (4 streams per layer)
    site.page.wait_for_timeout(200)
    txt = site.readout("滑到的流")
    assert "第 2 層" in txt and "第 2 流" in txt, txt
    site.set_slider("殘差流數", 2)
    site.page.wait_for_timeout(300)
    assert site.ev("document.querySelectorAll('#stage .focuslist button').length") == 17 * 2, "focus list must follow the rebuilt streams"
