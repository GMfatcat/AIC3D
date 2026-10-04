"""P9 — 關於: the top-bar button (and the picture frame on the desk) fly the camera to the frame on the desk and show the site
description and typed external links from about.json in the side panel — no pop-up. Offline single-file builds embed the JSON;
a static host re-reads about.json at runtime."""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
ABOUT = json.loads((ROOT / "about.json").read_text(encoding="utf-8"))
OPEN = "App.home && App.desk.focused === 'about' && App.desk.ready && !App.routing"


def _open(site):
    site.page.locator("#top #aboutbtn").click()
    site.page.wait_for_function(OPEN)
    site.page.wait_for_timeout(150)


def test_about_button_flies_to_the_frame_and_shows_the_json_content_in_the_panel(site):
    site.goto("residual")
    assert site.ev("document.querySelector('#top #aboutbtn').textContent").strip() == "關於"
    far = None
    _open(site)
    assert site.ev("location.hash") == "#tab=about"
    assert site.ev("App.about.isOpen()")
    assert not site.ev("!!document.querySelector('#about.open')"), "no modal any more"
    assert site.ev("document.querySelector('#deskbar .about-panel h2').textContent") == ABOUT["title"]
    assert site.ev("document.querySelectorAll('#deskbar .about-desc p').length") == len(ABOUT["description"])
    links = site.ev("[...document.querySelectorAll('#deskbar .about-links a')].map(a => [a.getAttribute('href'), a.target, a.rel, a.querySelector('b').textContent])")
    assert [l[0] for l in links] == [l["url"] for l in ABOUT["links"]]
    assert all(l[1] == "_blank" and "noopener" in l[2] for l in links), links
    assert [l[3] for l in links] == [l["name"] for l in ABOUT["links"]]
    assert "about.json" in site.ev("document.querySelector('#deskbar .about-foot').textContent")
    # the camera is on the frame, not on the wide desk
    assert site.ev("App.cam.dist") < site.ev("App.camHome.dist") * 0.5
    site.assert_clean()


def test_links_get_an_icon_by_type_and_types_are_inferred_from_the_url(site):
    site.goto("residual")
    _open(site)
    types = site.ev("[...document.querySelectorAll('#deskbar .about-links a')].map(a => [a.dataset.type, !!a.querySelector('.aicon svg')])")
    assert types == [["git", True], ["git", True], ["youtube", True], ["x", True], ["instagram", True], ["threads", True], ["web", True]], types
    cases = {"https://gitea.example.com/me/repo": "git", "https://gitlab.com/x": "git", "https://codeberg.org/x": "git", "https://youtu.be/abc": "youtube",
             "https://www.youtube.com/@c": "youtube", "https://x.com/me": "x", "https://twitter.com/me": "x", "https://www.instagram.com/me": "instagram",
             "https://www.threads.net/@me": "threads", "https://www.threads.com/@me": "threads", "https://example.org/": "web", "not a url": "web"}
    for url, want in cases.items():
        assert site.ev("u => App.about.typeOf(u)", url) == want, url
    assert site.ev("App.about.typeOf('https://example.org/', 'youtube')") == "youtube", "an explicit type wins"
    assert site.ev("App.about.typeOf('https://example.org/', 'bogus')") == "web", "unknown explicit types fall back to inference"


def test_escape_and_the_desk_button_both_leave_the_frame(site):
    site.goto("residual")
    site.page.focus("#top #aboutbtn")
    site.page.keyboard.press("Enter")
    site.page.wait_for_function(OPEN)
    site.page.keyboard.press("Escape")
    site.page.wait_for_function("App.home && App.desk.focused === null && App.desk.ready")
    assert not site.ev("App.about.isOpen()")
    assert site.ev("location.hash") in ("", "#home")
    _open(site)
    site.page.locator("#deskbar button", has_text="回工作桌").click()
    site.page.wait_for_function("App.home && App.desk.focused === null && App.desk.ready")
    site.assert_clean()


def test_frame_on_the_desk_opens_about_too(site):
    site.goto("home")
    site.page.focus("#stage .focuslist button >> nth=10")
    assert "關於" in site.page.locator("#stage .focuslist button").nth(10).text_content()
    site.page.keyboard.press("Enter")
    site.page.wait_for_function(OPEN)
    assert site.ev("document.querySelector('#deskbar .about-panel h2').textContent") == ABOUT["title"]


def test_about_json_is_embedded_for_file_urls_and_copied_next_to_the_build(site, dist_url):
    assert dist_url.startswith("file:")
    assert site.ev("window.ABOUT") == ABOUT
    assert site.ev("App.about.data.title") == ABOUT["title"]
    copied = ROOT / "dist" / "about.json"
    assert copied.exists() and json.loads(copied.read_text(encoding="utf-8")) == ABOUT
    assert "about.json" in (ROOT / "build.py").read_text(encoding="utf-8")
    assert "fetch('about.json'" in (ROOT / "core" / "about.js").read_text(encoding="utf-8"), "a static host re-reads the JSON at runtime"


def test_about_fits_a_phone_and_the_top_bar_does_not_overflow(phone_site):
    phone_site.goto("residual")
    widths = phone_site.ev("[document.documentElement.scrollWidth, document.getElementById('top').scrollWidth]")
    assert max(widths) <= 390, widths
    phone_site.page.locator("#top #aboutbtn").click()
    phone_site.page.wait_for_function(OPEN)
    panel = phone_site.ev("document.querySelector('#deskbar .about-panel').getBoundingClientRect()")
    assert panel["left"] >= 0 and panel["right"] <= 390, panel
    assert phone_site.ev("document.documentElement.scrollWidth") <= 390
