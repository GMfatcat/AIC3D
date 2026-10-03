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


# ---------- rerank ----------

def test_rerank_cross_encoder_reorders_the_bi_encoder_list(site):
    site.goto("rerank", settle=600)
    assert site.ev("App.currentItem.tab") == "model"
    site.ctrl_button("重置").click()
    first = site.readout("第一階段的第 1 名")
    assert site.readout("重排後的第 1 名") == "—"
    for _ in range(6):
        site.ctrl_button("單步").click()
        site.page.wait_for_timeout(80)
    site.page.wait_for_timeout(400)
    after = site.readout("重排後的第 1 名")
    assert after != "—" and after != first, (first, after)
    assert site.readout("已打分") == "6 / 6"


def test_rerank_top_k_sets_the_number_of_forward_passes(site):
    site.goto("rerank", settle=600)
    site.set_slider("top-k", 2)
    assert site.readout("cross-encoder 前向次數").startswith("2")
    site.set_slider("top-k", 6)
    assert site.readout("cross-encoder 前向次數").startswith("6")


def test_rerank_hovering_a_candidate_reports_both_scores(site):
    site.goto("rerank", settle=600)
    site.page.focus(f"{FOCUS_BTN} >> nth=0")
    site.page.wait_for_timeout(200)
    txt = site.readout("滑到的候選")
    assert "bi-encoder" in txt, txt
    site.assert_clean()


# ---------- rag ----------

def test_rag_walks_index_query_retrieve_stuff_generate(site):
    site.goto("rag", settle=600)
    assert site.ev("App.currentItem.tab") == "agent"
    site.ctrl_button("重置").click()
    seen = []
    for _ in range(5):
        site.ctrl_button("單步").click()
        site.page.wait_for_timeout(80)
        seen.append(site.readout("階段"))
    assert seen == ["切塊並嵌入（離線）", "嵌入查詢", "檢索 top-k", "塞進 prompt", "生成"], seen
    assert site.readout("檢索到的段落").startswith("3")
    assert "檢索" in site.readout("答案來源")


def test_rag_top_k_and_no_rag_change_what_the_llm_sees(site):
    site.goto("rag", settle=600)
    site.set_slider("top-k", 1)
    site.ctrl_button("重置").click()
    for _ in range(5):
        site.ctrl_button("單步").click()
    site.page.wait_for_timeout(200)
    assert site.readout("檢索到的段落").startswith("1")
    _seg(site, "沒有 RAG")
    for _ in range(5):
        site.ctrl_button("單步").click()
    site.page.wait_for_timeout(200)
    assert "模型記憶" in site.readout("答案來源")
    site.page.focus(f"{FOCUS_BTN} >> nth=0")
    site.page.wait_for_timeout(200)
    assert "相似度" in site.readout("滑到的段落")
    site.assert_clean()


# ---------- vision-rag ----------

def test_vision_rag_keeps_charts_that_ocr_loses(site):
    site.goto("vision-rag", settle=600)
    assert "保留" in site.readout("表格與圖表")
    site.ctrl_button("重置").click()
    for _ in range(3):
        site.ctrl_button("單步").click()
    site.page.wait_for_timeout(200)
    vision_hit = site.readout("檢索到的頁")
    assert "圖表" in vision_hit, vision_hit
    _seg(site, "OCR")
    assert "丟失" in site.readout("表格與圖表")
    site.ctrl_button("重置").click()
    for _ in range(3):
        site.ctrl_button("單步").click()
    site.page.wait_for_timeout(200)
    ocr_hit = site.readout("檢索到的頁")
    assert ocr_hit != vision_hit and "圖表" not in ocr_hit, ocr_hit
    site.page.focus(f"{FOCUS_BTN} >> nth=0")
    site.page.wait_for_timeout(200)
    assert "頁" in site.readout("滑到的頁")
    site.assert_clean()


# ---------- wemm ----------

def test_wemm_one_space_lets_mixed_queries_find_other_modalities(site):
    site.goto("wemm", settle=600)
    _seg(site, "圖 + 文")
    nn = site.readout("最近鄰")
    assert "影片" in nn or "文件" in nn, nn
    _seg(site, "每個模態各一個模型")
    assert "找不到" in site.readout("最近鄰")


def test_wemm_flexible_dimension_shrinks_the_index(site):
    site.goto("wemm", settle=600)
    site.set_slider("輸出維度", 2048)
    big = _num(site.readout("索引大小"))
    site.set_slider("輸出維度", 256)
    small = _num(site.readout("索引大小"))
    assert abs(big / small - 8) < 0.2, (big, small)
    site.page.focus(f"{FOCUS_BTN} >> nth=0")
    site.page.wait_for_timeout(200)
    assert "模態" in site.readout("滑到的點")
    site.assert_clean()
