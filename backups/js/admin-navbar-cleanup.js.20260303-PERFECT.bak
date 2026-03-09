/**
 * 後台導覽列清理腳本 v1.2 - 終極版
 * 功能：移除後台頁面導覽列中的前台使用者資訊（頭像、暱稱、登出按鈕）
 * 保留：⭐後台管理按鈕
 * 策略：強制且持續性地移除不需要的元素（不論有無 ID）
 */

(function() {
    'use strict';
    
    // 只在後台頁面執行
    const isAdminPage = window.location.pathname.includes('admin');
    if (!isAdminPage) {
        return;
    }
    
    console.log('[Admin Navbar Cleanup] 🧹 啟動後台導覽列清理系統 v1.3');
    
    // 🔥 額外清理：移除首頁的登入後容器（防止誤載入）
    function removeHomePageElements() {
        const elementsToRemove = [
            'logged-in-container',  // 首頁的登入後顯示區
            'user-avatar',           // 使用者頭像
            'user-name',             // 使用者名稱
            'user-mbti'              // 使用者 MBTI
        ];
        
        elementsToRemove.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                console.log(`[Admin Navbar Cleanup] 🗑️ 移除首頁元素: ${id}`);
                element.remove();
            }
        });
    }
    
    // 立即執行首頁元素清理
    removeHomePageElements();
    
    // 移除使用者資訊元素的函數
    function removeUserInfo() {
        let removed = false;
        const navbar = document.querySelector('.navbar-menu');
        
        if (!navbar) {
            return false;
        }
        
        // 方法 1：移除有特定 ID 的元素
        const idsToRemove = [
            'navbar-user-info', 
            'navbar-user-avatar', 
            'navbar-user-name', 
            'navbar-logout-btn',
            'admin-logout-btn'  // 🔥 新增：後台登出按鈕
        ];
        idsToRemove.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                console.log(`[Admin Navbar Cleanup] ❌ 移除 ${id}`);
                const parent = element.closest('li');
                if (parent) {
                    parent.remove();
                } else {
                    element.remove();
                }
                removed = true;
            }
        });
        
        // 方法 2：檢查所有 li 元素，根據內容移除
        const liElements = Array.from(navbar.querySelectorAll('li'));
        liElements.forEach(li => {
            const text = li.textContent.trim();
            const hasButton = li.querySelector('button');
            const hasImg = li.querySelector('img');
            
            // 移除包含「登出」的元素（但保留「後台管理」）
            if (text.includes('登出') && !text.includes('後台管理')) {
                console.log(`[Admin Navbar Cleanup] ❌ 移除登出按鈕: "${text}"`);
                li.remove();
                removed = true;
                return;
            }
            
            // 移除包含頭像的元素（檢查 alt 屬性）
            if (hasImg) {
                const img = li.querySelector('img');
                if (img && (img.alt === '頭像' || img.src.includes('googleusercontent.com'))) {
                    console.log(`[Admin Navbar Cleanup] ❌ 移除包含頭像的元素`);
                    li.remove();
                    removed = true;
                    return;
                }
            }
            
            // 移除看起來像使用者名稱的元素
            // 特徵：不是連結，文字短，不包含特殊字元，不是管理按鈕
            const hasLink = li.querySelector('a');
            if (!hasLink && !hasButton && text.length > 0 && text.length < 20 && !text.includes('⭐')) {
                // 排除基本導覽項目
                const basicItems = ['回到首頁', '玩家數據', '桌遊探索', '貢獻排行', '我的檔案', '管理後台'];
                if (!basicItems.includes(text)) {
                    console.log(`[Admin Navbar Cleanup] ❌ 移除疑似使用者名稱的元素: "${text}"`);
                    li.remove();
                    removed = true;
                    return;
                }
            }
            
            // 移除包含特定 ID 的子元素
            if (li.querySelector('#navbar-user-avatar') ||
                li.querySelector('#navbar-user-name') ||
                li.querySelector('#navbar-logout-btn') ||
                li.id === 'navbar-user-info') {
                console.log(`[Admin Navbar Cleanup] ❌ 移除包含使用者資訊 ID 的元素`);
                li.remove();
                removed = true;
                return;
            }
        });
        
        if (removed) {
            console.log('[Admin Navbar Cleanup] ✅ 清理完成');
        }
        
        return removed;
    }
    
    // 立即執行清理
    removeUserInfo();
    
    // 延遲清理（多次執行確保完全清理）
    const delays = [50, 100, 200, 300, 500, 800, 1000, 1500, 2000];
    delays.forEach(delay => {
        setTimeout(removeUserInfo, delay);
    });
    
    // DOM 載入後再執行一次
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('[Admin Navbar Cleanup] 📋 DOM 載入完成，執行清理');
            removeUserInfo();
        });
    }
    
    // 頁面完全載入後再執行一次
    window.addEventListener('load', () => {
        console.log('[Admin Navbar Cleanup] 🎬 頁面載入完成，執行清理');
        removeUserInfo();
        // 再延遲幾次確保
        setTimeout(removeUserInfo, 500);
        setTimeout(removeUserInfo, 1000);
        setTimeout(removeUserInfo, 2000);
    });
    
    // 監聽 DOM 變化，如果有新元素加入則立即移除
    const observer = new MutationObserver((mutations) => {
        let needsCleanup = false;
        
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // 元素節點
                    // 檢查是否為使用者資訊元素
                    const text = node.textContent ? node.textContent.trim() : '';
                    
                    if (node.id === 'navbar-user-info' || 
                        node.id === 'navbar-user-avatar' || 
                        node.id === 'navbar-user-name' || 
                        node.id === 'navbar-logout-btn' ||
                        text.includes('登出')) {
                        console.log('[Admin Navbar Cleanup] 🚨 偵測到新增使用者資訊元素');
                        needsCleanup = true;
                    }
                    
                    // 檢查子元素
                    if (node.querySelector) {
                        if (node.querySelector('#navbar-user-info') ||
                            node.querySelector('#navbar-user-avatar') ||
                            node.querySelector('#navbar-user-name') ||
                            node.querySelector('#navbar-logout-btn') ||
                            node.querySelector('img[alt="頭像"]')) {
                            console.log('[Admin Navbar Cleanup] 🚨 偵測到包含使用者資訊的新元素');
                            needsCleanup = true;
                        }
                    }
                }
            });
        });
        
        if (needsCleanup) {
            // 稍微延遲後執行清理，確保元素已完全加入
            setTimeout(removeUserInfo, 10);
            setTimeout(removeUserInfo, 50);
            setTimeout(removeUserInfo, 100);
        }
    });
    
    // 開始監聽整個 body
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('[Admin Navbar Cleanup] ✅ 清理系統已啟動並持續監聽');
    
})();
