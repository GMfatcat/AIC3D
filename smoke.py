import asyncio, pathlib, sys
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).parent
URL = (ROOT / "dist/index.html").resolve().as_uri()
IDS = ["tour=kv&step=3","tour=arch2026&step=2"]

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
            args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"])
        pg = await b.new_page(viewport={"width":1400,"height":860})
        errors=[]
        pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        pg.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type in ("error","warning") else None)
        await pg.goto(URL); await pg.wait_for_timeout(1500)
        (ROOT/"shots").mkdir(exist_ok=True)
        for sid in IDS:
            await pg.evaluate(f"location.hash='{sid}'"); await pg.wait_for_timeout(900)
            # poke controls
            if sid=="kvcache":
                for _ in range(6): await pg.click("text=單步 ⏭"); await pg.wait_for_timeout(80)
            if sid=="agent-loop":
                for _ in range(14): await pg.click("text=單步 ⏭"); await pg.wait_for_timeout(60)
            if sid=="vllm":
                await pg.click("text=共享 prefix page"); await pg.click("text=新增請求"); await pg.click("text=新增請求"); await pg.click("text=全部生成一步")
            if sid=="embedding":
                await pg.click("text=「拉麵」")
            if sid=="minilm":
                await pg.click("#ctrl .seg button >> nth=0"); await pg.wait_for_timeout(1600)
            if sid=="kvheads":
                await pg.evaluate("document.querySelector('#ctrl input[type=range]').value=3; document.querySelector('#ctrl input[type=range]').dispatchEvent(new Event('input'))")
            if sid=="mhc":
                await pg.click("text=Hyper-Conn."); await pg.wait_for_timeout(300); await pg.click("text=全部 1"); await pg.wait_for_timeout(300)
            if sid=="goal":
                for _ in range(4): await pg.click("text=單步 ⏭"); await pg.wait_for_timeout(60)
            if sid=="deepseek-v4":
                await pg.wait_for_timeout(1500); await pg.click("#ctrl .seg button >> nth=1"); await pg.wait_for_timeout(800)
            if sid=="yolo-v10":
                await pg.click("#ctrl .seg button >> nth=0")
            if sid=="ocr":
                await pg.evaluate("const r=document.querySelectorAll('#ctrl input[type=range]')[1]; r.value=5; r.dispatchEvent(new Event('input'))")
                for _ in range(8): await pg.click("text=單步 ⏭"); await pg.wait_for_timeout(40)
            if sid in ("jev","tiling","cnn","crnn","qat"):
                for _ in range(6): await pg.click("text=單步 ⏭"); await pg.wait_for_timeout(60)
            if sid=="sglang":
                await pg.click("#ctrl .btn >> nth=2"); await pg.click("#ctrl .btn >> nth=3")
            if sid=="engram":
                await pg.click("#ctrl .seg button >> nth=1")
            if sid in ("gdn","rwkv","gptq"):
                for _ in range(5): await pg.click("text=單步 ⏭"); await pg.wait_for_timeout(80)
            if sid=="mamba":
                await pg.click("#ctrl .seg button >> nth=1")
            if sid=="stages":
                await pg.click("#ctrl .seg button >> nth=1"); await pg.click("text=320B / 18B"); await pg.click("text=NVFP4"); await pg.wait_for_timeout(300)
            if sid in ("stages","subagent"):
                for _ in range(5): await pg.click("text=單步 ⏭"); await pg.wait_for_timeout(80)
            if sid=="residual":
                await pg.click("text=沒有（純堆疊）")
            if sid=="compact":
                await pg.click("text=標出被壓掉的")
            if sid=="tp":
                await pg.click("#ctrl .seg button >> nth=1")
            if sid=="transformer":
                await pg.click("text=Enc-Dec")
            await pg.wait_for_timeout(500)
            await pg.screenshot(path=str(ROOT/f"shots/{sid.replace('=','_').replace('&','_')}.png"))
            print("shot", sid, "errors so far:", len(errors))
        for e in errors[:40]: print(e)
        await b.close()
asyncio.run(main())
