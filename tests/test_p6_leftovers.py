"""The last backlog items: a real glow material, collapsible groups for dense panels, hover readouts everywhere, sidebar numbering."""
import pytest

FOCUS_BTN = "#stage .focuslist button"


def test_mat_uses_a_material_class_instead_of_a_per_instance_hack(site):
    site.goto("residual")
    assert site.ev("P.mat('signal', {glow: 1}) instanceof P.GlowMaterial")
    assert site.ev("Object.getOwnPropertyDescriptor(P.mat('signal'), 'emissiveIntensity') === undefined"), "no defineProperty on the instance"
    assert site.ev("P.mat('signal', {glow: 1}).emissiveIntensity") == pytest.approx(0.06 + 0.32 / 1.2, abs=1e-6)  # glow 1.2 is the top of the range
    assert site.ev("(() => { const m = P.mat('signal'); m.emissiveIntensity = 5; return m.emissiveIntensity; })()") == pytest.approx(0.38, abs=1e-6), "still clamped"
    assert site.ev("(() => { const m = P.mat('signal', {glow: 0.9}); const c = m.clone(); return c.emissiveIntensity; })()") == pytest.approx(0.06 + 0.32 * 0.9 / 1.2, abs=1e-6)


@pytest.mark.parametrize("scene_id,summary,min_readouts", [("stages", "規格", 3), ("ocr", "多頁", 2)])
def test_dense_panels_fold_secondary_readouts_into_a_details_group(site, scene_id, summary, min_readouts):
    site.goto(scene_id)
    n = site.ev("s => { const d = [...document.querySelectorAll('#ctrl details')].find(d => d.querySelector('summary').textContent.includes(s)); return d ? d.querySelectorAll('.readouts dt').length : -1; }", summary)
    assert n >= min_readouts, f"{scene_id}: expected a folded group '{summary}' with readouts, got {n}"
    assert site.ev("[...document.querySelectorAll('#ctrl details')].every(d => !d.open)"), "secondary groups start folded"


def test_cnn_and_transformer_hover_also_write_a_panel_readout(site):
    site.goto("cnn", settle=800)
    site.page.focus(f"{FOCUS_BTN} >> nth=7")
    site.page.wait_for_timeout(200)
    txt = site.readout("滑到的輸出格")
    assert "第 2 列" in txt and "第 2 欄" in txt, txt
    site.goto("transformer", settle=800)
    site.page.focus(f"{FOCUS_BTN} >> nth=2")
    site.page.wait_for_timeout(200)
    txt = site.readout("滑到的 query")
    assert "想" in txt and "個 key" in txt, txt


def test_sidebar_items_are_numbered(site):
    site.goto("residual")
    nums = site.ev("[...document.querySelectorAll('#items a .num')].map(e => e.textContent)")
    assert nums == ["1", "2", "3", "4", "5"], nums
