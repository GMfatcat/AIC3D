"""P10b — 訓練: optimizers (five balls down the same valley) and activations (curves, derivatives, gradient after N layers, softmax temperature)."""
import re

import pytest

FOCUS_BTN = "#stage .focuslist button"


def _seg(site, text):
    site.page.locator("#ctrl .seg button", has_text=re.compile("^" + re.escape(text))).first.click()
    site.page.wait_for_timeout(250)


def _steps(site, n, settle=50):
    for _ in range(n):
        site.ctrl_button("單步").click()
        site.page.wait_for_timeout(settle)


def _num(s):
    return float(re.search(r"[-\d.]+", s).group(0))


# ---------- optimizers ----------

def test_optimizers_adam_reaches_the_valley_floor_faster_than_sgd(site):
    site.goto("optimizers", settle=600)
    assert site.ev("App.currentItem.tab") == "train"
    site.ctrl_button("重置").click()
    _steps(site, 40)
    sgd = _num(site.readout("SGD 的 loss"))
    adam = _num(site.readout("Adam 的 loss"))
    assert adam < sgd, (sgd, adam)
    assert site.readout("步") == "40"


def test_optimizers_state_per_parameter_and_muon_scope(site):
    site.goto("optimizers", settle=600)
    _seg(site, "SGD")
    assert site.readout("每參數多存").startswith("0")
    _seg(site, "momentum")
    assert site.readout("每參數多存").startswith("1")
    _seg(site, "Adam")
    assert site.readout("每參數多存").startswith("2")
    _seg(site, "AdamW")
    assert "weight decay" in site.readout("特點")
    _seg(site, "Muon")
    assert "矩陣" in site.readout("特點")
    site.set_slider("learning rate", 1.0)
    site.ctrl_button("重置").click()
    _steps(site, 20)
    assert "發散" in site.readout("SGD 的 loss") or _num(site.readout("SGD 的 loss")) > 5
    site.page.focus(f"{FOCUS_BTN} >> nth=0")
    site.page.wait_for_timeout(200)
    assert "loss" in site.readout("滑到的球")
    site.assert_clean()


# ---------- activations ----------

def test_activations_sigmoid_vanishes_after_ten_layers_and_relu_does_not(site):
    site.goto("activations", settle=600)
    _seg(site, "sigmoid")
    site.set_slider("層數", 10)
    sig = _num(site.readout("N 層後的梯度"))
    _seg(site, "ReLU")
    relu = _num(site.readout("N 層後的梯度"))
    assert sig < 0.01 < relu, (sig, relu)
    _seg(site, "GELU")
    site.set_slider("x", -2)
    assert _num(site.readout("f(x)")) < 0
    assert "平滑" in site.readout("特點")


def test_activations_softmax_temperature_flattens_the_distribution(site):
    site.goto("activations", settle=600)
    _seg(site, "softmax")
    site.set_slider("溫度", 0.2)
    sharp = _num(site.readout("最大機率"))
    site.set_slider("溫度", 3)
    flat = _num(site.readout("最大機率"))
    assert sharp > 0.9 > flat > 0.3, (sharp, flat)
    site.page.focus(f"{FOCUS_BTN} >> nth=0")
    site.page.wait_for_timeout(200)
    assert site.readout("滑到的點") != "—"
    site.assert_clean()
