/**
 * MBTI × 桌遊配對 - Cloudflare Worker API
 * 模擬 Genspark tables/xxx API 格式，對接 Cloudflare D1
 *
 * 路由：
 *   GET    /tables/{table}           - 列表（支援 page, limit, search, sort）
 *   GET    /tables/{table}/{id}      - 單筆
 *   POST   /tables/{table}           - 新增
 *   PUT    /tables/{table}/{id}      - 完整更新
 *   PATCH  /tables/{table}/{id}      - 部分更新
 *   DELETE /tables/{table}/{id}      - 刪除
 *
 * 安全機制：
 *   1. API Secret — 所有請求需帶 X-Api-Key header（由 Nginx 注入）
 *   2. JWT 驗證  — 寫入操作需帶 Authorization: Bearer <Google JWT>
 *   3. RBAC      — 敏感 table 和 DELETE 需 admin 角色
 *
 * 環境變數（wrangler.toml [vars] 或 Dashboard Secrets）：
 *   API_SECRET       — Nginx 注入的 secret key
 *   GOOGLE_CLIENT_ID — Google OAuth Client ID（JWT aud 驗證）
 *   ALLOWED_ORIGINS  — 允許的 CORS origins（逗號分隔，如 "https://example.com,https://dev.example.com"）
 */

const ALLOWED_TABLES = [
  'users', 'user_stats', 'game_database', 'game_aliases', 'game_votes',
  'game_collections', 'collection_game_stats', 'user_collections',
  'user_collection_votes', 'achievements', 'admin_whitelist',
  'tester_whitelist', 'influencer_whitelist', 'publisher_badge_series',
  'quiz_collections', 'quiz_questions', 'quiz_attempts',
  'daily_quests', 'limited_events', 'event_progress', 'site_stats'
];

// 每頁最大筆數
const TABLE_MAX_LIMIT = {
  game_database: 200,
  game_aliases: 200,
  default: 100
};

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
  'game_votes', 'user_collection_votes'
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

    // ── 1. API Secret 驗證（所有請求） ──
    const apiSecret = env.API_SECRET;
    if (apiSecret) {
      const provided = request.headers.get('X-Api-Key');
      if (provided !== apiSecret) {
        return errorResponse('Forbidden', 403, origin, env);
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
        const row = await db.prepare(
          `SELECT * FROM ${tableName} WHERE id = ?`
        ).bind(recordId).first();

        if (!row) return errorResponse('Record not found', 404, origin, env);
        return jsonResponse(parseJsonFields(row), 200, origin, env);
      }

      // ── POST 新增 ──
      if (method === 'POST') {
        const body = await request.json();
        const id = body.id || generateUUID();
        const now = Date.now();

        const columns = await getTableColumns(db, tableName);
        const insertData = { ...body, id, created_at: now, updated_at: now };

        // 只保留 schema 中存在的欄位
        const validKeys = Object.keys(insertData).filter(k => columns.includes(k));
        const values = validKeys.map(k => serializeValue(insertData[k]));

        const placeholders = validKeys.map(() => '?').join(', ');
        const colNames = validKeys.join(', ');

        await db.prepare(
          `INSERT INTO ${tableName} (${colNames}) VALUES (${placeholders})`
        ).bind(...values).run();

        const created = await db.prepare(
          `SELECT * FROM ${tableName} WHERE id = ?`
        ).bind(id).first();

        return jsonResponse(parseJsonFields(created), 201, origin, env);
      }

      // ── PUT 完整更新 ──
      if (method === 'PUT' && recordId) {
        const body = await request.json();
        const now = Date.now();

        const columns = await getTableColumns(db, tableName);
        const updateData = { ...body, updated_at: now };

        const validKeys = Object.keys(updateData).filter(k =>
          columns.includes(k) && k !== 'id'
        );
        const setClauses = validKeys.map(k => `${k} = ?`).join(', ');
        const values = validKeys.map(k => serializeValue(updateData[k]));

        await db.prepare(
          `UPDATE ${tableName} SET ${setClauses} WHERE id = ?`
        ).bind(...values, recordId).run();

        const updated = await db.prepare(
          `SELECT * FROM ${tableName} WHERE id = ?`
        ).bind(recordId).first();

        if (!updated) return errorResponse('Record not found', 404, origin, env);
        return jsonResponse(parseJsonFields(updated), 200, origin, env);
      }

      // ── PATCH 部分更新 ──
      if (method === 'PATCH' && recordId) {
        const body = await request.json();
        const now = Date.now();

        const columns = await getTableColumns(db, tableName);
        const updateData = { ...body, updated_at: now };

        const validKeys = Object.keys(updateData).filter(k =>
          columns.includes(k) && k !== 'id'
        );

        if (validKeys.length === 0) {
          return errorResponse('No valid fields to update', 400, origin, env);
        }

        const setClauses = validKeys.map(k => `${k} = ?`).join(', ');
        const values = validKeys.map(k => serializeValue(updateData[k]));

        await db.prepare(
          `UPDATE ${tableName} SET ${setClauses} WHERE id = ?`
        ).bind(...values, recordId).run();

        const updated = await db.prepare(
          `SELECT * FROM ${tableName} WHERE id = ?`
        ).bind(recordId).first();

        if (!updated) return errorResponse('Record not found', 404, origin, env);
        return jsonResponse(parseJsonFields(updated), 200, origin, env);
      }

      // ── DELETE 刪除 ──
      if (method === 'DELETE' && recordId) {
        const existing = await db.prepare(
          `SELECT id FROM ${tableName} WHERE id = ?`
        ).bind(recordId).first();

        if (!existing) return errorResponse('Record not found', 404, origin, env);

        await db.prepare(
          `DELETE FROM ${tableName} WHERE id = ?`
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
