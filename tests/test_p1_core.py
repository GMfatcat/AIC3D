"""P1 — camera API that actually works, resources that get released, no per-frame waste."""
import pathlib
import re

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCENE_FILES = sorted(p for p in (ROOT / "scenes").glob("*.js") if p.name != "_catalog.js")

GEOMETRIES = "App.renderer.info.memory.geometries"
LABEL_COUNT = "App.labels.size"
EMPTY_LABELS = "[...document.querySelectorAll('#labels .l3d')].filter(e => e.textContent === '').length"


# ---------- camera ----------

def test_set_camera_zoom_scales_the_fitted_distance(site):
    site.goto("residual")
    fitted = site.ev("App.camHome.dist")
    site.ev("App.setCamera({theta: 0.3, phi: 1.2, zoom: 1.5}); App.fit()")
    assert site.ev("App.camHome.dist") == pytest.approx(fitted * 1.5, rel=1e-6)
    assert site.ev("App.cam.dist") == pytest.approx(fitted * 1.5, rel=1e-6)


@pytest.mark.parametrize("path", SCENE_FILES, ids=lambda p: p.name)
def test_scenes_do_not_pass_dead_camera_parameters(path):
    src = path.read_text(encoding="utf-8")
    calls = re.findall(r"setCamera\(\{[^}]*\}", src)
    bad = [c for c in calls if re.search(r"\b(dist|target)\s*:", c)]
    assert not bad, f"{path.name}: fit() overrides dist/target, use zoom instead: {bad}"


def test_auto_spin_is_time_based(site):
    site.goto("residual", settle=200)
    site.ev("App.autoSpin = true; App.cam.theta = 0; App._spinT0 = performance.now()")
    site.page.wait_for_timeout(600)
    theta, ms = site.ev("[App.cam.theta, performance.now() - App._spinT0]")
    rate = theta / (ms / 1000)
    assert 0.05 < rate < 0.1, f"spin rate {rate:.3f} rad/s is not ≈0.072 rad/s (frame-rate independent)"


# ---------- resources ----------

def test_switching_scenes_releases_gpu_geometries(site):
    site.goto("cnn"); site.goto("mhc"); site.goto("cnn")
    first = site.ev(GEOMETRIES)
    for _ in range(3):
        site.goto("mhc"); site.goto("cnn")
    assert site.ev(GEOMETRIES) == first, "geometries accumulate across scene switches"


LIVE_GEOMETRIES = "(() => { const s = new Set(); App.scene.traverse(o => { if (o.geometry) s.add(o.geometry.uuid); }); return s.size; })()"


def test_ocr_stepper_does_not_leak_geometries(site):
    site.goto("ocr")
    step = site.ctrl_button("單步")
    for _ in range(9):
        step.click(); site.page.wait_for_timeout(60)
    site.page.wait_for_timeout(200)
    # the renderer may hold at most what is actually in the scene (plus a couple of helpers)
    assert site.ev(GEOMETRIES) <= site.ev(LIVE_GEOMETRIES) + 2, "OCR rebuilds meshes every step without disposing"


def test_vllm_redraw_does_not_accumulate_labels(site):
    site.goto("vllm")
    base = site.ev(LABEL_COUNT)
    for _ in range(4):
        site.ctrl_button("全部生成一步").click()
    site.page.wait_for_timeout(200)
    assert site.ev(LABEL_COUNT) == base, "labels removed from the scene stay registered"


@pytest.mark.parametrize("scene_id", ["tp", "dp", "stages", "imatrix"])
def test_no_empty_text_labels_in_dom(site, scene_id):
    site.goto(scene_id)
    assert site.ev(EMPTY_LABELS) == 0


def test_towers_expert_choice_is_reproducible(site):
    site.goto("nemotron")
    a = site.ev("App.current._inner.highlightLayer(10)")
    site.ev("App.current._inner.highlightLayer(12)")
    b = site.ev("App.current._inner.highlightLayer(10)")
    assert a and a == b, "the experts lit for a given layer must not depend on history (no Math.random)"
    assert a != site.ev("App.current._inner.highlightLayer(12)")


def test_scene_can_register_cleanup_with_on_dispose(site):
    site.goto("vllm")
    site.ev("App.current.__ran = 0; App.ctx.onDispose(() => { window.__disposed = (window.__disposed || 0) + 1; })")
    site.goto("cnn")
    assert site.ev("window.__disposed") == 1


# ---------- static hygiene ----------

@pytest.mark.parametrize("path", SCENE_FILES, ids=lambda p: p.name)
def test_scene_uses_ctx_app_not_global_app_for_hover(path):
    src = path.read_text(encoding="utf-8")
    assert "App.hover(" not in src, f"{path.name} reaches for the global App; use ctx.app.hover"


@pytest.mark.parametrize("path", SCENE_FILES, ids=lambda p: p.name)
def test_scene_builds_materials_through_p_mat(path):
    src = path.read_text(encoding="utf-8")
    assert "MeshStandardMaterial" not in src, f"{path.name} bypasses P.mat (emissive clamp, palette); use P.mat(color, {{extra: {{...}}}})"


@pytest.mark.parametrize("path", SCENE_FILES, ids=lambda p: p.name)
def test_scene_has_no_inline_style_blocks(path):
    src = path.read_text(encoding="utf-8")
    hits = re.findall(r"style\.cssText\s*=|style=\"|onclick=", src)
    assert not hits, f"{path.name} uses inline styles / handlers: {hits}; add a class to theme.css"
