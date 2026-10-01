"""P1 — one palette. P.ROLE is the single source of colour truth for 3D, DOM and canvas."""
import pathlib
import re

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCENE_FILES = sorted(p for p in (ROOT / "scenes").glob("*.js") if p.name != "_catalog.js")
CATALOG = (ROOT / "scenes" / "_catalog.js").read_text(encoding="utf-8")
SCENE_IDS = re.findall(r"\{id:'([\w-]+)'", CATALOG)

ROLES = ["signal", "memory", "state", "flow", "alert", "moe", "inactive", "structure"]
OLD_ALIASES = ["amber", "blue", "violet", "teal", "red", "grey", "fg2"]

LEGEND_COLOURS = """
  [...document.querySelectorAll('#legend span i')].map(i => getComputedStyle(i).backgroundColor)
"""
ROLE_RGB = "k => { const c = new THREE.Color(P.hex(k)); return `rgb(${Math.round(c.r*255)}, ${Math.round(c.g*255)}, ${Math.round(c.b*255)})`; }"


# ---------- source of truth ----------

@pytest.mark.parametrize("name", ROLES + OLD_ALIASES[:-1])  # fg2 is a theme text colour, must NOT be overwritten
def test_css_variable_is_generated_from_role_palette(site, name):
    css = site.ev("n => getComputedStyle(document.documentElement).getPropertyValue('--' + n).trim().toLowerCase()", name)
    assert css == site.ev("n => P.hex(n).toLowerCase()", name), f"--{name} in CSS differs from P.hex('{name}')"


def test_hex_accepts_role_colon_tier_syntax(site):
    assert site.ev("P.hex('flow:dim')") == site.ev("P.ROLE.flow.dim")
    assert site.ev("P.hex('signal:hot')") == site.ev("P.ROLE.signal.hot")
    assert site.ev("P.C('flow:dim').getHexString()") == site.ev("P.ROLE.flow.dim.slice(1).toLowerCase()")


def test_rgba_helper_builds_from_role(site):
    assert site.ev("P.rgba('signal', 0.1)") == "rgba(242, 181, 68, 0.1)"


# ---------- scenes never bypass the palette ----------

@pytest.mark.parametrize("path", SCENE_FILES, ids=lambda p: p.name)
def test_scene_has_no_hardcoded_colours(path):
    src = path.read_text(encoding="utf-8")
    hits = re.findall(r"#[0-9A-Fa-f]{6}\b|rgba?\(\s*\d", src)
    assert not hits, f"{path.name} hardcodes colours: {hits}"


@pytest.mark.parametrize("path", SCENE_FILES, ids=lambda p: p.name)
def test_scene_uses_role_names_not_old_aliases(path):
    src = path.read_text(encoding="utf-8")
    quoted = re.findall(r"['\"](" + "|".join(OLD_ALIASES) + r")['\"]", src)
    css_vars = re.findall(r"var\(--(" + "|".join(OLD_ALIASES) + r")\)", src)
    assert not quoted and not css_vars, f"{path.name} still uses old colour aliases: {sorted(set(quoted + css_vars))}"


# ---------- legends are honest ----------

@pytest.mark.parametrize("scene_id", SCENE_IDS)
def test_legend_entries_have_distinct_colours(site, scene_id):
    site.goto(scene_id)
    cols = site.ev(LEGEND_COLOURS)
    assert len(cols) == len(set(cols)), f"{scene_id}: two legend entries share a colour: {cols}"


def test_moe_expert_grid_uses_the_moe_role(site):
    site.goto("deepseek-v4")
    moe = site.ev(ROLE_RGB, "moe")
    assert moe in site.ev(LEGEND_COLOURS), "legend has no entry for the expert grid"
    cell_rgb = site.ev("""(() => { const lab = [...App.labels].find(l => l.el.textContent.includes('個專家'));
      const m = lab.parent.children.find(c => c.isMesh); const c = m.material.color;
      return `rgb(${Math.round(c.r*255)}, ${Math.round(c.g*255)}, ${Math.round(c.b*255)})`; })()""")
    assert cell_rgb == moe


def test_vllm_request_colours_are_in_legend_and_never_alert(site):
    site.goto("vllm")
    alert = site.ev(ROLE_RGB, "alert")
    legend = site.ev(LEGEND_COLOURS)
    owners = site.ev("""(() => { const set = new Set(); App.root.traverse(o => { if (o.isMesh && o.geometry.type === 'BoxGeometry' && Math.abs(o.geometry.parameters.width - 0.34) < 1e-6) {
      const c = o.material.color; set.add(`rgb(${Math.round(c.r*255)}, ${Math.round(c.g*255)}, ${Math.round(c.b*255)})`); } }); return [...set]; })()""")
    assert owners, "no logical blocks found"
    for c in owners:
        assert c != alert, "a request is drawn in the alert colour, which the bar uses for wasted space"
        assert c in legend, f"request colour {c} is not explained in the legend"


def test_dp_batch_colours_never_use_alert(site):
    site.goto("dp")
    site.set_slider("GPU 數", 8)
    alert = site.ev(ROLE_RGB, "alert")
    cols = site.ev("""(() => { const set = new Set(); App.root.traverse(o => { if (o.isMesh && o.geometry.type === 'BoxGeometry' && Math.abs(o.geometry.parameters.width - 0.22) < 1e-6) {
      const c = o.material.color; set.add(`rgb(${Math.round(c.r*255)}, ${Math.round(c.g*255)}, ${Math.round(c.b*255)})`); } }); return [...set]; })()""")
    assert cols and alert not in cols


def test_summary_chunk_colour_is_the_same_in_every_agent_scene(site):
    site.goto("agent-loop")
    a = site.ev("[...document.querySelectorAll('#legend span')].find(s => s.textContent.includes('摘要')).querySelector('i').style.background")
    site.goto("compact")
    b = site.ev("[...document.querySelectorAll('#legend span')].find(s => s.textContent.includes('摘要')).querySelector('i').style.background")
    assert a == b


def test_gguf_legend_lists_every_type_used(site):
    site.goto("gguf")
    site.ctrl_button("Q8_0").click()
    texts = site.ev("[...document.querySelectorAll('#legend span')].map(s => s.textContent)")
    assert any("F32" in t for t in texts), texts
