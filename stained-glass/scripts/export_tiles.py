import asyncio, base64, json, os, sys
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("GLASS_MAPS", "maps"); os.makedirs(OUT, exist_ok=True)
NAMES = sys.argv[1:] or ["sun", "moon", "lantern", "keyhole", "rose", "lighthouse", "magnifier", "envelope", "compass", "hourglass"]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        await pg.goto("file://" + os.path.abspath(os.path.join(HERE, "..", "tiles", "export_tiles.html"))); await pg.wait_for_timeout(800)
        for nm in NAMES:
            r = await pg.evaluate("nm => window.exportTile(nm, 8, 1.5)", nm)
            fn = nm.replace(":", "_"); open(f"{OUT}/{fn}_ids.png", "wb").write(base64.b64decode(r["png"].split(",", 1)[1]))
            json.dump(r["meta"], open(f"{OUT}/{fn}_meta.json", "w"))
            print(nm, len(r["meta"]["pieces"]))
        await b.close()
asyncio.run(main())
