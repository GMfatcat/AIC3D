"""P10a — 基礎架構: diffusion (加噪 / 去噪), dllm (遮罩擴散 LLM vs 自回歸), clip (對比訓練 + zero-shot)."""
import re

import pytest

FOCUS_BTN = "#stage .focuslist button"


def _seg(site, text):
    site.page.locator("#ctrl .seg button", has_text=re.compile("^" + re.escape(text))).first.click()
    site.page.wait_for_timeout(250)


def _steps(site, n, settle=60):
    for _ in range(n):
        site.ctrl_button("單步").click()
        site.page.wait_for_timeout(settle)


def _num(s):
    return float(re.search(r"[-\d.]+", s).group(0))


# ---------- diffusion ----------

def test_diffusion_forward_noising_destroys_the_image_by_t_max(site):
    site.goto("diffusion", settle=600)
    assert site.ev("App.currentItem.tab") == "arch"
    _seg(site, "前向加噪")
    site.set_slider("t（加噪到第幾步）", 0)
    assert _num(site.readout("與原圖的誤差")) == 0
    assert _num(site.readout("ᾱ_t")) > 0.99
    site.set_slider("t（加噪到第幾步）", 1000)
    assert _num(site.readout("ᾱ_t")) < 0.01
    assert _num(site.readout("與原圖的誤差")) > 0.5
    _seg(site, "餘弦")
    site.set_slider("t（加噪到第幾步）", 500)
    cos = _num(site.readout("ᾱ_t"))
    _seg(site, "線性")
    lin = _num(site.readout("ᾱ_t"))
    assert cos != lin


def test_diffusion_reverse_sampling_recovers_the_image_in_s_steps(site):
    site.goto("diffusion", settle=600)
    _seg(site, "反向去噪")
    site.set_slider("取樣步數", 20)
    site.ctrl_button("重置").click()
    assert site.readout("已走") == "0 / 20"
    assert _num(site.readout("與原圖的誤差")) > 0.5
    _steps(site, 20)
    assert site.readout("已走") == "20 / 20"
    assert _num(site.readout("與原圖的誤差")) < 0.05
    site.set_slider("取樣步數", 4)
    site.ctrl_button("重置").click()
    _steps(site, 4)
    assert site.readout("已走") == "4 / 4"
    site.page.focus(f"{FOCUS_BTN} >> nth=0")
    site.page.wait_for_timeout(200)
    assert "亮度" in site.readout("滑到的像素")
    site.assert_clean()


# ---------- dllm ----------

def test_dllm_masked_diffusion_fills_the_sentence_in_parallel(site):
    site.goto("dllm", settle=600)
    _seg(site, "遮罩擴散")
    site.set_slider("去噪步數", 6)
    site.ctrl_button("重置").click()
    assert site.readout("已確定") == "0 / 12"
    _steps(site, 1)
    assert _num(site.readout("這一步填了")) >= 2
    _steps(site, 5)
    assert site.readout("已確定") == "12 / 12"
    assert "可以" in site.readout("可平行 / 可回頭改")
    site.set_slider("去噪步數", 3)
    site.ctrl_button("重置").click()
    _steps(site, 3)
    assert site.readout("已確定") == "12 / 12"


def test_dllm_autoregressive_needs_one_step_per_token(site):
    site.goto("dllm", settle=600)
    _seg(site, "自回歸")
    site.ctrl_button("重置").click()
    _steps(site, 6)
    assert site.readout("已確定") == "6 / 12"
    assert site.readout("這一步填了").startswith("1")
    assert "不能" in site.readout("可平行 / 可回頭改")
    site.page.focus(f"{FOCUS_BTN} >> nth=0")
    site.page.wait_for_timeout(200)
    assert "token" in site.readout("滑到的 token")
    site.assert_clean()


# ---------- clip ----------

def test_clip_contrastive_training_brightens_the_diagonal(site):
    site.goto("clip", settle=600)
    _seg(site, "對比訓練")
    site.ctrl_button("重置").click()
    before = _num(site.readout("對角線平均相似度"))
    _steps(site, 10)
    after = _num(site.readout("對角線平均相似度"))
    assert after > before + 0.2, (before, after)
    site.set_slider("batch 大小 N", 6)
    assert site.readout("負樣本數").startswith("30")
    assert site.ev("document.querySelectorAll('#stage .focuslist button').length") >= 36


def test_clip_zero_shot_picks_the_matching_prompt(site):
    site.goto("clip", settle=600)
    _seg(site, "對比訓練")
    site.ctrl_button("重置").click()
    _steps(site, 20)
    _seg(site, "zero-shot")
    res = site.readout("zero-shot 結果")
    assert "狗" in res and "%" in res, res
    site.page.focus(f"{FOCUS_BTN} >> nth=0")
    site.page.wait_for_timeout(200)
    assert "相似度" in site.readout("滑到的格")
    site.assert_clean()
