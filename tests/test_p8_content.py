"""P8 — content expansion: lora (LoRA / QLoRA / rsLoRA) in 壓縮與量化, rerank in 完整模型, RAG series in Agent."""
import re

import pytest

FOCUS_BTN = "#stage .focuslist button"


def _seg(site, text):
    site.page.locator("#ctrl .seg button", has_text=re.compile("^" + re.escape(text))).first.click()
    site.page.wait_for_timeout(250)


def _num(s):
    return float(re.search(r"[-\d.]+", s).group(0))


# ---------- lora ----------

def test_lora_trainable_share_grows_with_rank(site):
    site.goto("lora", settle=600)
    assert site.ev("App.currentItem.tab") == "optimize"
    site.set_slider("rank", 2)
    low = _num(site.readout("佔全參數的比例"))
    site.set_slider("rank", 8)
    high = _num(site.readout("佔全參數的比例"))
    assert 0 < low < high < 5, (low, high)
    assert "凍結" in site.readout("底模")


def test_qlora_quantizes_the_frozen_base(site):
    site.goto("lora", settle=600)
    assert site.readout("底模每參數 bytes").startswith("2")
    _seg(site, "QLoRA")
    assert site.readout("底模每參數 bytes").startswith("0.5")
    assert "4 bit" in site.readout("底模")


def test_rslora_keeps_the_update_size_at_high_rank(site):
    site.goto("lora", settle=600)
    site.set_slider("rank", 1)
    one = _num(site.readout("有效更新幅度"))
    site.set_slider("rank", 8)
    eight = _num(site.readout("有效更新幅度"))
    assert eight < one, (one, eight)
    _seg(site, "rsLoRA")
    assert abs(_num(site.readout("有效更新幅度")) - one) < 0.01


def test_lora_hovering_reports_frozen_or_trainable(site):
    site.goto("lora", settle=600)
    site.page.focus(f"{FOCUS_BTN} >> nth=0")
    site.page.wait_for_timeout(200)
    assert "凍結" in site.readout("滑到的格")
    n = site.ev("document.querySelectorAll('#stage .focuslist button').length")
    site.page.focus(f"{FOCUS_BTN} >> nth={n - 1}")
    site.page.wait_for_timeout(200)
    assert "可訓練" in site.readout("滑到的格")
    site.assert_clean()
