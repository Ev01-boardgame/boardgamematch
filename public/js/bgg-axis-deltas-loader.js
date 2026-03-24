/**
 * 從 Worker GET /api/bgg-axis-deltas 覆寫 window.BGG_AXIS_V1（失敗則保留先載入的 bgg-axis-deltas-v1.js）。
 * @param {{ apiBase?: string, apiKey?: string }} [opts]
 * @returns {Promise<object|undefined>}
 */
(function (global) {
    'use strict';

    global.loadBggAxisV1FromApi = async function loadBggAxisV1FromApi(opts) {
        opts = opts || {};
        const bases = [];
        const b = opts.apiBase && String(opts.apiBase).trim().replace(/\/+$/, '');
        if (b) bases.push(b);
        bases.push(''); // 同源相對路徑

        const apiKey = opts.apiKey && String(opts.apiKey).trim();
        let lastErr;

        for (const base of bases) {
            const url = base
                ? base + '/api/bgg-axis-deltas'
                : new URL('/api/bgg-axis-deltas', global.location.href).href;
            try {
                const headers = {};
                if (apiKey) headers['X-Api-Key'] = apiKey;
                const r = await fetch(url, { headers, cache: 'no-store' });
                if (!r.ok) {
                    lastErr = 'HTTP ' + r.status;
                    continue;
                }
                const d = await r.json();
                if (!d || d.error) {
                    lastErr = d && d.error ? d.error : 'invalid body';
                    continue;
                }
                const fallback = global.BGG_AXIS_V1 || {};
                global.BGG_AXIS_V1 = {
                    version: d.version != null ? d.version : 1,
                    AXIS_KEYS: d.AXIS_KEYS || fallback.AXIS_KEYS,
                    AXIS_LABELS_ZH: d.AXIS_LABELS_ZH || fallback.AXIS_LABELS_ZH,
                    CATEGORY_AXIS_DELTAS: d.CATEGORY_AXIS_DELTAS || {},
                    MECHANIC_AXIS_DELTAS: d.MECHANIC_AXIS_DELTAS || {}
                };
                global.__BGG_AXIS_V1_SOURCE = d.source || 'api';
                return global.BGG_AXIS_V1;
            } catch (e) {
                lastErr = e && e.message ? e.message : String(e);
            }
        }

        global.__BGG_AXIS_V1_SOURCE = global.__BGG_AXIS_V1_SOURCE || 'static';
        if (lastErr && typeof console !== 'undefined' && console.warn) {
            console.warn('[bgg-axis-deltas-loader] 使用靜態檔後備：', lastErr);
        }
        return global.BGG_AXIS_V1;
    };
})(typeof window !== 'undefined' ? window : globalThis);
