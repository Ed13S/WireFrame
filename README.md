# WireFrame

A KiCad-style schematic editor plus a Tinkercad-style breadboard Build view (two-way sync), with a live simulator, Arduino/ESP32 sketches with Serial Monitor, 3D export (GLB/OBJ/STL), KiCad import/export, a huge parts library (built-in parts plus the KiCad symbol libraries), a part creator, and AI that can make parts and whole circuits. Free and open source. Runs in any browser; no install, no build step, no API key in the page.

See GUIDE.md for the full guide.

## Use it
Open `index.html` through any static web server (`python3 -m http.server`), or host it:

**GitHub Pages:** put these files in a repo, Settings → Pages → deploy from branch → `/ (root)`. Install as an app from the browser menu (it's a PWA, works offline).

**Render (static site):** New → Static Site → connect the repo → publish directory `.` → no build command.

## AI without pasting a key
Three ways, pick one:
1. **Copy/paste (default):** WireFrame writes a prompt, you paste it into any AI chat, paste the reply back. Nothing to set up.
2. **Your own proxy:** deploy `proxy/` as a free Render Web Service, set `OPENROUTER_API_KEY` (from openrouter.ai/keys) there, optionally `MODEL`, then set `window.AI_PROXY_URL = "https://your-app.onrender.com/api/ai"` in `config.js`. Students never see the key. Set `ALLOWED_ORIGIN` to your site URL.
3. **Mac app:** `OPENROUTER_API_KEY` in your environment enables one-click AI.

## Mac app
Easiest: install from the browser (Chrome/Edge install icon), or run the **Build Mac app** workflow under the repo's Actions tab and download the `.dmg` (unsigned: right-click → Open). Or:
```
cd electron && npm install && npm start     # run it
npm run dist                                 # build a .dmg in electron/dist
```

## Simulator
Press Play. Click switches and buttons. Supports resistors, capacitors, inductors, diodes, LEDs, BJTs, MOSFETs, op-amps, logic gates, 555, regulators, relays, motors, lamps, meters. Power symbols named like `+9V` act as supplies.

## Contributing
Parts live in `parts.js`/`parts_ic.js`; lesson circuits in `examples.js`. Pull requests welcome.

## Licence
MIT for the app. KiCad libraries: see `lib/LICENSE-KiCad-libraries.md`.
