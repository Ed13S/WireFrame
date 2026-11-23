# WireFrame user guide

## 1. Hosting it (pick either)

### GitHub Pages (free)
1. On GitHub create a new repository, e.g. `WireFrame` (public). Don't reuse `Ed13S/page` or `Ed13S/Course` unless you want it inside them.
2. Upload everything inside the `schematic` folder (`index.html`, `*.js`, `style.css`, `lib/`, etc. must be at the repo's top level). Easiest: on the repo page choose **Add file → Upload files** and drag the contents in, or use git:
   `git init && git add . && git commit -m "WireFrame" && git branch -M main && git remote add origin https://github.com/Ed13S/WireFrame.git && git push -u origin main`
3. **Settings → Pages → Build and deployment**: Source "Deploy from a branch", Branch `main`, folder `/ (root)`, Save.
4. After a minute it's live at `https://ed13s.github.io/WireFrame/`. Give students that link.

### Render (free static site)
1. Push the same repo to GitHub.
2. Render dashboard → **New → Static Site** → pick the repo.
3. Build command: leave empty. Publish directory: `.` → Create. You get a `https://wireframe-xxxx.onrender.com` link.

Either works. GitHub Pages is simplest. Use Render only if you also want the AI proxy (below).

### Installing like an app
Open the live link in Chrome/Edge/Safari and use **Install app / Add to Dock / Add to Home Screen**. It then works offline.

### Mac app (three ways, easiest first)
1. **Install from the browser (no build, recommended).** Open your live link in **Chrome or Edge** and click the install icon in the address bar (Safari 17+: File → Add to Dock). It gets its own window and works offline.
2. **Download a ready-made `.dmg` from GitHub.** In your repo open **Actions → Build Mac app → Run workflow**. When it finishes, download the `WireFrame-mac` artifact at the bottom of the run, unzip, open the `.dmg` and drag WireFrame to Applications. The app is unsigned, so the first time **right-click → Open → Open** (or System Settings → Privacy & Security → Open Anyway).
3. **Run it yourself.** Install Node.js, then in the `electron` folder run `npm install` then `npm start`. `npm run dist` builds the `.dmg`. To give the app AI without pasting a key, start it with `OPENROUTER_API_KEY=your-key npm start`.

## 2. AI without pasting a key
- **Default (nothing to set up):** click **AI Assistant**, describe a part or circuit, copy the prompt it makes into any AI chat (Claude, ChatGPT…), paste the reply back. WireFrame builds, wires and checks it.
- **One-click for students:** deploy the `proxy` folder on Render as a **Web Service** (build `npm install`, start `npm start`), add environment variable `OPENROUTER_API_KEY` (your OpenRouter key from openrouter.ai/keys stays on Render; optionally add `MODEL`, e.g. `anthropic/claude-sonnet-4.5` or any free model OpenRouter lists) and `ALLOWED_ORIGIN` = your Pages URL. Then in `config.js` set `window.AI_PROXY_URL = "https://your-proxy.onrender.com/api/ai"` and re-upload. The proxy limits each visitor to 20 requests per 10 minutes.

## 3. Using WireFrame
**Start:** click **Lessons** for ready-made circuits, then press green **Play**.

**Place parts:** search or browse the left panel, click a part, click the sheet. Press `R` to rotate, `M` to mirror, `Del` to delete. **KiCad library** holds thousands more symbols. **+ New part** makes your own (pins and box, or advanced JSON); you can import `.kicad_sym` files too.

**Wire:** press `W`, click a pin, click where to bend, double-click or click another pin to finish. Pins touching or wires crossing a wire end connect. **Label** (`L`) joins nets by name without drawing wires; power symbols (GND, +5V, +9V…) join automatically.

**Move/edit:** drag parts (wires follow), drag a box to select several, Ctrl/Cmd+C/V/D copy, paste, duplicate, Ctrl/Cmd+Z undo. Click a part to edit its reference and value (e.g. `10k`, `100u`).

**View:** scroll or pinch to zoom, hold Space or middle/right mouse to pan, **Fit** to see everything.

**Simulate:** **Play** starts it. Click switches and buttons. Blue→red wire colours show voltage, moving dots show current, LEDs glow (and burn out with no resistor!), voltmeters and ammeters show readings. Edit while running and it updates. **Reset** restarts, **Stop** ends.

**Check:** finds unconnected pins and shorts.

**AI:** Make a circuit, Make a part, or Ask about this circuit.

**Save and share:** File menu → Save `.json` (reopen with Open or drag onto the page). Export PNG/SVG, **Copy picture to clipboard**, Copy SVG, netlist. Fill in Title, Author, Date in Properties; exports carry a KiCad-style title block ending "©WireFrame EDA 1.0.1".

**Theme button (top right):** cycles dark (black and acid green), light (KiCad-style with light-blue symbols) and auto. The sheet is cream in dark mode.

**Keyboard shortcuts (KiCad style):** `A` add part, `W` wire, `L` label, `P` power symbol, `T` note, `R` rotate, `X`/`Y` mirror, `M` move, `G` drag, `C` copy, `Del` delete, `Esc` cancel, Ctrl/Cmd+Z undo, Ctrl/Cmd+C/V/D copy, paste, duplicate. File menu → **Keyboard shortcuts** shows the full list.

**Projects:** the folder button next to the logo keeps several circuits (new, open, rename, duplicate, delete). They are stored in your browser, so also use File → Save `.json` as a backup.

**Title block:** double-click the block at the bottom right of the sheet to edit title, company, date, revision and sheet. Exports carry it.

**Build view (breadboard):** click **Build** at the top. Parts sit on a breadboard like Tinkercad. Pick a part on the left, click to place, drag from any hole to run a jumper wire, `R` rotates. Schematic and Build stay in step: edit either and the other updates. **Play** runs the simulation here too (LED glow, motors, meters). Arduino and ESP32 boards show their real pins and indicator LEDs (L, TX, RX, ON).

**Code and Serial (microcontrollers):** put an Arduino or ESP32 part on the sheet, open **Code & Serial** at the bottom, write a sketch (`pinMode`, `digitalWrite`, `digitalRead`, `analogWrite`, `analogRead`, `delay`, `tone`, `Serial.println`) and press Play. Output appears in the Serial Monitor. Not supported: Servo, Wire/I2C, WiFi and other libraries.

**3D export:** in Build view use File → Export 3D model as **GLB** (metres, for viewers and Blender), **OBJ** or **STL** (millimetres, import straight into Fusion 360, Tinkercad or a slicer).

**KiCad and other tools:** File → Import KiCad (`.kicad_sch`, `.kicad_sym`), Export KiCad schematic, netlist, SPICE and BOM. Note: the exports follow KiCad 8's format but have not been checked in every KiCad version, so open them once before relying on them.

**Copy to Word/Docs:** Copy picture and PNG/SVG exports have a transparent background so they take on the page colour.

## 4. Tips for class
Set a lesson, have students open a Lesson, predict the voltage, then press Play to check. Delete the LED resistor to see burnout. Students can save their `.json` and hand it in.

## 5. Known limits
Negative supply rails (e.g. -12 V) in Build view, dragging jumper end points, and wire-current animation in Build view are untested. No Servo/I2C/WiFi sketch libraries. A simplified kids' mode is not built yet.
