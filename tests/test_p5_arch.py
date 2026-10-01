"""P5 — 基礎架構 tab: the interactions the catalogue promised, plus focus feedback on slider scenes."""
import pytest

FOCUS_BTN = "#stage .focuslist button"
SPHERES_OF_RADIUS = """r => { const shown = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  let n = 0; App.root.traverse(o => { if (o.isMesh && shown(o) && o.geometry.type === 'SphereGeometry' && Math.abs(o.geometry.parameters.radius - r) < 1e-6) n++; }); return n; }"""


def test_app_can_watch_hover_for_a_scene(site):
    site.goto("rnn")
    assert site.ev("typeof App.watchHover") == "function"


# ---------- RNN ----------

def test_rnn_token_focus_tracks_that_token(site):
    site.goto("rnn", settle=800)
    before = site.readout("到最後一步剩多少")
    site.page.focus(f"{FOCUS_BTN} >> nth=5")
    site.page.wait_for_timeout(200)
    after = site.readout("到最後一步剩多少")
    assert before != after, "hovering / focusing a token should make it the tracked token"
    assert site.ev("[...document.querySelectorAll('#ctrl .slider output')][0].textContent") == "失敗"


def test_rnn_can_compare_with_a_gated_cell(site):
    site.goto("rnn", settle=800)
    plain = site.readout("到最後一步剩多少")
    site.ctrl_button("LSTM").click()
    site.page.wait_for_timeout(200)
    gated = site.readout("到最後一步剩多少")
    assert float(gated) > float(plain), "a gated cell keeps more of the signal"


# ---------- Mamba ----------

def test_mamba_token_focus_and_rnn_comparison_row(site):
    site.goto("mamba", settle=800)
    assert site.ev(SPHERES_OF_RADIUS, 0.42) == 8
    site.ctrl_button("RNN 對照").click()
    site.page.wait_for_timeout(300)
    assert site.ev(SPHERES_OF_RADIUS, 0.42) == 16, "comparison row should add a second set of states"
    before = site.readout("這個 token 的 Δ（閘值）")
    site.page.focus(f"{FOCUS_BTN} >> nth=4")
    site.page.wait_for_timeout(200)
    assert site.readout("這個 token 的 Δ（閘值）") != before


# ---------- RWKV / GDN ----------

def test_rwkv_token_focus_jumps_to_that_step(site):
    site.goto("rwkv", settle=800)
    site.page.focus(f"{FOCUS_BTN} >> nth=4")
    site.page.wait_for_timeout(200)
    assert "第 5 步" in site.readout("目前")


def test_gdn_token_focus_replays_to_that_step(site):
    site.goto("gdn", settle=800)
    site.page.focus(f"{FOCUS_BTN} >> nth=2")
    site.page.wait_for_timeout(300)
    assert "t=3" in site.readout("目前半步")


# ---------- Jev ----------

def test_jev_custom_state_text_drives_the_slots(site):
    site.goto("jev", settle=600)
    box = site.page.locator("#ctrl textarea")
    assert box.count() == 1, "needs a free-text state box"
    box.fill("客戶 投訴 被 扣款 兩次 很 生氣")
    site.page.wait_for_timeout(300)
    answers = site.readout("右：讀到的答案")
    assert answers.startswith("是"), answers              # 退款？
    assert "高" in answers and "憤怒" in answers, answers  # 優先級、情緒
    assert site.ev("document.querySelectorAll('#labels .l3d').length") > 0


# ---------- Embedding ----------

def test_embedding_new_word_drops_into_place(site):
    site.goto("embedding", settle=800)
    site.ctrl_button("「拉麵」").click()
    y0 = site.ev("(() => { let q; App.root.traverse(o => { if (o.isMesh && o.geometry.type === 'SphereGeometry' && Math.abs(o.geometry.parameters.radius - 0.2) < 1e-6) q = o; }); return q.position.y; })()")
    site.page.wait_for_timeout(900)
    y1 = site.ev("(() => { let q; App.root.traverse(o => { if (o.isMesh && o.geometry.type === 'SphereGeometry' && Math.abs(o.geometry.parameters.radius - 0.2) < 1e-6) q = o; }); return q.position.y; })()")
    assert y0 > y1 + 0.5, "the new point should start above and fall into place"
    assert y1 == pytest.approx(-0.1, abs=1e-3)


# ---------- CRNN ----------

def test_crnn_sample_text_is_selectable_and_blank_is_distinct(site):
    site.goto("crnn", settle=800)
    assert "LENS-0733" in site.readout("目標") or "9 個字元" in site.readout("目標")
    site.ctrl_button("AOI-0021").click()
    site.page.wait_for_timeout(300)
    assert "8 個字元" in site.readout("目標")
    texts = site.ev("[...document.querySelectorAll('#labels .l3d')].map(e => e.textContent)")
    assert any(t == "·" for t in texts), "blank should be drawn as a middle dot, not a dash that looks like '-'"
    assert not any(t == "–" for t in texts)
