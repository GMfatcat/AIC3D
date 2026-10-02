#!/usr/bin/env python3
"""Bundle core/ + scenes/ into a single self-contained dist/index.html.

Order: core/theme.css -> <style>; vendor/three.min.js inlined;
core/app.js, core/primitives.js, core/controls.js, scenes/_catalog.js, then scenes/*.js (sorted).
"""
import pathlib, re, sys
CDN = "--cdn" in sys.argv

ROOT = pathlib.Path(__file__).parent
tpl = (ROOT / "index.template.html").read_text(encoding="utf-8")
css = (ROOT / "core/theme.css").read_text(encoding="utf-8")
three = (ROOT / "vendor/three.min.js").read_text(encoding="utf-8")
fonts = (ROOT / "vendor/fonts.css").read_text(encoding="utf-8")

order = ["core/primitives.js", "core/motion.js", "core/controls.js", "core/app.js", "core/tours.js", "core/guide.js", "scenes/_catalog.js"]
scenes = sorted(p for p in (ROOT / "scenes").glob("*.js") if p.name != "_catalog.js")
files = [ROOT / p for p in order] + scenes

js = []
for f in files:
    src = f.read_text(encoding="utf-8")
    js.append(f"/* ===== {f.relative_to(ROOT)} ===== */\n{src}")
js.append("window.App.boot();")

GF = '@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap");'
out = tpl.replace("/*@FONTS@*/", GF if CDN else fonts).replace("/*@CSS@*/", css).replace("/*@THREE@*/", three).replace("/*@JS@*/", "\n".join(js))
DIST = ROOT / ("dist-cdn" if CDN else "dist"); DIST.mkdir(exist_ok=True)
(DIST / "index.html").write_text(out, encoding="utf-8")
import shutil
if not CDN:
    shutil.rmtree(ROOT / "dist/fonts", ignore_errors=True); shutil.copytree(ROOT / "vendor/fonts", ROOT / "dist/fonts")
print(DIST.name + "/index.html", len(out) // 1024, "KB,", len(scenes), "scene files", "(CDN fonts)" if CDN else "+ local fonts")
