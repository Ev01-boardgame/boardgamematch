/**
 * Tests for GitHub Issue #24:
 * 1. Duplicate game entries in arrays (no includes() check before push)
 * 2. Name normalization mismatch causing games to reappear in explore
 * 3. Game names with "/" should be preserved correctly
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// ── Simulate the nameMap lookup (like GameNames.lookup) ──
const mockNameMap = {
    'luthier':       { name_zh: '製琴師', name_en: 'Luthier', name_ja: '' },
    '製琴師':        { name_zh: '製琴師', name_en: 'Luthier', name_ja: '' },
    '10/12 heart':   { name_zh: '', name_en: '10/12 Heart', name_ja: '' },
    '12 heart':      { name_zh: '', name_en: '12 Heart', name_ja: '' },
    'catan':         { name_zh: '卡坦島', name_en: 'Catan', name_ja: '' },
    '卡坦島':        { name_zh: '卡坦島', name_en: 'Catan', name_ja: '' },
};

function mockLookup(name) {
    if (!name) return null;
    return mockNameMap[name.toLowerCase().trim()] || null;
}

// ══════════════════════════════════════════════════════
// Helper functions under test (to be extracted/created)
// ══════════════════════════════════════════════════════

// Bug 1: addGameToCategory — prevent duplicates
function addGameToCategory(user, field, gameName) {
    if (!user[field]) user[field] = [];
    if (!user[field].includes(gameName)) {
        user[field].push(gameName);
    }
}

// Bug 2: isGameRated — match across normalized names using lookup
// Returns true if gameName (or any of its known aliases) is in ratedGames
function isGameRated(gameName, ratedGames, lookupFn) {
    // Fast path: exact match
    if (ratedGames.includes(gameName)) return true;
    // Slow path: lookup the game to get all known names, check each
    const info = lookupFn(gameName);
    if (!info) return false;
    const knownNames = [info.name_zh, info.name_en, info.name_ja].filter(Boolean);
    return knownNames.some(name => ratedGames.includes(name));
}

// Bug 2b: normalizeForSave — should NOT change the stored name to break matching
// Current code in edit-games-drag: normalizeName returns info.name_zh || info.name_en
// This changes "Luthier" → "製琴師", breaking collection matching
// No function to test yet — the fix will address comparison instead

// ══════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════

describe('Bug 1: Duplicate game entries in arrays', () => {

    it('should NOT add duplicate when game already in liked_games', () => {
        const user = { liked_games: ['Luthier'] };
        addGameToCategory(user, 'liked_games', 'Luthier');
        assert.equal(user.liked_games.length, 1, 'Should still have 1 entry, not 2');
    });

    it('should add game when not already present', () => {
        const user = { liked_games: ['Catan'] };
        addGameToCategory(user, 'liked_games', 'Luthier');
        assert.equal(user.liked_games.length, 2);
        assert.ok(user.liked_games.includes('Luthier'));
    });

    it('should handle empty array', () => {
        const user = { liked_games: [] };
        addGameToCategory(user, 'liked_games', 'Catan');
        assert.equal(user.liked_games.length, 1);
    });

    it('should handle undefined field (initialize first)', () => {
        const user = {};
        addGameToCategory(user, 'super_liked_games', 'Catan');
        assert.equal(user.super_liked_games.length, 1);
    });

    it('should prevent duplicates across multiple rapid calls', () => {
        const user = { wishlist: [] };
        addGameToCategory(user, 'wishlist', '10/12 Heart');
        addGameToCategory(user, 'wishlist', '10/12 Heart');
        addGameToCategory(user, 'wishlist', '10/12 Heart');
        assert.equal(user.wishlist.length, 1, 'Should have exactly 1 entry after 3 calls');
    });
});

describe('Bug 2: Name normalization mismatch (Luthier reappearing)', () => {

    it('should detect "Luthier" as rated when user has "製琴師"', () => {
        // User rated "Luthier" → edit-games normalized to "製琴師"
        // Collection still has "Luthier" → should still count as rated
        const ratedGames = ['製琴師', 'Catan'];
        const result = isGameRated('Luthier', ratedGames, mockLookup);
        assert.equal(result, true, '"Luthier" and "製琴師" are the same game');
    });

    it('should detect "製琴師" as rated when user has "Luthier"', () => {
        const ratedGames = ['Luthier', 'Catan'];
        const result = isGameRated('製琴師', ratedGames, mockLookup);
        assert.equal(result, true);
    });

    it('should detect exact match as rated', () => {
        const ratedGames = ['Luthier'];
        const result = isGameRated('Luthier', ratedGames, mockLookup);
        assert.equal(result, true);
    });

    it('should detect unrated game as not rated', () => {
        const ratedGames = ['Catan'];
        const result = isGameRated('Luthier', ratedGames, mockLookup);
        assert.equal(result, false);
    });

    it('should handle game name "卡坦島" matching "Catan"', () => {
        const ratedGames = ['卡坦島'];
        const result = isGameRated('Catan', ratedGames, mockLookup);
        assert.equal(result, true);
    });

    it('should handle game not in lookup database', () => {
        const ratedGames = ['Unknown Game'];
        const result = isGameRated('Unknown Game', ratedGames, mockLookup);
        assert.equal(result, true, 'Exact match should still work');
    });

    it('should return false for unknown game not in list', () => {
        const ratedGames = ['Catan'];
        const result = isGameRated('Unknown Game', ratedGames, mockLookup);
        assert.equal(result, false);
    });
});

describe('Bug 3: Game names with "/" preserved correctly', () => {

    it('should store "10/12 Heart" correctly in array', () => {
        const user = { wishlist: [] };
        addGameToCategory(user, 'wishlist', '10/12 Heart');
        assert.equal(user.wishlist[0], '10/12 Heart');
    });

    it('should not split "10/12 Heart" at the slash', () => {
        const user = { wishlist: [] };
        addGameToCategory(user, 'wishlist', '10/12 Heart');
        assert.equal(user.wishlist.length, 1);
        assert.ok(!user.wishlist.includes('12 Heart'), 'Should NOT contain "12 Heart"');
    });

    it('should detect "10/12 Heart" as rated regardless of slash', () => {
        const ratedGames = ['10/12 Heart'];
        const result = isGameRated('10/12 Heart', ratedGames, mockLookup);
        assert.equal(result, true);
    });

    it('should not confuse "10/12 Heart" with "12 Heart"', () => {
        const ratedGames = ['10/12 Heart'];
        const result = isGameRated('12 Heart', ratedGames, mockLookup);
        assert.equal(result, false, '"12 Heart" is a different game than "10/12 Heart"');
    });
});
