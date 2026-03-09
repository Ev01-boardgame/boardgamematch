/**
 * 前台管理員連結顯示系統 v2.2
 * 功能：在所有頁面自動檢查使用者是否為管理員，並顯示後台管理連結
 * 優化：使用快取機制，避免每次都查詢 API
 */

(function() {
    'use strict';
    
    // 配置
    const CONFIG = {
        CACHE_KEY: 'admin_check_cache',
        CACHE_DURATION: 30 * 60 * 1000, // 30 分鐘快取
        SUPER_ADMIN_ID: '101279808163813574015' // 與 admin-auth.js 同步
    };
    
    // 快取管理
    const AdminCache = {
        // 儲存快取
        save: function(userId, isAdmin, role) {
            const cache = {
                userId: userId,
                isAdmin: isAdmin,
                role: role,
                timestamp: Date.now()
            };
            localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(cache));
            console.log('[Admin Link Cache] 已儲存快取:', cache);
        },
        
        // 讀取快取
        get: function(userId) {
            try {
                const cached = localStorage.getItem(CONFIG.CACHE_KEY);
                if (!cached) return null;
                
                const cache = JSON.parse(cached);
                
                // 檢查是否為同一個使用者
                if (cache.userId !== userId) {
                    console.log('[Admin Link Cache] 使用者已變更，清除快取');
                    this.clear();
                    return null;
                }
                
                // 檢查是否過期
                const age = Date.now() - cache.timestamp;
                if (age > CONFIG.CACHE_DURATION) {
                    console.log('[Admin Link Cache] 快取已過期 (', Math.round(age / 1000 / 60), '分鐘)');
                    this.clear();
                    return null;
                }
                
                console.log('[Admin Link Cache] ✅ 使用快取 (剩餘:', Math.round((CONFIG.CACHE_DURATION - age) / 1000 / 60), '分鐘)');
                return cache;
            } catch (e) {
                console.error('[Admin Link Cache] 讀取快取失敗:', e);
                return null;
            }
        },
        
        // 清除快取
        clear: function() {
            localStorage.removeItem(CONFIG.CACHE_KEY);
        }
    };
    
    // 等待 AdminAuth 載入
    function waitForAdminAuth(callback) {
        if (typeof window.AdminAuth !== 'undefined') {
            callback();
        } else {
            setTimeout(() => waitForAdminAuth(callback), 100);
        }
    }
    
    // 快速檢查（不需要 API）
    function quickCheck(user) {
        // 檢查是否為超級管理員（寫死在程式碼中）
        if (user.sub === CONFIG.SUPER_ADMIN_ID) {
            console.log('[Admin Link] 🚀 快速檢查：超級管理員');
            return { isAdmin: true, role: 'super_admin' };
        }
        return null;
    }
    
    // 檢查並顯示管理員連結
    async function checkAndShowAdminLink() {
        // 取得當前登入的使用者
        const savedUser = localStorage.getItem('googleUser');
        if (!savedUser) {
            console.log('[Admin Link] 使用者未登入');
            return;
        }
        
        try {
            const user = JSON.parse(savedUser);
            const userId = user.sub;
            
            // 1️⃣ 快速檢查：是否為超級管理員
            const quickResult = quickCheck(user);
            if (quickResult) {
                addAdminLinkToNavbar(quickResult.role);
                // 同時儲存快取
                AdminCache.save(userId, true, quickResult.role);
                return;
            }
            
            // 2️⃣ 檢查快取
            const cached = AdminCache.get(userId);
            if (cached) {
                if (cached.isAdmin) {
                    console.log('[Admin Link] ✅ 使用快取：管理員 (角色:', cached.role, ')');
                    addAdminLinkToNavbar(cached.role);
                } else {
                    console.log('[Admin Link] ✅ 使用快取：非管理員');
                }
                return;
            }
            
            // 3️⃣ 快取失效或不存在，進行完整檢查
            console.log('[Admin Link] 🔍 執行完整管理員檢查:', user.email);
            
            // 等待 AdminAuth 載入
            waitForAdminAuth(async () => {
                try {
                    // 使用 AdminAuth 檢查是否為管理員
                    const authResult = await window.AdminAuth.checkIsAdmin(user.sub, user.email);
                    
                    // 儲存快取
                    AdminCache.save(userId, authResult.isAdmin, authResult.role || null);
                    
                    if (authResult.isAdmin) {
                        console.log('[Admin Link] ✅ 使用者是管理員，角色:', authResult.role);
                        addAdminLinkToNavbar(authResult.role);
                    } else {
                        console.log('[Admin Link] ℹ️ 使用者不是管理員');
                    }
                } catch (error) {
                    console.error('[Admin Link] 檢查管理員權限失敗:', error);
                }
            });
            
        } catch (error) {
            console.error('[Admin Link] 解析使用者資料失敗:', error);
        }
    }
    
    // 在導覽列加入後台管理連結
    function addAdminLinkToNavbar(role) {
        const navbar = document.querySelector('.navbar-menu');
        if (!navbar) {
            console.warn('[Admin Link] 找不到導覽列');
            return;
        }
        
        // 檢查是否已經有後台連結
        if (document.getElementById('admin-nav-link')) {
            console.log('[Admin Link] 後台連結已存在');
            return;
        }
        
        // 建立後台連結
        const adminItem = document.createElement('li');
        adminItem.id = 'admin-nav-link';
        
        const roleTitle = role === 'super_admin' ? '後台管理 (超級管理員)' : '後台管理 (管理員)';
        
        adminItem.innerHTML = `
            <a href="admin.html" title="${roleTitle}">
                後台管理
            </a>
        `;
        
        navbar.appendChild(adminItem);
        
        console.log('[Admin Link] ✅ 已顯示後台管理連結 (角色: ' + role + ')');
    }
    
    // 當 DOM 載入完成時執行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAndShowAdminLink);
    } else {
        checkAndShowAdminLink();
    }
    
    // 監聽登入事件（如果頁面有 Google 登入）
    window.addEventListener('load', () => {
        // 稍後再檢查一次，確保使用者資料已更新
        setTimeout(checkAndShowAdminLink, 1000);
    });
    
    // 監聽登出事件，清除快取
    window.addEventListener('beforeunload', () => {
        const savedUser = localStorage.getItem('googleUser');
        if (!savedUser) {
            // 使用者已登出，清除快取
            AdminCache.clear();
        }
    });
    
    // 匯出 API 供其他腳本使用
    window.AdminLinkCache = {
        clear: AdminCache.clear,
        refresh: checkAndShowAdminLink
    };
    
})();
