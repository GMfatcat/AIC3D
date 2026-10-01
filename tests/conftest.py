"""Browser-level tests: build dist/, open it in the system Chrome (headless), drive scenes.

Run:  python -m pytest            (from the project root)
Requires:  pip install playwright pytest   (no browser download — uses installed Chrome)
"""
import pathlib
import subprocess
import sys

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
DIST_URL = (ROOT / "dist" / "index.html").resolve().as_uri()
CHROME_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]


@pytest.fixture(scope="session")
def dist_url():
    subprocess.run([sys.executable, str(ROOT / "build.py")], check=True, cwd=ROOT, capture_output=True)
    return DIST_URL


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", args=CHROME_ARGS)
        yield b
        b.close()


class Site:
    """Thin driver around one page of the built site."""

    def __init__(self, page):
        self.page = page
        self.errors = []
        page.on("pageerror", lambda e: self.errors.append(f"pageerror: {e}"))
        page.on("console", lambda m: self.errors.append(f"console.{m.type}: {m.text}")
                if m.type in ("error", "warning") else None)

    def goto(self, hash_, settle=400):
        """Navigate to a scene (or tour) by hash and wait for it to mount."""
        self.page.evaluate("h => { location.hash = h; }", hash_)
        if hash_ in ('', 'home'):
            self.page.wait_for_function("!App.routing && App.home")
            self.page.wait_for_timeout(settle)
            return self
        # hashchange is async: wait until the scene for THIS hash is mounted and the crossfade is over
        self.page.wait_for_function("h => window.App && App.currentItem && !App.routing && (h.startsWith('tour=') || App.currentItem.id === h)", arg=hash_)
        self.page.wait_for_timeout(settle)
        return self

    def ev(self, js, *args):
        return self.page.evaluate(js, *args)

    def ctrl_button(self, text):
        return self.page.locator("#ctrl button", has_text=text).first

    def set_slider(self, label_text, value):
        """Set a #ctrl range input by its label text and fire 'input'."""
        self.page.evaluate(
            """([label, v]) => {
                const lab = [...document.querySelectorAll('#ctrl .ctl label')].find(l => l.textContent.includes(label));
                if (!lab) throw new Error('slider not found: ' + label);
                const inp = lab.parentElement.querySelector('input[type=range]');
                inp.value = v; inp.dispatchEvent(new Event('input'));
            }""", [label_text, value])

    def readout(self, label_text):
        return self.page.evaluate(
            """label => {
                const dts = [...document.querySelectorAll('#ctrl .readouts dt')];
                const dt = dts.find(d => d.textContent.trim() === label);
                if (!dt) throw new Error('readout not found: ' + label);
                const dd = dt.nextElementSibling; return dd.dataset.final ?? dd.textContent;  // the value it is settling to
            }""", label_text)

    def readout_text(self, label_text):
        """What the readout literally shows right now (mid-tween)."""
        return self.page.evaluate(
            """label => { const dt = [...document.querySelectorAll('#ctrl .readouts dt')].find(d => d.textContent.trim() === label);
                return dt.nextElementSibling.textContent; }""", label_text)

    def assert_clean(self):
        assert not self.errors, "\n".join(self.errors)


@pytest.fixture
def site(browser, dist_url):
    ctx = browser.new_context(viewport={"width": 1400, "height": 860})
    page = ctx.new_page()
    s = Site(page)
    page.goto(dist_url)
    page.wait_for_function("window.App && App.current && !App.routing")
    yield s
    ctx.close()


@pytest.fixture
def phone_site(browser, dist_url):
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    s = Site(page)
    page.goto(dist_url)
    page.wait_for_function("window.App && App.current")
    yield s
    ctx.close()
