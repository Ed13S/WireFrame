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

### Mac app (optional)
Install Node.js, then in the `electron` folder run `npm install` and `npm start`. `npm run dist` builds a `.dmg`.

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

## 4. Tips for class
Set a lesson, have students open a Lesson, predict the voltage, then press Play to check. Delete the LED resistor to see burnout. Students can save their `.json` and hand it in.

## 5. Not built yet
Breadboard "Build" view with two-way sync, and a simplified kids' mode.
