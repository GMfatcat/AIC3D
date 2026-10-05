#!/usr/bin/env python3
"""Bundle core/ + scenes/ into a single self-contained dist/index.html.

Order: core/theme.css -> <style>; vendor/three.min.js inlined; vendor/*.mp3 copied next to the page as music.mp3;
core/app.js, core/primitives.js, core/controls.js, scenes/_catalog.js, then scenes/*.js (sorted).
about.json is embedded as window.ABOUT (file:// cannot fetch) and also copied next to the build for static hosts.
"""
import json, pathlib, re, shutil, sys
CDN = "--cdn" in sys.argv

ROOT = pathlib.Path(__file__).parent
tpl = (ROOT / "index.template.html").read_text(encoding="utf-8")
css = (ROOT / "core/theme.css").read_text(encoding="utf-8")
three = (ROOT / "vendor/three.min.js").read_text(encoding="utf-8")
fonts = (ROOT / "vendor/fonts.css").read_text(encoding="utf-8")
about = json.loads((ROOT / "about.json").read_text(encoding="utf-8"))  # validated here so a typo fails the build, not the page

order = ["core/primitives.js", "core/pictures.js", "core/motion.js", "core/i18n.js", "core/i18n-en.js", "core/i18n-en-glossary.js", "core/i18n-en-tours.js", "core/i18n-en-scenes-block.js", "core/i18n-en-scenes-arch.js", "core/i18n-en-scenes-model.js", "core/i18n-en-scenes-train.js", "core/i18n-en-scenes-eval.js", "core/i18n-en-scenes-optimize.js", "core/i18n-en-scenes-infra.js", "core/i18n-en-scenes-agent.js", "core/controls.js", "core/app.js", "core/tours.js", "core/guide.js", "core/glossary.js", "core/about.js", "core/desk-models.js", "core/desk-toys.js", "core/desk.js", "core/desk-messenger.js", "core/desk-cat.js", "core/music.js", "scenes/_catalog.js"]
scenes = sorted(p for p in (ROOT / "scenes").glob("*.js") if p.name != "_catalog.js")
files = [ROOT / p for p in order] + scenes

js = []
for f in files:
    src = f.read_text(encoding="utf-8")
    js.append(f"/* ===== {f.relative_to(ROOT)} ===== */\n{src}")
js.append("window.App.boot();")

GF = '@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap");'
out = tpl.replace("/*@FONTS@*/", GF if CDN else fonts).replace("/*@CSS@*/", css).replace("/*@THREE@*/", three).replace("/*@ABOUT@*/", "window.ABOUT=" + json.dumps(about, ensure_ascii=False).replace("</", "<\\/") + ";").replace("/*@JS@*/", "\n".join(js))
DIST = ROOT / ("dist-cdn" if CDN else "dist"); DIST.mkdir(exist_ok=True)
(DIST / "index.html").write_text(out, encoding="utf-8")
shutil.copy(ROOT / "about.json", DIST / "about.json")
mp3 = sorted((ROOT / "vendor").glob("*.mp3"))  # 背景音樂：改成固定的 ASCII 檔名，靜態主機與網址都不會出問題
if mp3: shutil.copy(mp3[0], DIST / "music.mp3")
if not CDN:
    shutil.rmtree(ROOT / "dist/fonts", ignore_errors=True); shutil.copytree(ROOT / "vendor/fonts", ROOT / "dist/fonts")
print(DIST.name + "/index.html", len(out) // 1024, "KB,", len(scenes), "scene files", "(CDN fonts)" if CDN else "+ local fonts")
