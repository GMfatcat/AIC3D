"""P0 layout: phone viewport must not overflow; theme is locked to dark."""
import pytest


PHONE_W = 390  # must match the phone_site fixture; innerWidth is NOT usable here because mobile Chrome zooms out to fit overflowing content


@pytest.mark.parametrize("scene_id", ["mhc", "transformer", "stages", "deepseek-v4"])
def test_phone_viewport_has_no_horizontal_overflow(phone_site, scene_id):
    phone_site.goto(scene_id)
    widths = phone_site.ev("[document.documentElement.scrollWidth, document.body.scrollWidth, innerWidth]")
    assert max(widths) <= PHONE_W, f"page is wider than the phone: {widths}"


def test_phone_stage_camera_aspect_matches_stage(phone_site):
    phone_site.goto("mhc", settle=800)
    stage, aspect = phone_site.ev(
        "(() => { const r = document.getElementById('stage').getBoundingClientRect(); return [[r.width, r.height], App.camera.aspect]; })()")
    assert stage[0] <= PHONE_W
    assert aspect == pytest.approx(stage[0] / stage[1], rel=1e-3)


def test_site_stays_dark_when_os_prefers_light(browser, dist_url):
    ctx = browser.new_context(viewport={"width": 1400, "height": 860}, color_scheme="light")
    page = ctx.new_page()
    page.goto(dist_url)
    page.wait_for_function("window.App && App.current")
    body_bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
    top_bg = page.evaluate("getComputedStyle(document.getElementById('top')).backgroundColor")
    ctx.close()
    assert body_bg == "rgb(14, 20, 32)", body_bg
    assert top_bg == "rgb(21, 29, 44)", top_bg
