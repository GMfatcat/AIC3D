"""P1 — accessibility basics: names for controls, keyboard paths, non-colour cues, contrast."""
import pytest


def test_every_slider_has_a_programmatic_name(site):
    site.goto("stages")
    unnamed = site.ev("""[...document.querySelectorAll('#ctrl input[type=range]')].filter(i => {
        const byFor = i.id && document.querySelector(`label[for="${i.id}"]`);
        return !(byFor || i.getAttribute('aria-label') || i.closest('label')); }).length""")
    assert unnamed == 0


def test_segmented_controls_are_labelled_groups(site):
    site.goto("stages")
    bad = site.ev("""[...document.querySelectorAll('#ctrl .seg')].filter(s => s.getAttribute('role') !== 'group' || !(s.getAttribute('aria-label') || s.getAttribute('aria-labelledby'))).length""")
    assert bad == 0


def test_tabs_are_a_keyboard_tablist(site):
    site.goto("cnn")
    assert site.ev("document.getElementById('tabs').getAttribute('role')") == "tablist"
    site.page.focus("#tabs button[aria-selected='true']")
    site.page.keyboard.press("ArrowRight")
    site.page.wait_for_timeout(300)
    assert site.ev("document.querySelector('#tabs button[aria-selected=\"true\"]').dataset.tab") == "block"
    assert site.ev("document.activeElement.closest('#intro') !== null"), "first visit: focus goes into the intro card"
    site.ev("App.intro.enter('free')")
    assert site.ev("document.activeElement.dataset.tab") == "block", "closing the card gives focus back to the tab"


def test_canvas_and_charts_have_text_alternatives(site):
    site.goto("engram")
    assert site.ev("document.getElementById('gl').getAttribute('aria-label')")
    assert site.ev("[...document.querySelectorAll('#overlay canvas')].every(c => c.getAttribute('role') === 'img' && c.getAttribute('aria-label'))")
    site.goto("mhc")
    assert site.ev("[...document.querySelectorAll('#overlay canvas')].every(c => c.getAttribute('role') === 'img' && c.getAttribute('aria-label'))")


def test_readout_state_is_not_colour_only(site):
    site.goto("compact")
    bad_glyph, ok_glyph = site.ev("""(() => { const g = cls => { const d = document.querySelector('#ctrl .readouts dd.' + cls); return d ? getComputedStyle(d, '::before').content : null; };
        return [g('bad'), g('ok')]; })()""")
    assert bad_glyph not in (None, "none", '""'), f"dd.bad has no non-colour marker: {bad_glyph}"
    assert ok_glyph not in (None, "none", '""'), f"dd.ok has no non-colour marker: {ok_glyph}"
    assert bad_glyph != ok_glyph


def _luminance(rgb):
    def ch(c):
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def test_hint_text_meets_aa_contrast_on_panel(site):
    site.goto("cnn")
    fg, bg = site.ev("""(() => { const cs = getComputedStyle(document.documentElement);
        const p = v => cs.getPropertyValue(v).trim().replace('#','');
        const h = s => [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16));
        return [h(p('--fg3')), h(p('--bg2'))]; })()""")
    l1, l2 = sorted([_luminance(fg), _luminance(bg)], reverse=True)
    ratio = (l1 + 0.05) / (l2 + 0.05)
    assert ratio >= 4.5, f"--fg3 on --bg2 is {ratio:.2f}:1"


def test_mhc_matrix_cells_are_keyboard_editable(site):
    site.goto("mhc")
    cell = site.page.locator(".mat.edit .cell").first
    assert cell.get_attribute("role") == "spinbutton"
    assert cell.get_attribute("tabindex") == "0"
    before = float(cell.text_content())
    cell.focus()
    site.page.keyboard.press("ArrowUp")
    site.page.wait_for_timeout(100)
    after = float(site.page.locator(".mat.edit .cell").first.text_content())
    assert after == pytest.approx(before + 0.1, abs=1e-6)
    assert site.page.locator(".mat.edit .cell").first.get_attribute("aria-valuenow") == f"{after:.2f}"
