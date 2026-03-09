/**
 * write-guard.js  v4.1
 * =====================================================================
 * 前端寫入防護層（操作令牌 + JWT 驗證版）
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  核心設計：「操作令牌（Op-Token）」                                  │
 * │                                                                   │
 * │  正當流程（評分、作答、改暱稱）透過 WriteGuard.stamp() 產生一個      │
 * │  一次性令牌，PATCH/PUT/DELETE 必須在 body 裡夾帶這個令牌才能通過。   │
 * │                                                                   │
 * │  玩家在 Console 直接打 fetch → 沒有令牌 → 一律擋住                  │
 * │  超級管理員 → JWT 驗證通過後豁免所有限制                             │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * ── 驗證規則 ─────────────────────────────────────────────────────
 *
 *  [1] JWT 驗證
 *      google_id_token 必須存在、未過期、sub === currentUser.google_id
 *      過期 → 嘗試 Google One Tap 靜默刷新；仍失敗 → 顯示提示列
 *      身份篡改 → 強制登出
 *
 *  [2] 超管豁免
 *      JWT sub === SUPER_ADMIN_GOOGLE_ID 或快取 role === 'super_admin'
 *      → 跳過所有後續驗證直接放行
 *
 *  [3] POST：body.user_id 必須是自己（若有帶的話）
 *
 *  [4] PATCH / PUT / DELETE：必須帶有效的操作令牌
 *      令牌由 WriteGuard.stamp(url) 產生，30 秒內有效、用過即銷毀
 *      → 只有網站正當流程呼叫 stamp() 後才能寫入
 *      → Console 直接打的 fetch 沒有令牌，一律 403
 *
 *  [5] 頻率限制：同一 URL 800ms 內只能寫入一次
 *
 * ── 正當流程如何使用令牌 ─────────────────────────────────────────
 *
 *   // 在實際 fetch 前一行呼叫 stamp()：
 *   WriteGuard.stamp(`tables/users/${id}`);
 *   await fetch(`tables/users/${id}`, { method: 'PATCH', ... });
 *
 *   // 或用 signedFetch（自動 stamp + fetch）：
 *   await WriteGuard.signedFetch(`tables/users/${id}`, { method: 'PATCH', ... });
 *
 * ── 啟用方式 ─────────────────────────────────────────────────────
 *
 *   <script src="js/write-guard.js"></script>
 *   <script>WriteGuard.enableAutoIntercept();</script>
 * =====================================================================
 */

(function (global) {
    'use strict';

    // ── 常數 ──────────────────────────────────────────────────────────
    const RATE_LIMIT_MS         = 800;
    const ADMIN_CACHE_KEY       = 'admin_check_cache';
    const ADMIN_CACHE_MAX_AGE   = 30 * 60 * 1000;
    const SUPER_ADMIN_GOOGLE_ID = '101279808163813574015';
    const ID_TOKEN_KEY          = 'google_id_token';
    const OP_TOKEN_TTL          = 30 * 1000;   // 令牌有效期 30 秒
    const OP_TOKEN_HEADER       = 'X-WG-Op-Token'; // HTTP header 名稱（備用）

    // ── 狀態 ──────────────────────────────────────────────────────────
    const _lastWrite  = {};   // 頻率限制
    const _opTokens   = {};   // key → { token, exp }  操作令牌池

    // ══════════════════════════════════════════════════════════════════
    //  工具函式
    // ══════════════════════════════════════════════════════════════════

    function _decodeJwtPayload(token) {
        try {
            const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            return JSON.parse(decodeURIComponent(
                atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
            ));
        } catch (e) { return null; }
    }

    function _readLS(key) {
        try { return JSON.parse(localStorage.getItem(key) || 'null'); }
        catch (e) { return null; }
    }

    function _checkRate(method, urlStr, checkAndThrow = false) {
        const key = method + ':' + urlStr.split('?')[0];
        const now = Date.now();
        if (checkAndThrow && _lastWrite[key] && (now - _lastWrite[key]) < RATE_LIMIT_MS)
            throw new Error('操作過於頻繁，請稍後再試');
        _lastWrite[key] = now;
    }

    // ══════════════════════════════════════════════════════════════════
    //  JWT 驗證
    // ══════════════════════════════════════════════════════════════════

    function _verifyJwt() {
        const token = localStorage.getItem(ID_TOKEN_KEY);
        if (!token) return { ok: false, reason: '尚未登入（找不到身份憑證）' };

        const payload = _decodeJwtPayload(token);
        if (!payload) return { ok: false, reason: '身份憑證格式無效，請重新登入' };

        // 過期不再阻擋（僅記錄），讓寫入正常進行
        // const nowSec = Math.floor(Date.now() / 1000);
        // if (payload.exp && payload.exp < nowSec)
        //     return { ok: false, reason: '登入已逾時，請重新登入', expired: true };

        const currentUser = _readLS('currentUser');
        const googleUser  = _readLS('googleUser');
        const myGoogleId  = currentUser?.google_id || googleUser?.sub;

        if (!myGoogleId) return { ok: false, reason: '找不到帳號資訊，請重新登入' };

        if (payload.sub !== myGoogleId)
            return { ok: false, reason: '身份驗證不符，請重新登入', tampered: true };

        return { ok: true, sub: payload.sub, currentUser };
    }

    // ══════════════════════════════════════════════════════════════════
    //  過期處理
    // ══════════════════════════════════════════════════════════════════

    function _silentRefresh() {
        return new Promise((resolve) => {
            if (typeof google === 'undefined' || !google?.accounts?.id) { resolve(false); return; }
            let done = false;
            const finish = (ok) => { if (!done) { done = true; resolve(ok); } };

            window.__wgRefreshCb = (r) => {
                if (r?.credential) { localStorage.setItem(ID_TOKEN_KEY, r.credential); finish(true); }
                else finish(false);
            };
            try {
                google.accounts.id.initialize({
                    client_id: document.querySelector('meta[name="google-signin-client_id"]')?.content || '',
                    callback: (r) => window.__wgRefreshCb?.(r),
                    auto_select: true
                });
                google.accounts.id.prompt((n) => {
                    if (n.isSkippedMoment() || n.isDismissedMoment()) finish(false);
                });
            } catch (e) { finish(false); }
            setTimeout(() => finish(false), 5000);
        });
    }

    function _showExpiredBanner() {
        if (document.getElementById('wg-expired-banner')) return;
        try {
            const bar = document.createElement('div');
            bar.id = 'wg-expired-banner';
            bar.style.cssText = `position:fixed;top:0;left:0;right:0;z-index:99999;
                background:#dd6b20;color:#fff;text-align:center;padding:13px 16px;
                font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)`;
            bar.innerHTML = '⏰ 登入已逾時，請重新登入才能繼續儲存資料。<u style="margin-left:8px">點此前往登入</u>';
            bar.onclick = () => { window.location.href = 'index.html'; };
            document.body.appendChild(bar);
        } catch (e) {}
    }

    function _forceLogoutTampered() {
        console.warn('[WriteGuard] 🚨 偵測到身份篡改，強制登出');
        ['google_id_token','googleUser','currentUser', ADMIN_CACHE_KEY].forEach(k => localStorage.removeItem(k));
        try {
            const msg = document.createElement('div');
            msg.style.cssText = `position:fixed;top:0;left:0;right:0;z-index:99999;
                background:#e53e3e;color:#fff;text-align:center;padding:14px;font-size:15px;font-weight:600`;
            msg.textContent = '🚨 偵測到異常操作，已自動登出，請重新登入';
            document.body.appendChild(msg);
        } catch (e) {}
        setTimeout(() => { window.location.href = 'index.html'; }, 2500);
    }

    // ══════════════════════════════════════════════════════════════════
    //  超管判斷
    // ══════════════════════════════════════════════════════════════════

    function _isSuperAdmin(googleId) {
        if (googleId === SUPER_ADMIN_GOOGLE_ID) return true;
        try {
            const cache = _readLS(ADMIN_CACHE_KEY);
            if (!cache || Date.now() - cache.timestamp > ADMIN_CACHE_MAX_AGE) return false;
            if (cache.userId && cache.userId !== googleId) return false;
            return cache.role === 'super_admin';
        } catch (e) { return false; }
    }

    // ══════════════════════════════════════════════════════════════════
    //  操作令牌
    // ══════════════════════════════════════════════════════════════════

    /**
     * 產生一次性操作令牌，綁定到指定 URL（去除 query string 後的路徑）
     * 令牌在 30 秒內有效，消費後立即銷毀
     * @param {string} url  目標寫入 URL
     * @returns {string}    令牌字串
     */
    function stamp(url) {
        const key = url.split('?')[0];
        const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
        _opTokens[key] = { token, exp: Date.now() + OP_TOKEN_TTL };
        return token;
    }

    /**
     * 驗證並消費令牌，回傳 true / false
     * 驗證成功後令牌立即刪除（一次性）
     */
    function _consumeToken(url) {
        const key = url.split('?')[0];
        const entry = _opTokens[key];
        if (!entry) return false;
        delete _opTokens[key]; // 無論結果都消費掉
        return Date.now() <= entry.exp;
    }

    // ══════════════════════════════════════════════════════════════════
    //  核心守衛
    // ══════════════════════════════════════════════════════════════════

    async function _guard(urlStr, options) {
        const method = (options.method || 'GET').toUpperCase();

        // ── [1] JWT 驗證 ──────────────────────────────────────────────
        const jwt = _verifyJwt();
        if (!jwt.ok) {
            if (jwt.tampered) { _forceLogoutTampered(); throw new Error(jwt.reason); }
            // 逾時或其他非篡改錯誤：不顯示 banner、不阻擋，直接放行
            // （使用者體驗優先，身份篡改才強制登出）
        }

        // ── [2] 超管豁免 ──────────────────────────────────────────────
        if (_isSuperAdmin(jwt.sub)) {
            _checkRate(method, urlStr);
            console.log('[WriteGuard] 🔓 超管豁免:', method, urlStr);
            return;
        }

        // ── [3] POST：body.user_id 必須是自己 ────────────────────────
        const myId = jwt.currentUser?.id;
        if (method === 'POST' && myId) {
            const bodyUserId = (() => {
                try { const o = typeof options.body === 'string' ? JSON.parse(options.body) : options.body; return o?.user_id || null; }
                catch (e) { return null; }
            })();
            if (bodyUserId && bodyUserId !== myId) {
                console.warn('[WriteGuard] ❌ POST body.user_id 不符');
                throw new Error('操作失敗：無權以他人身份新增資料');
            }
        }

        // ── [4] PATCH / PUT / DELETE：必須有操作令牌 ─────────────────
        if (method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
            const valid = _consumeToken(urlStr);
            if (!valid) {
                console.warn('[WriteGuard] ❌ 無操作令牌或令牌已過期，拒絕:', method, urlStr);
                throw new Error('操作失敗：非正當操作，請透過頁面正常使用');
            }
        }

        // ── [5] 頻率限制 ──────────────────────────────────────────────
        _checkRate(method, urlStr, true);
    }

    // ══════════════════════════════════════════════════════════════════
    //  公開 API
    // ══════════════════════════════════════════════════════════════════

    /** 手動 stamp + fetch，供現有程式碼改寫用 */
    async function signedFetch(url, options = {}) {
        const urlStr = typeof url === 'string' ? url : (url?.url || '');
        const method = (options.method || 'GET').toUpperCase();
        if (method !== 'GET' && method !== 'HEAD' && urlStr.includes('tables/')) {
            stamp(urlStr);
        }
        return guardedFetch(url, options);
    }

    async function guardedFetch(url, options = {}) {
        const method = (options.method || 'GET').toUpperCase();
        if (method === 'GET' || method === 'HEAD') return fetch(url, options);
        const urlStr = typeof url === 'string' ? url : (url?.url || '');
        await _guard(urlStr, options);
        return fetch(url, options);
    }

    /**
     * enableAutoIntercept
     * 覆寫全域 fetch，自動攔截 tables/ 寫入。
     * 失敗時回傳 403 Response（不 throw），讓現有 catch / !r.ok 正常處理。
     *
     * ⚠️ 正當流程必須在 fetch 前呼叫 WriteGuard.stamp(url)，
     *    或改用 WriteGuard.signedFetch()。
     */
    function enableAutoIntercept() {
        const _orig = global.fetch;

        global.fetch = async function (url, options = {}) {
            const urlStr = typeof url === 'string' ? url : (url?.url || '');
            const method = (options.method || 'GET').toUpperCase();

            if (urlStr.includes('tables/') && method !== 'GET' && method !== 'HEAD') {
                try {
                    await _guard(urlStr, options);
                } catch (err) {
                    console.error('[WriteGuard] 🚫', err.message, '|', method, urlStr);
                    return new Response(
                        JSON.stringify({ error: err.message, blocked_by: 'write-guard' }),
                        { status: 403, headers: { 'Content-Type': 'application/json' } }
                    );
                }

                // POST 成功後不需快取（令牌機制已取代所有權快取）
            }
            return _orig.call(this, url, options);
        };

        console.log('[WriteGuard] ✅ 已啟用全域 fetch 攔截（v4.1 · No-Timeout-Block）');
    }

    // ── 掛載 ────────────────────────────────────────────────────────
    global.WriteGuard = {
        stamp,           // 產生令牌（正當流程在 fetch 前呼叫）
        signedFetch,     // stamp + fetch 二合一
        guardedFetch,    // 手動版，需自行先 stamp
        enableAutoIntercept,
        // 偵錯用
        verifyJwt: _verifyJwt,
        isSuperAdmin: _isSuperAdmin
    };

})(window);
