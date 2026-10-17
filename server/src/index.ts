// PrimSieb – weltweite Bestenliste (Cloudflare Worker + D1).
//
//  POST /v1/results              Ergebnis einreichen (signiert mit HMAC-SHA-256, Schlüssel APP_KEY)
//  GET  /v1/top?kind=device      Gerätemodelle nach Durchschnittspunkten (mind. 1 Ergebnis)
//  GET  /v1/model?kind=…&model=…&score=…   Durchschnitt, Anzahl, Bestwert, Perzentil eines Werts für ein Modell
//
// Schutz gegen Unsinn: Plausibilitätsgrenzen je Test, höchstens 30 Uploads pro Installation und Tag,
// für Durchschnitte zählt je Installation und Modell nur das jeweils beste Ergebnis.

export interface Env {
  DB: D1Database;
  APP_KEY: string;            // wrangler secret put APP_KEY (gleicher Wert wie VITE_LB_KEY in der App)
}

const LIMITS: Record<string, [number, number]> = {
  device: [50, 20000],        // Gesamtpunkte Geräte-Check
  prime: [1, 5000],           // Punkte (Mrd. geprüfte Zahlen in 3 min)
  bh: [10, 50000],            // Ø FPS × 100
  ai: [1, 200000],            // GFLOPS FP16
  // Primzahl-Jagd: „model“ ist hier eine Gruppe (Modus bzw. Datum der Tages-Challenge), nicht das Gerät
  game: [10, 5_000_000],      // Klassisch
  blitz: [10, 5_000_000],     // 60 Sekunden
  split: [10, 5_000_000],     // Zerleger
  daily: [10, 5_000_000],     // Tages-Challenge, model = Datum
  profi: [1, 10_000_000],     // Mathe-Profi: Stufe (Anzahl erkannter Primzahlen)
  pidigits: [1, 10_000_000],  // π-Stellen: richtig getippte Nachkommastellen
};
const MAX_PER_DAY = 30;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Signature',
  'Access-Control-Max-Age': '86400',
};

const json = (data: unknown, status = 200, cache = 0) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors, ...(cache ? { 'Cache-Control': `public, max-age=${cache}` } : {}) },
  });

async function hmacHex(key: string, msg: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function sha256(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const clean = (s: unknown, max = 60) => String(s ?? '').replace(/[^\p{L}\p{N} .,+()\-_/]/gu, '').trim().slice(0, max);

/** Durchschnitt je Modell: pro Installation zählt nur deren bestes Ergebnis. */
const PER_MODEL = `
  WITH best AS (
    SELECT model, soc, install, MAX(score) AS s FROM results WHERE kind = ?1 GROUP BY model, install
  )
  SELECT model, MAX(soc) AS soc, COUNT(*) AS n, AVG(s) AS avg, MAX(s) AS best FROM best GROUP BY model`;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    try {
      if (req.method === 'POST' && url.pathname === '/v1/results') {
        const body = await req.text();
        if (body.length > 2000) return json({ error: 'too large' }, 413);
        const sig = req.headers.get('X-Signature') ?? '';
        if (!env.APP_KEY || sig !== (await hmacHex(env.APP_KEY, body))) return json({ error: 'bad signature' }, 401);
        const r = JSON.parse(body);
        const kind = String(r.kind);
        const lim = LIMITS[kind];
        const score = Number(r.score);
        if (!lim || !(score >= lim[0] && score <= lim[1])) return json({ error: 'implausible' }, 422);
        const model = clean(r.model), soc = clean(r.soc), platform = clean(r.platform, 10), version = clean(r.version, 10);
        if (!model || !/^[0-9a-f-]{20,40}$/i.test(String(r.install ?? ''))) return json({ error: 'bad request' }, 400);
        if (Math.abs(Date.now() / 1000 - Number(r.ts)) > 3600 * 24 * 3) return json({ error: 'stale' }, 422);
        const install = await sha256(String(r.install));
        const now = Math.floor(Date.now() / 1000);
        const recent = await env.DB.prepare('SELECT COUNT(*) AS c FROM results WHERE install = ? AND created > ?').bind(install, now - 86400).first<{ c: number }>();
        if ((recent?.c ?? 0) >= MAX_PER_DAY) return json({ error: 'rate limited' }, 429);
        await env.DB.prepare('INSERT INTO results (kind, model, soc, platform, score, version, install, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(kind, model, soc || '?', platform || '?', Math.round(score * 10) / 10, version, install, now).run();
        return json({ ok: true });
      }

      if (req.method === 'GET' && url.pathname === '/v1/top') {
        const kind = url.searchParams.get('kind') ?? 'device';
        if (!LIMITS[kind]) return json({ error: 'bad kind' }, 400);
        const { results } = await env.DB.prepare(`${PER_MODEL} ORDER BY avg DESC LIMIT 200`).bind(kind).all();
        const total = await env.DB.prepare('SELECT COUNT(DISTINCT install) AS c FROM results WHERE kind = ?').bind(kind).first<{ c: number }>();
        return json({ kind, devices: results, participants: total?.c ?? 0 }, 200, 60);
      }

      if (req.method === 'GET' && url.pathname === '/v1/model') {
        const kind = url.searchParams.get('kind') ?? 'device';
        const model = clean(url.searchParams.get('model'));
        const score = Number(url.searchParams.get('score') ?? NaN);
        if (!LIMITS[kind] || !model) return json({ error: 'bad request' }, 400);
        const row = await env.DB.prepare(`SELECT * FROM (${PER_MODEL}) WHERE model = ?2`).bind(kind, model).first();
        const rank = await env.DB.prepare(`SELECT COUNT(*) + 1 AS r FROM (${PER_MODEL}) WHERE avg > (SELECT avg FROM (${PER_MODEL}) WHERE model = ?2)`).bind(kind, model).first<{ r: number }>();
        let below: number | null = null;
        if (Number.isFinite(score)) {
          const b = await env.DB.prepare(`SELECT SUM(CASE WHEN s < ?3 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) AS p FROM
            (SELECT install, MAX(score) AS s FROM results WHERE kind = ?1 AND model = ?2 GROUP BY install)`).bind(kind, model, score).first<{ p: number }>();
          below = b?.p ?? null;
        }
        return json({ kind, model, stats: row ?? null, rank: row ? rank?.r ?? null : null, below });
      }

      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: 'server error', detail: String(e).slice(0, 200) }, 500);
    }
  },
};
