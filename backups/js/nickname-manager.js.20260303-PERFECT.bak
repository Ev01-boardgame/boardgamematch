/**
 * 暱稱管理系統
 * 處理使用者暱稱的設定、產生和修改
 */

const NicknameManager = {
    // 隨機暱稱配置
    ADJECTIVES: [
        '神秘的', '勇敢的', '睿智的', '友善的', '活潑的',
        '沉穩的', '機智的', '溫柔的', '熱情的', '冷靜的',
        '幽默的', '認真的', '樂觀的', '謹慎的', '創意的',
        '堅定的', '靈活的', '細心的', '開朗的', '內斂的'
    ],
    
    ANIMALS: [
        '狐狸', '獅子', '貓頭鷹', '熊貓', '企鵝',
        '海豚', '老鷹', '兔子', '松鼠', '貓咪',
        '狗狗', '浣熊', '刺蝟', '水獺', '無尾熊',
        '狼', '鹿', '天鵝', '蝴蝶', '龍'
    ],

    /**
     * 產生隨機暱稱
     */
    generateRandomNickname() {
        const adjective = this.ADJECTIVES[Math.floor(Math.random() * this.ADJECTIVES.length)];
        const animal = this.ANIMALS[Math.floor(Math.random() * this.ANIMALS.length)];
        
        // ✅ 移除編號，只保留「形容詞 + 動物」
        return `${adjective}${animal}`;
    },

    /**
     * 驗證暱稱是否有效
     */
    validateNickname(nickname) {
        if (!nickname || nickname.trim() === '') {
            return { valid: false, message: '暱稱不能為空' };
        }
        
        if (nickname.length < 2) {
            return { valid: false, message: '暱稱至少需要 2 個字元' };
        }
        
        if (nickname.length > 20) {
            return { valid: false, message: '暱稱不能超過 20 個字元' };
        }
        
        // 檢查是否包含不雅字詞（可以擴充）
        const badWords = ['幹', 'fuck', '操', 'shit', '靠北'];
        for (const word of badWords) {
            if (nickname.toLowerCase().includes(word)) {
                return { valid: false, message: '暱稱包含不適當的內容' };
            }
        }
        
        return { valid: true };
    },

    /**
     * 顯示暱稱設定彈窗
     */
    showNicknameModal(user, isFirstTime = true) {
        return new Promise((resolve) => {
            // 建立彈窗 HTML
            const modal = document.createElement('div');
            modal.id = 'nickname-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                animation: fadeIn 0.3s ease;
            `;
            
            const randomNickname = this.generateRandomNickname();
            
            modal.innerHTML = `
                <div style="
                    background: white;
                    border-radius: 16px;
                    padding: 40px;
                    max-width: 500px;
                    width: 90%;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                    animation: slideUp 0.3s ease;
                ">
                    <h2 style="
                        color: #5b7fe7;
                        margin: 0 0 10px 0;
                        font-size: 28px;
                        text-align: center;
                    ">
                        ${isFirstTime ? '🎉 歡迎加入！' : '✏️ 修改暱稱'}
                    </h2>
                    
                    <p style="
                        color: #666;
                        text-align: center;
                        margin: 0 0 30px 0;
                        line-height: 1.6;
                    ">
                        ${isFirstTime 
                            ? '為了保護您的隱私，請設定一個匿名暱稱<br>其他使用者將只看到您的暱稱，不會看到真實姓名' 
                            : '修改您的顯示暱稱'}
                    </p>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="
                            display: block;
                            color: #333;
                            font-weight: 600;
                            margin-bottom: 10px;
                        ">
                            您的暱稱
                        </label>
                        <input 
                            type="text" 
                            id="nickname-input"
                            placeholder="輸入暱稱（2-20 字元）"
                            value="${user.nickname || ''}"
                            maxlength="20"
                            style="
                                width: 100%;
                                padding: 12px 16px;
                                border: 2px solid #e0e0e0;
                                border-radius: 8px;
                                font-size: 16px;
                                box-sizing: border-box;
                                transition: all 0.3s;
                            "
                        >
                        <div id="nickname-error" style="
                            color: #e74c3c;
                            font-size: 14px;
                            margin-top: 8px;
                            display: none;
                        "></div>
                    </div>
                    
                    <button id="generate-nickname-btn" style="
                        width: 100%;
                        padding: 12px;
                        background: #f0f0f0;
                        border: 2px dashed #ccc;
                        border-radius: 8px;
                        color: #666;
                        font-size: 16px;
                        cursor: pointer;
                        margin-bottom: 20px;
                        transition: all 0.3s;
                    ">
                        🎲 隨機產生暱稱：${randomNickname}
                    </button>
                    
                    <div style="
                        display: flex;
                        gap: 12px;
                        margin-top: 30px;
                    ">
                        ${!isFirstTime ? `
                        <button id="cancel-nickname-btn" style="
                            flex: 1;
                            padding: 14px;
                            background: #f0f0f0;
                            border: none;
                            border-radius: 8px;
                            color: #666;
                            font-size: 16px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.3s;
                        ">
                            取消
                        </button>
                        ` : ''}
                        <button id="save-nickname-btn" style="
                            flex: 1;
                            padding: 14px;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            border: none;
                            border-radius: 8px;
                            color: white;
                            font-size: 16px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.3s;
                            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                        ">
                            ${isFirstTime ? '開始使用' : '儲存'}
                        </button>
                    </div>
                </div>
            `;
            
            // 加入動畫樣式
            const style = document.createElement('style');
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { 
                        opacity: 0;
                        transform: translateY(30px);
                    }
                    to { 
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                #nickname-input:focus {
                    outline: none;
                    border-color: #5b7fe7 !important;
                }
                #generate-nickname-btn:hover {
                    background: #e8e8e8;
                    border-color: #999;
                }
                #save-nickname-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
                }
                #cancel-nickname-btn:hover {
                    background: #e0e0e0;
                }
            `;
            document.head.appendChild(style);
            
            document.body.appendChild(modal);
            
            // 綁定事件
            const input = document.getElementById('nickname-input');
            const generateBtn = document.getElementById('generate-nickname-btn');
            const saveBtn = document.getElementById('save-nickname-btn');
            const cancelBtn = document.getElementById('cancel-nickname-btn');
            const errorDiv = document.getElementById('nickname-error');
            
            // 隨機產生暱稱
            generateBtn.addEventListener('click', () => {
                const newNickname = this.generateRandomNickname();
                input.value = newNickname;
                generateBtn.textContent = `🎲 隨機產生暱稱：${newNickname}`;
                errorDiv.style.display = 'none';
            });
            
            // 儲存暱稱
            saveBtn.addEventListener('click', async () => {
                const nickname = input.value.trim();
                const validation = this.validateNickname(nickname);
                
                if (!validation.valid) {
                    errorDiv.textContent = validation.message;
                    errorDiv.style.display = 'block';
                    input.style.borderColor = '#e74c3c';
                    return;
                }
                
                // 顯示載入狀態
                saveBtn.textContent = '儲存中...';
                saveBtn.disabled = true;
                
                try {
                    // 更新使用者暱稱
                    const success = await this.updateUserNickname(user, nickname);
                    
                    if (success) {
                        modal.remove();
                        resolve(nickname);
                    } else {
                        throw new Error('更新失敗');
                    }
                } catch (error) {
                    console.error('[NicknameManager] 儲存暱稱失敗:', error);
                    errorDiv.textContent = '儲存失敗，請稍後再試';
                    errorDiv.style.display = 'block';
                    saveBtn.textContent = isFirstTime ? '開始使用' : '儲存';
                    saveBtn.disabled = false;
                }
            });
            
            // 取消（僅在非首次時顯示）
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    modal.remove();
                    resolve(null);
                });
            }
            
            // 按 Enter 儲存
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    saveBtn.click();
                }
            });
            
            // 自動 focus
            input.focus();
        });
    },

    /**
     * 更新使用者暱稱
     */
    async updateUserNickname(user, nickname) {
        try {
            const updateData = {
                ...user,
                nickname: nickname
            };
            
            const response = await fetch(`tables/users/${user.id}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(updateData)
            });
            
            if (response.ok) {
                const updatedUser = await response.json();
                
                // 更新 localStorage
                if (typeof GameMBTI !== 'undefined' && GameMBTI.setCurrentUser) {
                    GameMBTI.setCurrentUser(updatedUser);
                } else {
                    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
                }
                
                console.log('[NicknameManager] 暱稱更新成功:', nickname);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('[NicknameManager] 更新暱稱失敗:', error);
            return false;
        }
    },

    /**
     * 檢查是否需要設定暱稱（首次登入）
     */
    async checkAndSetNickname(user) {
        if (!user.nickname || user.nickname.trim() === '') {
            console.log('[NicknameManager] 首次登入，需要設定暱稱');
            const nickname = await this.showNicknameModal(user, true);
            return nickname;
        }
        return user.nickname;
    }
};

// 匯出給其他模組使用
window.NicknameManager = NicknameManager;
