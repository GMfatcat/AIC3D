"""P0 functional bugs from docs/backlog.md. Each test was written to fail before its fix."""
import pytest

# ---------- model towers: MoE expert grid ----------

HIGHLIGHTED_EXPERTS = """
  (() => { let n = 0; App.root.traverse(o => { if (o.isMesh && Math.abs(o.scale.x - 1.25) < 1e-6) n++; }); return n; })()
"""


@pytest.mark.parametrize("scene_id", ["deepseek-v4", "glm-flash", "nemotron"])
def test_moe_models_light_up_expert_cells(site, scene_id):
    site.goto(scene_id, settle=2500)  # token has travelled through many layers by now
    assert site.ev(HIGHLIGHTED_EXPERTS) > 0, f"{scene_id}: no expert cell was ever highlighted"


def test_deepseek_variant_switch_keeps_app_state(site):
    site.goto("deepseek-v4")
    site.ev("App.autoSpin = false")  # as if the user had dragged the camera
    site.ctrl_button("Pro").click()
    site.page.wait_for_timeout(300)
    assert site.readout("總參數") == "1.6T"
    assert site.ev("App.autoSpin") is False, "variant switch went through App.show() and reset app state"
    site.assert_clean()


# ---------- mHC matrix drag ----------

def test_mhc_cell_drag_is_continuous_and_triggers_sinkhorn(site):
    site.goto("mhc")
    cell = site.page.locator(".mat.edit .cell").first
    before = float(cell.text_content())
    box = cell.bounding_box()
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    site.page.mouse.move(cx, cy)
    site.page.mouse.down()
    for i in range(1, 11):  # 100 px upward in 10 steps → +1.00
        site.page.mouse.move(cx, cy - 10 * i)
    site.page.mouse.up()
    site.page.wait_for_timeout(200)
    after = float(site.page.locator(".mat.edit .cell").first.text_content())
    assert after - before > 0.8, f"drag only moved the value from {before} to {after}"
    assert "Sinkhorn" in site.page.locator(".sink").text_content(), "commit() did not run after drag"


# ---------- Engram U curve orientation ----------

TEAL_ROW_AT = """
  ([fx]) => {
    const cv = document.querySelector('#overlay canvas'); const g = cv.getContext('2d');
    const x = Math.round(10 + fx * (cv.width - 20)); const col = g.getImageData(x, 0, 1, cv.height).data;
    for (let y = 0; y < cv.height; y++) { const r = col[y*4], gg = col[y*4+1], b = col[y*4+2], a = col[y*4+3];
      if (a > 200 && gg > 140 && b > 120 && r < 120) return y; }
    return -1;
  }
"""


def test_engram_curve_is_u_shaped_with_minimum_at_bottom(site):
    site.goto("engram")
    y_edge = site.ev(TEAL_ROW_AT, [0.02])
    y_mid = site.ev(TEAL_ROW_AT, [0.45])
    assert y_edge >= 0 and y_mid >= 0, "curve not found on canvas"
    assert y_mid > y_edge, f"minimum loss should be drawn lowest (edge y={y_edge}, mid y={y_mid})"


# ---------- TP / DP ----------

HBM_FILL_RGB = """
  (() => {
    const lab = [...App.labels].find(l => l.el.textContent === 'HBM');
    const fill = lab.parent.children.find(c => c.isMesh && Math.abs(c.scale.x - 1) > 1e-6);
    const c = fill.material.color; return `rgb(${Math.round(c.r*255)}, ${Math.round(c.g*255)}, ${Math.round(c.b*255)})`;
  })()
"""
LEGEND_RGB = """
  label => { const s = [...document.querySelectorAll('#legend span')].find(s => s.textContent.includes(label));
    return getComputedStyle(s.querySelector('i')).backgroundColor; }
"""


@pytest.mark.parametrize("scene_id", ["tp", "dp"])
def test_parallel_hbm_fill_matches_legend(site, scene_id):
    site.goto(scene_id)
    assert site.ev(HBM_FILL_RGB) == site.ev(LEGEND_RGB, "HBM 佔用")


def test_dp_can_show_a_model_that_does_not_fit_one_gpu(site):
    site.goto("dp")
    site.ctrl_button("70B").click()
    assert "放不下" in site.readout("80 GB 卡")
    site.goto("tp")
    site.ctrl_button("70B").click()
    site.set_slider("GPU 數", 1)
    assert "放不下" in site.readout("80 GB 卡")
    site.set_slider("GPU 數", 2)
    assert "放得下" in site.readout("80 GB 卡")


# ---------- CNN receptive field ----------

def test_cnn_receptive_field_accounts_for_stride_compounding(site):
    site.goto("cnn")
    site.set_slider("stride", 2)
    site.set_slider("堆幾層", 2)
    # k=3, stride 2, 2 layers: 1 + (k-1)*(1 + 2) = 7
    assert site.readout("堆層後的感受野").startswith("7×7")
    site.set_slider("堆幾層", 3)
    # 1 + 2*(1 + 2 + 4) = 15
    assert site.readout("堆層後的感受野").startswith("15×15")


# ---------- /goal marker ----------

MARKER_ON_NODE = """
  (() => { let marker = null, nodes = [];
    App.root.traverse(o => { if (!o.isMesh) return; const p = o.geometry.parameters;
      if (o.geometry.type === 'SphereGeometry' && Math.abs(p.radius - 0.16) < 1e-6) marker = o;
      if (o.geometry.type === 'SphereGeometry' && Math.abs(p.radius - 0.32) < 1e-6) nodes.push(o); });
    return nodes.some(n => Math.hypot(n.position.x - marker.position.x, n.position.z - marker.position.z) < 1e-3);
  })()
"""


def test_goal_marker_rests_on_a_node_after_every_step(site):
    site.goto("goal")
    for step in range(6):
        site.ctrl_button("單步").click()
        site.page.wait_for_timeout(900)  # the marker glides to its node; it must come to rest ON one
        assert site.ev(MARKER_ON_NODE), f"after step {step + 1} the marker sits between nodes"


# ---------- Embedding nearest-neighbour readout ----------

def test_embedding_readouts_use_the_distance_that_ranks_neighbours(site):
    site.goto("embedding")
    site.ctrl_button("「貓罐頭」").click()
    vals = [site.readout(f"最近鄰 {i}") for i in (1, 2, 3)]
    assert all("距離" in v for v in vals), vals
    nums = [float(v.split("距離")[1]) for v in vals]
    assert nums == sorted(nums), f"neighbours not ranked by the shown metric: {nums}"


# ---------- imatrix budget fairness ----------

def test_imatrix_mixed_allocation_averages_exactly_four_bits(site):
    site.goto("imatrix")
    assert site.readout("位元預算").startswith("4.00")


# ---------- QAT histogram bar placement ----------

QAT_BAR_XS = """
  (() => { const xs = []; App.root.traverse(o => { if (o.isMesh && o.geometry.type === 'BoxGeometry') {
    const p = o.geometry.parameters; if (Math.abs(p.width - 0.2) < 1e-6 && Math.abs(p.height - 1) < 1e-6) xs.push(o.position.x); } });
    return xs.sort((a, b) => a - b); })()
"""


def test_qat_histogram_bars_sit_on_bin_centres(site):
    site.goto("qat")
    xs = site.ev(QAT_BAR_XS)
    assert len(xs) == 40
    # bin b covers w ∈ [-1 + 2b/40, -1 + 2(b+1)/40]; its centre maps to ((b+0.5)/40 - 0.5) * 9 on the x axis
    assert xs[0] == pytest.approx((0.5 / 40 - 0.5) * 9, abs=1e-6)
    assert xs[-1] == pytest.approx((39.5 / 40 - 0.5) * 9, abs=1e-6)


# ---------- Agent loop log ----------

def test_agent_loop_log_has_no_leading_blank_and_ends_once(site):
    site.goto("agent-loop")
    log = site.page.locator("#ctrl .ctxbar + .log")  # the running log sits right under the context bar
    step = site.ctrl_button("單步")
    step.click()
    assert not log.text_content().startswith("\n")
    for _ in range(23):  # 21 scripted steps + 2 extra clicks
        step.click()
    assert log.text_content().count("腳本結束") == 1
