/**
 * 玩家偏好六軸：延伸軌道 −3～15、固定寬 6 的滑動膠囊（數值仍為 0～12）。
 * 供首頁名片、測驗結果等共用；本檔只放幾何與漸層，不含 DOM。
 */
(function (global) {
    var TRACK_MIN = -3;
    var TRACK_MAX = 15;
    var TRACK_LEN = TRACK_MAX - TRACK_MIN;
    var CAP_W = 6;
    var CENTER_REF = 6;

    function clampV(v) {
        var n = Number(v);
        if (isNaN(n)) return 6;
        return Math.max(0, Math.min(12, Math.round(n)));
    }

    function capsuleLeftEdge(v) {
        return TRACK_MIN + clampV(v);
    }

    function splitLeftRatio(L) {
        var R = L + CAP_W;
        if (R <= CENTER_REF) return 1;
        if (L >= CENTER_REF) return 0;
        return (CENTER_REF - L) / CAP_W;
    }

    function capsulePositionPercent(v) {
        var L = capsuleLeftEdge(v);
        return {
            leftPct: ((L - TRACK_MIN) / TRACK_LEN) * 100,
            widthPct: (CAP_W / TRACK_LEN) * 100
        };
    }

    /** 首頁名片條：左藍、右側銜接橘→粉（與舊 card-fill 色系一致） */
    function capsuleGradientHomeCard(v) {
        var L = capsuleLeftEdge(v);
        var lr = splitLeftRatio(L);
        var stop = Math.round(lr * 1000) / 10;
        return (
            'linear-gradient(90deg, rgba(59,130,246,0.85) 0%, rgba(59,130,246,0.45) ' + stop + '%, ' +
            'rgba(245,158,11,0.45) ' + stop + '%, rgba(236,72,153,0.85) 100%)'
        );
    }

    /** 測驗／檔案結果條：藍↔粉（與原 pref-div-fillL/R 語感一致） */
    function capsuleGradientPreferenceBar(v) {
        var L = capsuleLeftEdge(v);
        var lr = splitLeftRatio(L);
        var stop = Math.round(lr * 1000) / 10;
        return (
            'linear-gradient(90deg, rgba(59,130,246,0.55) 0%, rgba(59,130,246,0.325) ' + stop + '%, ' +
            'rgba(236,72,153,0.10) ' + stop + '%, rgba(236,72,153,0.55) 100%)'
        );
    }

    /**
     * 已含 .card-capsule / .card-capsule-inner 的列（首頁／檔案名片軌）
     */
    function applyToHomeCardRow(rowEl, value) {
        var inner = rowEl.querySelector('.card-capsule-inner');
        var capsule = rowEl.querySelector('.card-capsule');
        if (!inner || !capsule) return;
        var v = clampV(value);
        var pos = capsulePositionPercent(v);
        capsule.style.left = pos.leftPct + '%';
        capsule.style.width = pos.widthPct + '%';
        inner.style.background = capsuleGradientHomeCard(v);
    }

    global.PreferenceAxisCapsule = {
        capsulePositionPercent: capsulePositionPercent,
        capsuleGradientHomeCard: capsuleGradientHomeCard,
        capsuleGradientPreferenceBar: capsuleGradientPreferenceBar,
        clampV: clampV,
        applyToHomeCardRow: applyToHomeCardRow
    };
})(typeof window !== 'undefined' ? window : this);
