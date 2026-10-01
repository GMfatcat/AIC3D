"""P5 — Agent tab: loops become helices (time = height), context accumulates as cubes along the helix,
compact squashes old laps, /goal lets you pick a goal and see the path change."""
import pytest

MARKER_Y = "(() => { let m; App.root.traverse(o => { if (o.isMesh && o.geometry.type === 'SphereGeometry' && Math.abs(o.geometry.parameters.radius - 0.16) < 1e-6 && !m) m = o; }); return m.getWorldPosition(new THREE.Vector3()).y; })()"
CHUNKS = "(() => { const ys = []; App.root.traverse(o => { if (o.userData && o.userData.chunk && o.visible) ys.push(o.getWorldPosition(new THREE.Vector3()).y); }); return ys; })()"
SUMMARIES = "(() => { let n = 0; App.root.traverse(o => { if (o.userData && o.userData.summary && o.visible) n++; }); return n; })()"


def test_loop_primitive_can_rise_like_a_helix(site):
    site.goto("agent-loop")
    y = site.ev("(() => { const l = new P.Loop(['a','b','c','d'], {rise: 0.6}); App.root.add(l.group); l.setT(4); const y = l.marker.position.y; P.drop(l.group); return y; })()")
    assert y == pytest.approx(0.05 + 0.6, abs=1e-6), "one full lap should lift the marker by `rise`"


def test_agent_loop_stacks_context_along_the_helix(site):
    site.goto("agent-loop", settle=600)
    step = site.ctrl_button("單步")
    step.click()  # cancels autoplay
    site.ctrl_button("重置").click()
    for _ in range(6):
        step.click(); site.page.wait_for_timeout(60)
    site.page.wait_for_timeout(700)
    ys = site.ev(CHUNKS)
    assert len(ys) == 6, f"one cube per message, got {len(ys)}"
    assert all(b > a for a, b in zip(ys, ys[1:])), f"cubes should climb with time: {ys}"
    assert site.ev(MARKER_Y) > 0.4, "the marker should have climbed the helix"


def test_agent_loop_compact_squashes_old_laps_into_a_summary_disc(site):
    site.goto("agent-loop", settle=600)
    step = site.ctrl_button("單步")
    step.click(); site.ctrl_button("重置").click()
    for _ in range(16):  # context passes 85% of 40 at step 16
        step.click(); site.page.wait_for_timeout(40)
    site.page.wait_for_timeout(900)
    assert "1" in site.readout("compact 次數")
    assert site.ev(SUMMARIES) >= 1, "compacted messages should collapse into a summary disc at the base"
    assert len(site.ev(CHUNKS)) <= 4, "only the kept recent messages should remain as cubes"


def test_goal_scene_offers_several_goals_and_the_path_changes(site):
    site.goto("goal", settle=600)
    step = site.ctrl_button("單步")
    step.click(); site.ctrl_button("重置").click()
    for _ in range(6):
        step.click(); site.page.wait_for_timeout(40)
    site.page.wait_for_timeout(300)
    log_a = site.ev("document.querySelector('#ctrl .log').textContent")
    site.ctrl_button("寫根因報告").click()
    site.page.wait_for_timeout(200)
    assert "報告" in site.ev("[...App.labels].map(l => l.el.textContent).join(' ')"), "the goal label above the loop should show the new goal"
    for _ in range(6):
        step.click(); site.page.wait_for_timeout(40)
    site.page.wait_for_timeout(300)
    log_b = site.ev("document.querySelector('#ctrl .log').textContent")
    assert log_a != log_b, "a different goal should drive a different path"


def test_subagent_loops_rise_too(site):
    site.goto("subagent", settle=600)
    step = site.ctrl_button("單步")
    step.click(); site.ctrl_button("重置").click()
    for _ in range(3):
        step.click(); site.page.wait_for_timeout(50)
    site.page.wait_for_timeout(800)
    assert site.ev(MARKER_Y) > 0.3
