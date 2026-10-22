// ld-push: avisos push de Luxury Inventory.
//  - Los teléfonos piden la llave pública ("key") y se suscriben aquí (subscribe / prefs / unsubscribe / test).
//  - La base de datos llama a "notify" (con la clave de ld_push_config) cuando hay un trabajo nuevo, una orden
//    completada, las piezas de un trabajo listas en el taller o todos sus muebles armados.
// Configuración: la tabla privada ld_push_config (la crea ld_push.sql). Las llaves VAPID se generan solas la
// primera vez y se guardan ahí; nadie tiene que copiarlas. (Opcional: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY /
// LD_PUSH_SECRET como secretos de la función tienen prioridad.) SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase.

import { generateVapidKeys, sendPush, type PushSubscriptionJSON, type Vapid } from './webpush.ts';

const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
// al tocar el aviso se abre la app (sin dirección: la del service worker del teléfono)
const APP_URL = Deno.env.get('LD_APP_URL') || undefined;
const SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:info@luxuryckdesign.com';
const KINDS = ['nuevo', 'completado', 'piezas', 'armado'] as const;
type Kind = (typeof KINDS)[number];
// solo servidores de push de verdad (Chrome/Android, Firefox, Safari/iPhone, Edge)
const PUSH_HOSTS = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-ld-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function db(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

interface Config {
  vapid: Vapid;
  secret: string;
}
let cached: Config | null = null;

type ConfigRow = { secret: string | null; vapid_public: string | null; vapid_private: string | null; vapid_subject: string | null };
async function readConfig(): Promise<ConfigRow | null> {
  const r = await db('ld_push_config?id=eq.1&select=secret,vapid_public,vapid_private,vapid_subject');
  if (!r.ok) return null;
  const rows = (await r.json()) as ConfigRow[];
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

/** Llaves y clave compartida: de los secretos de la función o de ld_push_config (las llaves se crean una sola vez). */
async function config(): Promise<Config | null> {
  if (cached) return cached;
  if (!SB_URL || !SRK) return null;
  const envPub = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const envPriv = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const envSecret = Deno.env.get('LD_PUSH_SECRET') ?? '';
  let row = await readConfig();
  if (!row && !(envPub && envPriv && envSecret)) return null; // falta correr ld_push.sql
  let pub = envPub;
  let priv = envPriv;
  if (!(pub && priv) && row) {
    if (!row.vapid_public || !row.vapid_private) {
      const k = await generateVapidKeys();
      // solo si nadie las guardó antes (dos teléfonos a la vez: gana el primero y el otro relee)
      await db('ld_push_config?id=eq.1&vapid_private=is.null', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ vapid_public: k.publicKey, vapid_private: k.privateKey }) });
      row = await readConfig();
    }
    pub = row?.vapid_public ?? '';
    priv = row?.vapid_private ?? '';
  }
  const secret = envSecret || row?.secret || '';
  if (!pub || !priv) return null;
  cached = { vapid: { publicKey: pub, privateKey: priv, subject: row?.vapid_subject || SUBJECT }, secret };
  return cached;
}

interface Prefs {
  nuevo?: boolean;
  completado?: boolean;
  piezas?: boolean;
  armado?: boolean;
  silencio?: boolean;
}
const cleanPrefs = (p: unknown): Prefs => {
  const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
  const out: Prefs = { silencio: o.silencio === true };
  for (const k of KINDS) out[k] = o[k] !== false;
  return out;
};

function validSub(s: unknown): PushSubscriptionJSON | null {
  const o = s as PushSubscriptionJSON;
  if (!o || typeof o.endpoint !== 'string' || !o.keys || typeof o.keys.p256dh !== 'string' || typeof o.keys.auth !== 'string') return null;
  try {
    const u = new URL(o.endpoint);
    if (u.protocol !== 'https:' || !PUSH_HOSTS.some((re) => re.test(u.hostname))) return null;
  } catch {
    return null;
  }
  return { endpoint: o.endpoint, keys: { p256dh: o.keys.p256dh, auth: o.keys.auth } };
}

const str = (v: unknown, max = 120) => String(v ?? '').slice(0, max);

async function sendTo(vapid: Vapid, rows: { endpoint: string; sub: PushSubscriptionJSON; fails: number }[], msg: Record<string, unknown>, topic?: string) {
  let sent = 0;
  let failed = 0;
  await Promise.allSettled(
    rows.map(async (r) => {
      try {
        const res = await sendPush(r.sub, msg, vapid, { topic, urgency: 'normal' });
        if (res.gone) {
          await db(`ld_push_subs?endpoint=eq.${encodeURIComponent(r.endpoint)}`, { method: 'DELETE' });
          failed++;
        } else if (res.status >= 200 && res.status < 300) {
          sent++;
          if (r.fails) await db(`ld_push_subs?endpoint=eq.${encodeURIComponent(r.endpoint)}`, { method: 'PATCH', body: JSON.stringify({ fails: 0 }) });
        } else {
          failed++;
          await db(`ld_push_subs?endpoint=eq.${encodeURIComponent(r.endpoint)}`, { method: 'PATCH', body: JSON.stringify({ fails: (r.fails ?? 0) + 1 }) });
        }
      } catch {
        failed++;
      }
    }),
  );
  return { sent, failed };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405);
  const cfg = await config();
  if (!cfg) return json({ ok: false, error: 'not-configured' }, 503);
  const vapid = cfg.vapid;
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return json({ ok: false, error: 'json' }, 400);
  }
  const action = str(b.action, 20);
  const now = new Date().toISOString();

  // la llave pública es pública: los teléfonos la necesitan para suscribirse
  if (action === 'key') return json({ ok: true, publicKey: vapid.publicKey });

  if (action === 'subscribe') {
    const sub = validSub(b.sub);
    if (!sub) return json({ ok: false, error: 'subscription' }, 400);
    const r = await db('ld_push_subs?on_conflict=endpoint', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ endpoint: sub.endpoint, sub, device: str(b.device, 60), who: str(b.who, 60), prefs: cleanPrefs(b.prefs), updated_at: now, fails: 0 }),
    });
    return r.ok ? json({ ok: true }) : json({ ok: false, error: `db ${r.status}` }, 500);
  }

  if (action === 'prefs' || action === 'unsubscribe' || action === 'test') {
    const endpoint = str(b.endpoint, 1000);
    if (!endpoint) return json({ ok: false, error: 'endpoint' }, 400);
    const where = `ld_push_subs?endpoint=eq.${encodeURIComponent(endpoint)}`;
    if (action === 'prefs') {
      const r = await db(where, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ prefs: cleanPrefs(b.prefs), updated_at: now }) });
      const rows = r.ok ? await r.json() : [];
      return r.ok ? json({ ok: true, found: Array.isArray(rows) && rows.length > 0 }) : json({ ok: false, error: `db ${r.status}` }, 500);
    }
    if (action === 'unsubscribe') {
      const r = await db(where, { method: 'DELETE' });
      return r.ok ? json({ ok: true }) : json({ ok: false, error: `db ${r.status}` }, 500);
    }
    const r = await db(`${where}&select=endpoint,sub,fails`);
    const rows = r.ok ? await r.json() : [];
    if (!Array.isArray(rows) || !rows.length) return json({ ok: false, error: 'not-subscribed' }, 404);
    const res = await sendTo(vapid, rows, { title: 'Luxury Inventory', body: 'Notificación de prueba: los avisos llegan a este teléfono.', tag: 'test', url: APP_URL });
    return json({ ok: res.sent > 0, ...res });
  }

  if (action === 'notify') {
    if (!cfg.secret || req.headers.get('x-ld-secret') !== cfg.secret) return json({ ok: false, error: 'forbidden' }, 403);
    const kind = str(b.kind, 20) as Kind;
    if (!KINDS.includes(kind)) return json({ ok: false, error: 'kind' }, 400);
    const r = await db('ld_push_subs?select=endpoint,sub,fails,prefs');
    const all = r.ok ? ((await r.json()) as { endpoint: string; sub: PushSubscriptionJSON; fails: number; prefs: Prefs }[]) : [];
    const rows = all.filter((x) => {
      const p = cleanPrefs(x.prefs);
      return !p.silencio && p[kind] !== false;
    });
    const msg = { title: str(b.title, 80), body: str(b.body, 200), tag: str(b.tag, 80) || kind, url: APP_URL };
    const res = await sendTo(vapid, rows, msg, msg.tag);
    await db('ld_push_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ kind, title: msg.title, body: msg.body, sent: res.sent, failed: res.failed }) });
    return json({ ok: true, ...res });
  }

  return json({ ok: false, error: 'action' }, 400);
});
