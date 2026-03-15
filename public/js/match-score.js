/**
 * 推薦匹配度：玩家 8 軸 + MBTI 與遊戲 8 軸 + 同類型喜好 + 群體喜好的綜合分數
 * 供推薦列表／排序使用；權重可調。
 */
(function(global) {
    'use strict';

    var PREFERENCE_AXES = ['conflict', 'strategy', 'social_fun', 'immersion', 'accessibility', 'manipulation', 'coop', 'luck'];

    /**
     * 將玩家或遊戲的 8 軸轉成固定順序的數值陣列（缺值當 0）
     * @param {Object} profile - 鍵為軸名（snake_case），值為數字
     * @param {number} maxScale - 軸的滿分（測驗 0~12，後台可能 0~100）
     * @returns {number[]}
     */
    function toAxisVector(profile, maxScale) {
        maxScale = maxScale || 12;
        return PREFERENCE_AXES.map(function(k) {
            var v = profile[k];
            if (v === null || v === undefined || isNaN(Number(v))) return 0;
            return Math.max(0, Math.min(maxScale, Number(v)));
        });
    }

    /**
     * 從 game_database 一筆取出 8 軸（axis_conflict ... axis_luck）
     * @param {Object} game - 遊戲資料，可有 axis_* 欄位
     * @returns {number[]}
     */
    function gameToAxisVector(game) {
        var vec = PREFERENCE_AXES.map(function(k) {
            var key = 'axis_' + k;
            var v = game[key];
            if (v === null || v === undefined || isNaN(Number(v))) return 0;
            return Number(v);
        });
        return vec;
    }

    /**
     * 餘弦相似度（0~1），兩向量長度需一致
     * @param {number[]} a
     * @param {number[]} b
     * @returns {number} 0~1
     */
    function cosineSimilarity(a, b) {
        if (a.length !== b.length) return 0;
        var dot = 0, normA = 0, normB = 0;
        for (var i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        if (normA === 0 || normB === 0) return 0;
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * 將餘弦相似度從 [-1,1] 線性映射到 [0,1]（本專案軸皆非負，通常已在 0~1）
     * @param {number} sim
     * @returns {number} 0~1
     */
    function simTo01(sim) {
        return Math.max(0, Math.min(1, (sim + 1) / 2));
    }

    /**
     * 計算單一遊戲對當前玩家的匹配度
     * @param {Object} playerAxes - 玩家 8 軸，鍵：conflict, strategy, ...（或從 user_preference_profiles 一筆）
     * @param {Object} game - 遊戲一筆，需含 axis_conflict ... axis_luck（可為 null／未計算）
     * @param {number} sameTypeScore - 同 MBTI 對該遊戲的喜好分數，建議 0~1（例如 like 比例）
     * @param {number} groupScore - 群體喜好分數，建議 0~1（例如全站 like 正規化）
     * @param {Object} weights - 可選，{ axis: 0.5, sameType: 0.3, group: 0.2 }
     * @returns {number} 0~100 匹配度
     */
    function computeMatchScore(playerAxes, game, sameTypeScore, groupScore, weights) {
        weights = weights || { axis: 0.5, sameType: 0.3, group: 0.2 };
        sameTypeScore = sameTypeScore != null ? Math.max(0, Math.min(1, Number(sameTypeScore))) : 0;
        groupScore = groupScore != null ? Math.max(0, Math.min(1, Number(groupScore))) : 0;

        var pVec = toAxisVector(playerAxes || {}, 12);
        var gVec = game ? gameToAxisVector(game) : [];
        var axisSim = 0;
        if (gVec.length === pVec.length) {
            var raw = cosineSimilarity(pVec, gVec);
            axisSim = simTo01(raw);
        }

        var total = weights.axis * axisSim + weights.sameType * sameTypeScore + weights.group * groupScore;
        var sumW = weights.axis + weights.sameType + weights.group;
        if (sumW > 0) total /= sumW;
        return Math.round(Math.max(0, Math.min(100, total * 100)));
    }

    global.MatchScore = {
        PREFERENCE_AXES: PREFERENCE_AXES,
        toAxisVector: toAxisVector,
        gameToAxisVector: gameToAxisVector,
        cosineSimilarity: cosineSimilarity,
        computeMatchScore: computeMatchScore
    };
})(typeof window !== 'undefined' ? window : this);
