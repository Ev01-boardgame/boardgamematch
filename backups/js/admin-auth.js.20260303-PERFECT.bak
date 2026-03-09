/**
 * 後台管理員驗證系統 v2.0
 * 功能：基於 Google OAuth 的管理員白名單驗證
 */

// ========== 配置 ==========
const ADMIN_AUTH_CONFIG = {
    // 超級管理員的 Google ID（您的帳號）
    // 這是寫死在程式碼中的，永遠有權限
    SUPER_ADMIN_GOOGLE_ID: '101279808163813574015', // 請替換為您的 Google ID
    
    // 驗證狀態儲存時間（毫秒）- 預設 4 小時
    SESSION_DURATION: 4 * 60 * 60 * 1000,
    
    // localStorage 金鑰
    STORAGE_ADMIN_KEY: 'admin_auth_verified',
    STORAGE_TIME_KEY: 'admin_auth_time',
    STORAGE_USER_KEY: 'admin_user_info'
};

// ========== 全域狀態 ==========
let currentAdminUser = null;
let adminWhitelist = [];

// ========== 工具函數 ==========
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('JWT 解析失敗:', e);
        return null;
    }
}

// ========== API 函數 ==========
async function loadAdminWhitelist() {
    try {
        const response = await fetch('tables/admin_whitelist?limit=1000');
        const data = await response.json();
        adminWhitelist = data.data || [];
        console.log('✅ 已載入管理員白名單:', adminWhitelist.length, '位管理員');
        return adminWhitelist;
    } catch (error) {
        console.error('❌ 載入管理員白名單失敗:', error);
        return [];
    }
}

async function checkIsAdmin(googleId, email) {
    // 1. 檢查是否為超級管理員（寫死在程式碼中）
    if (googleId === ADMIN_AUTH_CONFIG.SUPER_ADMIN_GOOGLE_ID) {
        console.log('✅ 超級管理員驗證通過');
        return { isAdmin: true, role: 'super_admin', source: 'hardcoded' };
    }
    
    // 2. 從白名單資料表檢查
    await loadAdminWhitelist();
    
    const adminUser = adminWhitelist.find(admin => 
        (admin.google_id === googleId || admin.email === email) && 
        admin.is_active !== false
    );
    
    if (adminUser) {
        console.log('✅ 白名單管理員驗證通過:', adminUser.nickname || adminUser.email);
        
        // 更新最後訪問時間，同時補上 google_id（若原本是空的）
        try {
            const patch = { last_access: Date.now() };
            if (!adminUser.google_id && googleId) {
                patch.google_id = googleId;
                console.log('🔧 自動補上 google_id:', googleId);
            }
            await fetch(`tables/admin_whitelist/${adminUser.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch)
            });
        } catch (e) {
            console.warn('更新最後訪問時間失敗:', e);
        }
        
        return { 
            isAdmin: true, 
            role: adminUser.role || 'admin', 
            source: 'whitelist',
            adminData: adminUser
        };
    }
    
    console.log('❌ 非管理員用戶');
    return { isAdmin: false };
}

async function addAdminToWhitelist(googleUser, addedBy, notes = '') {
    try {
        const newAdmin = {
            google_id: googleUser.sub,
            email: googleUser.email,
            nickname: googleUser.name,
            picture: googleUser.picture,
            role: 'admin',
            added_by: addedBy,
            added_at: Date.now(),
            last_access: Date.now(),
            is_active: true,
            notes: notes
        };
        
        const response = await fetch('tables/admin_whitelist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newAdmin)
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ 新增管理員成功:', data);
            await loadAdminWhitelist(); // 重新載入白名單
            return { success: true, data };
        } else {
            throw new Error('API 回應失敗');
        }
    } catch (error) {
        console.error('❌ 新增管理員失敗:', error);
        return { success: false, error: error.message };
    }
}

async function removeAdminFromWhitelist(adminId) {
    try {
        const response = await fetch(`tables/admin_whitelist/${adminId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            console.log('✅ 移除管理員成功');
            await loadAdminWhitelist(); // 重新載入白名單
            return { success: true };
        } else {
            throw new Error('API 回應失敗');
        }
    } catch (error) {
        console.error('❌ 移除管理員失敗:', error);
        return { success: false, error: error.message };
    }
}

// ========== 驗證狀態管理 ==========
function saveAuthState(user, authResult) {
    localStorage.setItem(ADMIN_AUTH_CONFIG.STORAGE_ADMIN_KEY, 'verified');
    localStorage.setItem(ADMIN_AUTH_CONFIG.STORAGE_TIME_KEY, Date.now().toString());
    localStorage.setItem(ADMIN_AUTH_CONFIG.STORAGE_USER_KEY, JSON.stringify({
        ...user,
        role: authResult.role,
        source: authResult.source
    }));
    currentAdminUser = user;
}

function clearAuthState() {
    localStorage.removeItem(ADMIN_AUTH_CONFIG.STORAGE_ADMIN_KEY);
    localStorage.removeItem(ADMIN_AUTH_CONFIG.STORAGE_TIME_KEY);
    localStorage.removeItem(ADMIN_AUTH_CONFIG.STORAGE_USER_KEY);
    currentAdminUser = null;
}

function isAuthStateValid() {
    const verified = localStorage.getItem(ADMIN_AUTH_CONFIG.STORAGE_ADMIN_KEY);
    const time = localStorage.getItem(ADMIN_AUTH_CONFIG.STORAGE_TIME_KEY);
    const userInfo = localStorage.getItem(ADMIN_AUTH_CONFIG.STORAGE_USER_KEY);
    
    if (verified !== 'verified' || !time || !userInfo) {
        return false;
    }
    
    const authTime = parseInt(time, 10);
    const now = Date.now();
    
    // 檢查是否過期
    if (now - authTime > ADMIN_AUTH_CONFIG.SESSION_DURATION) {
        clearAuthState();
        return false;
    }
    
    try {
        currentAdminUser = JSON.parse(userInfo);
        return true;
    } catch (e) {
        clearAuthState();
        return false;
    }
}

// ========== UI 函數 ==========
function showAdminLoginPrompt() {
    // 建立遮罩層
    const overlay = document.createElement('div');
    overlay.id = 'admin-login-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        backdrop-filter: blur(5px);
    `;
    
    // 建立登入卡片
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        padding: 3rem;
        border-radius: 1rem;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        max-width: 450px;
        width: 90%;
        animation: slideDown 0.3s ease-out;
        text-align: center;
    `;
    
    modal.innerHTML = `
        <style>
            @keyframes slideDown {
                from {
                    opacity: 0;
                    transform: translateY(-50px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        </style>
        
        <div style="text-align: center; margin-bottom: 2rem;">
            <div style="font-size: 4rem; margin-bottom: 1rem;">🔐</div>
            <h2 style="margin: 0; color: #1f2937; font-size: 1.5rem; margin-bottom: 0.5rem;">管理後台驗證</h2>
            <p style="margin: 0.5rem 0; color: #6b7280; font-size: 0.95rem; line-height: 1.6;">
                只有授權的管理員才能訪問此頁面<br>
                請使用您的 Google 帳號登入
            </p>
        </div>
        
        <div id="admin-google-signin" style="margin: 2rem 0;"></div>
        
        <div id="admin-login-status" style="display: none; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem; font-size: 0.9rem;"></div>
        
        <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #9ca3af; font-size: 0.85rem; line-height: 1.6;">
                🔒 您的帳號需要在管理員白名單中<br>
                如需開通權限，請聯繫超級管理員
            </p>
        </div>
        
        <div style="margin-top: 1rem; text-align: center;">
            <a href="index.html" style="color: #6b7280; text-decoration: none; font-size: 0.9rem;">
                ← 返回首頁
            </a>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // 初始化 Google Sign-In
    setTimeout(() => {
        if (typeof google !== 'undefined' && google.accounts) {
            google.accounts.id.initialize({
                client_id: '105319270176-djqr0n6r4l3mvmpalsqjn8kasqii9ukt.apps.googleusercontent.com',
                callback: handleAdminGoogleLogin
            });
            
            google.accounts.id.renderButton(
                document.getElementById('admin-google-signin'),
                { 
                    theme: 'filled_blue', 
                    size: 'large',
                    text: 'signin_with',
                    width: 300
                }
            );
        } else {
            console.error('Google Sign-In SDK 未載入');
            showLoginStatus('❌ 無法載入登入系統，請重新整理頁面', true);
        }
    }, 500);
}

function showLoginStatus(message, isError = false) {
    const statusEl = document.getElementById('admin-login-status');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.style.display = 'block';
        statusEl.style.background = isError ? '#fee2e2' : '#d1fae5';
        statusEl.style.color = isError ? '#991b1b' : '#065f46';
    }
}

async function handleAdminGoogleLogin(response) {
    showLoginStatus('⏳ 驗證中...', false);
    
    try {
        const credential = response.credential;
        const payload = parseJwt(credential);
        
        if (!payload) {
            throw new Error('無法解析 Google 登入資訊');
        }
        
        console.log('Google 登入成功，檢查管理員權限...');
        
        // 檢查是否為管理員
        const authResult = await checkIsAdmin(payload.sub, payload.email);
        
        if (authResult.isAdmin) {
            // 是管理員，儲存驗證狀態
            saveAuthState(payload, authResult);
            
            showLoginStatus('✅ 驗證成功！正在進入後台...', false);
            
            // 移除遮罩並觸發驗證完成事件
            setTimeout(() => {
                const overlay = document.getElementById('admin-login-overlay');
                if (overlay) {
                    overlay.style.opacity = '0';
                    overlay.style.transition = 'opacity 0.3s ease';
                    setTimeout(() => {
                        overlay.remove();
                        document.dispatchEvent(new CustomEvent('adminAuthenticated', {
                            detail: { user: payload, role: authResult.role }
                        }));
                    }, 300);
                }
            }, 1000);
        } else {
            // 不是管理員
            showLoginStatus(`❌ 權限不足\n您的帳號（${payload.email}）不在管理員白名單中`, true);
            
            // 3 秒後清除訊息
            setTimeout(() => {
                const statusEl = document.getElementById('admin-login-status');
                if (statusEl) statusEl.style.display = 'none';
            }, 5000);
        }
    } catch (error) {
        console.error('❌ 登入失敗:', error);
        showLoginStatus('❌ 登入失敗: ' + error.message, true);
    }
}

// addAdminLogoutButton() 已移除
// 後台不再需要特殊的登出按鈕

// ========== 主要驗證函數 ==========
async function checkAdminAuth() {
    // 檢查當前頁面是否為 admin 頁面
    const isAdminPage = window.location.pathname.includes('admin');
    
    if (!isAdminPage) {
        return; // 不是 admin 頁面，不需要驗證
    }
    
    console.log('🔍 檢查管理員權限...');
    
    // 檢查驗證狀態（localStorage 快取）
    if (isAuthStateValid()) {
        console.log('✅ 已驗證，管理員:', currentAdminUser.name);
        _showAdminBody();
        // 觸發 adminAuthenticated 事件（供各頁面判斷角色）
        setTimeout(() => {
            document.dispatchEvent(new CustomEvent('adminAuthenticated', {
                detail: { user: currentAdminUser, role: currentAdminUser.role }
            }));
        }, 0);
        return;
    }
    
    // 檢查是否有前台的 Google 登入狀態
    const frontendUser = localStorage.getItem('googleUser');
    if (frontendUser) {
        try {
            const user = JSON.parse(frontendUser);
            console.log('🔍 檢測到前台登入狀態，驗證管理員權限...');
            
            // 檢查是否為管理員
            const authResult = await checkIsAdmin(user.sub, user.email);
            
            if (authResult.isAdmin) {
                console.log('✅ 前台使用者是管理員，自動登入後台');
                saveAuthState(user, authResult);
                _showAdminBody();
                setTimeout(() => {
                    document.dispatchEvent(new CustomEvent('adminAuthenticated', {
                        detail: { user: currentAdminUser, role: authResult.role }
                    }));
                }, 0);
                return;
            } else {
                console.log('❌ 前台使用者不是管理員');
            }
        } catch (error) {
            console.error('❌ 前台登入狀態驗證失敗:', error);
        }
    }
    
    // 未驗證 → 顯示 Google 登入 overlay（body 此時仍隱藏，overlay 顯示後才 visible）
    console.log('❌ 未驗證，顯示登入畫面');
    _showAdminBody();
    showAdminLoginPrompt();
}

// ========== 自動執行 ==========
// 策略：admin 頁面一開始就隱藏 body，驗證通過才顯示；失敗或超時直接跳回首頁

function _hideAdminBody() {
    // 立刻隱藏整個 body，防止頁面在驗證前被看到
    if (!document.body) {
        document.addEventListener('DOMContentLoaded', () => {
            document.body.style.visibility = 'hidden';
        });
    } else {
        document.body.style.visibility = 'hidden';
    }
}

function _showAdminBody() {
    if (document.body) document.body.style.visibility = '';
}

function _blockAndRedirect() {
    // 驗證失敗 → 移除 overlay（若有）、立刻跳回首頁
    const overlay = document.getElementById('admin-login-overlay');
    if (overlay) overlay.remove();
    window.location.replace('index.html');
}

let _adminAuthRetryCount = 0;
const _adminAuthMaxRetry = 10; // 10 次 × 500ms = 最多等 5 秒

function initAdminAuth() {
    const isAdminPage = window.location.pathname.includes('admin');
    if (!isAdminPage) return; // 非後台頁面不處理

    // 立刻隱藏頁面內容
    _hideAdminBody();

    if (typeof google !== 'undefined' && google.accounts) {
        checkAdminAuth();
    } else if (_adminAuthRetryCount < _adminAuthMaxRetry) {
        _adminAuthRetryCount++;
        setTimeout(initAdminAuth, 500);
    } else {
        // Google SDK 5 秒內未載入
        // 檢查是否有前台登入 + localStorage 快取的後台驗證
        if (isAuthStateValid()) {
            _showAdminBody();
            setTimeout(() => {
                document.dispatchEvent(new CustomEvent('adminAuthenticated', {
                    detail: { user: currentAdminUser, role: currentAdminUser?.role }
                }));
            }, 0);
        } else {
            // 無法驗證 → 跳回首頁
            console.warn('[admin-auth] Google SDK 未載入且無快取驗證，拒絕進入後台');
            _blockAndRedirect();
        }
    }
}

// 當 DOM 載入完成時執行驗證
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminAuth);
} else {
    initAdminAuth();
}

// ========== 匯出 API（供其他腳本使用）==========
window.AdminAuth = {
    check: checkAdminAuth,
    isValid: isAuthStateValid,
    getCurrentAdmin: () => currentAdminUser,
    logout: clearAuthState,
    
    // 管理員管理功能
    loadWhitelist: loadAdminWhitelist,
    addAdmin: addAdminToWhitelist,
    removeAdmin: removeAdminFromWhitelist,
    checkIsAdmin: checkIsAdmin,
    
    // 更新 session 時間
    updateSessionTime: () => {
        if (isAuthStateValid()) {
            localStorage.setItem(ADMIN_AUTH_CONFIG.STORAGE_TIME_KEY, Date.now().toString());
        }
    }
};
