/**
 * 由 BGG category / mechanics / complexity 計算六軸（與 admin-bgg-axis-sync 相同邏輯）
 * 依賴：先載入 bgg-axis-deltas-v1.js，並可選 await loadBggAxisV1FromApi() 覆寫為線上 delta
 */
(function (g) {
    'use strict';

    function getV() {
        const V = g.BGG_AXIS_V1;
        if (!V) throw new Error('請先載入 bgg-axis-deltas-v1.js');
        return V;
    }

    function normTag(s) {
        return String(s || '').trim().toLowerCase();
    }

    function parseJsonArrayField(val) {
        if (val == null || val === '') return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
            try {
                const j = JSON.parse(val);
                return Array.isArray(j) ? j : [];
            } catch {
                return [];
            }
        }
        return [];
    }

    function applyDeltasForTags(tags, dict, acc, AXIS_KEYS) {
        if (!Array.isArray(tags)) return;
        for (const raw of tags) {
            const t = normTag(raw);
            if (!t) continue;
            let d = dict[t];
            if (!d) {
                const keys = Object.keys(dict);
                const hits = keys.filter(k => t.includes(k) || k.includes(t));
                if (hits.length === 1) d = dict[hits[0]];
            }
            if (!d) continue;
            for (const k of AXIS_KEYS) {
                if (d[k] != null) acc[k] = (acc[k] || 0) + d[k];
            }
        }
    }

    function clamp01(x) {
        if (x == null || isNaN(x)) return 0;
        return x < 0 ? 0 : x > 1 ? 1 : x;
    }

    function clampAxis(v) {
        const n = Number(v);
        if (isNaN(n)) return 6;
        return Math.round(Math.max(0, Math.min(12, n)) * 10) / 10;
    }

    /**
     * @param {string[]|*} categoryArr
     * @param {string[]|*} mechanicsArr
     * @param {*} complexity
     * @returns {Object} axis_entry, axis_mood, ...
     */
    function computeSixAxesFromParsed(categoryArr, mechanicsArr, complexity) {
        const V = getV();
        const AXIS_KEYS = V.AXIS_KEYS;
        const cat = Array.isArray(categoryArr) ? categoryArr : parseJsonArrayField(categoryArr);
        const mech = Array.isArray(mechanicsArr) ? mechanicsArr : parseJsonArrayField(mechanicsArr);
        const w = complexity != null && Number(complexity) > 0 ? Number(complexity) : null;
        const base = {
            entry: w != null ? clamp01(w / 5) * 12 : 6,
            mood: 6,
            control: 6,
            openness: 6,
            sociality: 6,
            competition: 6
        };
        const delta = { entry: 0, mood: 0, control: 0, openness: 0, sociality: 0, competition: 0 };
        applyDeltasForTags(cat, V.CATEGORY_AXIS_DELTAS, delta, AXIS_KEYS);
        applyDeltasForTags(mech, V.MECHANIC_AXIS_DELTAS, delta, AXIS_KEYS);
        const out = {};
        for (const k of AXIS_KEYS) {
            out['axis_' + k] = clampAxis(base[k] + (delta[k] || 0));
        }
        return out;
    }

    function computeSixAxesFromRow(row) {
        if (!row) return computeSixAxesFromParsed([], [], null);
        return computeSixAxesFromParsed(row.category, row.mechanics, row.complexity);
    }

    /**
     * 審稿人加減後強制落在 0～12（再怎麼拉 Δ 也不會爆）
     * @param {Object} bggAxes - { axis_entry, ... }
     * @param {Object} reviewerDeltaByKey - { entry: 0.5, mood: -1, ... } 缺省視為 0
     */
    function mergeBggWithReviewerDelta(bggAxes, reviewerDeltaByKey) {
        const AXIS_KEYS = getV().AXIS_KEYS;
        const dIn = reviewerDeltaByKey || {};
        const out = {};
        for (const k of AXIS_KEYS) {
            const b = Number(bggAxes && bggAxes['axis_' + k]);
            const bNum = isNaN(b) ? 6 : b;
            const d = Number(dIn[k]);
            const dNum = isNaN(d) ? 0 : d;
            out['axis_' + k] = clampAxis(bNum + dNum);
        }
        return out;
    }

    g.BggSixAxesCompute = {
        parseJsonArrayField,
        computeSixAxesFromParsed,
        computeSixAxesFromRow,
        mergeBggWithReviewerDelta,
        clampAxis,
        normTag
    };
})(typeof window !== 'undefined' ? window : globalThis);
