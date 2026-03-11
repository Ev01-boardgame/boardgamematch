// MBTI 類型數據
const MBTI_TYPES = {
    'INTJ': {
        name: '建築師',
        description: '富有想像力和戰略性的思考者，一切皆在計劃之中。',
        color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    'INTP': {
        name: '邏輯學家',
        description: '具有創新精神的發明家，對知識有著不可遏止的渴望。',
        color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    },
    'ENTJ': {
        name: '指揮官',
        description: '大膽、富有想像力且意志強大的領導者。',
        color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
    },
    'ENTP': {
        name: '辯論家',
        description: '聰明好奇的思考者，無法抗拒智力上的挑戰。',
        color: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
    },
    'INFJ': {
        name: '提倡者',
        description: '安靜而神秘，鼓舞人心且不知疲倦的理想主義者。',
        color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
    },
    'INFP': {
        name: '調停者',
        description: '詩意、善良的利他主義者，總是熱情地為正義事業而努力。',
        color: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
    },
    'ENFJ': {
        name: '主人公',
        description: '富有魅力且鼓舞人心的領導者，能夠使聽眾著迷。',
        color: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'
    },
    'ENFP': {
        name: '競選者',
        description: '熱情、有創造力且社交能力強的自由精神。',
        color: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'
    },
    'ISTJ': {
        name: '物流師',
        description: '實際且注重事實的個人，可靠性不容置疑。',
        color: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)'
    },
    'ISFJ': {
        name: '守衛者',
        description: '非常專注且溫暖的守護者，時刻準備著保護所愛之人。',
        color: 'linear-gradient(135deg, #fdcbf1 0%, #e6dee9 100%)'
    },
    'ESTJ': {
        name: '總經理',
        description: '出色的管理者，在管理事務或人員方面無與倫比。',
        color: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)'
    },
    'ESFJ': {
        name: '執政官',
        description: '極有同情心、受歡迎且關懷他人的人。',
        color: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'
    },
    'ISTP': {
        name: '鑑賞家',
        description: '大膽且實際的實驗者，擅長使用各種工具。',
        color: 'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)'
    },
    'ISFP': {
        name: '探險家',
        description: '靈活且有魅力的藝術家，時刻準備著探索和體驗新事物。',
        color: 'linear-gradient(135deg, #fbc7d4 0%, #9796f0 100%)'
    },
    'ESTP': {
        name: '企業家',
        description: '聰明、精力充沛且非常敏銳的人，真正享受生活的刺激。',
        color: 'linear-gradient(135deg, #fad0c4 0%, #ffd1ff 100%)'
    },
    'ESFP': {
        name: '表演者',
        description: '自發性、精力充沛且熱情的表演者，生活在他們周圍從不沈悶。',
        color: 'linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%)'
    }
};

// API 基礎 URL
const API_BASE = 'tables/users';

// ── 全站統計快取 ───────────────────────────────────────────────
let _siteStatsCache = null;
let _siteStatsCacheTime = 0;
const SITE_STATS_TTL = 5 * 60 * 1000; // 5 分鐘快取

/**
 * 取得全站統計（total_games）
 * 優先從 site_stats 表讀取，快速且不需掃描整個 game_database
 * @returns {Promise<{total_games: number}>}
 */
async function getSiteStats() {
    const now = Date.now();
    if (_siteStatsCache && (now - _siteStatsCacheTime) < SITE_STATS_TTL) {
        return _siteStatsCache;
    }
    try {
        const r = await fetch('tables/site_stats?limit=10');
        if (r.ok) {
            const d = await r.json();
            const global = (d.data || []).find(x => x.id === 'global');
            if (global) {
                _siteStatsCache = global;
                _siteStatsCacheTime = now;
                return global;
            }
        }
    } catch(e) {}
    // fallback：直接查 game_database 總數
    try {
        const r2 = await fetch('tables/game_database?limit=1');
        if (r2.ok) {
            const d2 = await r2.json();
            const fallback = { total_games: d2.total || 0 };
            _siteStatsCache = fallback;
            _siteStatsCacheTime = now;
            return fallback;
        }
    } catch(e) {}
    return { total_games: 0 };
}

/**
 * 取得含 JWT Authorization 的 headers（自動從 localStorage 注入）
 */
function getAuthHeaders(extra = {}) {
    const token = localStorage.getItem('google_id_token');
    const h = { 'Content-Type': 'application/json', ...extra };
    if (token && !h['Authorization']) h['Authorization'] = 'Bearer ' + token;
    return h;
}

/**
 * safePatch(url, patchData)
 * GET 取回現有資料 → 移除所有非 schema 欄位 → PUT 回去
 *
 * Genspark/D1 只接受 schema 裡存在的欄位，多送就 500
 * 系統欄位（gs_*、_rid 等）、created_at、updated_at 都不能送
 */
async function safePatch(url, patchData, headers = {}) {
    // 自動注入 JWT Authorization header
    headers = getAuthHeaders(headers);

    // 1. 取回現有資料
    const getRes = await fetch(url, { headers });
    if (!getRes.ok) throw new Error(`GET 失敗 HTTP ${getRes.status}`);
    const existing = await getRes.json();

    // 2. 移除所有系統/自動欄位（D1 schema 裡不存在的欄位送進去會 500）
    const systemFields = [
        'gs_project_id','gs_table_name','gs_created_at','gs_updated_at',
        'created_at','updated_at','deleted','deleted_at',
        '_rid','_id','__rid','__id'
    ];
    const cleaned = Object.fromEntries(
        Object.entries(existing).filter(([k]) => !systemFields.includes(k))
    );

    // 3. 合併要更新的欄位
    const merged = { ...cleaned, ...patchData };

    // 4. 序列化 array/object → JSON 字串（D1 text 欄位不接受 object 型別）
    const serialized = {};
    for (const [k, v] of Object.entries(merged)) {
        if (v !== null && v !== undefined && typeof v === 'object') {
            serialized[k] = JSON.stringify(v);
        } else {
            serialized[k] = v;
        }
    }

    // 5. PUT 回原 URL
    const putRes = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(serialized)
    });
    if (!putRes.ok) {
        const errText = await putRes.text().catch(() => '');
        throw new Error(`PUT 失敗 HTTP ${putRes.status}: ${errText.slice(0, 150)}`);
    }
    return await putRes.json();
}

// 載入中狀態
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>載入中...</p>
            </div>
        `;
    }
}

// 顯示錯誤訊息
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <div class="alert alert-error">
                <strong>錯誤：</strong> ${message}
            </div>
        `;
    }
}

// 顯示成功訊息
function showSuccess(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <div class="alert alert-success">
                <strong>成功！</strong> ${message}
            </div>
        `;
    }
}

// 取得所有使用者資料（分頁抓取，帶快取 60 秒）
let _allUsersCache = null;
let _allUsersCacheTime = 0;
const ALL_USERS_TTL = 60 * 1000; // 60 秒

async function getAllUsers(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && _allUsersCache && (now - _allUsersCacheTime) < ALL_USERS_TTL) {
        return _allUsersCache;
    }
    try {
        const allData = await fetchAllPages('tables/users');
        // API 有時回傳 JSON 字串而非陣列，統一轉換
        const toArr = v => {
            if (Array.isArray(v)) return v;
            if (typeof v === 'string' && v) { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch(e) {} }
            return [];
        };
        allData.forEach(u => {
            u.liked_games        = toArr(u.liked_games);
            u.disliked_games     = toArr(u.disliked_games);
            u.super_liked_games  = toArr(u.super_liked_games);
            u.neutral_games      = toArr(u.neutral_games);
            u.no_interest_games  = toArr(u.no_interest_games);
            u.wishlist           = toArr(u.wishlist);
        });
        _allUsersCache = allData;
        _allUsersCacheTime = Date.now();
        return _allUsersCache;
    } catch (error) {
        console.error('Error fetching users:', error);
        return _allUsersCache || [];
    }
}

/**
 * 通用分頁抓取函式（API 每頁上限 100 筆）
 * @param {string} tableUrl - 例如 'tables/users' 或 'tables/game_votes'
 * @param {number} maxRows  - 最多抓幾筆（預設 9999 = 全部）
 * @returns {Promise<Array>}
 */
async function fetchAllPages(tableUrl, maxRows = 9999) {
    const baseUrl = tableUrl.includes('?') ? tableUrl + '&' : tableUrl + '?';
    try {
        const first = await fetch(baseUrl + 'limit=100&page=1');
        if (!first.ok) return [];
        const firstData = await first.json();
        const total = Math.min(firstData.total || 0, maxRows);
        let allData = firstData.data || [];
        if (total > 100) {
            const pages = Math.ceil(total / 100);
            const reqs = [];
            for (let p = 2; p <= pages; p++) {
                reqs.push(fetch(baseUrl + `limit=100&page=${p}`).then(r => r.ok ? r.json() : { data: [] }));
            }
            const results = await Promise.all(reqs);
            results.forEach(d => { allData = allData.concat(d.data || []); });
        }
        return allData.slice(0, maxRows);
    } catch(e) {
        console.error('fetchAllPages error:', tableUrl, e);
        return [];
    }
}

// 取得單一使用者資料
async function getUserById(userId) {
    try {
        const response = await fetch(`${API_BASE}/${userId}`);
        if (!response.ok) throw new Error('無法載入使用者資料');
        return await response.json();
    } catch (error) {
        console.error('Error fetching user:', error);
        return null;
    }
}

// 新增使用者
async function createUser(userData) {
    try {
        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(userData)
        });
        if (!response.ok) throw new Error('無法新增使用者');
        return await response.json();
    } catch (error) {
        console.error('Error creating user:', error);
        throw error;
    }
}

// 更新使用者
async function updateUser(userId, userData) {
    try {
        // safePatch 使用 GET+POST(UPSERT)，不需要任何 token
        const updatedUser = await safePatch(`${API_BASE}/${userId}`, userData);
        
        // 更新 localStorage 中的當前使用者
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.id === userId) {
            setCurrentUser(updatedUser);
        }
        
        return updatedUser;
    } catch (error) {
        console.error('Error updating user:', error);
        throw error;
    }
}

// 刪除使用者
async function deleteUser(userId) {
    try {
        const response = await fetch(`${API_BASE}/${userId}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('無法刪除使用者');
        return true;
    } catch (error) {
        console.error('Error deleting user:', error);
        throw error;
    }
}

// 按 MBTI 類型分組使用者
function groupUsersByMBTI(users) {
    const grouped = {};
    
    // 初始化所有 MBTI 類型
    Object.keys(MBTI_TYPES).forEach(type => {
        grouped[type] = [];
    });
    
    // 分組使用者
    users.forEach(user => {
        if (user.mbti_type && grouped[user.mbti_type]) {
            grouped[user.mbti_type].push(user);
        }
    });
    
    return grouped;
}

// 計算各 MBTI 類型的熱門遊戲
function getPopularGamesByMBTI(users, mbtiType) {
    const typeUsers = users.filter(u => u.mbti_type === mbtiType);
    const gameCount = {};
    
    typeUsers.forEach(user => {
        if (user.liked_games && Array.isArray(user.liked_games)) {
            user.liked_games.forEach(game => {
                gameCount[game] = (gameCount[game] || 0) + 1;
            });
        }
    });
    
    // 轉換為陣列並排序
    return Object.entries(gameCount)
        .map(([game, count]) => ({ game, count }))
        .sort((a, b) => b.count - a.count);
}

// 計算各 MBTI 類型最不受歡迎的遊戲
function getDislikedGamesByMBTI(users, mbtiType) {
    const typeUsers = users.filter(u => u.mbti_type === mbtiType);
    const gameCount = {};
    
    typeUsers.forEach(user => {
        if (user.disliked_games && Array.isArray(user.disliked_games)) {
            user.disliked_games.forEach(game => {
                gameCount[game] = (gameCount[game] || 0) + 1;
            });
        }
    });
    
    return Object.entries(gameCount)
        .map(([game, count]) => ({ game, count }))
        .sort((a, b) => b.count - a.count);
}

// 計算整體統計數據
function calculateStats(users) {
    const stats = {
        totalUsers: users.length,
        mbtiDistribution: {},
        mostPopularGames: {},
        mostDislikedGames: {}
    };
    
    // MBTI 分佈
    users.forEach(user => {
        if (user.mbti_type) {
            stats.mbtiDistribution[user.mbti_type] = 
                (stats.mbtiDistribution[user.mbti_type] || 0) + 1;
        }
    });
    
    // 整體熱門遊戲
    const allLikedGames = {};
    const allNeutralGames = {};
    const allDislikedGames = {};
    
    users.forEach(user => {
        // 超喜歡 + 喜歡 合併計入熱門
        if (user.super_liked_games && Array.isArray(user.super_liked_games)) {
            user.super_liked_games.forEach(game => {
                allLikedGames[game] = (allLikedGames[game] || 0) + 2; // 權重加倍
            });
        }
        if (user.liked_games && Array.isArray(user.liked_games)) {
            user.liked_games.forEach(game => {
                allLikedGames[game] = (allLikedGames[game] || 0) + 1;
            });
        }
        if (user.neutral_games && Array.isArray(user.neutral_games)) {
            user.neutral_games.forEach(game => {
                allNeutralGames[game] = (allNeutralGames[game] || 0) + 1;
            });
        }
        if (user.disliked_games && Array.isArray(user.disliked_games)) {
            user.disliked_games.forEach(game => {
                allDislikedGames[game] = (allDislikedGames[game] || 0) + 1;
            });
        }
    });
    
    stats.mostPopularGames = Object.entries(allLikedGames)
        .map(([game, count]) => ({ game, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    
    stats.mostNeutralGames = Object.entries(allNeutralGames)
        .map(([game, count]) => ({ game, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    stats.mostDislikedGames = Object.entries(allDislikedGames)
        .map(([game, count]) => ({ game, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    
    return stats;
}

// Local Storage 操作
function saveToLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        return false;
    }
}

function getFromLocalStorage(key) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    } catch (error) {
        console.error('Error reading from localStorage:', error);
        return null;
    }
}

function removeFromLocalStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error('Error removing from localStorage:', error);
        return false;
    }
}

// 取得當前使用者
function getCurrentUser() {
    return getFromLocalStorage('currentUser');
}

// 設定當前使用者
function setCurrentUser(user) {
    return saveToLocalStorage('currentUser', user);
}

// 清除當前使用者
function clearCurrentUser() {
    localStorage.removeItem('google_id_token'); // 🔐 同步清除 JWT token
    return removeFromLocalStorage('currentUser');
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// ====================================
// Gamification API Functions
// ====================================

// 獲取使用者統計資料
async function getUserStats(userId) {
    try {
        // 撈全部再精確比對 user_id（避免 search 全文搜尋誤判）
        const response = await fetch(`tables/user_stats?limit=1000`);
        const result = await response.json();
        const allStats = result.data || [];
        // 精確比對，若有重複取 total_xp 最高那筆
        const matched = allStats
            .filter(s => s.user_id === userId)
            .sort((a, b) => (b.total_xp || 0) - (a.total_xp || 0));
        if (matched.length > 0) {
            // 如果有重複筆，非同步清除多餘的（保留最高 XP 那筆）
            if (matched.length > 1) {
                console.warn(`⚠️ user_stats 重複 ${matched.length} 筆，自動清除多餘紀錄`);
                const keepId = matched[0].id;
                matched.slice(1).forEach(dup => {
                    fetch(`tables/user_stats/${dup.id}`, { method: 'DELETE' })
                        .catch(() => {});
                });
            }
            return matched[0];
        }
        // 找不到 → 建立初始資料
        return await createUserStats(userId);
    } catch (error) {
        console.error('Error fetching user stats:', error);
        throw error;
    }
}

// 建立使用者統計資料
async function createUserStats(userId) {
    try {
        const response = await fetch('tables/user_stats', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                user_id: userId,
                total_xp: 100, // 註冊獎勵
                level: 1,
                games_added: 0,
                votes_count: 0,
                daily_streak: 0,
                max_streak: 0,
                last_login: Date.now(),
                daily_quest_completed: []
            })
        });
        return await response.json();
    } catch (error) {
        console.error('Error creating user stats:', error);
        throw error;
    }
}

// 更新使用者統計資料
async function updateUserStats(userId, updates) {
    try {
        const stats = await getUserStats(userId);
        const response = await safePatch(`tables/user_stats/${stats.id}`, {
            ...updates,
            updated_at: Date.now()
        });
        return response;
    } catch (error) {
        console.error('Error updating user stats:', error);
        throw error;
    }
}

// 計算等級（根據 XP）
function calculateLevel(xp) {
    if (xp < 100) return 1;
    if (xp < 300) return 2;
    if (xp < 600) return 3;
    if (xp < 1000) return 4;
    if (xp < 1500) return 5;
    if (xp < 2100) return 6;
    if (xp < 2800) return 7;
    if (xp < 3600) return 8;
    if (xp < 4500) return 9;
    if (xp < 5500) return 10;
    if (xp < 6600) return 11;
    if (xp < 7800) return 12;
    if (xp < 9100) return 13;
    if (xp < 10500) return 14;
    if (xp < 12000) return 15;
    if (xp < 14000) return 16;
    if (xp < 16000) return 17;
    if (xp < 18500) return 18;
    if (xp < 21000) return 19;
    return 20;
}

// 獲取當前等級所需 XP
function getLevelXP(level) {
    const xpMap = {
        1: 0, 2: 100, 3: 300, 4: 600, 5: 1000, 6: 1500, 7: 2100, 8: 2800,
        9: 3600, 10: 4500, 11: 5500, 12: 6600, 13: 7800, 14: 9100, 15: 10500,
        16: 12000, 17: 14000, 18: 16000, 19: 18500, 20: 21000, 21: 25000
    };
    return xpMap[level] || 0;
}

// 增加 XP
async function addXP(userId, amount, reason = '') {
    try {
        const stats = await getUserStats(userId);
        const newXP = stats.total_xp + amount;
        const oldLevel = calculateLevel(stats.total_xp);
        const newLevel = calculateLevel(newXP);
        
        const updates = {
            total_xp: newXP,
            level: newLevel
        };
        
        await updateUserStats(userId, updates);
        
        // ✅ 同步快取到 localStorage，下次開頁可即時顯示
        try {
            localStorage.setItem('userStats_cache', JSON.stringify({
                user_id: userId,
                total_xp: newXP,
                level: newLevel,
                cached_at: Date.now()
            }));
        } catch(e) { /* localStorage 寫入失敗不影響主流程 */ }
        
        // 檢查是否升級
        const leveledUp = newLevel > oldLevel;
        
        return {
            success: true,
            xpGained: amount,
            totalXP: newXP,
            oldLevel,
            newLevel,
            leveledUp,
            reason
        };
    } catch (error) {
        console.error('Error adding XP:', error);
        throw error;
    }
}

// 獲取使用者已解鎖的成就
async function getUserAchievements(userId) {
    try {
        const stats = await getUserStats(userId);
        return stats.unlocked_badges || [];
    } catch (error) {
        console.error('Error fetching user achievements:', error);
        return [];
    }
}

// 獲取所有成就定義
async function getAllAchievements() {
    try {
        const response = await fetch('tables/achievements?limit=500');
        const result = await response.json();
        const all = result.data || [];

        // ── 去重：同一個 id 只保留最新那筆（created_at 最大），並非同步刪除重複舊筆 ──
        const seen = new Map();
        const dupes = [];
        all.forEach(a => {
            const key = String(a.id);
            if (!seen.has(key)) {
                seen.set(key, a);
            } else {
                // 保留 created_at 較大（較新）的
                const existing = seen.get(key);
                if ((a.created_at || 0) > (existing.created_at || 0)) {
                    dupes.push(existing); // 舊的丟掉
                    seen.set(key, a);
                } else {
                    dupes.push(a); // 這筆是舊的
                }
            }
        });

        // 非同步刪除重複舊成就（不擋 UI）
        if (dupes.length > 0) {
            console.warn(`⚠️ achievements 發現 ${dupes.length} 筆重複，自動清除:`, dupes.map(d => d.id));
            dupes.forEach(d => {
                fetch(`tables/achievements/${d.id}`, { method: 'DELETE' }).catch(() => {});
            });
        }

        // 自動修正已知錯誤的 unlock_type
        const fixMap = {
            'badge_mbti_done': 'mbti_complete', // 舊版誤設為 special，應為 mbti_complete
        };
        [...seen.values()].forEach(a => {
            const correctType = fixMap[a.id];
            if (correctType && a.unlock_type !== correctType) {
                console.warn(`🔧 自動修正 ${a.id} unlock_type: ${a.unlock_type} → ${correctType}`);
                safePatch(`tables/achievements/${a.id}`, { unlock_type: correctType }).catch(() => {});
                a.unlock_type = correctType; // 本地也改掉，讓這次判定生效
            }
        });

        const finalList = [...seen.values()];
        console.log('📋 成就清單:', finalList.map(a => `${a.id}(${a.unlock_type})`).join(', '));
        return finalList;
    } catch (error) {
        console.error('Error fetching achievements:', error);
        return [];
    }
}

// 檢查並解鎖成就（唯一成就系統，統一由此處理）
async function checkAndUnlockAchievements(userId) {
    try {
        const [stats, user, allAchievements] = await Promise.all([
            getUserStats(userId),
            getUserById(userId),
            getAllAchievements()
        ]);
        const unlockedIds = [...(stats.unlocked_badges || [])];
        const newUnlocks = [];

        console.log('🏅 成就檢查開始 userId:', userId);
        console.log('  已解鎖:', unlockedIds);
        console.log('  user.google_id:', user?.google_id);

        // ── 預先收集各類型所需資料（避免在迴圈中重複 fetch）──

        // votes_count：從 game_votes 查此玩家的評價筆數（最可靠來源）
        let myVotesCount = 0;
        const hasVotesType = allAchievements.some(a => a.unlock_type === 'votes_count');
        if (hasVotesType) {
            try {
                const vr = await fetch('tables/game_votes?limit=5000');
                if (vr.ok) {
                    const vd = await vr.json();
                    myVotesCount = (vd.data || []).filter(v => v.user_id === userId).length;
                }
            } catch(e) { /* 查不到就維持 0 */ }
        }

        // collections_count：此玩家建立的公開清單數
        let myCollectionsCount = 0;
        const hasCollectionsType = allAchievements.some(a => a.unlock_type === 'collections_count');
        if (hasCollectionsType) {
            try {
                const cr = await fetch('tables/user_collections?limit=1000');
                if (cr.ok) {
                    const cd = await cr.json();
                    myCollectionsCount = (cd.data || []).filter(c => c.created_by === userId && c.is_public !== false).length;
                }
            } catch(e) { /* 查不到就維持 0 */ }
        }

        // rated_others_count：此玩家評分他人清單的次數（rated_by 欄位中含有 userId 的清單數）
        let myRatedOthersCount = 0;
        const hasRatedOthersType = allAchievements.some(a => a.unlock_type === 'rated_others_count');
        if (hasRatedOthersType) {
            try {
                const rr = await fetch('tables/user_collections?limit=1000');
                if (rr.ok) {
                    const rd = await rr.json();
                    myRatedOthersCount = (rd.data || []).filter(c => {
                        if (c.created_by === userId) return false; // 排除自己的清單
                        try {
                            const ratedBy = typeof c.rated_by === 'string' ? JSON.parse(c.rated_by) : (c.rated_by || []);
                            return Array.isArray(ratedBy) && ratedBy.includes(userId);
                        } catch(e) { return false; }
                    }).length;
                }
            } catch(e) { /* 查不到就維持 0 */ }
        }

        // special（管理員）：查 admin_whitelist，同時納入超級管理員
        let adminWhitelistIds = new Set();
        const hasSpecial = allAchievements.some(a => a.unlock_type === 'special');
        if (hasSpecial) {
            try {
                const ar = await fetch('tables/admin_whitelist?limit=200');
                if (ar.ok) {
                    const ad = await ar.json();
                    (ad.data || []).filter(a => a.is_active !== false).forEach(a => {
                        if (a.google_id) adminWhitelistIds.add(a.google_id);
                    });
                }
            } catch(e) { console.warn('admin_whitelist 查詢失敗:', e); }

            // 超級管理員是硬寫在 admin-auth.js 的，不一定在 admin_whitelist 裡
            try {
                // 方法 1：從已載入的 admin-auth.js 取得
                const superAdminId = window.ADMIN_AUTH_CONFIG && window.ADMIN_AUTH_CONFIG.SUPER_ADMIN_GOOGLE_ID;
                if (superAdminId) {
                    adminWhitelistIds.add(superAdminId);
                    console.log('  ✅ 加入 superAdminId:', superAdminId);
                }
                // 方法 2：從 show-admin-link.js 的快取取得（備援）
                const adminCache = localStorage.getItem('admin_check_cache');
                if (adminCache) {
                    const cache = JSON.parse(adminCache);
                    if (cache.isAdmin && cache.userId) {
                        adminWhitelistIds.add(cache.userId);
                        console.log('  ✅ 加入 adminCache.userId:', cache.userId);
                    }
                }
                // 方法 3：從 localStorage currentUser 的 google_id 做快速超管比對
                const cachedUser = localStorage.getItem('currentUser');
                if (cachedUser) {
                    const cu = JSON.parse(cachedUser);
                    if (cu.google_id && window.ADMIN_AUTH_CONFIG) {
                        if (cu.google_id === window.ADMIN_AUTH_CONFIG.SUPER_ADMIN_GOOGLE_ID) {
                            adminWhitelistIds.add(cu.google_id);
                        }
                    }
                }
            } catch(e) { /* 略過 */ }

            console.log('  adminWhitelistIds:', [...adminWhitelistIds]);
            console.log('  user.google_id to check:', user?.google_id);
        }

        // special（測試人員）：查 tester_whitelist
        let testerWhitelistIds = new Set();
        const hasTesterBadge = allAchievements.some(a => a.unlock_type === 'special' && a.id === 'badge_tester');
        if (hasTesterBadge) {
            try {
                const tr = await fetch('tables/tester_whitelist?limit=200');
                if (tr.ok) {
                    const td = await tr.json();
                    (td.data || []).filter(a => a.is_active !== false).forEach(a => {
                        if (a.google_id) testerWhitelistIds.add(a.google_id);
                    });
                }
            } catch(e) { console.warn('tester_whitelist 查詢失敗:', e); }
            console.log('  testerWhitelistIds:', [...testerWhitelistIds]);
        }

        // badge_influencer 由管理員直接寫入 unlocked_badges，不需要 whitelist check

        // ── 逐一判斷成就條件 ──
        for (const achievement of allAchievements) {
            if (unlockedIds.includes(achievement.id)) continue;

            let unlocked = false;

            if (achievement.unlock_type === 'games_count') {
                // 喜歡 + 普普 + 不喜歡 的遊戲總數
                const gamesAdded = (user.super_liked_games || []).length + (user.liked_games || []).length + (user.neutral_games || []).length + (user.disliked_games || []).length + (user.no_interest_games || []).length;
                unlocked = gamesAdded >= achievement.unlock_value;

            } else if (achievement.unlock_type === 'mbti_complete') {
                // 完成 MBTI 測驗：user.mbti_type 有值即解鎖
                unlocked = !!(user.mbti_type && user.mbti_type.trim());
                console.log(`  🧠 mbti_complete 檢查: mbti_type=${user.mbti_type}, unlocked=${unlocked}`);

            } else if (achievement.unlock_type === 'votes_count') {
                // 評價過的不重複遊戲筆數（來自 game_votes，不受刪除影響）
                unlocked = myVotesCount >= achievement.unlock_value;

            } else if (achievement.unlock_type === 'streak_days') {
                // 連續登入天數（由 profile.html 在登入時呼叫 updateLoginStreak 維護）
                unlocked = (stats.streak_days || 0) >= achievement.unlock_value;

            } else if (achievement.unlock_type === 'special' && achievement.id === 'badge_admin') {
                // 管理員成就：google_id 必須在 admin_whitelist 中（或為超級管理員）
                const userGoogleId = user?.google_id ||
                    (() => { try { return JSON.parse(localStorage.getItem('currentUser') || '{}').google_id; } catch(e) { return null; } })();
                if (userGoogleId) {
                    unlocked = adminWhitelistIds.has(userGoogleId);
                    console.log(`  🛡️ badge_admin 檢查: google_id=${userGoogleId}, 在名單中=${unlocked}`);
                } else {
                    console.warn('  ⚠️ badge_admin: 無法取得 user.google_id');
                }

            } else if (achievement.unlock_type === 'special' && achievement.id === 'badge_tester') {
                // 測試人員成就：google_id 必須在 tester_whitelist 中
                const userGoogleId = user?.google_id ||
                    (() => { try { return JSON.parse(localStorage.getItem('currentUser') || '{}').google_id; } catch(e) { return null; } })();
                if (userGoogleId) {
                    unlocked = testerWhitelistIds.has(userGoogleId);
                    console.log(`  🧪 badge_tester 檢查: google_id=${userGoogleId}, 在名單中=${unlocked}`);
                } else {
                    console.warn('  ⚠️ badge_tester: 無法取得 user.google_id');
                }

            } else if (achievement.unlock_type === 'collections_count') {
                // 清單創作型成就：公開清單數量
                unlocked = myCollectionsCount >= achievement.unlock_value;

            } else if (achievement.unlock_type === 'rated_others_count') {
                // 社群貢獻型成就：評分他人清單次數
                unlocked = myRatedOthersCount >= achievement.unlock_value;

            } else if (achievement.unlock_type === 'event_complete') {
                // 活動完成型成就：由活動系統主動寫入 unlocked_badges，此處跳過自動檢查
                unlocked = false;
            }

            if (unlocked) {
                newUnlocks.push(achievement);
                unlockedIds.push(achievement.id);
            }
        }

        // ── 有新解鎖才寫入資料庫（直接用已知 stats.id，避免 updateUserStats 再抓一次 stats 導致 id 不同）──
        if (newUnlocks.length > 0) {
            console.log('🏅 準備寫入新解鎖:', newUnlocks.map(a => a.name_zh || a.id));
            console.log('   寫入 stats.id:', stats.id, '  unlocked_badges:', unlockedIds);
            try {
                const saved = await safePatch(`tables/user_stats/${stats.id}`, { unlocked_badges: unlockedIds, updated_at: Date.now() });
                const savedBadges = Array.isArray(saved.unlocked_badges)
                    ? saved.unlocked_badges
                    : (() => { try { return JSON.parse(saved.unlocked_badges || '[]'); } catch(e) { return []; } })();
                console.log('   ✅ 寫入成功，DB 回傳 unlocked_badges:', savedBadges);
            } catch(patchErr) {
                console.error('   ❌ 寫入失敗', patchErr.message);
            }
        }

        return newUnlocks;
    } catch (error) {
        console.error('Error checking achievements:', error);
        return [];
    }
}

// 獲取每日任務
async function getDailyQuests() {
    try {
        const response = await fetch('tables/daily_quests');
        const result = await response.json();
        return result.data || [];
    } catch (error) {
        console.error('Error fetching daily quests:', error);
        return [];
    }
}

// 顯示 XP 獲得動畫
function showXPAnimation(amount, element) {
    const xpElement = document.createElement('div');
    xpElement.className = 'xp-gain';
    xpElement.textContent = `+${amount} XP`;
    xpElement.style.position = 'absolute';
    xpElement.style.top = '50%';
    xpElement.style.left = '50%';
    xpElement.style.transform = 'translate(-50%, -50%)';
    xpElement.style.zIndex = '1000';
    xpElement.style.transition = 'all 0.6s ease-out';
    xpElement.style.animation = 'fadeInUp 0.6s ease-out';
    
    const container = element || document.body;
    container.style.position = 'relative';
    container.appendChild(xpElement);
    
    // 縮短動畫時間從 2000ms → 800ms
    setTimeout(() => {
        xpElement.style.opacity = '0';
        xpElement.style.transform = 'translate(-50%, -70%)';
    }, 200);
    
    setTimeout(() => {
        xpElement.remove();
    }, 800);
}

// 顯示升級提示
function showLevelUpNotification(newLevel) {
    const notification = document.createElement('div');
    notification.className = 'level-up-notification';
    notification.innerHTML = `
        <div class="level-up-content">
            <div class="level-up-icon">🎉</div>
            <h2>恭喜升級！</h2>
            <p>你已經達到 <strong>等級 ${newLevel}</strong></p>
            <p>繼續努力，解鎖更多成就！</p>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

// 顯示成就解鎖提示
function showAchievementUnlocked(achievement) {
    const notification = document.createElement('div');
    notification.className = 'achievement-notification';
    notification.innerHTML = `
        <div class="achievement-content">
            <div class="achievement-icon">${achievement.icon}</div>
            <div class="achievement-details">
                <h3>🎊 成就解鎖！</h3>
                <p><strong>${achievement.name_zh}</strong></p>
                <p style="font-size: 0.9rem; opacity: 0.8;">${achievement.description}</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}

// ====================================
// Game Recommendation Functions
// ====================================

// 獲取隨機遊戲推薦（優化版：使用快取）
let gamesCacheTimestamp = 0;
let gamesCache = null;
const CACHE_DURATION = 60000; // 快取 1 分鐘

async function getRandomGame(userId) {
    try {
        // 使用快取的遊戲列表（1 分鐘內有效）
        const now = Date.now();
        if (!gamesCache || (now - gamesCacheTimestamp) > CACHE_DURATION) {
            // 獲取遊戲資料庫（分批載入全部）
            const countRes = await fetch('tables/game_database?limit=1');
            const countData = await countRes.json();
            const total = countData.total || 0;
            const batchSize = 100;
            const pages = Math.ceil(total / batchSize) || 1;
            let allGamesTemp = [];
            for (let p = 1; p <= pages; p++) {
                const res = await fetch(`tables/game_database?page=${p}&limit=${batchSize}`);
                const d = await res.json();
                allGamesTemp = allGamesTemp.concat(d.data || []);
            }
            gamesCache = allGamesTemp;
            gamesCacheTimestamp = now;
            
            if (gamesCache.length === 0) {
                console.warn('遊戲資料庫為空，使用使用者已新增的遊戲');
                // 如果資料庫為空，從使用者已新增的遊戲中選擇
                const allUsers = await getAllUsers();
                const userGames = new Set();
                allUsers.forEach(user => {
                    (user.liked_games || []).forEach(g => userGames.add(g));
                    (user.disliked_games || []).forEach(g => userGames.add(g));
                });
                gamesCache = Array.from(userGames).map(name => ({
                    name_zh: name,
                    name_en: name,
                    image_url: '🎲'
                }));
            }
        }
        
        const allGames = gamesCache;
        
        // 從 localStorage 取得當前使用者資料（更快）
        let answeredGames = [];
        if (userId) {
            const user = getCurrentUser(); // 使用 localStorage，不呼叫 API
            if (user) {
                answeredGames = [
                    ...(user.liked_games || []),
                    ...(user.disliked_games || []),
                    ...(user.wishlist || [])
                ];
            }
        }
        
        // 過濾掉已經回答過的遊戲
        const availableGames = allGames.filter(game => 
            !answeredGames.includes(game.name_zh)
        );
        
        if (availableGames.length === 0) {
            return null; // 所有遊戲都已回答
        }
        
        // 隨機選擇一款遊戲
        const randomIndex = Math.floor(Math.random() * availableGames.length);
        return availableGames[randomIndex];
        
    } catch (error) {
        console.error('Error getting random game:', error);
        return null;
    }
}

// 記錄遊戲回答（極速版 - 移除成就檢查）
async function recordGameAnswer(userId, gameName, answerType) {
    try {
        // 從 localStorage 取得使用者（不呼叫 API）
        const user = getCurrentUser();
        if (!user) throw new Error('找不到使用者');
        
        let updates = {};
        let xpAmount = 0;
        let reason = '';
        
        if (answerType === 'like') {
            const likedGames = user.liked_games || [];
            if (!likedGames.includes(gameName)) {
                likedGames.push(gameName);
                updates.liked_games = likedGames;
            }
            xpAmount = 10;
            reason = '喜歡遊戲推薦';
        } else if (answerType === 'dislike') {
            const dislikedGames = user.disliked_games || [];
            if (!dislikedGames.includes(gameName)) {
                dislikedGames.push(gameName);
                updates.disliked_games = dislikedGames;
            }
            xpAmount = 10;
            reason = '不喜歡遊戲推薦';
        } else if (answerType === 'unknown') {
            const wishlist = user.wishlist || [];
            if (!wishlist.includes(gameName)) {
                wishlist.push(gameName);
                updates.wishlist = wishlist;
            }
            xpAmount = 5;
            reason = '標記未玩過遊戲';
        }
        
        // 1. 更新使用者資料（唯一的阻塞操作）
        await updateUser(userId, updates);
        
        // 2. 🎯 取得並更新每日計數（必須等待）
        const stats = await getUserStats(userId);
        const today = new Date().toDateString();
        const lastAnswer = stats.last_question_date ? new Date(stats.last_question_date).toDateString() : '';
        
        const dailyCount = (today === lastAnswer) ? (stats.daily_question_count || 0) + 1 : 1;
        
        // 3. 背景執行：更新統計和 XP（不等待）
        Promise.all([
            addXP(userId, xpAmount, reason),
            updateUserStats(userId, {
                daily_question_count: dailyCount,
                last_question_date: Date.now()
            })
        ]).catch(err => console.error('背景更新失敗:', err));
        
        // 4. 立即更新 localStorage
        user.liked_games = updates.liked_games || user.liked_games;
        user.disliked_games = updates.disliked_games || user.disliked_games;
        user.wishlist = updates.wishlist || user.wishlist;
        setCurrentUser(user);
        
        // 5. 返回正確的 dailyCount
        return {
            success: true,
            xpGained: xpAmount,
            totalXP: 0,
            leveledUp: false,
            newLevel: 0,
            dailyCount: dailyCount  // 🎯 返回實際計數
        };
        
    } catch (error) {
        console.error('Error recording answer:', error);
        throw error;
    }
}

// 獲取連續回答次數
async function getAnswerStreak(userId) {
    try {
        const stats = await getUserStats(userId);
        const today = new Date().toDateString();
        const lastAnswer = stats.last_question_date ? new Date(stats.last_question_date).toDateString() : '';
        
        if (today === lastAnswer) {
            return stats.daily_question_count || 0;
        }
        return 0;
    } catch (error) {
        console.error('Error getting answer streak:', error);
        return 0;
    }
}

// 更新待玩清單
async function updateWishlist(userId, gameName, action = 'add') {
    try {
        const user = await getUserById(userId);
        if (!user) throw new Error('找不到使用者');
        
        const wishlist = user.wishlist || [];
        
        if (action === 'add' && !wishlist.includes(gameName)) {
            wishlist.push(gameName);
        } else if (action === 'remove') {
            const index = wishlist.indexOf(gameName);
            if (index > -1) {
                wishlist.splice(index, 1);
            }
        }
        
        await updateUser(userId, { wishlist });
        return wishlist;
        
    } catch (error) {
        console.error('Error updating wishlist:', error);
        throw error;
    }
}

// 匯出函數供全域使用
window.GameMBTI = {
    MBTI_TYPES,
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    groupUsersByMBTI,
    getPopularGamesByMBTI,
    getDislikedGamesByMBTI,
    calculateStats,
    getCurrentUser,
    setCurrentUser,
    clearCurrentUser,
    saveToLocalStorage,
    getFromLocalStorage,
    removeFromLocalStorage,
    formatDate,
    showLoading,
    showError,
    showSuccess,
    // Gamification functions
    getUserStats,
    createUserStats,
    updateUserStats,
    calculateLevel,
    getLevelXP,
    addXP,
    getUserAchievements,
    getAllAchievements,
    checkAndUnlockAchievements,
    getDailyQuests,
    showXPAnimation,
    showLevelUpNotification,
    showAchievementUnlocked,
    // Game recommendation functions
    getRandomGame,
    recordGameAnswer,
    getAnswerStreak,
    updateWishlist
};
