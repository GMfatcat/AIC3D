"""P3 — visual upgrade: top bar, label system, lighting, instrument-like panel, phone dock, sidebar."""
import pathlib
import re

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCENE_FILES = sorted(p for p in (ROOT / "scenes").glob("*.js") if p.name != "_catalog.js")

RECT = "e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }"
VISIBLE_LABELS = """
  [...document.querySelectorAll('#labels .l3d')].filter(e => e.style.display !== 'none' && e.textContent.trim()).map(e => {
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    return { text: e.textContent, rect: [r.left, r.top, r.right, r.bottom], font: parseFloat(cs.fontSize),
             scale: (e.style.transform.match(/scale\\(([\\d.]+)\\)/) || [0, 1])[1] * 1, bg: cs.backgroundColor, cls: e.className, op: parseFloat(cs.opacity) }; })
"""


def _overlaps(a, b):
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])


def _stacked(a, b):
    """True overlap: boxes intersect AND the horizontal overlap is at least half the narrower label."""
    if not _overlaps(a, b):
        return False
    ox = min(a[2], b[2]) - max(a[0], b[0])
    return ox >= 0.5 * min(a[2] - a[0], b[2] - b[0])


# ---------- top bar ----------

def test_tabs_are_all_chinese_and_progress_is_position(site):
    site.goto("residual")
    labels = site.ev("[...document.querySelectorAll('#tabs button')].map(b => b.textContent)")
    assert labels == ["基礎架構", "模型積木", "完整模型", "訓練", "壓縮與量化", "推論基礎設施", "Agent"]
    assert site.ev("document.getElementById('progress').textContent").replace(" ", "") == "14/53"
    assert site.ev("document.querySelector('#top .brand small').textContent") == "看懂概念，不追數值"


def test_camera_hint_fades_after_first_drag(site):
    site.goto("residual")
    assert site.ev("parseFloat(getComputedStyle(document.getElementById('camhint')).opacity)") == 1
    box = site.page.locator("#gl").bounding_box()
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    site.page.mouse.move(cx, cy); site.page.mouse.down(); site.page.mouse.move(cx + 60, cy + 10, steps=4); site.page.mouse.up()
    site.page.wait_for_timeout(900)
    assert site.ev("parseFloat(getComputedStyle(document.getElementById('camhint')).opacity)") == 0


# ---------- labels ----------

@pytest.mark.parametrize("scene_id", ["deepseek-v4", "stages", "attention"])
def test_labels_never_render_below_twelve_px(site, scene_id):
    site.goto(scene_id, settle=1200)
    labs = site.ev(VISIBLE_LABELS)
    assert labs
    small = [(l["text"], l["font"], l["scale"]) for l in labs if l["font"] * l["scale"] < 11.99]
    assert not small, f"labels too small to read: {small[:5]}"


def test_labels_have_three_tiers_and_a_backdrop(site):
    site.goto("attention", settle=600)
    fonts = site.ev("""(() => { const out = {}; for (const [size, tier] of [[24, 'title'], [20, 'axis'], [16, 'value']]) {
        const l = P.label('x', {size}); App.root.add(l); document.getElementById('labels').appendChild(l.el); const cs = getComputedStyle(l.el); out[tier] = [l.el.classList.contains('l3d-' + tier), parseFloat(cs.fontSize), cs.backgroundColor]; } return out; })()""")
    assert all(v[0] for v in fonts.values()), f"tier classes missing: {fonts}"
    assert fonts["title"][1] > fonts["axis"][1] > fonts["value"][1] >= 12
    assert all(v[2] not in ("rgba(0, 0, 0, 0)", "transparent") for v in fonts.values()), "labels need a faint backdrop"


def test_label_hidden_behind_geometry_fades(site):
    site.goto("residual", settle=1200)
    site.ev("""(() => { const lab = [...App.labels].find(l => l.el.textContent.includes('輸入'));
        const p = lab.getWorldPosition(new THREE.Vector3()); const dir = App.camera.position.clone().sub(p).normalize();
        const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 0.3), P.mat('structure')); wall.position.copy(p).addScaledVector(dir, 2); wall.lookAt(App.camera.position);
        wall.name = '__wall'; App.root.add(wall); window.__lab = lab; })()""")
    site.page.wait_for_timeout(400)
    assert site.ev("parseFloat(getComputedStyle(window.__lab.el).opacity)") < 0.5, "occluded label should fade"
    site.ev("P.drop(App.root.getObjectByName('__wall'))")
    site.page.wait_for_timeout(400)
    assert site.ev("parseFloat(getComputedStyle(window.__lab.el).opacity)") == 1


def test_overlapping_labels_are_pushed_apart(site):
    site.goto("embedding", settle=1200)
    rects = [l["rect"] for l in site.ev(VISIBLE_LABELS)]
    pairs = [(i, j) for i in range(len(rects)) for j in range(i + 1, len(rects)) if _stacked(rects[i], rects[j])]
    assert not pairs, f"{len(pairs)} stacked label pairs"


@pytest.mark.parametrize("scene_id", ["transformer", "deepseek-v4", "mhc"])
def test_fit_keeps_labels_out_of_title_and_legend(site, scene_id):
    site.goto(scene_id, settle=1300)
    info = site.ev(RECT.replace("e =>", "() =>").replace("(e)", "(document.getElementById('info'))").replace("e.getBoundingClientRect", "document.getElementById('info').getBoundingClientRect"))
    legend = site.ev("(() => { const r = document.getElementById('legend').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })()")
    labs = site.ev(VISIBLE_LABELS)
    hits = [l["text"] for l in labs if _overlaps(l["rect"], info) or _overlaps(l["rect"], legend)]
    assert not hits, f"labels collide with title/legend: {hits}"


# ---------- lighting ----------

def test_stage_has_gradient_background_vignette_and_transparent_canvas(site):
    site.goto("residual")
    assert site.ev("App.renderer.getClearAlpha()") == 0
    assert "radial-gradient" in site.ev("getComputedStyle(document.getElementById('stage')).backgroundImage")
    assert site.ev("!!document.getElementById('vignette')")


def test_materials_get_environment_reflections_and_rim_light(site):
    site.goto("residual")
    assert site.ev("(() => { let m; App.root.traverse(o => { if (o.isMesh && o.material.isMeshStandardMaterial && !m) m = o.material; }); return !!(m && m.envMap); })()")
    assert site.ev("(() => { let r; App.scene.traverse(o => { if (o.isDirectionalLight && o.name === 'rim') r = o; }); return !!r; })()")
    assert site.ev("!!(App.grid && App.grid.material && App.grid.material.map)"), "grid should be a texture that fades with distance"


# ---------- instrument panel ----------

def test_custom_slider_has_track_fill_thumb_and_keyboard_path(site):
    site.goto("residual")
    assert site.ev("!!document.querySelector('#ctrl .slider .track') && !!document.querySelector('#ctrl .slider .fill') && !!document.querySelector('#ctrl .slider .thumb')")
    inp = site.page.locator("#ctrl .slider input[type=range]").first
    before = site.ev("document.querySelector('#ctrl .slider .fill').style.width")
    inp.focus(); site.page.keyboard.press("ArrowRight")
    site.page.wait_for_timeout(100)
    assert site.ev("document.querySelector('#ctrl .slider .fill').style.width") != before


def test_slider_shows_value_bubble_while_dragging(site):
    site.goto("residual")
    thumb = site.page.locator("#ctrl .slider .track").first
    box = thumb.bounding_box()
    assert site.ev("getComputedStyle(document.querySelector('#ctrl .slider .bubble')).opacity") == "0"
    site.page.mouse.move(box["x"] + box["width"] * 0.3, box["y"] + box["height"] / 2); site.page.mouse.down()
    site.page.wait_for_timeout(300)  # bubble fades in over 150ms
    assert site.ev("getComputedStyle(document.querySelector('#ctrl .slider .bubble')).opacity") == "1"
    site.page.mouse.up()


def test_long_readout_values_wrap_onto_their_own_line(site):
    site.goto("deepseek-v4")
    assert site.ev("""(() => { const dt = [...document.querySelectorAll('#ctrl .readouts dt')].find(d => d.textContent.trim() === 'MoE'); const dd = dt.nextElementSibling;
        return dd.classList.contains('long') && getComputedStyle(dd).gridColumnEnd === 'span 2'; })()""")


@pytest.mark.parametrize("scene_id", ["kvcache", "stages", "transformer"])
def test_segmented_buttons_stay_on_one_line(site, scene_id):
    site.goto(scene_id)
    tall = site.ev("[...document.querySelectorAll('#ctrl .seg button')].filter(b => b.getBoundingClientRect().height > 34).map(b => b.textContent)")
    assert not tall, f"segmented labels wrap: {tall}"


def test_stepper_and_tour_buttons_use_svg_icons(site):
    site.goto("cnn")
    assert site.ev("document.querySelectorAll('#ctrl .btnrow svg.icon').length") >= 3
    assert not site.ev("/[⏭▶⏸▾]/.test(document.getElementById('ctrl').textContent + document.getElementById('top').textContent)")


@pytest.mark.parametrize("path", SCENE_FILES, ids=lambda p: p.name)
def test_controls_follow_the_panel_order(path):
    src = path.read_text(encoding="utf-8")
    for block in re.split(r"App\.register\(", src)[1:]:
        first_heading = block.find("ctrl.heading(")
        others = [block.find(k) for k in ("ctrl.slider(", "ctrl.segmented(", "ctrl.stepper(", "ctrl.buttons(", "ctrl.readouts(", "ctrl.note(") if k in block]
        if others:
            assert first_heading >= 0 and first_heading < min(others), f"{path.name}: heading must come first"
        r, n = block.find("ctrl.readouts("), block.find("ctrl.note(")
        if r >= 0 and n >= 0:
            assert r < n, f"{path.name}: readouts must come before the note"


def test_token_row_style_eases_glow(site):
    site.goto("attention", settle=1200)
    final = site.ev("P.mat('signal',{glow:0.8}).emissiveIntensity")
    site.set_slider("哪個 token 當 Query", 0)
    mid = site.ev("(() => { let c; App.root.traverse(o => { if (o.isMesh && o.geometry.type === 'BoxGeometry' && Math.abs(o.geometry.parameters.width - 0.55) < 1e-6 && !c) c = o; }); return c.material.emissiveIntensity; })()")
    assert mid < final - 1e-3, "glow should ease toward the new value, not jump"
    site.page.wait_for_timeout(600)
    end = site.ev("(() => { let c; App.root.traverse(o => { if (o.isMesh && o.geometry.type === 'BoxGeometry' && Math.abs(o.geometry.parameters.width - 0.55) < 1e-6 && !c) c = o; }); return c.material.emissiveIntensity; })()")
    assert end == pytest.approx(final, abs=1e-3)


# ---------- phone + sidebar ----------

def test_phone_docks_overlay_cards_into_the_panel(phone_site):
    phone_site.goto("mhc")
    assert phone_site.ev("!!document.querySelector('#ctrl .ovl-card') && !document.querySelector('#overlay .ovl-card')")


def test_sidebar_is_a_list_of_links(site):
    site.goto("residual")
    assert site.ev("document.getElementById('items').tagName") == "UL"
    assert site.ev("document.querySelectorAll('#items li a').length") == 5
    assert site.ev("document.querySelector('#items a[aria-current=\"page\"] .t').textContent") == "Residual Block"


def test_token_row_labels_are_in_the_scene(site):
    """Regression: an inline comment once swallowed the group.add(label) call and every token word vanished."""
    site.goto("transformer", settle=800)
    texts = site.ev("[...document.querySelectorAll('#labels .l3d')].map(e => e.textContent)")
    assert texts.count("牛肉麵") == 2, texts
