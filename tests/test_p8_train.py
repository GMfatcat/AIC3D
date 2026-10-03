"""P8 — 訓練 tab: train-step (forward → loss → backward → update), sft (loss mask on the answer),
rl (group of answers → reward → advantage → update, KL leash), train-mem (what a GPU holds while training)."""
import re

import pytest

FOCUS_BTN = "#stage .focuslist button"


def _seg(site, text):
    site.page.locator("#ctrl .seg button", has_text=re.compile("^" + re.escape(text))).first.click()
    site.page.wait_for_timeout(250)


def _steps(site, n, settle=80):
    for _ in range(n):
        site.ctrl_button("單步").click()
        site.page.wait_for_timeout(settle)


# ---------- the tab ----------

def test_training_tab_sits_between_model_and_optimize(site):
    assert site.ev("App.TABS.map(t => t.id)") == ["arch", "block", "model", "train", "optimize", "infra", "agent"]
    assert site.ev("App.catalog.filter(i => i.tab === 'train').map(i => i.id)") == ["train-step", "sft", "rl", "train-mem"]
    site.goto("cnn")
    site.page.keyboard.press("4")
    site.page.wait_for_function("!App.routing && App.currentItem.id === 'train-step'")
    site.ev("App.intro.isOpen() && App.intro.enter('free')")
    site.page.keyboard.press("5")
    site.page.wait_for_function("!App.routing && App.currentItem.id === 'kvcache'")


def test_training_tour_and_glossary_terms_exist(site):
    tour = site.ev("App.tours.find(t => t.id === 'train')")
    assert tour and [s[0] for s in tour["steps"]][:4] == ["train-step", "sft", "rl", "train-mem"]
    assert site.ev("App.glossary.terms.filter(t => t.tab === 'train').length") >= 12
    for alias in ["SFT", "GRPO", "KL", "RLVR", "ZeRO", "gradient checkpointing", "learning rate"]:
        assert site.ev("a => App.termify('x ' + a + ' y').includes('a class=\"term\"')", alias), alias


# ---------- train-step ----------

def test_train_step_four_half_steps_make_one_training_step(site):
    site.goto("train-step", settle=800)
    site.ctrl_button("重置").click()
    site.page.wait_for_timeout(100)
    assert site.readout("訓練步") == "0"
    seen = []
    for _ in range(4):
        _steps(site, 1)
        seen.append(site.readout("半步"))
    assert seen == ["前向", "算 loss", "反向", "更新"], seen
    assert site.readout("訓練步") == "1"


def test_train_step_loss_falls_and_a_bigger_learning_rate_falls_faster(site):
    site.goto("train-step", settle=800)
    site.ctrl_button("重置").click()
    site.page.wait_for_timeout(100)
    l0 = float(site.readout("平均 loss"))
    site.set_slider("learning rate", 0.2)
    _steps(site, 12)
    slow = float(site.readout("平均 loss"))
    site.ctrl_button("重置").click()
    site.set_slider("learning rate", 1.5)
    _steps(site, 12)
    fast = float(site.readout("平均 loss"))
    assert fast < slow < l0, (l0, slow, fast)
    site.assert_clean()


def test_train_step_hovering_a_bar_reports_the_candidate(site):
    site.goto("train-step", settle=800)
    site.page.focus(f"{FOCUS_BTN} >> nth=3")
    site.page.wait_for_timeout(200)
    txt = site.readout("滑到的柱")
    assert "p =" in txt and "位置" in txt, txt


# ---------- sft ----------

def test_sft_only_the_answer_tokens_count_by_default(site):
    site.goto("sft", settle=800)
    src = site.readout("loss 來源")
    assert "回答" in src and "不算" in src, src
    _seg(site, "全部 token")
    src = site.readout("loss 來源")
    assert "含問題" in src, src


def test_sft_answer_loss_falls_slower_when_the_question_is_trained_too(site):
    site.goto("sft", settle=800)
    site.ctrl_button("重置").click()
    _steps(site, 10)
    only = float(site.readout("回答段平均 loss"))
    _seg(site, "全部 token")
    site.ctrl_button("重置").click()
    _steps(site, 10)
    both = float(site.readout("回答段平均 loss"))
    assert both > only, (only, both)


def test_sft_template_off_removes_the_special_tokens(site):
    site.goto("sft", settle=800)
    n_on = int(site.readout("token 數").split()[0])
    _seg(site, "無")
    n_off = int(site.readout("token 數").split()[0])
    assert n_off < n_on, (n_on, n_off)
    site.page.focus(f"{FOCUS_BTN} >> nth=1")
    site.page.wait_for_timeout(200)
    assert "loss" in site.readout("滑到的 token")


# ---------- rl ----------

def test_rl_grpo_baseline_is_the_group_mean(site):
    site.goto("rl", settle=800)
    site.ctrl_button("重置").click()
    _steps(site, 3)
    assert "組內平均" in site.readout("基準")
    assert site.readout("半步") == "算優勢"
    _seg(site, "PPO")
    site.ctrl_button("重置").click()
    _steps(site, 3)
    assert "critic" in site.readout("基準")
    _seg(site, "DPO")
    site.ctrl_button("重置").click()
    _steps(site, 3)
    assert "偏好" in site.readout("基準")
    site.assert_clean()


def test_rl_kl_coefficient_leashes_the_policy(site):
    site.goto("rl", settle=800)
    site.set_slider("KL 係數", 0)
    site.ctrl_button("重置").click()
    _steps(site, 12)
    loose = float(site.readout("與原模型的距離").split()[0])
    site.set_slider("KL 係數", 1)
    site.ctrl_button("重置").click()
    _steps(site, 12)
    tight = float(site.readout("與原模型的距離").split()[0])
    assert tight < loose, (loose, tight)
    assert float(site.readout("平均獎勵")) > 0


def test_rl_hovering_an_answer_reports_its_reward(site):
    site.goto("rl", settle=800)
    _steps(site, 2)
    site.page.focus(f"{FOCUS_BTN} >> nth=0")
    site.page.wait_for_timeout(200)
    assert "獎勵" in site.readout("滑到的回答")


# ---------- train-mem ----------

def test_train_mem_bytes_per_param_by_method(site):
    site.goto("train-mem", settle=800)
    assert site.readout("每參數 bytes").startswith("16")
    _seg(site, "8-bit optimizer")
    assert site.readout("每參數 bytes").startswith("10")
    _seg(site, "QLoRA")
    assert float(site.readout("每參數 bytes").split()[0]) < 1
    _seg(site, "只推論")
    assert site.readout("每參數 bytes").startswith("2")


def test_train_mem_sharding_and_checkpointing_shrink_the_per_gpu_total(site):
    site.goto("train-mem", settle=800)
    _seg(site, "70B")
    one = float(site.readout("每卡合計").split()[0])
    assert "bad" in site.ev("[...document.querySelectorAll('#ctrl .readouts dt')].find(d => d.textContent.trim() === '每卡合計').nextElementSibling.className")
    site.set_slider("GPU 數", 8)
    _seg(site, "ZeRO-3")
    sharded = float(site.readout("每卡合計").split()[0])
    assert sharded < one / 4, (one, sharded)
    act_before = float(site.readout("activation").split()[0])
    _seg(site, "開")
    act_after = float(site.readout("activation").split()[0])
    assert act_after < act_before
    assert site.ev("document.querySelectorAll('#stage .focuslist button').length") >= 8 * 4
    site.page.focus(f"{FOCUS_BTN} >> nth=2")
    site.page.wait_for_timeout(200)
    assert "GB" in site.readout("滑到的區塊")
    site.assert_clean()
