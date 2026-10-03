"""P9 — 關於: a top-bar button opens a card with the site description and typed external links read from about.json.
Offline single-file builds embed the JSON; a static host re-reads about.json at runtime."""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
ABOUT = json.loads((ROOT / "about.json").read_text(encoding="utf-8"))
OPEN = "document.getElementById('about').classList.contains('open')"


def _open(site):
    site.page.locator("#top #aboutbtn").click()
    site.page.wait_for_function(OPEN)
    site.page.wait_for_timeout(150)


def test_about_button_opens_the_card_with_the_json_content(site):
    site.goto("residual")
    assert site.ev("document.querySelector('#top #aboutbtn').textContent").strip() == "關於"
    _open(site)
    assert site.ev("document.querySelector('#about .intro-card h2').textContent") == ABOUT["title"]
    assert site.ev("document.querySelectorAll('#about .about-desc p').length") == len(ABOUT["description"])
    links = site.ev("[...document.querySelectorAll('#about .about-links a')].map(a => [a.getAttribute('href'), a.target, a.rel, a.querySelector('b').textContent])")
    assert [l[0] for l in links] == [l["url"] for l in ABOUT["links"]]
    assert all(l[1] == "_blank" and "noopener" in l[2] for l in links), links
    assert [l[3] for l in links] == [l["name"] for l in ABOUT["links"]]
    assert "about.json" in site.ev("document.querySelector('#about .about-foot').textContent")


def test_links_get_an_icon_by_type_and_types_are_inferred_from_the_url(site):
    site.goto("residual")
    _open(site)
    types = site.ev("[...document.querySelectorAll('#about .about-links a')].map(a => [a.dataset.type, !!a.querySelector('.aicon svg')])")
    assert types == [["git", True], ["git", True], ["youtube", True], ["x", True], ["instagram", True], ["threads", True], ["web", True]], types
    cases = {"https://gitea.example.com/me/repo": "git", "https://gitlab.com/x": "git", "https://codeberg.org/x": "git", "https://youtu.be/abc": "youtube",
             "https://www.youtube.com/@c": "youtube", "https://x.com/me": "x", "https://twitter.com/me": "x", "https://www.instagram.com/me": "instagram",
             "https://www.threads.net/@me": "threads", "https://www.threads.com/@me": "threads", "https://example.org/": "web", "not a url": "web"}
    for url, want in cases.items():
        assert site.ev("u => App.about.typeOf(u)", url) == want, url
    assert site.ev("App.about.typeOf('https://example.org/', 'youtube')") == "youtube", "an explicit type wins"
    assert site.ev("App.about.typeOf('https://example.org/', 'bogus')") == "web", "unknown explicit types fall back to inference"


def test_about_is_modal_and_escape_closes_it_and_restores_focus(site):
    site.goto("residual")
    site.page.focus("#top #aboutbtn")
    site.page.keyboard.press("Enter")
    site.page.wait_for_function(OPEN)
    assert site.ev("document.body.classList.contains('about')")
    assert site.ev("document.getElementById('stage').inert && document.getElementById('ctrl').inert")
    assert site.ev("document.activeElement.closest('#about') !== null"), "focus moves into the dialog"
    site.page.keyboard.press("Escape")
    site.page.wait_for_function("!" + OPEN)
    assert not site.ev("document.body.classList.contains('about')")
    assert not site.ev("document.getElementById('stage').inert")
    assert site.ev("document.activeElement.id") == "aboutbtn"
    _open(site)
    site.page.locator("#about button", has_text="關閉").click()
    site.page.wait_for_function("!" + OPEN)
    site.assert_clean()


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
    card = phone_site.ev("document.querySelector('#about .intro-card').getBoundingClientRect()")
    assert card["left"] >= 0 and card["right"] <= 390, card
    assert phone_site.ev("document.documentElement.scrollWidth") <= 390
