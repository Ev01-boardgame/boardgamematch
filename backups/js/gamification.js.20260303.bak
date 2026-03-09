// ========================================
// 🎮 遊戲化系統核心模組
// ========================================

// XP 與等級常數
const XP_RULES = {
    REGISTER: 100,
    FILL_MBTI: 50,
    ADD_LIKED_GAME: 10,
    ADD_DISLIKED_GAME: 10,
    VOTE_AGREE: 5,
    VOTE_DISAGREE: 5,
    EDIT_GAMES: 5,
    DAILY_LOGIN: 20,
    COMPLETE_DAILY_QUEST: 50,
    RATE_DAILY_GAME_LIKED: 10,
    RATE_DAILY_GAME_DISLIKED: 10,
    RATE_DAILY_GAME_WISHLIST: 5
};

const LEVEL_TITLES = {
    1: '桌遊新手',
    2: '見習玩家',
    3: '資深玩家',
    5: '遊戲專家',
    10: '社群達人',
    20: '傳奇玩家',
    50: '桌遊宗師'
};

// ========================================
// 經驗值計算函數
// ========================================

/**
 * 根據總 XP 計算等級
 */
function calculateLevel(totalXP) {
    let level = 1;
    let requiredXP = 0;
    
    while (totalXP >= requiredXP) {
        level++;
        requiredXP = getLevelRequiredXP(level);
        if (totalXP < requiredXP) {
            return level - 1;
        }
    }
    
    return level;
}

/**
 * 獲取升到指定等級所需的總 XP
 */
function getLevelRequiredXP(level) {
    if (level <= 1) return 0;
    
    let total = 0;
    for (let i = 2; i <= level; i++) {
        total += Math.floor(100 * Math.pow(1.2, i - 1));
    }
    return total;
}

/**
 * 獲取當前等級的稱號
 */
function getLevelTitle(level) {
    // 找到最接近但不超過的等級稱號
    const levels = Object.keys(LEVEL_TITLES).map(Number).sort((a, b) => b - a);
    for (const l of levels) {
        if (level >= l) {
            return LEVEL_TITLES[l];
        }
    }
    return LEVEL_TITLES[1];
}

/**
 * 獲取當前等級進度資訊
 */
function getLevelProgress(totalXP) {
    const currentLevel = calculateLevel(totalXP);
    const currentLevelXP = getLevelRequiredXP(currentLevel);
    const nextLevelXP = getLevelRequiredXP(currentLevel + 1);
    const xpInCurrentLevel = totalXP - currentLevelXP;
    const xpNeededForNextLevel = nextLevelXP - currentLevelXP;
    const progress = (xpInCurrentLevel / xpNeededForNextLevel) * 100;
    
    return {
        level: currentLevel,
        title: getLevelTitle(currentLevel),
        totalXP,
        currentLevelXP,
        nextLevelXP,
        xpInCurrentLevel,
        xpNeededForNextLevel,
        progress: Math.min(progress, 100)
    };
}

// ========================================
// 使用者統計資料管理
// ========================================

/**
 * 獲取或建立使用者統計資料
 */
async function getUserStats(userId) {
    try {
        const response = await fetch(`tables/user_stats?limit=1000`);
        const data = await response.json();
        
        const userStats = data.data.find(stat => stat.user_id === userId);
        
        if (userStats) {
            return userStats;
        } else {
            // 建立新的統計資料
            return await createUserStats(userId);
        }
    } catch (error) {
        console.error('Error getting user stats:', error);
        return null;
    }
}

/**
 * 建立新的使用者統計資料
 */
async function createUserStats(userId) {
    const newStats = {
        user_id: userId,
        xp: 0,
        level: 1,
        total_xp: 0,
        unlocked_badges: [],
        daily_quest_completed: [],
        last_quest_reset: new Date().toISOString(),
        streak_days: 0,
        last_login: new Date().toISOString(),
        total_contributions: 0,
        weekly_contributions: 0,
        last_weekly_reset: new Date().toISOString()
    };
    
    try {
        const response = await fetch('tables/user_stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newStats)
        });
        
        return await response.json();
    } catch (error) {
        console.error('Error creating user stats:', error);
        return null;
    }
}

/**
 * 更新使用者統計資料（GET + 清系統欄位 + serialize + PUT）
 */
async function updateUserStats(statsId, updates) {
    try {
        if (typeof safePatch !== 'undefined') {
            return await safePatch(`tables/user_stats/${statsId}`, updates);
        }
        // 備援
        const sys = ['gs_project_id','gs_table_name','gs_created_at','gs_updated_at',
                     'created_at','updated_at','deleted','deleted_at','_rid','_id','__rid','__id'];
        const g = await fetch(`tables/user_stats/${statsId}`);
        const ex = g.ok ? await g.json() : {};
        const cleaned = Object.fromEntries(Object.entries(ex).filter(([k]) => !sys.includes(k)));
        const merged = { ...cleaned, ...updates };
        const s = {};
        for (const [k,v] of Object.entries(merged)) {
            s[k] = (v !== null && v !== undefined && typeof v === 'object') ? JSON.stringify(v) : v;
        }
        const r = await fetch(`tables/user_stats/${statsId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(s)
        });
        return await r.json();
    } catch (error) {
        console.error('Error updating user stats:', error);
        return null;
    }
}

// ========================================
// XP 獲得與動畫
// ========================================

/**
 * 獲得 XP 並顯示動畫
 */
async function gainXP(userId, amount, x, y) {
    // 顯示浮動 XP 文字
    showFloatingXP(amount, x, y);
    
    // 獲取當前統計
    let userStats = await getUserStats(userId);
    if (!userStats) return;
    
    // 記錄升級前等級
    const oldLevel = userStats.level || 1;
    
    // 更新 XP
    userStats.total_xp = (userStats.total_xp || 0) + amount;
    userStats.xp = userStats.total_xp;
    
    // 計算新等級
    const newLevel = calculateLevel(userStats.total_xp);
    userStats.level = newLevel;
    
    // 更新到資料庫
    await updateUserStats(userStats.id, userStats);
    
    // ✅ 同步快取到 localStorage，下次開頁可即時顯示
    try {
        localStorage.setItem('userStats_cache', JSON.stringify({
            user_id: userId,
            total_xp: userStats.total_xp,
            level: newLevel,
            cached_at: Date.now()
        }));
    } catch(e) { /* localStorage 寫入失敗不影響主流程 */ }
    
    // 更新 UI
    updateXPDisplay(userStats);
    
    // 檢查是否升級
    if (newLevel > oldLevel) {
        showLevelUpAnimation(oldLevel, newLevel);
    }
    
    // 成就檢查由外部（profile.html）統一呼叫，gainXP 不再重複觸發，避免遞迴 API 請求
    
    return userStats;
}

/**
 * 顯示浮動 XP 文字動畫
 */
function showFloatingXP(amount, x, y) {
    const xpFloat = document.createElement('div');
    xpFloat.className = 'xp-float';
    xpFloat.textContent = `+${amount} XP`;
    xpFloat.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        font-size: 1.5rem;
        font-weight: bold;
        color: #ffc107;
        pointer-events: none;
        z-index: 10000;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        animation: floatUp 1.5s ease-out forwards;
    `;
    
    document.body.appendChild(xpFloat);
    
    setTimeout(() => {
        xpFloat.remove();
    }, 1500);
}

/**
 * 更新 XP 顯示
 */
function updateXPDisplay(userStats) {
    const progress = getLevelProgress(userStats.total_xp);
    
    // 更新等級顯示
    const levelBadge = document.getElementById('user-level');
    if (levelBadge) {
        levelBadge.textContent = `Lv.${progress.level} ${progress.title}`;
    }
    
    // 更新 XP 顯示
    const xpDisplay = document.getElementById('user-xp');
    if (xpDisplay) {
        xpDisplay.textContent = `${progress.xpInCurrentLevel} / ${progress.xpNeededForNextLevel} XP`;
    }
    
    // 更新進度條
    const xpBar = document.getElementById('xp-progress-bar');
    if (xpBar) {
        xpBar.style.width = `${progress.progress}%`;
        xpBar.textContent = `${Math.round(progress.progress)}%`;
    }
}

/**
 * 顯示升級動畫
 */
function showLevelUpAnimation(oldLevel, newLevel) {
    const modal = document.createElement('div');
    modal.className = 'level-up-modal';
    modal.innerHTML = `
        <div class="level-up-content">
            <div class="level-up-icon">⭐</div>
            <div class="level-up-title">升級了！</div>
            <div class="level-up-text">
                Lv.${oldLevel} → Lv.${newLevel}
            </div>
            <div class="level-up-subtitle">
                現在是「${getLevelTitle(newLevel)}」！
            </div>
            <button class="level-up-btn" onclick="this.closest('.level-up-modal').remove()">
                太棒了！
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// ========================================
// 成就系統
// ========================================

/**
 * 檢查並解鎖成就（已廢棄，統一轉發給 app.js 的 GameMBTI.checkAndUnlockAchievements）
 * 保留此函數避免舊呼叫點報錯
 */
async function checkAchievements(userId, userStats) {
    if (window.GameMBTI && GameMBTI.checkAndUnlockAchievements) {
        return GameMBTI.checkAndUnlockAchievements(userId);
    }
}

/**
 * 解鎖成就
 */
async function unlockAchievement(userId, userStats, achievement) {
    // 更新已解鎖徽章列表
    const unlockedBadges = userStats.unlocked_badges || [];
    unlockedBadges.push(achievement.id);
    
    userStats.unlocked_badges = unlockedBadges;
    await updateUserStats(userStats.id, userStats);
    
    // 顯示解鎖動畫
    showAchievementUnlockAnimation(achievement);
    
    // 給予額外 XP（根據稀有度）
    const bonusXP = {
        'common': 10,
        'rare': 25,
        'epic': 50,
        'legendary': 100,
        'mythic': 200
    };
    
    const xp = bonusXP[achievement.rarity] || 10;
    await gainXP(userId, xp, window.innerWidth / 2, window.innerHeight / 2);
}

/**
 * 顯示成就解鎖動畫
 */
function showAchievementUnlockAnimation(achievement) {
    const modal = document.createElement('div');
    modal.className = 'achievement-modal';
    modal.innerHTML = `
        <div class="achievement-content">
            <div class="achievement-icon">${achievement.icon}</div>
            <div class="achievement-title">🎉 解鎖新徽章！</div>
            <div class="achievement-name">${achievement.name_zh}</div>
            <div class="achievement-desc">${achievement.description}</div>
            <div class="achievement-rarity rarity-${achievement.rarity}">
                ${getRarityName(achievement.rarity)}
            </div>
            <button class="achievement-btn" onclick="this.closest('.achievement-modal').remove()">
                太棒了！
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
}

/**
 * 獲取稀有度中文名稱
 */
function getRarityName(rarity) {
    const names = {
        'common': '普通',
        'rare': '稀有',
        'epic': '史詩',
        'legendary': '傳說',
        'mythic': '神話'
    };
    return names[rarity] || '普通';
}

// ========================================
// 每日任務系統
// ========================================

/**
 * 檢查並重置每日任務
 */
async function checkDailyQuestReset(userStats) {
    const now = new Date();
    const lastReset = new Date(userStats.last_quest_reset || now);
    
    // 如果是新的一天，重置任務
    if (now.toDateString() !== lastReset.toDateString()) {
        userStats.daily_quest_completed = [];
        userStats.last_quest_reset = now.toISOString();
        await updateUserStats(userStats.id, userStats);
    }
    
    return userStats;
}

/**
 * 完成每日任務
 */
async function completeDailyQuest(userId, questId) {
    let userStats = await getUserStats(userId);
    if (!userStats) return;
    
    // 檢查重置
    userStats = await checkDailyQuestReset(userStats);
    
    // 檢查是否已完成
    const completed = userStats.daily_quest_completed || [];
    if (completed.includes(questId)) {
        return userStats; // 已完成，不重複獎勵
    }
    
    // 獲取任務定義
    const questsResponse = await fetch('tables/daily_quests?limit=100');
    const questsData = await questsResponse.json();
    const quest = questsData.data.find(q => q.id === questId);
    
    if (!quest) return userStats;
    
    // 標記為已完成
    completed.push(questId);
    userStats.daily_quest_completed = completed;
    await updateUserStats(userStats.id, userStats);
    
    // 給予 XP
    await gainXP(userId, quest.reward_xp, window.innerWidth / 2, window.innerHeight / 2);
    
    // 檢查是否完成所有任務
    const allQuests = questsData.data.filter(q => q.is_active);
    if (completed.length === allQuests.length) {
        // 額外獎勵
        await gainXP(userId, 50, window.innerWidth / 2, window.innerHeight / 2);
        showMessage('🎉 完成所有每日任務！獲得額外 50 XP！', 'success');
    }
    
    return userStats;
}

/**
 * 獲取每日任務進度
 */
async function getDailyQuestProgress(userId) {
    const userStats = await getUserStats(userId);
    if (!userStats) return [];
    
    // 檢查重置
    await checkDailyQuestReset(userStats);
    
    // 獲取所有任務
    const questsResponse = await fetch('tables/daily_quests?limit=100');
    const questsData = await questsResponse.json();
    const allQuests = questsData.data.filter(q => q.is_active);
    
    // 組合進度資訊
    const completed = userStats.daily_quest_completed || [];
    
    return allQuests.map(quest => ({
        ...quest,
        completed: completed.includes(quest.id),
        progress: completed.includes(quest.id) ? quest.target_count : 0,
        target: quest.target_count
    }));
}

// ========================================
// 工具函數
// ========================================

/**
 * 顯示訊息提示
 */
function showMessage(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#667eea'};
        color: white;
        border-radius: 0.5rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ========================================
// 初始化
// ========================================

/**
 * 初始化遊戲化系統
 */
async function initGamification(userId) {
    if (!userId) return;
    
    // 獲取或建立使用者統計
    let userStats = await getUserStats(userId);
    
    // 更新登入時間和連續天數
    userStats = await updateLoginStreak(userStats);
    
    // 更新顯示
    updateXPDisplay(userStats);
    
    // 檢查每日任務重置
    await checkDailyQuestReset(userStats);
    
    // 返回統計資料
    return userStats;
}

/**
 * 更新登入連續天數
 */
async function updateLoginStreak(userStats) {
    const now = new Date();
    const lastLogin = new Date(userStats.last_login || now);
    
    const daysDiff = Math.floor((now - lastLogin) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 1) {
        // 連續登入
        userStats.streak_days = (userStats.streak_days || 0) + 1;
    } else if (daysDiff > 1) {
        // 中斷連續
        userStats.streak_days = 1;
    }
    // daysDiff === 0 表示今天已登入，不變
    
    userStats.last_login = now.toISOString();
    await updateUserStats(userStats.id, userStats);
    
    return userStats;
}

// ========================================
// 匯出 API
// ========================================

window.Gamification = {
    // XP 系統
    XP_RULES,
    calculateLevel,
    getLevelRequiredXP,
    getLevelTitle,
    getLevelProgress,
    gainXP,
    updateXPDisplay,
    
    // 統計管理
    getUserStats,
    createUserStats,
    updateUserStats,
    
    // 成就系統
    checkAchievements,
    unlockAchievement,
    
    // 每日任務
    checkDailyQuestReset,
    completeDailyQuest,
    getDailyQuestProgress,
    
    // 工具函數
    showMessage,
    showFloatingXP,
    showLevelUpAnimation,
    showAchievementUnlockAnimation,
    
    // 初始化
    initGamification
};
