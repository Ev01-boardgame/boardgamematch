/**
 * 沙漏載入動畫 - 統一全站使用
 * 取代所有轉圈圈 spinner，使用沙漏翻轉動畫 + 沙子流動效果
 */

const HourglassLoader = {
    /**
     * 創建基礎沙漏載入 HTML
     * @param {string} text - 顯示文字 (預設: "載入中...")
     * @param {string} size - 尺寸: 'small', 'normal', 'large' (預設: 'normal')
     * @param {boolean} iconOnly - 是否只顯示圖示 (預設: false)
     * @returns {string} HTML 字串
     */
    create: function(text = '載入中...', size = 'normal', iconOnly = false) {
        const sizeClass = size !== 'normal' ? size : '';
        const iconOnlyClass = iconOnly ? 'icon-only' : '';
        
        return `
            <div class="hourglass-loader ${sizeClass} ${iconOnlyClass}">
                <span class="hourglass-icon">⏳</span>
                <span class="hourglass-text">${text}</span>
            </div>
        `;
    },

    /**
     * 創建進階版沙漏（真實沙子流動效果）
     * @param {string} text - 顯示文字
     * @param {string} size - 尺寸
     * @param {boolean} withFlip - 是否加入翻轉效果
     * @param {boolean} iconOnly - 是否只顯示圖示
     * @returns {string} HTML 字串
     */
    createAdvanced: function(text = '載入中...', size = 'normal', withFlip = false, iconOnly = false) {
        const sizeClass = size !== 'normal' ? size : '';
        const flipClass = withFlip ? 'with-flip' : '';
        const iconOnlyClass = iconOnly ? 'icon-only' : '';
        
        return `
            <div class="hourglass-advanced ${sizeClass} ${iconOnlyClass}">
                <div class="hourglass-container ${flipClass}">
                    <span class="hourglass-base">⏳</span>
                    <div class="sand-flow"></div>
                    <div class="sand-stream">
                        <div class="sand-particle"></div>
                        <div class="sand-particle"></div>
                        <div class="sand-particle"></div>
                        <div class="sand-particle"></div>
                        <div class="sand-particle"></div>
                        <div class="sand-particle"></div>
                    </div>
                </div>
                <span class="hourglass-text">${text}</span>
            </div>
        `;
    },

    /**
     * 顯示沙漏載入（替換容器內容）
     * @param {string|HTMLElement} container - 容器選擇器或元素
     * @param {string} text - 顯示文字
     * @param {string} size - 尺寸
     * @param {boolean} advanced - 是否使用進階版
     */
    show: function(container, text = '載入中...', size = 'normal', advanced = false) {
        const element = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
        
        if (element) {
            element.innerHTML = advanced 
                ? this.createAdvanced(text, size)
                : this.create(text, size);
        }
    },

    /**
     * 替換舊的 spinner 為沙漏（保留原有結構）
     * 用於已有 .loading 容器的頁面
     * @param {string|HTMLElement} container - 容器選擇器或元素
     */
    replaceSpinner: function(container) {
        const element = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
        
        if (!element) return;

        // 找到 spinner 元素並替換
        const spinner = element.querySelector('.spinner');
        if (spinner) {
            spinner.outerHTML = '<span class="hourglass-replacement">⏳</span>';
        }
        
        // 如果沒有 spinner，但有 loading 類別，添加沙漏
        if (!spinner && element.classList.contains('loading')) {
            const existingText = element.querySelector('p');
            element.innerHTML = this.create(
                existingText ? existingText.textContent : '載入中...'
            );
        }
    },

    /**
     * 批量替換頁面中所有的 spinner
     * 在頁面載入時呼叫一次即可
     */
    replaceAll: function() {
        // 替換所有包含 .spinner 的 .loading 容器
        document.querySelectorAll('.loading .spinner').forEach(spinner => {
            spinner.outerHTML = '<span class="hourglass-replacement">⏳</span>';
        });

        // 替換純文字的 loading
        document.querySelectorAll('.loading').forEach(loading => {
            if (!loading.querySelector('.hourglass-replacement') && 
                !loading.querySelector('.spinner') &&
                !loading.querySelector('.hourglass-loader') &&
                !loading.querySelector('.hourglass-advanced')) {
                const text = loading.textContent.trim() || '載入中...';
                loading.innerHTML = this.create(text);
            }
        });
    },

    /**
     * 創建沙漏元素（返回 DOM 元素而非字串）
     * @param {string} text - 顯示文字
     * @param {string} size - 尺寸
     * @param {boolean} advanced - 是否使用進階版
     * @returns {HTMLElement} DOM 元素
     */
    createElement: function(text = '載入中...', size = 'normal', advanced = false) {
        const div = document.createElement('div');
        div.innerHTML = advanced 
            ? this.createAdvanced(text, size)
            : this.create(text, size);
        return div.firstElementChild;
    }
};

// 頁面載入完成後自動替換所有 spinner
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            HourglassLoader.replaceAll();
        });
    } else {
        // DOM 已載入，立即執行
        HourglassLoader.replaceAll();
    }
}

// 匯出供其他模組使用
if (typeof window !== 'undefined') {
    window.HourglassLoader = HourglassLoader;
}
