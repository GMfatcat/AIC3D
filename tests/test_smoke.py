"""Every catalogued scene mounts without console errors."""
import json
import pathlib
import re

import pytest

CATALOG = (pathlib.Path(__file__).resolve().parents[1] / "scenes" / "_catalog.js").read_text(encoding="utf-8")
SCENE_IDS = re.findall(r"\{id:'([\w-]+)'", CATALOG)
assert len(SCENE_IDS) == 38, SCENE_IDS


@pytest.mark.parametrize("scene_id", SCENE_IDS)
def test_scene_mounts_without_errors(site, scene_id):
    site.goto(scene_id, settle=600)
    title = site.ev("document.getElementById('i-title').textContent")
    assert title, f"{scene_id}: no title rendered"
    assert site.ev("App.root.children.length") > 0, f"{scene_id}: empty 3D root"
    site.assert_clean()
