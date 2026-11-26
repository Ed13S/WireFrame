// Tiny AI proxy for WireFrame. Holds the API key as an environment variable so users never see or paste one.
// Deploy free on Render (Web Service, Node). Set OPENROUTER_API_KEY (and optionally MODEL, e.g. a free model) and optionally ALLOWED_ORIGIN.
const http = require('http');
const KEY = process.env.OPENROUTER_API_KEY, ORIGIN = process.env.ALLOWED_ORIGIN || '*', MODEL = process.env.MODEL || 'openrouter/free';
const hits = new Map(); // crude per-IP rate limit: 20 requests / 10 min
const ok = ip => { const n = Date.now(), a = (hits.get(ip) || []).filter(t => n - t < 6e5); a.push(n); hits.set(ip, a); return a.length <= 20; };
http.createServer(async (req, res) => {
  const h = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'content-type', 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') { res.writeHead(204, h); return res.end(); }
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) { res.writeHead(200, h); return res.end(JSON.stringify({ ok: true, hasKey: !!KEY, model: MODEL, note: 'WireFrame AI proxy is running. The app calls POST /api/ai.' })); }
  if (req.url !== '/api/ai' || req.method !== 'POST') { res.writeHead(404, h); return res.end('{"error":"not found"}'); }
  if (!KEY) { res.writeHead(500, h); return res.end('{"error":"server has no API key set"}'); }
  if (!ok(req.socket.remoteAddress)) { res.writeHead(429, h); return res.end('{"error":"slow down, try again in a few minutes"}'); }
  let body = ''; for await (const c of req) { body += c; if (body.length > 2e5) break; }
  try {
    const { prompt } = JSON.parse(body); if (typeof prompt !== 'string') throw new Error('bad request');
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'Authorization': 'Bearer ' + KEY, 'content-type': 'application/json' }, body: JSON.stringify({ model: MODEL, max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }) });
    const j = await r.json(); if (!r.ok) throw new Error('OpenRouter said: ' + (j.error && j.error.message || r.status) + ' (model ' + MODEL + ')');
    res.writeHead(200, h); res.end(JSON.stringify({ text: (j.choices && j.choices[0] && j.choices[0].message.content) || '' }));
  } catch (e) { res.writeHead(500, h); res.end(JSON.stringify({ error: String(e.message) })); }
}).listen(process.env.PORT || 8787);
