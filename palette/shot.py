import asyncio, pathlib
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args=["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox"])
        pg=await b.new_page(viewport={"width":1500,"height":820})
        await pg.goto(pathlib.Path("palette.html").resolve().as_uri()); await pg.wait_for_timeout(2500)
        await pg.screenshot(path="palette.png"); await b.close()
asyncio.run(main())
