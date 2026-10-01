"""P5 — 壓縮與量化 tab: flip bits, density in 3D, hover feedback on every scene."""
import pytest

FOCUS_BTN = "#stage .focuslist button"


# ---------- fp ----------

def test_fp_clicking_a_mantissa_bit_changes_the_value(site):
    site.goto("fp", settle=800)
    before = site.ev("[...document.querySelectorAll('#ctrl .slider output')][0].textContent")
    chips = site.page.locator("#ctrl .bitrow .bitchip.man")
    assert chips.count() == 3
    assert site.ev("[...document.querySelectorAll('#ctrl .bitrow .bitchip')].every(c => c.tagName === 'BUTTON')"), "bit chips should be real buttons"
    chips.first.click()
    site.page.wait_for_timeout(300)
    after = site.ev("[...document.querySelectorAll('#ctrl .slider output')][0].textContent")
    assert before != after, "flipping a bit should move x to the value that bit pattern encodes"


def test_fp_shows_point_density_as_bars_and_hover_reads_a_bin(site):
    site.goto("fp", settle=800)
    bars = site.ev("(() => { let n = 0; App.root.traverse(o => { if (o.userData && o.userData.bin !== undefined && o.visible) n++; }); return n; })()")
    assert bars >= 3 * 20, "each format should show a density comb behind its axis"
    site.page.focus(f"{FOCUS_BTN} >> nth=4")
    site.page.wait_for_timeout(200)
    txt = site.readout("滑到的區間")
    assert "個點" in txt, txt


# ---------- gptq ----------

def test_gptq_hovering_a_cell_reports_the_weight(site):
    site.goto("gptq", settle=800)
    site.page.focus(f"{FOCUS_BTN} >> nth=9")  # row 2, col 2
    site.page.wait_for_timeout(200)
    txt = site.readout("滑到的權重")
    assert txt.startswith("第 2 列 第 2 欄"), txt


# ---------- exl3 ----------

def test_exl3_hovering_a_chosen_point_reports_its_error(site):
    site.goto("exl3", settle=800)
    site.page.focus(f"{FOCUS_BTN} >> nth=3")
    site.page.wait_for_timeout(200)
    txt = site.readout("滑到的欄")
    assert txt.startswith("第 4 欄") and "誤差" in txt, txt


# ---------- imatrix ----------

def test_imatrix_hovering_a_cell_reports_bits_and_importance(site):
    site.goto("imatrix", settle=800)
    site.page.focus(f"{FOCUS_BTN} >> nth=12")  # row 2, col 3 (10 per row)
    site.page.wait_for_timeout(200)
    txt = site.readout("滑到的權重")
    assert txt.startswith("第 2 列 第 3 欄") and "bit" in txt and "重要度" in txt, txt


# ---------- qat ----------

def test_qat_hovering_a_histogram_bar_reports_the_bin(site):
    site.goto("qat", settle=800)
    site.page.focus(f"{FOCUS_BTN} >> nth=20")
    site.page.wait_for_timeout(200)
    txt = site.readout("滑到的 bin")
    assert "個權重" in txt and "[" in txt, txt


# ---------- kvcache ----------

def test_kvcache_hovering_a_slab_reports_the_token(site):
    site.goto("kvcache", settle=800)
    for _ in range(5):
        site.ctrl_button("單步").click()
    site.page.focus(f"{FOCUS_BTN} >> nth=2")
    site.page.wait_for_timeout(200)
    txt = site.readout("滑到的 K/V 片")
    assert "良率" in txt and "KB" in txt, txt
