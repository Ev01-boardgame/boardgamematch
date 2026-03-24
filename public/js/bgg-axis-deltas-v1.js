/**
 * BGG Category（主題）／Mechanic（機制）→ 六軸「加總修正量」（delta）
 * 與 admin-bgg-axis-sync 的 computeSixAxes 一致。
 * 正式環境：後台頁會先請求 GET /api/bgg-axis-deltas（公開）覆寫 window.BGG_AXIS_V1；
 * 此檔為離線／API 失敗時的後備，且應與 cloudflare/bgg-axis-defaults.js 預設值同步。
 * 官方「全部」主題／機制清單見 public/data/bgg-taxonomy.json（由 scripts/build-bgg-taxonomy.mjs 產生）。
 * 線上編輯：admin-bgg-axis-delta-editor.html（PUT /api/admin/bgg-axis-deltas，需管理員 JWT）。
 * 數值會加在「基底六軸」上再 clamp 到 0–12；未列出的 BGG 標籤不套用此表。
 */
(function (global) {
    'use strict';

    const AXIS_KEYS = ['entry', 'mood', 'control', 'openness', 'sociality', 'competition'];

    const AXIS_LABELS_ZH = {
        entry: '進入門檻（高＝複雜）',
        mood: '歡樂 ↔ 燒腦',
        control: '運氣 ↔ 策略',
        openness: '磊落 ↔ 心機',
        sociality: '社交 ↔ 沉浸',
        competition: '合作 ↔ 對抗'
    };

    /** BGG Category（themes）→ 各軸加總修正，可為負 */
    const CATEGORY_AXIS_DELTAS = {
        'abstract strategy': { mood: -1, control: 2, sociality: -2 },
        'card game': { control: 1 },
        'children\'s game': { entry: -2, mood: 1, control: -1 },
        'deduction': { openness: 2, control: 1, mood: -1 },
        'dice': { control: -2, mood: 1 },
        'economic': { control: 2, openness: 1 },
        'family': { entry: -2, mood: 1, control: -0.5 },
        'fantasy': { mood: 0.5, sociality: -0.5 },
        'fighting': { competition: 2, mood: 1 },
        'humor': { mood: 2, sociality: 1 },
        'mature / adult': { mood: 1 },
        'negotiation': { sociality: 2, openness: 2 },
        'party game': { mood: 3, sociality: 2, entry: -2, control: -1 },
        'political': { sociality: 2, openness: 1 },
        'puzzle': { mood: -2, sociality: -2, control: 1 },
        'real-time': { mood: 2, control: -1 },
        'science fiction': { mood: 0.5 },
        'strategy': { control: 2, mood: -2, entry: 2 },
        'territory building': { competition: 1, control: 1 },
        'thematic': { mood: 1, sociality: -1 },
        'travel': { entry: -1 },
        'trivia': { mood: 2, sociality: 1, control: -1 },
        'wargame': { competition: 3, control: 2, mood: -2 },
        'zombies': { mood: 1 }
    };

    /** BGG Mechanic → 各軸加總修正 */
    const MECHANIC_AXIS_DELTAS = {
        'action points': { control: 1 },
        'area majority / influence': { competition: 2, control: 1 },
        'auction / bidding': { openness: 1, competition: 1, sociality: 1 },
        'betting and bluffing': { openness: 2, control: -1 },
        'card draft': { control: 1, openness: 1 },
        'cooperative game': { competition: -3, sociality: 1 },
        'deck building': { control: 2, entry: 1 },
        'deduction': { openness: 2, control: 1 },
        'dice rolling': { control: -2, mood: 1 },
        'grid movement': { control: 1 },
        'hand management': { control: 1 },
        'hidden roles': { openness: 3, sociality: 2 },
        'income': { control: 1 },
        'modular board': { entry: 0.5 },
        'once-per-game abilities': { control: 1 },
        'pattern building': { control: 1, mood: -0.5 },
        'pick-up and deliver': { control: 1 },
        'player elimination': { competition: 2, mood: 1 },
        'push your luck': { control: -2, mood: 2 },
        'rock-paper-scissors': { control: -2 },
        'role playing': { sociality: 2, mood: 1, openness: 1 },
        'set collection': { control: 0.5 },
        'simultaneous action selection': { sociality: 1, control: 1 },
        'solo / solitaire game': { sociality: -2 },
        'storytelling': { sociality: 2, mood: 1 },
        'take that': { competition: 2, mood: 2, openness: -1 },
        'tile placement': { control: 1 },
        'trading': { sociality: 2, openness: 1 },
        'variable player powers': { entry: 1, openness: 1 },
        'variable set-up': { entry: 0.5 },
        'voting': { sociality: 2, openness: 1 },
        'worker placement': { control: 2, openness: -0.5 }
    };

    global.BGG_AXIS_V1 = {
        version: 1,
        AXIS_KEYS,
        AXIS_LABELS_ZH,
        CATEGORY_AXIS_DELTAS,
        MECHANIC_AXIS_DELTAS
    };
})(typeof window !== 'undefined' ? window : globalThis);
