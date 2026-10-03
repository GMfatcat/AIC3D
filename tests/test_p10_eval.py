"""P10c — 模型評估 tab: cls-metrics, det-seg-metrics, text-metrics, llm-eval, retrieval-metrics, latency-metrics."""
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


# ---------- the tab ----------

def test_eval_tab_sits_after_training(site):
    assert site.ev("App.TABS.map(t => t.id)") == ["arch", "block", "model", "train", "eval", "optimize", "infra", "agent"]
    assert site.ev("App.catalog.filter(i => i.tab === 'eval').map(i => i.id)") == ["cls-metrics", "det-seg-metrics", "text-metrics", "llm-eval", "retrieval-metrics", "latency-metrics"]
    site.goto("cnn")
    site.page.keyboard.press("5")
    site.page.wait_for_function("!App.routing && App.currentItem.id === 'cls-metrics'")
    site.ev("App.intro.isOpen() && App.intro.enter('free')")
    site.page.keyboard.press("8")
    site.page.wait_for_function("!App.routing && App.currentItem.id === 'agent-loop'")
    assert site.ev("App.glossary.terms.filter(t => t.tab === 'eval').length") >= 10


# ---------- cls-metrics ----------

def test_cls_threshold_trades_precision_for_recall(site):
    site.goto("cls-metrics", settle=600)
    site.set_slider("門檻", 0.2)
    p_low, r_low = _num(site.readout("precision")), _num(site.readout("recall"))
    site.set_slider("門檻", 0.8)
    p_high, r_high = _num(site.readout("precision")), _num(site.readout("recall"))
    assert r_low > r_high and p_high > p_low, (p_low, r_low, p_high, r_high)
    tp, fp, fn, tn = [_num(site.readout(k)) for k in ("TP", "FP", "FN", "TN")]
    assert tp + fp + fn + tn == 40
    assert 0.5 < _num(site.readout("AUC")) <= 1
    site.page.focus(f"{FOCUS_BTN} >> nth=0")
    site.page.wait_for_timeout(200)
    assert "分數" in site.readout("滑到的樣本")
    site.assert_clean()


# ---------- det-seg-metrics ----------

def test_det_iou_threshold_flips_matches_and_map_averages_classes(site):
    site.goto("det-seg-metrics", settle=600)
    _seg(site, "偵測")
    site.set_slider("IoU 門檻", 0.5)
    tp50 = _num(site.readout("TP"))
    site.set_slider("IoU 門檻", 0.9)
    tp90 = _num(site.readout("TP"))
    assert tp90 < tp50
    site.set_slider("IoU 門檻", 0.5)
    m50 = _num(site.readout("mAP@0.5"))
    m5095 = _num(site.readout("mAP@0.5:0.95"))
    assert 0 < m5095 < m50 <= 1
    _seg(site, "分割")
    assert 0 < _num(site.readout("IoU")) < 1 and _num(site.readout("Dice")) > _num(site.readout("IoU"))
    site.page.focus(f"{FOCUS_BTN} >> nth=0")
    site.page.wait_for_timeout(200)
    assert site.readout("滑到的框") != "—"
    site.assert_clean()


# ---------- text-metrics ----------

def test_text_metrics_paraphrase_scores_low_on_bleu(site):
    site.goto("text-metrics", settle=600)
    _seg(site, "幾乎一樣")
    good = _num(site.readout("BLEU"))
    _seg(site, "同義改寫")
    para = _num(site.readout("BLEU"))
    assert good > 0.5 > para, (good, para)
    site.set_slider("n", 1)
    uni = _num(site.readout("n-gram 命中"))
    site.set_slider("n", 4)
    four = _num(site.readout("n-gram 命中"))
    assert uni >= four
    assert _num(site.readout("ROUGE-L")) > 0
    site.page.focus(f"{FOCUS_BTN} >> nth=0")
    site.page.wait_for_timeout(200)
    assert site.readout("滑到的詞") != "—"


# ---------- llm-eval ----------

def test_llm_eval_perplexity_pass_k_and_elo(site):
    site.goto("llm-eval", settle=600)
    _seg(site, "perplexity")
    site.set_slider("平均 loss", 1.0)
    assert abs(_num(site.readout("perplexity")) - 2.72) < 0.05
    _seg(site, "pass@k")
    site.set_slider("k", 1)
    p1 = _num(site.readout("pass@k"))
    site.set_slider("k", 10)
    p10 = _num(site.readout("pass@k"))
    assert p10 > p1
    _seg(site, "Elo")
    site.ctrl_button("重置").click()
    _steps(site, 30)
    assert "場" in site.readout("對戰數")
    assert _num(site.readout("A 的 Elo")) != _num(site.readout("B 的 Elo"))
    site.page.focus(f"{FOCUS_BTN} >> nth=0")
    site.page.wait_for_timeout(200)
    assert site.readout("滑到的物件") != "—"
    site.assert_clean()


# ---------- retrieval-metrics ----------

def test_retrieval_moving_a_relevant_doc_up_changes_mrr_and_ndcg(site):
    site.goto("retrieval-metrics", settle=600)
    site.ctrl_button("重置").click()
    base = {k: _num(site.readout(k)) for k in ("Recall@k", "MRR", "nDCG@k")}
    site.ctrl_button("把相關的往上移").click()
    site.page.wait_for_timeout(300)
    moved = {k: _num(site.readout(k)) for k in ("Recall@k", "MRR", "nDCG@k")}
    assert moved["MRR"] >= base["MRR"] and moved["nDCG@k"] > base["nDCG@k"]
    site.set_slider("k", 2)
    assert _num(site.readout("Recall@k")) <= moved["Recall@k"]
    site.page.focus(f"{FOCUS_BTN} >> nth=0")
    site.page.wait_for_timeout(200)
    assert "名" in site.readout("滑到的文件")


# ---------- latency-metrics ----------

def test_latency_ttft_grows_with_prompt_and_tpot_with_batch(site):
    site.goto("latency-metrics", settle=600)
    site.set_slider("prompt 長度", 512)
    t1 = _num(site.readout("TTFT"))
    site.set_slider("prompt 長度", 4096)
    t2 = _num(site.readout("TTFT"))
    assert t2 > t1
    site.set_slider("同時的請求數", 1)
    tp1 = _num(site.readout("TPOT"))
    thr1 = _num(site.readout("吞吐"))
    site.set_slider("同時的請求數", 16)
    tp16 = _num(site.readout("TPOT"))
    thr16 = _num(site.readout("吞吐"))
    assert tp16 > tp1 and thr16 > thr1
    site.ctrl_button("重置").click()
    _steps(site, 3)
    assert site.readout("階段") != "—"
    site.page.focus(f"{FOCUS_BTN} >> nth=0")
    site.page.wait_for_timeout(200)
    assert site.readout("滑到的區段") != "—"
    site.assert_clean()
