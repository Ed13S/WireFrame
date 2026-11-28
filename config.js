/* Optional AI proxy.
   Leave empty to use copy/paste mode (no key, no server needed).
   To make the AI buttons work directly, deploy the small server in /proxy to Render
   (the ANTHROPIC_API_KEY stays on Render, never in this page) and paste its URL here, e.g.
   window.AI_PROXY_URL = "https://my-schematic-ai.onrender.com/api/ai";  */
window.AI_PROXY_URL = "https://wireframe-o8xv.onrender.com/api/ai";

/* Where the "Download Mac app (.dmg)" menu item points. Put WireFrame.dmg in the repo root (or attach it to a
   GitHub Release and use the releases URL), then make sure this address matches. */
window.RELEASES_API = "https://api.github.com/repos/Ed13S/WireFrame/releases/latest";
window.DMG_URL = "https://github.com/Ed13S/WireFrame/releases/download/v2.1.13/WireFrame-2.1.13-arm64.dmg";
