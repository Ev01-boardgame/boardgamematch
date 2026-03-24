/**
 * MBTI × 桌遊配對 - Cloudflare Worker API
 * 模擬 Genspark tables/xxx API 格式，對接 Cloudflare D1
 *
 * 路由：
 *   GET    /admin/aggregate-game-names - 管理員：遊戲名稱次數聚合 + 遊戲庫名稱（別名後台）
 *   GET    /tables/{table}           - 列表（支援 page, limit, search, sort）
 *   GET    /tables/{table}/{id}      - 單筆
 *   POST   /tables/{table}           - 新增
 *   PUT    /tables/{table}/{id}      - 完整更新
 *   PATCH  /tables/{table}/{id}      - 部分更新
 *   DELETE /tables/{table}/{id}      - 刪除
 *
 * 安全機制：
 *   1. API Secret — 多數請求需帶 X-Api-Key header（由 Nginx 注入）；GET /api/bgg-axis-deltas 除外
 *   2. JWT 驗證  — 寫入操作需帶 Authorization: Bearer <Google JWT>
 *   3. RBAC      — 敏感 table 和 DELETE 需 admin 角色
 *
 * 環境變數（wrangler.toml [vars] 或 Dashboard Secrets）：
 *   API_SECRET       — Nginx 注入的 secret key
 *   GOOGLE_CLIENT_ID — Google OAuth Client ID（JWT aud 驗證）
 *   ALLOWED_ORIGINS  — 允許的 CORS origins（逗號分隔，如 "https://example.com,https://dev.example.com"）
 *
 * 例外（不需 X-Api-Key）：
 *   GET /api/bgg-axis-deltas — 公開讀取 BGG→六軸 delta（與靜態 bgg-axis-deltas-v1.js 後備一致）
 *
 * BGG 收藏預覽（需 X-Api-Key + Authorization Bearer Google JWT）：
 *   GET /api/bgg/collection-preview?username=&include_expansions=0|1
 *   — 代理 BGG xmlapi2/collection（含 202 輪詢）、對照 game_database.bgg_id
 *
 * 管理端（需 X-Api-Key + JWT + admin／超管）：
 *   PUT /api/admin/bgg-axis-deltas — 寫入整包 category／mechanic delta 至 D1
 */

import { BGG_AXIS_DEFAULTS } from './bgg-axis-defaults.js';

const ALLOWED_TABLES = [
  'users', 'user_stats', 'game_database', 'game_aliases', 'game_votes',
  'game_collections', 'collection_game_stats', 'user_collections',
  'user_collection_votes', 'achievements', 'admin_whitelist',
  'tester_whitelist', 'influencer_whitelist', 'publisher_badge_series',
  'quiz_collections', 'quiz_questions', 'quiz_attempts',
  'daily_quests', 'limited_events', 'event_progress', 'site_stats',
  'community_links', 'user_preference_profiles'
];

// 每頁最大筆數
const TABLE_MAX_LIMIT = {
  game_database: 200,
  game_aliases: 200,
  community_links: 500,
  default: 100
};

// 以非 id 為 PK 的資料表（單筆 GET/PUT/PATCH 用此欄位）
const PK_COLUMN = { user_preference_profiles: 'user_id' };
function getPkColumn(tableName) {
  return PK_COLUMN[tableName] || 'id';
}

// 若 D1 尚未建表，自動建立（新手免手動跑 migration）
const USER_PREFERENCE_PROFILES_DDL = `CREATE TABLE IF NOT EXISTS user_preference_profiles (
  user_id TEXT PRIMARY KEY,
  conflict INTEGER DEFAULT 0,
  strategy INTEGER DEFAULT 0,
  social_fun INTEGER DEFAULT 0,
  immersion INTEGER DEFAULT 0,
  accessibility INTEGER DEFAULT 0,
  manipulation INTEGER DEFAULT 0,
  coop INTEGER DEFAULT 0,
  luck INTEGER DEFAULT 0,
  updated_at INTEGER DEFAULT (strftime('%s','now') * 1000)
)`;
async function ensureUserPreferenceProfilesTable(db) {
  await db.prepare(USER_PREFERENCE_PROFILES_DDL).run();
}

// BGG 主題／機制 → 六軸 delta（線上覆寫；無資料列時回傳與 bgg-axis-defaults.js 相同預設）
const BGG_AXIS_DELTAS_DDL = `CREATE TABLE IF NOT EXISTS bgg_axis_deltas (
  id TEXT PRIMARY KEY,
  category_deltas TEXT NOT NULL DEFAULT '{}',
  mechanic_deltas TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
)`;

async function ensureBggAxisDeltasTable(db) {
  await db.prepare(BGG_AXIS_DELTAS_DDL).run();
}

function validateBggAxisDeltaMaps(cat, mech) {
  const axes = new Set(BGG_AXIS_DEFAULTS.AXIS_KEYS);
  if (!cat || typeof cat !== 'object' || Array.isArray(cat)) return 'category_deltas 必須為物件';
  if (!mech || typeof mech !== 'object' || Array.isArray(mech)) return 'mechanic_deltas 必須為物件';
  for (const [label, map] of [['category_deltas', cat], ['mechanic_deltas', mech]]) {
    for (const [tag, deltas] of Object.entries(map)) {
      if (typeof tag !== 'string' || !tag.trim()) return `${label} 含無效鍵`;
      if (!deltas || typeof deltas !== 'object' || Array.isArray(deltas)) {
        return `${label} 的「${tag}」值必須為物件`;
      }
      for (const [ax, val] of Object.entries(deltas)) {
        if (!axes.has(ax)) return `未知軸：${ax}`;
        const n = typeof val === 'number' ? val : parseFloat(val);
        if (Number.isNaN(n)) return `「${tag}」的 ${ax} 必須為數字`;
      }
    }
  }
  return null;
}

async function handleGetBggAxisDeltas(db, origin, env) {
  const def = BGG_AXIS_DEFAULTS;
  let cat = { ...def.CATEGORY_AXIS_DELTAS };
  let mech = { ...def.MECHANIC_AXIS_DELTAS };
  let source = 'defaults';

  if (db) {
    try {
      await ensureBggAxisDeltasTable(db);
      const row = await db.prepare(
        'SELECT category_deltas, mechanic_deltas FROM bgg_axis_deltas WHERE id = ?'
      ).bind('v1').first();
      if (row) {
        let fromDb = false;
        try {
          const c = JSON.parse(row.category_deltas || '{}');
          if (c && typeof c === 'object' && !Array.isArray(c) && Object.keys(c).length) {
            cat = c;
            fromDb = true;
          }
        } catch (e) { /* ignore */ }
        try {
          const m = JSON.parse(row.mechanic_deltas || '{}');
          if (m && typeof m === 'object' && !Array.isArray(m) && Object.keys(m).length) {
            mech = m;
            fromDb = true;
          }
        } catch (e) { /* ignore */ }
        if (fromDb) source = 'database';
      }
    } catch (e) {
      console.warn('handleGetBggAxisDeltas', e);
    }
  }

  const headers = { ...corsHeaders(origin, env), 'Cache-Control': 'no-store' };
  Object.keys(headers).forEach(k => headers[k] === undefined && delete headers[k]);
  return new Response(
    JSON.stringify({
      version: def.version,
      AXIS_KEYS: def.AXIS_KEYS,
      AXIS_LABELS_ZH: def.AXIS_LABELS_ZH,
      CATEGORY_AXIS_DELTAS: cat,
      MECHANIC_AXIS_DELTAS: mech,
      source
    }),
    { status: 200, headers }
  );
}

// ══ 權限矩陣 ══
// public  = API Secret 即可（未登入可讀）
// auth    = 需 JWT（已登入用戶）
// admin   = 需 JWT + admin_whitelist
const PUBLIC_READ_TABLES = [
  'game_database', 'game_aliases', 'game_collections',
  'collection_game_stats', 'achievements', 'site_stats',
  'quiz_collections', 'quiz_questions', 'daily_quests',
  'limited_events', 'publisher_badge_series',
  'user_collections', 'users', 'user_stats',
  'game_votes', 'user_collection_votes', 'community_links'
];

const ADMIN_ONLY_TABLES = [
  'admin_whitelist', 'tester_whitelist', 'influencer_whitelist'
];

// ══ Google JWT 驗證 ══
let cachedGoogleKeys = null;
let googleKeysExpiry = 0;

async function getGooglePublicKeys() {
  const now = Date.now();
  if (cachedGoogleKeys && now < googleKeysExpiry) return cachedGoogleKeys;

  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  const data = await res.json();

  // 從 Cache-Control 取 max-age
  const cacheControl = res.headers.get('Cache-Control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) * 1000 : 3600000;

  cachedGoogleKeys = data.keys;
  googleKeysExpiry = now + maxAge;
  return cachedGoogleKeys;
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)));
}

async function verifyGoogleJWT(token, clientId) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');

  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
  const signature = base64UrlDecode(parts[2]);

  // 不檢查過期：JWT 簽章已確保身份不可偽造，過期僅限制被竊取 token 的使用窗口
  // 本專案有 API Secret 閘門，且非高機敏系統，放寬過期以避免頻繁重新登入

  // 檢查 audience
  if (clientId && payload.aud !== clientId) throw new Error('Invalid audience');

  // 檢查 issuer
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) {
    throw new Error('Invalid issuer');
  }

  // 取 Google 公鑰驗簽
  const keys = await getGooglePublicKeys();
  const key = keys.find(k => k.kid === header.kid);
  if (!key) throw new Error('Key not found');

  const cryptoKey = await crypto.subtle.importKey(
    'jwk', key,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['verify']
  );

  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, data);
  if (!valid) throw new Error('Invalid signature');

  return payload;
}

// ══ 權限檢查 ══
function getRequiredAuth(method, tableName) {
  // DELETE 一律需要 admin
  if (method === 'DELETE') return 'admin';

  // 寫入操作（POST/PUT/PATCH）
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    if (ADMIN_ONLY_TABLES.includes(tableName)) return 'admin';
    return 'auth';
  }

  // GET 請求
  if (ADMIN_ONLY_TABLES.includes(tableName)) return 'admin';
  if (PUBLIC_READ_TABLES.includes(tableName)) return 'public';
  return 'auth';
}

async function checkAdmin(db, googleId) {
  const row = await db.prepare(
    'SELECT id FROM admin_whitelist WHERE google_id = ? AND is_active = 1'
  ).bind(googleId).first();
  return !!row;
}

/**
 * 與 public/js/admin-auth.js 的 SUPER_ADMIN_IDS 保持一致（JWT payload.sub = Google user id）
 * 超級管理員未寫入 admin_whitelist 時，仍須能呼叫 /admin/aggregate-game-names 等管理端點
 */
const SUPER_ADMIN_GOOGLE_IDS = new Set([
  '101279808163813574015',
  '103111021786847709012'
]);

async function checkAdminOrSuper(db, googleId) {
  if (googleId != null && SUPER_ADMIN_GOOGLE_IDS.has(String(googleId))) return true;
  return checkAdmin(db, googleId);
}

// ══ CORS ══
function corsHeaders(origin, env) {
  const allowedOrigins = (env?.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
  const resolvedOrigin = allowedOrigins.includes('*')
    ? '*'
    : (allowedOrigins.includes(origin) ? origin : allowedOrigins[0]);

  return {
    'Access-Control-Allow-Origin': resolvedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key',
    'Access-Control-Allow-Credentials': resolvedOrigin !== '*' ? 'true' : undefined,
    'Content-Type': 'application/json'
  };
}

function jsonResponse(data, status = 200, origin, env) {
  const headers = corsHeaders(origin, env);
  // 移除 undefined 值
  Object.keys(headers).forEach(k => headers[k] === undefined && delete headers[k]);
  return new Response(JSON.stringify(data), { status, headers });
}

function errorResponse(message, status = 400, origin, env) {
  return jsonResponse({ error: message }, status, origin, env);
}

// 產生 UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 取得資料表欄位
async function getTableColumns(db, tableName) {
  try {
    const result = await db.prepare(`PRAGMA table_info(${tableName})`).all();
    return result.results.map(col => col.name);
  } catch (e) {
    return [];
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const BGG_COLLECTION_HEADERS = {
  Accept: 'application/xml, text/xml;q=0.9, */*;q=0.8',
  'User-Agent': 'BoardGameMatch/1.0 (+https://boardgamematch.com.tw; collection-preview)',
};

/**
 * BGG xmlapi2/collection 常先回 202（背景建快取），必須重試至 200。
 */
async function fetchBggCollectionXml(username, includeExpansions) {
  const params = new URLSearchParams({
    username: username.trim(),
    own: '1',
    wishlist: '1',
    stats: '0',
  });
  if (!includeExpansions) {
    params.set('excludesubtype', 'boardgameexpansion');
    params.set('excludeexpansion', '1');
  }
  const bggUrl = `https://boardgamegeek.com/xmlapi2/collection?${params.toString()}`;

  let lastStatus = 0;
  for (let attempt = 0; attempt < 28; attempt++) {
    const res = await fetch(bggUrl, {
      headers: BGG_COLLECTION_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
    });
    lastStatus = res.status;
    if (res.status === 200) {
      return await res.text();
    }
    if (res.status === 202) {
      await sleep(2200);
      continue;
    }
    const body = await res.text().catch(() => '');
    const err = new Error(`BGG collection HTTP ${res.status}`);
    err.bggStatus = res.status;
    err.bggBodySnippet = body.slice(0, 400);
    throw err;
  }
  const err = new Error(`BGG collection 逾時（最後 HTTP ${lastStatus}）`);
  err.bggStatus = 503;
  throw err;
}

function parseBggCollectionMessage(xml) {
  const m = /<message[^>]*>([\s\S]*?)<\/message>/i.exec(xml);
  return m ? m[1].replace(/\s+/g, ' ').trim() : null;
}

function parseBggCollectionItems(xml) {
  const owned = [];
  const wishlist = [];
  const re = /<item\s+([^>]+)>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const open = m[1];
    const block = m[2];
    const oidMatch = /objectid="(\d+)"/i.exec(open);
    if (!oidMatch) continue;
    const bggId = oidMatch[1];
    const nameMatch = /<name\b[^>]*>([^<]*)<\/name>/i.exec(block);
    const name = nameMatch ? nameMatch[1].trim() : '';
    const statusMatch = block.match(/<status\s+([^>]+?)\s*\/>/i);
    const st = statusMatch ? statusMatch[1] : '';
    const isOwn = /\bown="1"/i.test(st);
    const isWish = /\bwishlist="1"/i.test(st);
    const entry = { bgg_id: bggId, name };
    if (isOwn) owned.push(entry);
    if (isWish) wishlist.push(entry);
  }
  return { owned, wishlist };
}

async function lookupGamesByBggIds(db, ids) {
  const map = new Map();
  const unique = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  if (!unique.length || !db) return map;
  const chunkSize = 80;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const ph = chunk.map(() => '?').join(',');
    const q = `SELECT bgg_id, name_zh, name_en, name_ja FROM game_database WHERE bgg_id IN (${ph})`;
    const res = await db.prepare(q).bind(...chunk).all();
    for (const row of res.results || []) {
      if (row && row.bgg_id != null && row.bgg_id !== '') map.set(String(row.bgg_id), row);
    }
  }
  return map;
}

async function handleGetBggCollectionPreview(request, env, origin, db) {
  const url = new URL(request.url);
  const rawUser = url.searchParams.get('username') || '';
  const username = rawUser.trim();
  if (!username || username.length > 80) {
    return errorResponse('Invalid or missing username', 400, origin, env);
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    return errorResponse('Invalid BGG username', 400, origin, env);
  }
  const incExp = url.searchParams.get('include_expansions');
  const includeExpansions = incExp === '1' || incExp === 'true';

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return errorResponse('Authentication required', 401, origin, env);
  try {
    await verifyGoogleJWT(token, env.GOOGLE_CLIENT_ID);
  } catch (err) {
    return errorResponse('Authentication failed: ' + err.message, 401, origin, env);
  }

  let xml;
  try {
    xml = await fetchBggCollectionXml(username, includeExpansions);
  } catch (e) {
    console.error('bgg collection-preview fetch', e && e.message, e && e.bggBodySnippet);
    const st = e && e.bggStatus;
    if (st === 401) {
      return errorResponse(
        'BGG 回傳 401：收藏可能為非公開，請在 BoardGameGeek 將「Collection」設為公開後再試。',
        401,
        origin,
        env
      );
    }
    if (st === 404) {
      return errorResponse('找不到此 BGG 使用者或尚無可讀取的收藏。', 404, origin, env);
    }
    const clientStatus = st >= 400 && st < 600 ? st : 502;
    return errorResponse(e.message || 'BGG collection request failed', clientStatus, origin, env);
  }

  if (/<error\s+message=/i.test(xml)) {
    const em = /message="([^"]+)"/.exec(xml);
    return errorResponse(em ? em[1] : 'BGG 回傳錯誤', 400, origin, env);
  }

  const msg = parseBggCollectionMessage(xml);
  if (msg && (/invalid/i.test(msg) || /not found/i.test(msg))) {
    return errorResponse(`BGG：${msg}`, 400, origin, env);
  }

  const { owned, wishlist } = parseBggCollectionItems(xml);
  const allIds = [...owned, ...wishlist].map((x) => x.bgg_id);
  const lookup = await lookupGamesByBggIds(db, allIds);

  function enrich(list) {
    const pending = [];
    const rows = [];
    for (const item of list) {
      const row = lookup.get(String(item.bgg_id));
      if (row) {
        const dbName = row.name_zh || row.name_en || row.name_ja || '';
        rows.push({
          bgg_id: item.bgg_id,
          bgg_name: item.name,
          in_database: true,
          name_zh: row.name_zh || null,
          name_en: row.name_en || null,
          display_name: dbName,
        });
      } else {
        pending.push({ bgg_id: item.bgg_id, name: item.name });
        rows.push({
          bgg_id: item.bgg_id,
          bgg_name: item.name,
          in_database: false,
          display_name: item.name,
        });
      }
    }
    return { rows, pending };
  }

  const o = enrich(owned);
  const w = enrich(wishlist);

  return jsonResponse(
    {
      ok: true,
      username,
      include_expansions: includeExpansions,
      owned: o.rows,
      wishlist: w.rows,
      owned_pending: o.pending,
      wishlist_pending: w.pending,
    },
    200,
    origin,
    env
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    const origin = request.headers.get('Origin') || '';

    // OPTIONS preflight
    if (method === 'OPTIONS') {
      const headers = corsHeaders(origin, env);
      Object.keys(headers).forEach(k => headers[k] === undefined && delete headers[k]);
      return new Response(null, { status: 204, headers });
    }

    // ── 公開：GET /api/bgg-axis-deltas（不需 X-Api-Key；供前端覆寫 window.BGG_AXIS_V1）──
    if (url.pathname === '/api/bgg-axis-deltas' && method === 'GET') {
      try {
        return await handleGetBggAxisDeltas(env.DB, origin, env);
      } catch (e) {
        console.error('bgg-axis-deltas GET', e);
        return errorResponse('Failed to load BGG axis deltas', 500, origin, env);
      }
    }

    // ── 1. API Secret 驗證（所有請求） ──
    const apiSecret = env.API_SECRET;
    if (apiSecret) {
      const provided = request.headers.get('X-Api-Key');
      if (provided !== apiSecret) {
        return errorResponse('Forbidden', 403, origin, env);
      }
    }

    // ── GET /api/bgg/collection-preview（需 X-Api-Key + JWT）：BGG 收藏預覽 + 對照 game_database ──
    if (url.pathname === '/api/bgg/collection-preview' && method === 'GET') {
      if (!env.DB) return errorResponse('Database not configured', 503, origin, env);
      try {
        return await handleGetBggCollectionPreview(request, env, origin, env.DB);
      } catch (e) {
        console.error('collection-preview', e);
        return errorResponse(
          e && e.message ? e.message : 'collection-preview failed',
          500,
          origin,
          env
        );
      }
    }

    // ── 內部：遊戲 8 軸批次重算（POST /internal/recalc-game-axes，需帶 X-Api-Key 或 X-Internal-Secret）──
    if (url.pathname === '/internal/recalc-game-axes') {
      if (method !== 'POST') return errorResponse('Method not allowed', 405, origin, env);
      try {
        const result = await recalcGameAxes(env.DB);
        return jsonResponse({ ok: true, updated: result.updated, errors: result.errors }, 200, origin, env);
      } catch (e) {
        console.error('recalc-game-axes', e);
        return errorResponse('Recalc failed: ' + (e && e.message ? e.message : 'unknown'), 500, origin, env);
      }
    }

    // ── 大頭貼上傳（POST /api/upload-avatar）：需 JWT，body { image: "data:image/jpeg;base64,..." }，寫入 R2，回傳公開 URL ──
    if (url.pathname === '/api/upload-avatar' && method === 'POST') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      if (!token) return errorResponse('Authentication required', 401, origin, env);
      let jwtPayload;
      try {
        jwtPayload = await verifyGoogleJWT(token, env.GOOGLE_CLIENT_ID);
      } catch (err) {
        return errorResponse('Authentication failed: ' + err.message, 401, origin, env);
      }
      const bucket = env.AVATAR_BUCKET;
      if (!bucket) return errorResponse('Avatar storage not configured', 503, origin, env);
      try {
        const body = await request.json();
        const dataUrl = body && body.image;
        if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
          return errorResponse('Body must be { image: "data:image/..." }', 400, origin, env);
        }
        const base64Match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
        if (!base64Match) return errorResponse('Invalid data URL', 400, origin, env);
        const binary = Uint8Array.from(atob(base64Match[1]), c => c.charCodeAt(0));
        const MAX_AVATAR_BYTES = 3 * 1024 * 1024; // 3MB
        if (binary.length > MAX_AVATAR_BYTES) {
          return errorResponse('頭貼不得超過 3MB', 413, origin, env);
        }
        const key = `avatars/${jwtPayload.sub}.jpg`;
        await bucket.put(key, binary, {
          httpMetadata: { contentType: 'image/jpeg' },
          customMetadata: { uploaded: String(Date.now()) },
        });
        const base = (env.AVATAR_PUBLIC_BASE || '').replace(/\/$/, '') || url.origin;
        const avatarUrl = `${base}/avatars/${jwtPayload.sub}`;
        return jsonResponse({ url: avatarUrl }, 200, origin, env);
      } catch (e) {
        if (e && (e.status === 400 || e.status === 401)) throw e;
        console.error('upload-avatar', e);
        return errorResponse('Upload failed: ' + (e && e.message ? e.message : 'unknown'), 500, origin, env);
      }
    }

    // ── 大頭貼讀取（GET /avatars/:userId）：公開，從 R2 回傳圖片，其他玩家可載入 ──
    // ── Admin：遊戲名稱聚合（別名整合後台） GET /admin/aggregate-game-names
    // 需 X-Api-Key（若已設定）+ JWT +（admin_whitelist 或 SUPER_ADMIN_GOOGLE_IDS）
    if (url.pathname === '/admin/aggregate-game-names' && method === 'GET') {
      const db = env.DB;
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      if (!token) return errorResponse('Authentication required', 401, origin, env);
      let jwtPayload;
      try {
        jwtPayload = await verifyGoogleJWT(token, env.GOOGLE_CLIENT_ID);
      } catch (err) {
        return errorResponse('Authentication failed: ' + err.message, 401, origin, env);
      }
      const isAdmin = await checkAdminOrSuper(db, jwtPayload.sub);
      if (!isAdmin) return errorResponse('Admin access required', 403, origin, env);
      try {
        const [agg, games] = await Promise.all([
          aggregateGameNamesForAdmin(db),
          fetchGameDatabaseRowsForAliases(db)
        ]);
        const headers = corsHeaders(origin, env);
        headers['Cache-Control'] = 'no-store';
        Object.keys(headers).forEach(k => headers[k] === undefined && delete headers[k]);
        return new Response(
          JSON.stringify({
            participatingUsers: agg.participatingUsers,
            nameCounts: agg.nameCounts,
            games
          }),
          { status: 200, headers }
        );
      } catch (e) {
        console.error('aggregate-game-names', e);
        return errorResponse(
          'Aggregation failed: ' + (e && e.message ? e.message : 'unknown'),
          500,
          origin,
          env
        );
      }
    }

    // ── Admin：BGG 六軸 delta 寫入 D1 PUT /api/admin/bgg-axis-deltas
    if (url.pathname === '/api/admin/bgg-axis-deltas' && method === 'PUT') {
      const db = env.DB;
      if (!db) return errorResponse('Database not configured', 503, origin, env);
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      if (!token) return errorResponse('Authentication required', 401, origin, env);
      let jwtPayload;
      try {
        jwtPayload = await verifyGoogleJWT(token, env.GOOGLE_CLIENT_ID);
      } catch (err) {
        return errorResponse('Authentication failed: ' + err.message, 401, origin, env);
      }
      const isAdmin = await checkAdminOrSuper(db, jwtPayload.sub);
      if (!isAdmin) return errorResponse('Admin access required', 403, origin, env);
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return errorResponse('Invalid JSON', 400, origin, env);
      }
      const cat = body && body.category_deltas;
      const mech = body && body.mechanic_deltas;
      const vErr = validateBggAxisDeltaMaps(cat, mech);
      if (vErr) return errorResponse(vErr, 400, origin, env);
      try {
        await ensureBggAxisDeltasTable(db);
        const now = Date.now();
        await db.prepare(`
          INSERT INTO bgg_axis_deltas (id, category_deltas, mechanic_deltas, updated_at)
          VALUES ('v1', ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            category_deltas = excluded.category_deltas,
            mechanic_deltas = excluded.mechanic_deltas,
            updated_at = excluded.updated_at
        `).bind(JSON.stringify(cat), JSON.stringify(mech), now).run();
        return jsonResponse({ ok: true, updated_at: now }, 200, origin, env);
      } catch (e) {
        console.error('bgg-axis-deltas PUT', e);
        return errorResponse('Save failed: ' + (e && e.message ? e.message : 'unknown'), 500, origin, env);
      }
    }

    const avatarPathMatch = url.pathname.match(/^\/avatars\/([^\/]+)$/);
    if (avatarPathMatch && method === 'GET') {
      const userId = avatarPathMatch[1];
      const bucket = env.AVATAR_BUCKET;
      if (!bucket) return errorResponse('Avatar storage not configured', 503, origin, env);
      try {
        const key = `avatars/${userId}.jpg`;
        const object = await bucket.get(key);
        if (!object) {
          const headers = corsHeaders(origin, env);
          Object.keys(headers).forEach(k => headers[k] === undefined && delete headers[k]);
          return new Response(null, { status: 404, headers });
        }
        const headers = { ...corsHeaders(origin, env), 'Content-Type': object.httpMetadata?.contentType || 'image/jpeg', 'Cache-Control': 'public, max-age=86400' };
        Object.keys(headers).forEach(k => headers[k] === undefined && delete headers[k]);
        return new Response(object.body, { status: 200, headers });
      } catch (e) {
        console.error('get-avatar', e);
        return errorResponse('Avatar not found', 404, origin, env);
      }
    }

    // 解析路徑：/tables/{table} 或 /tables/{table}/{id}
    const pathMatch = url.pathname.match(/^\/tables\/([^\/]+)\/?([^\/]*)$/);
    if (!pathMatch) {
      return errorResponse('Invalid path. Use /tables/{table} or /tables/{table}/{id}', 404, origin, env);
    }

    const tableName = pathMatch[1];
    const recordId = pathMatch[2] || null;

    // 驗證資料表名稱
    if (!ALLOWED_TABLES.includes(tableName)) {
      return errorResponse(`Table "${tableName}" not found`, 404, origin, env);
    }

    const db = env.DB;

    if (tableName === 'user_preference_profiles') {
      await ensureUserPreferenceProfilesTable(db);
    }

    // ── 2. 權限檢查 ──
    const requiredAuth = getRequiredAuth(method, tableName);
    let jwtPayload = null;

    if (requiredAuth !== 'public') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');

      if (!token) {
        return errorResponse('Authentication required', 401, origin, env);
      }

      try {
        jwtPayload = await verifyGoogleJWT(token, env.GOOGLE_CLIENT_ID);
      } catch (err) {
        return errorResponse(`Authentication failed: ${err.message}`, 401, origin, env);
      }

      // admin 檢查
      if (requiredAuth === 'admin') {
        const isAdmin = await checkAdmin(db, jwtPayload.sub);
        if (!isAdmin) {
          return errorResponse('Admin access required', 403, origin, env);
        }
      }
    }

    try {
      // ── GET 列表 ──
      if (method === 'GET' && !recordId) {
        // game_database?random=10：全庫隨機 N 筆（一次請求，供純隨機推薦用）
        const randomN = parseInt(url.searchParams.get('random') || '0', 10);
        if (tableName === 'game_database' && randomN > 0 && randomN <= 50) {
          const columns = await getTableColumns(db, tableName);
          const hasDeletedAt = columns.includes('deleted_at');
          const whereBase = hasDeletedAt ? ` WHERE (deleted_at IS NULL OR deleted_at = '')` : '';
          const dataQuery = `SELECT * FROM ${tableName}${whereBase} ORDER BY RANDOM() LIMIT ?`;
          const dataResult = await db.prepare(dataQuery).bind(randomN).all();
          const rows = dataResult.results || [];
          const parsedRows = rows.map(row => parseJsonFields(row));
          const countResult = await db.prepare(`SELECT COUNT(*) as total FROM ${tableName}${whereBase}`).first();
          const total = countResult?.total || 0;
          const headers = corsHeaders(origin, env);
          headers['Cache-Control'] = 'no-store';
          return new Response(JSON.stringify({ data: parsedRows, total, table: tableName }), { status: 200, headers });
        }

        const page = parseInt(url.searchParams.get('page') || '1');
        const maxLimit = TABLE_MAX_LIMIT[tableName] || TABLE_MAX_LIMIT.default;
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), maxLimit);
        const search = url.searchParams.get('search') || '';
        const sort = url.searchParams.get('sort') || 'created_at';
        const offset = (page - 1) * limit;

        // 取得欄位列表
        const columns = await getTableColumns(db, tableName);

        // 計算總數（若表有 deleted_at 欄位則自動過濾已刪除資料）
        const hasDeletedAt = columns.includes('deleted_at');
        const whereBase = hasDeletedAt
          ? `WHERE (deleted_at IS NULL OR deleted_at = '')`
          : `WHERE 1=1`;
        let countQuery = `SELECT COUNT(*) as total FROM ${tableName} ${whereBase}`;
        let dataQuery = `SELECT * FROM ${tableName} ${whereBase}`;
        const params = [];

        // 搜尋（對 text 類型欄位做 LIKE）
        if (search) {
          const textCols = columns.filter(c =>
            !['id','created_at','updated_at'].includes(c)
          ).slice(0, 5);

          if (textCols.length > 0) {
            const searchConditions = textCols.map(c => `${c} LIKE ?`).join(' OR ');
            const searchVal = `%${search}%`;
            countQuery += ` AND (${searchConditions})`;
            dataQuery += ` AND (${searchConditions})`;
            textCols.forEach(() => params.push(searchVal));
          }
        }

        // 排序
        const validSort = columns.includes(sort) ? sort : (columns.includes('created_at') ? 'created_at' : 'id');
        dataQuery += ` ORDER BY ${validSort} DESC LIMIT ? OFFSET ?`;

        // 執行查詢
        const countResult = await db.prepare(countQuery).bind(...params).first();
        const total = countResult?.total || 0;

        const dataResult = await db.prepare(dataQuery).bind(...params, limit, offset).all();
        const rows = dataResult.results || [];

        // 解析 JSON 欄位
        const parsedRows = rows.map(row => parseJsonFields(row));

        // 取得 schema
        const schemaFields = columns
          .filter(c => !['created_at','updated_at','deleted_at'].includes(c))
          .map(c => ({ name: c, type: 'text' }));

        return jsonResponse({
          data: parsedRows,
          total,
          page,
          limit,
          table: tableName,
          schema: { fields: schemaFields }
        }, 200, origin, env);
      }

      // ── GET 單筆 ──
      if (method === 'GET' && recordId) {
        const pk = getPkColumn(tableName);
        const row = await db.prepare(
          `SELECT * FROM ${tableName} WHERE ${pk} = ?`
        ).bind(recordId).first();

        if (!row) return errorResponse('Record not found', 404, origin, env);
        return jsonResponse(parseJsonFields(row), 200, origin, env);
      }

      // ── POST 新增 ──
      if (method === 'POST') {
        const body = await request.json();
        const pk = getPkColumn(tableName);
        const now = Date.now();
        const columns = await getTableColumns(db, tableName);
        const insertData = { ...body, updated_at: now };
        if (!columns.includes(pk) || insertData[pk] === undefined) {
          if (pk === 'id') insertData.id = body.id || generateUUID();
        }
        if (pk !== 'id' && columns.includes('updated_at')) insertData.updated_at = now;

        const validKeys = Object.keys(insertData).filter(k => columns.includes(k));
        const values = validKeys.map(k => serializeValue(insertData[k]));

        const placeholders = validKeys.map(() => '?').join(', ');
        const colNames = validKeys.join(', ');
        await db.prepare(
          `INSERT INTO ${tableName} (${colNames}) VALUES (${placeholders})`
        ).bind(...values).run();

        const pkValue = insertData[pk] || body[pk];
        const created = await db.prepare(
          `SELECT * FROM ${tableName} WHERE ${pk} = ?`
        ).bind(pkValue).first();

        return jsonResponse(parseJsonFields(created), 201, origin, env);
      }

      // ── PUT 完整更新 ──
      if (method === 'PUT' && recordId) {
        const body = await request.json();
        const now = Date.now();
        const pk = getPkColumn(tableName);
        const columns = await getTableColumns(db, tableName);
        const updateData = { ...body, updated_at: now };

        const validKeys = Object.keys(updateData).filter(k =>
          columns.includes(k) && k !== pk
        );
        const setClauses = validKeys.map(k => `${k} = ?`).join(', ');
        const values = validKeys.map(k => serializeValue(updateData[k]));

        await db.prepare(
          `UPDATE ${tableName} SET ${setClauses} WHERE ${pk} = ?`
        ).bind(...values, recordId).run();

        const updated = await db.prepare(
          `SELECT * FROM ${tableName} WHERE ${pk} = ?`
        ).bind(recordId).first();

        if (!updated) return errorResponse('Record not found', 404, origin, env);
        return jsonResponse(parseJsonFields(updated), 200, origin, env);
      }

      // ── PATCH 部分更新 ──
      if (method === 'PATCH' && recordId) {
        const body = await request.json();
        const now = Date.now();
        const pk = getPkColumn(tableName);
        const columns = await getTableColumns(db, tableName);
        const updateData = { ...body, updated_at: now };

        const validKeys = Object.keys(updateData).filter(k =>
          columns.includes(k) && k !== pk
        );

        if (validKeys.length === 0) {
          return errorResponse('No valid fields to update', 400, origin, env);
        }

        const setClauses = validKeys.map(k => `${k} = ?`).join(', ');
        const values = validKeys.map(k => serializeValue(updateData[k]));

        await db.prepare(
          `UPDATE ${tableName} SET ${setClauses} WHERE ${pk} = ?`
        ).bind(...values, recordId).run();

        const updated = await db.prepare(
          `SELECT * FROM ${tableName} WHERE ${pk} = ?`
        ).bind(recordId).first();

        if (!updated) return errorResponse('Record not found', 404, origin, env);
        return jsonResponse(parseJsonFields(updated), 200, origin, env);
      }

      // ── DELETE 刪除 ──
      if (method === 'DELETE' && recordId) {
        const pk = getPkColumn(tableName);
        const existing = await db.prepare(
          `SELECT ${pk} FROM ${tableName} WHERE ${pk} = ?`
        ).bind(recordId).first();

        if (!existing) return errorResponse('Record not found', 404, origin, env);

        await db.prepare(
          `DELETE FROM ${tableName} WHERE ${pk} = ?`
        ).bind(recordId).run();

        const headers = corsHeaders(origin, env);
        Object.keys(headers).forEach(k => headers[k] === undefined && delete headers[k]);
        return new Response(null, { status: 204, headers });
      }

      return errorResponse('Method not allowed', 405, origin, env);

    } catch (err) {
      console.error('Worker error:', err);
      return errorResponse(`Internal server error: ${err.message}`, 500, origin, env);
    }
  },

  async scheduled(event, env, ctx) {
    try {
      const result = await recalcGameAxes(env.DB);
      console.log('recalcGameAxes completed', result.updated, 'games');
    } catch (e) {
      console.error('recalcGameAxes failed', e);
    }
  }
};

// JSON 陣列欄位解析（D1 存 TEXT，讀出來要還原成 array/object）
function parseJsonFields(row) {
  if (!row) return row;
  const result = { ...row };
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'string') {
      if ((value.startsWith('[') && value.endsWith(']')) ||
          (value.startsWith('{') && value.endsWith('}'))) {
        try {
          result[key] = JSON.parse(value);
        } catch (e) {
          // 不是 JSON，保留原值
        }
      }
    }
  }
  return result;
}

// 序列化值：array/object 轉 JSON string
function serializeValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

// ══ 遊戲 8 軸排程批次（只重算「至少被一位有偏好輪廓的玩家 like/super_like」的遊戲）════
const AXIS_KEYS = ['conflict', 'strategy', 'social_fun', 'immersion', 'accessibility', 'manipulation', 'coop', 'luck'];
const AXIS_DB_KEYS = AXIS_KEYS.map(k => 'axis_' + k);

function parseJsonArray(str) {
  if (str == null || str === '') return [];
  if (typeof str === 'string') {
    try {
      const v = JSON.parse(str);
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }
  return Array.isArray(str) ? str : [];
}

/** 別名後台：掃 users 四個清單欄位，聚合字串 → 次數（D1 端分批，避免單次回傳過大） */
async function aggregateGameNamesForAdmin(db) {
  const counts = new Map();
  let participatingUsers = 0;
  let offset = 0;
  const BATCH = 500;
  for (;;) {
    const r = await db.prepare(
      'SELECT liked_games, neutral_games, disliked_games, wishlist FROM users LIMIT ? OFFSET ?'
    ).bind(BATCH, offset).all();
    const rows = r.results || [];
    if (rows.length === 0) break;
    for (const row of rows) {
      const merged = [
        ...parseJsonArray(row.liked_games),
        ...parseJsonArray(row.neutral_games),
        ...parseJsonArray(row.disliked_games),
        ...parseJsonArray(row.wishlist)
      ];
      if (merged.length) participatingUsers++;
      for (const g of merged) {
        const name = typeof g === 'string' ? g.trim() : '';
        if (!name) continue;
        counts.set(name, (counts.get(name) || 0) + 1);
      }
    }
    if (rows.length < BATCH) break;
    offset += BATCH;
  }
  const nameCounts = Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  return { participatingUsers, nameCounts };
}

/** 別名後台：僅需比對／自動完成用的遊戲名稱 */
async function fetchGameDatabaseRowsForAliases(db) {
  const columns = await getTableColumns(db, 'game_database');
  const hasDeletedAt = columns.includes('deleted_at');
  const whereBase = hasDeletedAt ? ' WHERE (deleted_at IS NULL OR deleted_at = \'\')' : '';
  const r = await db.prepare(`SELECT name_zh, name_en FROM game_database${whereBase}`).all();
  return (r.results || []).map(row => ({
    name_zh: row.name_zh != null ? String(row.name_zh) : '',
    name_en: row.name_en != null ? String(row.name_en) : ''
  }));
}

async function recalcGameAxes(db) {
  let updated = 0;
  let errors = 0;
  try {
    await ensureUserPreferenceProfilesTable(db);
    const profilesRows = await db.prepare('SELECT user_id, conflict, strategy, social_fun, immersion, accessibility, manipulation, coop, luck FROM user_preference_profiles').all();
    const profiles = (profilesRows.results || []).map(r => ({
      user_id: r.user_id,
      conflict: Number(r.conflict) || 0,
      strategy: Number(r.strategy) || 0,
      social_fun: Number(r.social_fun) || 0,
      immersion: Number(r.immersion) || 0,
      accessibility: Number(r.accessibility) || 0,
      manipulation: Number(r.manipulation) || 0,
      coop: Number(r.coop) || 0,
      luck: Number(r.luck) || 0
    }));
    const profileUserIds = new Set(profiles.map(p => p.user_id));
    const profileByUserId = {};
    profiles.forEach(p => { profileByUserId[p.user_id] = p; });

    const usersRows = await db.prepare('SELECT id, liked_games, super_liked_games FROM users').all();
    const gameToUserIds = {};
    (usersRows.results || []).forEach(row => {
      if (!profileUserIds.has(row.id)) return;
      const liked = parseJsonArray(row.liked_games);
      const superLiked = parseJsonArray(row.super_liked_games);
      [...liked, ...superLiked].forEach(gameName => {
        const name = (gameName && typeof gameName === 'string' ? gameName.trim() : '') || '';
        if (!name) return;
        if (!gameToUserIds[name]) gameToUserIds[name] = [];
        gameToUserIds[name].push(row.id);
      });
    });

    const gamesRows = await db.prepare('SELECT id, name_zh, name_en, complexity FROM game_database').all();
    const games = gamesRows.results || [];

    for (const g of games) {
      const nameZh = (g.name_zh && g.name_zh.trim()) || '';
      const nameEn = (g.name_en && g.name_en.trim()) || '';
      const name = nameZh || nameEn;
      if (!name) continue;
      const userIds = gameToUserIds[nameZh] || gameToUserIds[nameEn] || gameToUserIds[name] || [];
      if (userIds.length === 0) continue;

      const L_G = userIds.map(uid => profileByUserId[uid]).filter(Boolean);
      if (L_G.length === 0) continue;

      const axisValues = {};
      const sevenKeys = AXIS_KEYS.filter(k => k !== 'accessibility');
      for (const k of sevenKeys) {
        let sumSq = 0, sumP = 0;
        for (const p of L_G) {
          const v = p[k];
          const num = Math.max(0, Math.min(12, Number(v) || 0));
          sumSq += num * num;
          sumP += num;
        }
        axisValues['axis_' + k] = sumP > 0 ? sumSq / sumP : null;
      }

      let accPlayers = 0;
      let sumSqAcc = 0, sumAcc = 0;
      for (const p of L_G) {
        const v = Math.max(0, Math.min(12, Number(p.accessibility) || 0));
        sumSqAcc += v * v;
        sumAcc += v;
      }
      if (sumAcc > 0) accPlayers = sumSqAcc / sumAcc;
      const complexity = g.complexity != null ? Number(g.complexity) : null;
      let E_G = null;
      if (complexity != null && !isNaN(complexity)) {
        const c = Math.max(0, Math.min(5, complexity));
        E_G = (1 - c / 5) * 12;
      }
      axisValues.axis_accessibility = E_G != null
        ? 0.3 * accPlayers + 0.7 * E_G
        : accPlayers;

      const setClauses = AXIS_DB_KEYS.map(k => `${k} = ?`).join(', ');
      const values = AXIS_DB_KEYS.map(k => axisValues[k] != null ? axisValues[k] : null);
      try {
        await db.prepare(`UPDATE game_database SET ${setClauses}, updated_at = ? WHERE id = ?`)
          .bind(...values, Date.now(), g.id).run();
        updated++;
      } catch (e) {
        errors++;
      }
    }
  } catch (e) {
    console.error('recalcGameAxes error:', e);
    throw e;
  }
  return { updated, errors };
}
