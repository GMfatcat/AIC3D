"""Screenshot every scene (and tour step) of dist/index.html into shots/ and report console errors.

Uses the installed Chrome through Playwright, so no browser download is needed:
    pip install playwright
    python build.py && python smoke.py            # desktop 1400×860
    python smoke.py --mobile                      # phone 390×844
    python smoke.py mhc engram tour=kv&step=3     # only these
    python smoke.py --intro cnn residual          # keep the first-visit intro card in the shot

The functional checks live in tests/ (python -m pytest); this script is for looking at the pictures.
"""
import pathlib
import re
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).parent
URL = (ROOT / "dist/index.html").resolve().as_uri()
CHROME_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]


def catalog_ids():
    src = (ROOT / "scenes/_catalog.js").read_text(encoding="utf-8")
    return re.findall(r"\{id:'([\w-]+)'", src)


def main(argv):
    mobile = "--mobile" in argv
    keep_intro = "--intro" in argv
    ids = [a for a in argv if not a.startswith("--")] or catalog_ids()
    out = ROOT / ("shots-intro" if keep_intro else "shots-mobile" if mobile else "shots")
    out.mkdir(exist_ok=True)
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", args=CHROME_ARGS)
        if mobile:
            ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        else:
            ctx = browser.new_context(viewport={"width": 1400, "height": 860})
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(f"{page.url.split('#')[-1]}: pageerror: {e}"))
        page.on("console", lambda m: errors.append(f"{page.url.split('#')[-1]}: console.{m.type}: {m.text}")
                if m.type in ("error", "warning") else None)
        page.goto(URL)
        page.wait_for_function("window.App && App.current")
        for sid in ids:
            page.evaluate("h => { location.hash = h; }", sid)
            page.wait_for_timeout(300)
            if not keep_intro:
                page.evaluate("App.intro && App.intro.isOpen() && App.intro.enter('free')")
            page.wait_for_timeout(900)
            page.screenshot(path=str(out / (re.sub(r"[^\w-]+", "_", sid) + ".png")))
            print("shot", sid)
        browser.close()
    print(f"\n{len(ids)} shots in {out.name}/")
    if errors:
        print("\n".join(errors))
        return 1
    print("no console errors")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
