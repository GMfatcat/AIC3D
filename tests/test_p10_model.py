"""P10a — 完整模型: ldm (Latent Diffusion pipeline), sam2 (prompt → mask, video memory, SAM2-UNet mode), sam3 (concept prompt → all instances)."""
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


# ---------- ldm ----------

def test_ldm_pipeline_runs_text_latent_denoise_decode(site):
    site.goto("ldm", settle=600)
    assert site.ev("App.currentItem.tab") == "model"
    site.set_slider("去噪步數", 8)
    site.ctrl_button("重置").click()
    assert site.readout("階段") in ("—", "文字編碼")
    _steps(site, 1)
    assert site.readout("階段") == "文字編碼"
    _steps(site, 1)
    assert site.readout("階段").startswith("去噪 1 / 8")
    _steps(site, 7)
    assert site.readout("階段").startswith("去噪 8 / 8")
    _steps(site, 1)
    assert site.readout("階段") == "VAE 解碼"
    assert "latent" in site.readout("每步算在哪") and "64" in site.readout("每步算在哪")


def test_ldm_steps_and_cfg_trade_time_against_quality(site):
    site.goto("ldm", settle=600)
    site.set_slider("去噪步數", 8)
    t8 = _num(site.readout("總時間"))
    site.set_slider("去噪步數", 32)
    t32 = _num(site.readout("總時間"))
    assert t32 > t8 * 3
    site.set_slider("CFG 強度", 3)
    ok = site.readout("品質")
    site.set_slider("CFG 強度", 14)
    bad = site.readout("品質")
    assert ok != bad and "過" in bad, (ok, bad)
    _seg(site, "DiT")
    assert "DiT" in site.readout("去噪網路")
    site.page.focus(f"{FOCUS_BTN} >> nth=0")
    site.page.wait_for_timeout(200)
    assert site.readout("滑到的區塊") != "—"
    site.assert_clean()


# ---------- sam2 ----------

def test_sam2_point_prompts_select_one_object_and_negative_points_shrink_it(site):
    site.goto("sam2", settle=600)
    _seg(site, "SAM2 影像")
    _seg(site, "點狗")
    dog = _num(site.readout("遮罩面積"))
    _seg(site, "點球")
    ball = _num(site.readout("遮罩面積"))
    assert dog > ball > 0
    _seg(site, "點狗 + 負點")
    assert 0 < _num(site.readout("遮罩面積")) < dog
    assert "Hiera" in site.readout("編碼器")


def test_sam2_video_memory_keeps_the_mask_through_occlusion(site):
    site.goto("sam2", settle=600)
    _seg(site, "SAM2 影片")
    site.ctrl_button("重置").click()
    assert site.readout("記憶庫").startswith("0")
    _steps(site, 3)
    assert site.readout("記憶庫").startswith("3")
    _steps(site, 1)
    assert "記憶" in site.readout("這一幀") and "遮" in site.readout("這一幀")
    assert _num(site.readout("遮罩面積")) > 0
    site.page.focus(f"{FOCUS_BTN} >> nth=0")
    site.page.wait_for_timeout(200)
    assert "格" in site.readout("滑到的格")


def test_sam2_unet_mode_freezes_the_encoder_and_needs_no_prompt(site):
    site.goto("sam2", settle=600)
    _seg(site, "SAM2-UNet")
    assert _num(site.readout("可訓練參數")) < 20
    assert "不用" in site.readout("提示")
    _seg(site, "醫學")
    assert "醫學" in site.readout("任務")
    assert _num(site.readout("遮罩面積")) > 0
    site.assert_clean()


# ---------- sam3 ----------

def test_sam3_concept_prompt_finds_every_instance_and_reports_absence(site):
    site.goto("sam3", settle=600)
    _seg(site, "狗")
    assert site.readout("找到的實例").startswith("3")
    assert "是" in site.readout("存在")
    _seg(site, "貓")
    assert site.readout("找到的實例").startswith("1")
    _seg(site, "斑馬")
    assert site.readout("找到的實例").startswith("0")
    assert "否" in site.readout("存在")


def test_sam3_versus_sam2_and_tracking(site):
    site.goto("sam3", settle=600)
    _seg(site, "狗")
    _seg(site, "SAM2（點一個）")
    assert site.readout("找到的實例").startswith("1")
    _seg(site, "SAM3（概念）")
    site.ctrl_button("重置").click()
    _steps(site, 2)
    assert "3" in site.readout("追蹤中")
    site.page.focus(f"{FOCUS_BTN} >> nth=0")
    site.page.wait_for_timeout(200)
    assert "格" in site.readout("滑到的格")
    site.assert_clean()
