# WireFrame

A free circuit editor for students. Draw a schematic the way KiCad does, then switch to **Build** and see the same circuit on a breadboard like Tinkercad. Press **Play** to simulate it.

- Schematic and breadboard views stay in sync
- Live simulator: LEDs glow, meters read, switches and buttons work, AC sources, microcontroller sketches with a Serial Monitor
- Thousands of parts (built in plus the KiCad symbol libraries), and a part creator, including parts built from other parts
- Footprints: browse about 12,000 KiCad footprints
- Optional AI helper that can make parts and whole circuits
- Import and export KiCad files, netlists, SPICE, parts lists, PNG/SVG and 3D models (GLB, OBJ, STL)
- Free. No account, no ads, no API key needed to use it

## Get it

**In the browser (easiest):** open the WireFrame website. In Chrome or Edge you can install it as an app from the address bar, and it then works offline.

**Mac app:** download **WireFrame.dmg** (File menu → *Download Mac app*, or from this repo), open it and drag WireFrame into Applications. The app is not signed by Apple, so the first time: open it, then go to System Settings → Privacy & Security → scroll down → **Open Anyway**. Step by step with pictures-in-words is in [GUIDE.md](GUIDE.md).

## Your files
Save sheets as **`.wire`** files (File → Save). They carry everything: the schematic, the breadboard layout, the title block and any parts you made. Open them on any computer, or in the Mac app, with File → Open or by dragging the file onto the page.

## Learn it
Start with **Lessons** in the app, then read [GUIDE.md](GUIDE.md). Press `Ctrl/Cmd+F1` in the app for the keyboard shortcuts.

## Hosting it yourself
You only need this if you are the teacher or developer setting it up. Everything is plain files with no build step.

- **GitHub Pages:** Settings → Pages → deploy from branch → `/ (root)`.
- **Render (static site):** New → Static Site → publish directory `.` → no build command.
- **Run locally:** `python3 -m http.server`, then open `http://localhost:8000`.
- **AI:** by default WireFrame writes a prompt you paste into any AI chat and paste the reply back. To make the AI buttons work directly, deploy `proxy/` as a Render Web Service with `OPENROUTER_API_KEY`, set `ALLOWED_ORIGIN` to your site, then put its address in `config.js`. In the Mac app, paste your own key once in the AI box. Details in GUIDE.md.
- **Mac app:** `cd electron && npm install && npm start` to run, `npm run dist` to build the `.dmg`, or use the **Build Mac app** workflow under Actions. Point `DMG_URL` in `config.js` at wherever you publish the `.dmg`.

## Contributing and licence
Source-available: free to use as provided, not to copy or modify. Improvements are welcome as pull requests; see `LICENSE` and `CONTRIBUTING.md`. KiCad libraries: see `lib/LICENSE-KiCad-libraries.md`. Other credits: `THIRD_PARTY.md`.
