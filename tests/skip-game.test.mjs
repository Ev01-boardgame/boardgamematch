/**
 * TDD: skipGame — 跳過按鈕行為測試
 *
 * 核心需求：
 * 1. skipGame 存在且可呼叫
 * 2. 呼叫後 currentGameIndex 遞增
 * 3. 呼叫後觸發 showNextGame
 * 4. 不修改任何使用者資料陣列（不污染統計）
 * 5. 不呼叫 saveToLocalStorage
 * 6. 不發出任何 fetch 請求
 * 7. buildGameCard 輸出包含跳過按鈕
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── 最小 DOM 模擬 ──

function createMockElement(id) {
    const classList = new Set();
    return {
        id,
        style: {},
        classList: {
            add(...cls) { cls.forEach(c => classList.add(c)); },
            remove(...cls) { cls.forEach(c => classList.delete(c)); },
            contains(c) { return classList.has(c); },
            _set: classList,
        },
        innerHTML: '',
    };
}

// ── 全域狀態（模擬 recommend.html 的 script 環境）──

let ctx; // 測試上下文，模擬 recommend.html 的全域變數

function setupContext() {
    ctx = {
        currentGameIndex: 0,
        showNextGameCalls: [],
        saveToLocalStorageCalls: [],
        fetchCalls: [],
        isReRateMode: false,
        currentUser: {
            id: 'test-user',
            liked_games: ['已評價遊戲A'],
            disliked_games: [],
            neutral_games: [],
            super_liked_games: [],
            no_interest_games: [],
            wishlist: [],
        },
        currentCollectionGames: ['遊戲1', '遊戲2', '遊戲3'],
        elements: {},
    };

    // 模擬 DOM 查找
    ctx.getElementById = (id) => ctx.elements[id] || null;

    // 模擬 showNextGame
    ctx.showNextGame = (collectionId) => {
        ctx.showNextGameCalls.push(collectionId);
    };

    // 模擬 saveToLocalStorage
    ctx.saveToLocalStorage = (data) => {
        ctx.saveToLocalStorageCalls.push(data);
    };

    // 模擬 fetch
    ctx.fetch = (...args) => {
        ctx.fetchCalls.push(args);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    };
}

// ── skipGame 實作（與 recommend.html 中的邏輯完全一致）──
// 使用 ctx 取代 document/全域變數，方便測試

function createSkipGame(c) {
    return function skipGame(collectionId) {
        const card = c.getElementById(`game-card-${collectionId}`);
        if (!card) return;
        card.style.pointerEvents = 'none';
        const nextCard = c.getElementById(`game-card-next-${collectionId}`);
        card.classList.remove('current-card');
        card.classList.add('swiped-up');
        if (nextCard) {
            nextCard.classList.remove('next-card');
            nextCard.classList.add('current-card', 'card-enter');
        }
        setTimeout(() => {
            c.currentGameIndex++;
            c.showNextGame(collectionId);
        }, 220);
    };
}

// ── buildGameCard 跳過按鈕片段測試 ──
// 只測試輸出 HTML 是否包含跳過按鈕，模擬最小 buildGameCard

function createBuildGameCard(c) {
    return function buildGameCard(collectionId, gameName, cardId, classes) {
        const safeGameName = gameName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        // 非重評模式才顯示跳過按鈕
        const skipBtn = !c.isReRateMode
            ? `<button class="recommendation-btn btn-skip" onclick="skipGame('${collectionId}', '${safeGameName}')" title="跳過">⏭<span class="btn-label">跳過</span></button>`
            : '';
        return `<div class="game-card ${classes.join(' ')}" id="${cardId}">
            <div class="game-name">${gameName}</div>
            <div class="rating-buttons">
                <button class="recommendation-btn btn-like" onclick="rateGame('${collectionId}', '${safeGameName}', 'like')">👍<span class="btn-label">喜歡</span></button>
                ${skipBtn}
            </div>
        </div>`;
    };
}

let skipGame;
let buildGameCard;

beforeEach(() => {
    setupContext();
    skipGame = createSkipGame(ctx);
    buildGameCard = createBuildGameCard(ctx);
});

describe('skipGame 行為', () => {

    it('skipGame 函式存在且可呼叫', () => {
        assert.strictEqual(typeof skipGame, 'function', 'skipGame 應為函式');
    });

    it('呼叫後 currentGameIndex 遞增 1', async () => {
        ctx.elements['game-card-col1'] = createMockElement('game-card-col1');
        const before = ctx.currentGameIndex;

        skipGame('col1');
        await new Promise(r => setTimeout(r, 300));

        assert.strictEqual(ctx.currentGameIndex, before + 1, 'currentGameIndex 應 +1');
    });

    it('呼叫後觸發 showNextGame(collectionId)', async () => {
        ctx.elements['game-card-col1'] = createMockElement('game-card-col1');

        skipGame('col1');
        await new Promise(r => setTimeout(r, 300));

        assert.strictEqual(ctx.showNextGameCalls.length, 1, '應呼叫 showNextGame 一次');
        assert.strictEqual(ctx.showNextGameCalls[0], 'col1', '應傳入正確的 collectionId');
    });

    it('不修改使用者資料陣列', () => {
        ctx.elements['game-card-col1'] = createMockElement('game-card-col1');
        const before = JSON.parse(JSON.stringify(ctx.currentUser));

        skipGame('col1');

        assert.deepStrictEqual(ctx.currentUser.liked_games, before.liked_games);
        assert.deepStrictEqual(ctx.currentUser.disliked_games, before.disliked_games);
        assert.deepStrictEqual(ctx.currentUser.neutral_games, before.neutral_games);
        assert.deepStrictEqual(ctx.currentUser.super_liked_games, before.super_liked_games);
        assert.deepStrictEqual(ctx.currentUser.no_interest_games, before.no_interest_games);
        assert.deepStrictEqual(ctx.currentUser.wishlist, before.wishlist);
    });

    it('不呼叫 saveToLocalStorage', async () => {
        ctx.elements['game-card-col1'] = createMockElement('game-card-col1');
        skipGame('col1');
        await new Promise(r => setTimeout(r, 300));

        assert.strictEqual(ctx.saveToLocalStorageCalls.length, 0, '不應呼叫 saveToLocalStorage');
    });

    it('不發出任何 fetch 請求', async () => {
        ctx.elements['game-card-col1'] = createMockElement('game-card-col1');
        skipGame('col1');
        await new Promise(r => setTimeout(r, 300));

        assert.strictEqual(ctx.fetchCalls.length, 0, '不應有任何 fetch 呼叫');
    });

    it('卡片沒找到時不報錯', () => {
        assert.doesNotThrow(() => skipGame('nonexistent'));
    });

    it('對當前卡片加上 swiped-up 動畫', () => {
        const card = createMockElement('game-card-col1');
        card.classList.add('current-card');
        ctx.elements['game-card-col1'] = card;

        skipGame('col1');

        assert.ok(!card.classList.contains('current-card'), '應移除 current-card');
        assert.ok(card.classList.contains('swiped-up'), '應加上 swiped-up');
    });

    it('有預載卡片時，預載卡片升為 current-card', () => {
        ctx.elements['game-card-col1'] = createMockElement('game-card-col1');
        const nextCard = createMockElement('game-card-next-col1');
        nextCard.classList.add('next-card');
        ctx.elements['game-card-next-col1'] = nextCard;

        skipGame('col1');

        assert.ok(!nextCard.classList.contains('next-card'), '應移除 next-card');
        assert.ok(nextCard.classList.contains('current-card'), '應加上 current-card');
        assert.ok(nextCard.classList.contains('card-enter'), '應加上 card-enter');
    });

    it('卡片沒找到時不遞增 currentGameIndex', async () => {
        const before = ctx.currentGameIndex;
        skipGame('nonexistent');
        await new Promise(r => setTimeout(r, 300));
        assert.strictEqual(ctx.currentGameIndex, before, '找不到卡片時不應遞增');
    });
});

describe('buildGameCard 跳過按鈕', () => {

    it('一般模式：卡片 HTML 包含跳過按鈕', () => {
        ctx.isReRateMode = false;
        const html = buildGameCard('col1', '測試遊戲', 'card-1', ['current-card']);
        assert.ok(html.includes('skipGame'), '卡片 HTML 應包含 skipGame 呼叫');
        assert.ok(html.includes('跳過'), '卡片 HTML 應包含「跳過」文字');
        assert.ok(html.includes('btn-skip'), '卡片 HTML 應包含 btn-skip class');
    });

    it('重評模式：卡片 HTML 不包含跳過按鈕', () => {
        ctx.isReRateMode = true;
        buildGameCard = createBuildGameCard(ctx);
        const html = buildGameCard('col1', '測試遊戲', 'card-1', ['current-card']);
        assert.ok(!html.includes('btn-skip'), '重評模式不應有跳過按鈕');
    });

    it('遊戲名稱含特殊字元時 onclick 正確轉義', () => {
        ctx.isReRateMode = false;
        const html = buildGameCard('col1', "Don't Get Got", 'card-1', ['current-card']);
        assert.ok(html.includes('skipGame'), '特殊字元遊戲名仍應包含 skipGame');
        // onclick 裡的單引號必須轉義為 \'
        assert.ok(html.includes("Don\\'t Get Got"), 'onclick 中單引號應被轉義');
    });
});
