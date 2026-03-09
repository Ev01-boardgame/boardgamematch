/**
 * game-names.js
 * 全局桌遊名稱對照工具
 * 從 game_database 載入一次，提供多語言名稱格式化函數
 *
 * 名稱顯示優先級規則：
 *   有中文 → 中文上（大）、英文下（小）  [中英 / 中日英]
 *   無中文、有日文 → 日文上（大）、英文下（小）  [日英]
 *   只有英文 → 英文單行
 *   只有中文 → 中文單行
 *   只有日文 → 日文單行
 */

window.GameNames = (() => {
    // nameMap: key(normalized name) → entry object
    // 快取時改存壓縮格式：{ keys: [...], games: [...], map: {key: idx} }
    // 讀出後還原成 nameMap，每款遊戲資料只存一份，節省 60~70% localStorage 空間
    let nameMap = {};
    let loaded = false;
    let loadPromise = null;

    // ── LocalStorage 快取設定 ──
    const CACHE_KEY     = 'gn_nameMap_v7';
    const CACHE_TS_KEY  = 'gn_nameMap_ts_v7';
    const CACHE_TTL_MS  = 2 * 60 * 60 * 1000; // 2 小時

    // ── image_url 壓縮/還原 ──
    // BGG 主格式：https://cf.geekdo-images.com/pic12345678.jpg → 存 "p:12345678"
    // 其他格式：直接存完整 URL
    const BGG_IMG_RE = /^https?:\/\/cf\.geekdo-images\.com\/pic(\d+)\.(?:jpg|png|jpeg)/i;
    function compressImageUrl(url) {
        if (!url) return '';
        const m = url.match(BGG_IMG_RE);
        if (m) return 'p:' + m[1]; // e.g. "p:12345678"
        return url; // 非標準格式，完整存
    }
    function decompressImageUrl(s) {
        if (!s) return '';
        if (s.startsWith('p:')) return `https://cf.geekdo-images.com/pic${s.slice(2)}.jpg`;
        return s;
    }

    function saveCache(map) {
        try {
            // 壓縮：
            // 1. 每款遊戲資料只存一份（去重，節省 2-3x 重複）
            // 2. image_url 壓縮：BGG pic URL 只存數字 ID（節省 ~87% URL 長度）
            const games = [];
            const entryToIdx = new Map();
            const compactMap = {};
            for (const [key, entry] of Object.entries(map)) {
                if (!entryToIdx.has(entry)) {
                    entryToIdx.set(entry, games.length);
                    games.push([
                        entry.name_zh || '',
                        entry.name_en || '',
                        entry.name_ja || '',
                        compressImageUrl(entry.image_url),
                        entry.bgg_id  || ''
                    ]);
                }
                compactMap[key] = entryToIdx.get(entry);
            }
            const payload = JSON.stringify({ g: games, m: compactMap });
            localStorage.setItem(CACHE_KEY, payload);
            localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
            console.log(`[GameNames] 快取寫入成功，${games.length} 款遊戲，${(payload.length/1024).toFixed(0)} KB`);
        } catch(e) {
            console.warn('[GameNames] 快取寫入失敗（容量限制），繼續使用記憶體版本', e.message);
        }
    }

    function loadCache() {
        try {
            const ts = Number(localStorage.getItem(CACHE_TS_KEY) || 0);
            if (Date.now() - ts > CACHE_TTL_MS) return null; // 過期
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const { g: games, m: compactMap } = JSON.parse(raw);
            if (!games || !compactMap) return null;
            // 還原：每款 entry 物件只建一次，image_url 解壓縮還原
            const entryObjs = games.map(arr => ({
                name_zh:   arr[0] || '',
                name_en:   arr[1] || '',
                name_ja:   arr[2] || '',
                image_url: decompressImageUrl(arr[3] || ''),
                bgg_id:    arr[4] || ''
            }));
            const restored = {};
            for (const [key, idx] of Object.entries(compactMap)) {
                restored[key] = entryObjs[idx];
            }
            return restored;
        } catch(e) {
            return null;
        }
    }

    // ── 載入 game_database（只載入一次，優先用快取）──
    async function load() {
        if (loaded) return Promise.resolve();
        if (loadPromise) return loadPromise;

        loadPromise = (async () => {
            try {
                // ① 先試讀快取
                const cached = loadCache();
                if (cached && Object.keys(cached).length > 0) {
                    nameMap = cached;
                    loaded = true;
                    console.log(`[GameNames] ✅ 快取命中，載入 ${Object.keys(nameMap).length} 筆（省略 fetch）`);
                    return;
                }

                // ② 快取不存在或過期，重新 fetch
                console.log('[GameNames] 🔄 快取未命中，重新從 API 載入...');
                nameMap = {};

                // ── 2a. 分批載入 game_database（並行所有頁）──
                const first = await fetch('tables/game_database?limit=1').then(r => r.json());
                const total = first.total || 0;
                const batchSize = 100;
                const pages = Math.ceil(total / batchSize) || 1;

                const bggIdMap = {};

                // 並行發出全部請求（比串行快 10-20 倍）
                const allPages = await Promise.all(
                    Array.from({ length: pages }, (_, i) =>
                        fetch(`tables/game_database?page=${i+1}&limit=${batchSize}`).then(r => r.json())
                    )
                );
                allPages.forEach(data => {
                    (data.data || []).forEach(game => {
                        const entry = {
                            name_zh:   game.name_zh   || '',
                            name_ja:   game.name_ja   || '',
                            name_en:   game.name_en   || '',
                            image_url: game.image_url || '',
                            bgg_id:    game.bgg_id    || ''
                        };
                        if (game.name_en) nameMap[normalizeName(game.name_en)] = entry;
                        if (game.name_zh) nameMap[normalizeName(game.name_zh)] = entry;
                        if (game.name_ja) nameMap[normalizeName(game.name_ja)] = entry;
                        if (game.bgg_id)  bggIdMap[String(game.bgg_id).trim()] = entry;
                    });
                });

                // ── 2b. 載入 game_aliases（並行）──
                try {
                    const aliasCount = await fetch('tables/game_aliases?limit=1').then(r => r.json());
                    const aliasTotal = aliasCount.total || 0;
                    const aliasPages = Math.ceil(aliasTotal / 100) || 1;
                    const aliasAllPages = await Promise.all(
                        Array.from({ length: aliasPages }, (_, i) =>
                            fetch(`tables/game_aliases?page=${i+1}&limit=100`).then(r => r.json())
                        )
                    );
                    let allAliases = [];
                    aliasAllPages.forEach(d => { allAliases = allAliases.concat(d.data || []); });

                    allAliases.forEach(record => {
                        if (!Array.isArray(record.aliases) || record.aliases.length === 0) return;
                        let entry = null;
                        if (record.bgg_id) entry = bggIdMap[String(record.bgg_id).trim()] || null;
                        if (!entry && record.primary_name) entry = nameMap[record.primary_name.toLowerCase()] || null;
                        if (!entry) return;
                        record.aliases.forEach(alias => {
                            if (alias) nameMap[normalizeName(alias)] = entry;
                        });
                    });

                    console.log(`[GameNames] ✅ 載入完成：${Object.keys(nameMap).length} 筆（${total} 款遊戲 + ${allAliases.length} 筆別名）`);
                } catch(ae) {
                    console.warn('[GameNames] ⚠️ 別名載入失敗，跳過', ae);
                }

                // ③ 寫入快取
                saveCache(nameMap);
                loaded = true;

            } catch (e) {
                console.warn('[GameNames] ⚠️ 載入失敗，使用原始名稱', e);
                loaded = true;
            }
        })();

        return loadPromise;
    }

    // ── 強制重新載入（清除快取，下次 load() 時重新 fetch）──
    function clearCache() {
        try {
            localStorage.removeItem(CACHE_KEY);
            localStorage.removeItem(CACHE_TS_KEY);
            // 清除舊版本快取
            ['v3','v4','v5','v6'].forEach(v => {
                localStorage.removeItem(`gn_nameMap_${v}`);
                localStorage.removeItem(`gn_nameMap_ts_${v}`);
            });
        } catch(e) {}
        nameMap = {};
        loaded = false;
        loadPromise = null;
        console.log('[GameNames] 快取已清除');
    }

    // ── 正規化輸入（全形→半形、去除前後空白）──
    function normalizeName(name) {
        if (!name) return '';
        return name.trim()
            .replace(/：/g, ':')   // 全形冒號→半形
            .replace(/　/g, ' ')   // 全形空格→半形
            .replace(/（/g, '(')
            .replace(/）/g, ')')
            .toLowerCase();
    }

    // ── 查詢遊戲資料 ──
    function lookup(name) {
        if (!name) return null;
        const key = normalizeName(name);
        return nameMap[key] || null;
    }

    /**
     * 根據遊戲資料決定「上行」與「下行」名稱
     * 回傳 { top, sub }
     *   top: 主要顯示名稱（中 > 日 > 英）
     *   sub: 次要顯示名稱（英，若 top 已是英則為空）
     */
    function resolveNames(info) {
        if (!info) return { top: null, sub: null };
        const zh = info.name_zh;
        const ja = info.name_ja;
        const en = info.name_en;

        if (zh) return { top: zh, sub: en || '' };       // 中上英下（含中日英）
        if (ja) return { top: ja, sub: en || '' };       // 日上英下
        if (en) return { top: en, sub: '' };             // 只有英文
        return { top: null, sub: null };
    }

    // ── formatCard：大卡片，分行顯示 ──
    function formatCard(name) {
        const info = lookup(name);
        const { top, sub } = resolveNames(info);

        if (top && sub) {
            return `<span class="gn-zh" style="display:block">${top}</span>`
                 + `<span class="gn-en" style="display:block">${sub}</span>`;
        }
        if (top) {
            return `<span class="gn-zh" style="display:block">${top}</span>`;
        }
        // 找不到對照，原樣顯示
        return `<span class="gn-zh" style="display:block">${name}</span>`;
    }

    // ── formatTag：小標籤，兩行顯示 ──
    function formatTag(name) {
        const info = lookup(name);
        const { top, sub } = resolveNames(info);

        if (top && sub) {
            return `<span class="gn-tag-zh">${top}</span>`
                 + `<span class="gn-tag-en">${sub}</span>`;
        }
        if (top) return `<span class="gn-tag-zh">${top}</span>`;
        // 找不到對照，原樣顯示
        return `<span class="gn-tag-zh">${name}</span>`;
    }

    // ── formatInline：排行榜，同行 ｜ 分隔 ──
    function formatInline(name) {
        const info = lookup(name);
        const { top, sub } = resolveNames(info);

        if (top && sub) {
            return `<span class="gn-inline-zh">${top}</span>`
                 + `<span class="gn-inline-sep">｜</span>`
                 + `<span class="gn-inline-en">${sub}</span>`;
        }
        if (top) return `<span class="gn-inline-zh">${top}</span>`;
        return `<span class="gn-inline-zh">${name}</span>`;
    }

    // ── displayName：純文字主名稱（優先中 > 日 > 英）──
    function displayName(name) {
        const info = lookup(name);
        if (info) return info.name_zh || info.name_ja || info.name_en || name;
        return name;
    }

    // ── getImageUrl：取得封面圖片 URL（同步，只查 DB）──
    function getImageUrl(name) {
        const info = lookup(name);
        return (info && info.image_url && info.image_url.startsWith('http'))
            ? info.image_url
            : null;
    }

    // ── fetchCoverImage：取得封面圖（只用資料庫的 image_url，快速無阻塞）──
    // 回傳可直接放進 <img src> 的 URL，DB 無圖片則回傳 null
    const _coverCache = {};
    async function fetchCoverImage(name) {
        if (!name) return null;
        const key = name.toLowerCase();
        if (_coverCache[key] !== undefined) return _coverCache[key];

        // 只查 DB 的 image_url，不做任何遠端 BGG 請求
        const info = lookup(name);
        if (info?.image_url && info.image_url.startsWith('http')) {
            // 用 weserv 代理繞 CORS（讓 html2canvas 能讀取）
            const proxied = `https://images.weserv.nl/?url=${encodeURIComponent(info.image_url)}&w=400&h=400&fit=cover&output=jpg&maxage=7d`;
            _coverCache[key] = proxied;
            return proxied;
        }

        // DB 無圖片，回傳 null（顯示預設佔位符）
        _coverCache[key] = null;
        return null;
    }

    // ── getDirectImageUrl：直接回傳 DB 原始 image_url（不走代理）──
    // 用於 <img src> 直接顯示
    function getDirectImageUrl(name) {
        const info = lookup(name);
        return (info?.image_url && info.image_url.startsWith('http'))
            ? info.image_url
            : null;
    }

    return { load, clearCache, lookup, resolveNames, formatCard, formatTag, formatInline, displayName, getImageUrl, getDirectImageUrl, fetchCoverImage, get _nameMap() { return nameMap; } };
})();
