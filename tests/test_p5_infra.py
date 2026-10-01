"""P5 — 推論基礎設施 tab: TP/DP side by side, hover feedback everywhere, panel order fixes."""
import pytest

FOCUS_BTN = "#stage .focuslist button"
LABEL_COUNT = "t => [...App.labels].filter(l => l.el.textContent === t).length"


@pytest.mark.parametrize("scene_id,other", [("tp", "Data Parallel"), ("dp", "Tensor Parallel")])
def test_parallel_scenes_can_show_the_other_scheme_side_by_side(site, scene_id, other):
    site.goto(scene_id, settle=800)
    assert site.ev(LABEL_COUNT, "GPU 0") == 1
    site.ctrl_button("並排看另一種").click()
    site.page.wait_for_timeout(400)
    assert site.ev(LABEL_COUNT, "GPU 0") == 2, "comparison stage should add a second row of GPUs"
    assert site.ev("[...App.labels].some(l => l.el.textContent.includes('對照：" + other + "'))")


def test_parallel_hovering_a_weight_brick_reports_its_gpu(site):
    site.goto("tp", settle=800)
    site.page.focus(f"{FOCUS_BTN} >> nth=2")
    site.page.wait_for_timeout(200)
    txt = site.readout("滑到的 GPU")
    assert txt.startswith("GPU 2") and "GB" in txt, txt


def test_stages_hovering_a_token_reports_its_phase(site):
    site.goto("stages", settle=800)
    site.page.focus(f"{FOCUS_BTN} >> nth=18")  # prompt 16 + generated index 2
    site.page.wait_for_timeout(200)
    txt = site.readout("滑到的 token")
    assert "生成" in txt and "3" in txt, txt


def test_tiling_hovering_an_output_cell_shows_its_row_and_column(site):
    site.goto("tiling", settle=800)
    site.page.focus(f"{FOCUS_BTN} >> nth=10")  # C[1,2] (8 per row)
    site.page.wait_for_timeout(200)
    txt = site.readout("滑到的格子")
    assert "C[2,3]" in txt and "A 第 2 列" in txt and "B 第 3 欄" in txt, txt


def test_vllm_hovering_a_page_reports_its_owner_and_hint_is_below_heading(site):
    site.goto("vllm", settle=800)
    assert site.ev("document.querySelector('#ctrl').firstElementChild.tagName") == "H2", "panel must start with the heading"
    site.page.focus(f"{FOCUS_BTN} >> nth=0")
    site.page.wait_for_timeout(200)
    txt = site.readout("滑到的 page")
    assert txt.startswith("page 1") and ("請求" in txt or "空" in txt), txt


def test_sglang_buttons_share_a_row_and_nodes_are_hoverable(site):
    site.goto("sglang", settle=800)
    rows = site.ev("[...document.querySelectorAll('#ctrl .btnrow')].map(r => r.children.length)")
    assert rows[0] == 4, f"the four request buttons should sit in one row, got {rows}"
    site.page.focus(f"{FOCUS_BTN} >> nth=0")
    site.page.wait_for_timeout(200)
    txt = site.readout("滑到的節點")
    assert "token" in txt and "請求" in txt, txt
    site.ctrl_button("摘要日報").click()
    site.page.wait_for_timeout(300)
    assert site.ev("document.querySelectorAll('#stage .focuslist button').length") == 6, "focus list must follow inserted nodes"  # 5 nodes after the two initial requests + 摘要日報
