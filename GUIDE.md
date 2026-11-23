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

### Mac app: step by step

**Option A: install from the browser (easiest, no download)**
1. Open your live WireFrame link in **Chrome** or **Edge** on the Mac.
2. Click the small install icon at the right end of the address bar, then **Install**. (In Safari 17+: **File → Add to Dock**.)
3. WireFrame now has its own window and Dock icon, and works offline.

**Option B: download the Mac app (.dmg) from GitHub**
1. Go to github.com/Ed13S/WireFrame and open the **Actions** tab.
2. Click **Build Mac app** in the left list, then **Run workflow → Run workflow** (green button). Wait about 3 to 5 minutes for the green tick.
3. Click the finished run, scroll to **Artifacts** at the bottom, and click **WireFrame-mac** to download a zip.
4. Double-click the zip to unzip it, then open the `.dmg` inside.
5. Drag **WireFrame** onto the **Applications** folder.
6. The app is unsigned, so the first time **right-click WireFrame in Applications, choose Open, then Open**. If macOS still blocks it: **System Settings → Privacy & Security → scroll down → Open Anyway**. You only do this once.

**Option C: run it from source**
1. Install Node.js from nodejs.org.
2. Open Terminal, go into the project's `electron` folder, run `npm install`, then `npm start`.
3. `npm run dist` builds the `.dmg` into `electron/dist`.

## 2. AI with your API key (the key never goes in the web page)
Get a key at **openrouter.ai/keys** (it starts with `sk-or-`). Never paste it into `config.js`, `index.html` or anything on GitHub.

**Students on the website: use a Render proxy (key stays on Render)**
1. Go to render.com, sign in with GitHub, then **New → Web Service** and pick the WireFrame repo.
2. Set **Root Directory** to `proxy`, **Build Command** to `npm install`, **Start Command** to `npm start`, and the free instance type.
3. Open **Environment** and add `OPENROUTER_API_KEY` = your key. Also add `ALLOWED_ORIGIN` = `https://ed13s.github.io` (your site address, no path). Optional: `MODEL` (default `anthropic/claude-sonnet-4.5`; any model OpenRouter lists works, including free ones).
4. Click **Create Web Service** and wait for it to say Live. Copy the URL at the top, e.g. `https://wireframe-ai.onrender.com`.
5. In the repo edit `config.js` so it reads `window.AI_PROXY_URL = "https://wireframe-ai.onrender.com/api/ai";` (your URL plus `/api/ai`) and commit.
6. After a minute reload WireFrame, open **AI Assistant**, and it works with no key box. The free Render plan sleeps when idle, so the first request after a break can take about 30 seconds. Each visitor is limited to 20 requests per 10 minutes.

**Just you, in the Mac app**
A Mac app opened from the Dock doesn't see keys set in Terminal, so start it from Terminal:
1. Open Terminal.
2. Run: `OPENROUTER_API_KEY=sk-or-your-key /Applications/WireFrame.app/Contents/MacOS/WireFrame` (use your real key).
3. AI Assistant now works inside that window. Closing Terminal closes the app, and you repeat the command next time.
4. Running from source, use `OPENROUTER_API_KEY=sk-or-your-key npm start` in the `electron` folder instead.

**No key at all:** AI Assistant always works by copy and paste. It writes a prompt, you paste it into any AI chat, then paste the reply back.

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
