/**
 * 首頁 dashboard：名片資料、熱門榜、3D tilt、捷徑點擊
 * 依賴：GameMBTI, getAuthHeaders, GameNames（選用）
 */
(function () {
    'use strict';

    function parseObj(raw) {
        if (!raw) return {};
        if (typeof raw === 'string') {
            try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
        }
        return typeof raw === 'object' ? raw : {};
    }

    function parseArr(raw) {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string') {
            try {
                const p = JSON.parse(raw);
                return Array.isArray(p) ? p : [];
            } catch (e) {
                return [];
            }
        }
        return [];
    }

    function parseProfileCardMeta(raw) {
        return parseObj(raw);
    }

    function getAuthHeadersSafe() {
        return (typeof getAuthHeaders === 'function')
            ? getAuthHeaders()
            : { 'Content-Type': 'application/json' };
    }

    async function resolveCurrentUserForHome() {
        let user = (typeof GameMBTI !== 'undefined' && GameMBTI.getCurrentUser)
            ? GameMBTI.getCurrentUser()
            : null;
        if (!user) return null;
        if (user.id) return user;
        const googleId = user.google_id || user.sub || null;
        if (!googleId) return user;
        try {
            const allUsers = await GameMBTI.getAllUsers();
            const matched = allUsers.find(u => u.google_id === googleId);
            if (matched) return { ...user, ...matched };
        } catch (e) { /* ignore */ }
        return user;
    }

    function getProfileCardMetaForUser(user) {
        const direct = parseProfileCardMeta(user && user.profile_card_meta);
        if (Object.keys(direct).length) return direct;
        const sl = parseObj(user && user.social_links);
        const fromSocial = parseProfileCardMeta(sl && sl.card_meta);
        if (Object.keys(fromSocial).length) return fromSocial;
        const userId = user && (user.google_id || user.id);
        if (!userId) return {};
        return parseProfileCardMeta(localStorage.getItem(`profile_card_meta_${userId}`));
    }

    function getRegionText(user) {
        let arr = user && user.region ? user.region : [];
        if (typeof arr === 'string') {
            try { arr = JSON.parse(arr); } catch (e) { arr = [arr]; }
        }
        if (!Array.isArray(arr) || !arr.length) return '';
        return arr.join('、');
    }

    function getDefaultAvatar(user) {
        const userId = String(user?.google_id || user?.id || user?.email || 'guest');
        const candidates = [
            { emoji: '🎮', color: '#667eea' },
            { emoji: '🎲', color: '#f093fb' },
            { emoji: '🃏', color: '#4facfe' },
            { emoji: '🎯', color: '#43e97b' },
            { emoji: '🎪', color: '#fa709a' },
            { emoji: '🎨', color: '#a8edea' }
        ];
        const idx = Math.abs(userId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % candidates.length;
        return candidates[idx];
    }

    function renderSocialInline(socialLinks, wantContact) {
        const container = document.getElementById('home-card-social');
        if (!container) return;

        const platforms = [
            {
                key: 'discord',
                label: 'Discord',
                svg: '<img src="https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png" width="18" height="18" style="border-radius:50%;display:block;" onerror="this.outerHTML=\'<span style=&quot;background:#5865F2;color:#fff;font-size:10px;font-weight:700;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;&quot;>DC</span>\'">',
                url: null,
                copyOnNoUrl: true
            },
            {
                key: 'line',
                label: 'LINE',
                svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>',
                url: (v) => `https://line.me/R/ti/p/~${encodeURIComponent(v)}`
            },
            {
                key: 'instagram',
                label: 'Instagram',
                svg: '<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Instagram_icon.png/600px-Instagram_icon.png" width="18" height="18" style="border-radius:4px;display:block;" onerror="this.outerHTML=\'<span style=&quot;background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);color:#fff;font-size:10px;font-weight:700;border-radius:4px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;&quot;>📷</span>\'">',
                url: (v) => `https://instagram.com/${v.replace(/^@/, '')}`
            },
            {
                key: 'facebook',
                label: 'Facebook',
                svg: '<img src="https://www.facebook.com/favicon.ico" width="18" height="18" style="border-radius:50%;display:block;" onerror="this.outerHTML=\'<span style=&quot;background:#1877F2;color:#fff;font-size:11px;font-weight:700;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;&quot;>f</span>\'">',
                url: (v) => `https://facebook.com/${v.replace(/^https?:\/\/(?:www\.)?facebook\.com\//, '').replace(/\/$/, '')}`
            },
            {
                key: 'telegram',
                label: 'Telegram',
                svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>',
                url: (v) => `https://t.me/${v.replace(/^@/, '')}`
            },
            {
                key: 'threads',
                label: 'Threads',
                svg: '<img src="https://www.threads.net/favicon.ico" width="18" height="18" style="border-radius:50%;display:block;" onerror="this.outerHTML=\'<span style=&quot;background:#000;color:#fff;font-size:10px;font-weight:700;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;&quot;>@</span>\'">',
                url: (v) => `https://threads.net/@${v.replace(/^@/, '')}`
            },
            {
                key: 'bgg',
                label: 'BGG',
                svg: '<img src="https://cf.geekdo-images.com/favicon.ico" width="18" height="18" style="border-radius:3px;display:block;" onerror="this.outerHTML=\'<span style=&quot;background:#FF5100;color:#fff;font-size:9px;font-weight:700;border-radius:3px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;&quot;>BGG</span>\'">',
                url: (v) => `https://boardgamegeek.com/user/${encodeURIComponent(v.replace(/^https?:\/\/(?:www\.)?boardgamegeek\.com\/(?:user|profile)\//i, '').replace(/\/$/, ''))}`
            },
            {
                key: 'bga',
                label: 'BGA',
                svg: '<img src="https://boardgamearena.com/favicon.ico" width="18" height="18" style="border-radius:50%;display:block;" onerror="this.outerHTML=\'<span style=&quot;background:#11294D;color:#fff;font-size:10px;font-weight:700;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;&quot;>B</span>\'">',
                clean: (v) => v,
                url: () => (socialLinks.bga_id || '').trim() || null
            }
        ];

        const chips = [];
        const baseStyle = 'display:inline-flex;align-items:center;gap:0.4rem;padding:0.2rem 0.6rem 0.2rem 0.2rem;border-radius:2rem;text-decoration:none;transition:transform 0.15s, box-shadow 0.15s, filter 0.15s;background:linear-gradient(140deg,#fffefb 0%,#f7f1e7 55%,#efe5d7 100%);border:1px solid #c5b093;box-shadow:inset 0 1px 0 rgba(255,255,255,0.95),inset 0 -1px 0 rgba(139,111,71,0.16),0 3px 8px rgba(80,63,38,0.16);';
        if (wantContact) chips.push('<span style="' + baseStyle + 'cursor:default;">🙋 開放被揪</span>');

        platforms.forEach((p) => {
            const raw = (socialLinks[p.key] || '').trim();
            if (!raw) return;
            const cleanText = p.clean ? p.clean(raw) : raw.replace(/^@/, '').replace(/^https?:\/\/(?:www\.)?facebook\.com\//, '').replace(/\/$/, '');
            const href = p.url ? p.url(raw) : null;
            const inner = `${p.svg} ${cleanText}`;
            if (href) {
                chips.push(
                    `<a href="${href}" target="_blank" rel="noopener noreferrer"
                        style="${baseStyle}"
                        onmouseover="this.style.transform='translateY(-1px)';this.style.filter='brightness(1.03)';this.style.boxShadow='inset 0 1px 0 rgba(255,255,255,0.98),inset 0 -1px 0 rgba(139,111,71,0.2),0 6px 14px rgba(80,63,38,0.22)';"
                        onmouseout="this.style.transform='translateY(0)';this.style.filter='none';this.style.boxShadow='inset 0 1px 0 rgba(255,255,255,0.95),inset 0 -1px 0 rgba(139,111,71,0.16),0 3px 8px rgba(80,63,38,0.16)';"
                        title="${p.label}: ${cleanText}">${inner}</a>`
                );
            } else if (p.copyOnNoUrl) {
                chips.push(
                    `<span style="${baseStyle}cursor:pointer;"
                        onclick="navigator.clipboard?.writeText('${raw.replace(/'/g, "\\'")}');"
                        onmouseover="this.style.transform='translateY(-1px)';this.style.filter='brightness(1.03)';this.style.boxShadow='inset 0 1px 0 rgba(255,255,255,0.98),inset 0 -1px 0 rgba(139,111,71,0.2),0 6px 14px rgba(80,63,38,0.22)';"
                        onmouseout="this.style.transform='translateY(0)';this.style.filter='none';this.style.boxShadow='inset 0 1px 0 rgba(255,255,255,0.95),inset 0 -1px 0 rgba(139,111,71,0.16),0 3px 8px rgba(80,63,38,0.16)';"
                        title="${p.label}: ${cleanText}（點擊複製）">${inner}</span>`
                );
            } else {
                chips.push(`<span style="${baseStyle}" title="${p.label}: ${cleanText}">${inner}</span>`);
            }
        });

        container.innerHTML = chips.join('');
        container.style.display = chips.length ? 'flex' : 'none';
    }

    function renderAxisRow(row, value) {
        const P = window.PreferenceAxisCapsule;
        if (!P || !P.applyToHomeCardRow) return;
        let v = Number(value);
        if (Number.isNaN(v)) v = 6;
        v = Math.max(0, Math.min(12, Math.round(v)));
        P.applyToHomeCardRow(row, v);
    }

    /** 未登入預覽名片：固定示範分數，與舊靜態條視覺相近 */
    function renderGuestPreviewAxes() {
        const P = window.PreferenceAxisCapsule;
        if (!P) return;
        const vals = [3, 8, 10, 5, 7, 4];
        const rows = document.querySelectorAll('#home-mode-guest .card-axes .card-ax-row');
        rows.forEach((row, i) => {
            renderAxisRow(row, vals[i] != null ? vals[i] : 6);
        });
    }

    async function loadHomeCardFromProfile() {
        const nameEl = document.getElementById('home-card-name');
        if (!nameEl || typeof GameMBTI === 'undefined') return;

        let user = await resolveCurrentUserForHome();
        if (!user) return;

        try {
            if (user.id) {
                const fresh = await GameMBTI.getUserById(user.id);
                if (fresh && fresh.id) user = { ...user, ...fresh };
            }
        } catch (e) { /* ignore */ }

        try {
            if (user.id) {
                const axisRes = await fetch(`tables/user_preference_profiles/${encodeURIComponent(user.id)}`, { headers: getAuthHeadersSafe() });
                if (axisRes.status !== 404 && axisRes.ok) {
                    const axisData = await axisRes.json();
                    user = { ...user, ...axisData };
                }
            }
        } catch (e) { /* ignore */ }

        const displayName = user.display_name || user.username || user.nickname || '玩家';
        const ownedCount = parseArr(user.owned_games).length;
        const mbti = user.mbti_type || '未設定';
        const avatar = user.avatar_url ? null : getDefaultAvatar(user);

        const welcomeNameEl = document.getElementById('home-welcome-name');
        if (welcomeNameEl) welcomeNameEl.textContent = displayName;

        const avatarEl = document.getElementById('home-card-avatar');
        if (avatarEl) {
            if (user.avatar_url) {
                avatarEl.innerHTML = `<img src="${user.avatar_url}" alt="${displayName}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            } else if (avatar) {
                avatarEl.textContent = avatar.emoji;
                avatarEl.style.background = `linear-gradient(135deg, ${avatar.color}, var(--home-primary-dark, #a0826d))`;
            }
        }

        nameEl.textContent = displayName;
        const subEl = document.getElementById('home-card-sub');
        if (subEl) subEl.textContent = `${mbti} · 桌遊收藏 ${ownedCount} 款`;

        const bioEl = document.getElementById('home-card-bio');
        if (bioEl) {
            const bio = (user.bio || '').trim();
            if (bio) {
                bioEl.textContent = `玩家簡介：${bio}`;
                bioEl.style.display = 'block';
            } else {
                bioEl.style.display = 'none';
            }
        }

        const meta = getProfileCardMetaForUser(user);
        const infoRows = [];
        if (meta.play_times) infoRows.push(`<div><b>📅 常玩時段：</b>${meta.play_times}</div>`);
        if (meta.table_preferences) infoRows.push(`<div><b>🎯 開桌偏好：</b>${meta.table_preferences}</div>`);
        if (meta.favorite_mechanisms) infoRows.push(`<div><b>🧩 喜愛機制：</b>${meta.favorite_mechanisms}</div>`);
        if (meta.preferred_locations) infoRows.push(`<div><b>🏠 偏好地點：</b>${meta.preferred_locations}</div>`);
        if (meta.languages) infoRows.push(`<div><b>📝 文字接受度：</b>${meta.languages}</div>`);
        const regionText = getRegionText(user);
        if (regionText) infoRows.push(`<div><b>📍 活動範圍：</b>${regionText}</div>`);
        const infoList = document.getElementById('home-card-info-list');
        if (infoList) {
            infoList.innerHTML = infoRows.join('');
            infoList.style.display = infoRows.length ? 'grid' : 'none';
        }

        renderSocialInline(parseObj(user.social_links), !!user.want_contact);

        document.querySelectorAll('#home-mode-logged .card-ax-row[data-axis-key]').forEach((row) => {
            const key = row.getAttribute('data-axis-key');
            renderAxisRow(row, user[key]);
        });
    }

    function renderGamePills(containerId, items, countPrefix) {
        const el = document.getElementById(containerId);
        if (!el) return;
        if (!items.length) {
            el.innerHTML = '<div class="game-item"><span class="game-name">尚無資料</span><span class="game-votes">-</span></div>';
            return;
        }
        el.innerHTML = items.map((item, index) => {
            const gameName = (typeof GameNames !== 'undefined' && GameNames.formatInline)
                ? GameNames.formatInline(item.game)
                : item.game;
            const countText = countPrefix ? `${countPrefix} ${item.count}` : `${item.count}`;
            return `<div class="game-item"><span class="game-name">${index + 1}. ${gameName}</span><span class="game-votes">${countText}</span></div>`;
        }).join('');
    }

    async function loadHomeRecentGames() {
        if (typeof GameMBTI === 'undefined' || !GameMBTI.getAllUsers) return;
        try {
            const allUsers = await GameMBTI.getAllUsers();
            const stats = GameMBTI.calculateStats(allUsers);
            const popular = (stats.mostPopularGames || []).slice(0, 8);
            renderGamePills('home-popular-games', popular, '❤️');

            const wishlistCounts = {};
            allUsers.forEach((u) => {
                (u.wishlist || []).forEach((g) => {
                    wishlistCounts[g] = (wishlistCounts[g] || 0) + 1;
                });
            });
            const wishlistRanking = Object.entries(wishlistCounts)
                .map(([game, count]) => ({ game, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 8);
            renderGamePills('home-wishlist-games', wishlistRanking, '⭐');
        } catch (e) {
            const popularEl = document.getElementById('home-popular-games');
            const wishEl = document.getElementById('home-wishlist-games');
            if (popularEl) popularEl.innerHTML = '<div class="game-item"><span class="game-name">資料讀取失敗</span><span class="game-votes">-</span></div>';
            if (wishEl) wishEl.innerHTML = '<div class="game-item"><span class="game-name">資料讀取失敗</span><span class="game-votes">-</span></div>';
        }
    }

    function bindTilt(root) {
        const scope = root || document;
        const cards = scope.querySelectorAll('.js-tilt');
        const prefersCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        const maxTilt = prefersCoarse ? 0 : 6;
        cards.forEach((card) => {
            if (maxTilt === 0) {
                card.style.transform = 'none';
                return;
            }
            card.addEventListener('mouseenter', () => {
                card.classList.add('is-hover');
                card.style.transform = 'perspective(2200px) rotateX(0deg) rotateY(0deg) translateY(-1px)';
                card.style.boxShadow = '0 20px 34px rgba(45,45,45,0.20)';
            });
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                if (!rect.width || !rect.height) return;
                const px = (e.clientX - rect.left) / rect.width - 0.5;
                const py = (e.clientY - rect.top) / rect.height - 0.5;
                const pointerX = Math.round(Math.max(-1, Math.min(1, px * 2)) * 100) / 100;
                const pointerY = Math.round(Math.max(-1, Math.min(1, py * 2)) * 100) / 100;
                card.style.setProperty('--mx', `${((pointerX + 1) * 50).toFixed(2)}%`);
                card.style.setProperty('--my', `${((pointerY + 1) * 50).toFixed(2)}%`);
                const rx = (-pointerY * maxTilt).toFixed(2);
                const ry = (pointerX * maxTilt).toFixed(2);
                card.style.transform = `perspective(2200px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-1px)`;
                const sx = (-pointerX * 5).toFixed(2);
                const sy = (9 - pointerY * 4).toFixed(2);
                card.style.boxShadow = `${sx}px ${sy}px 24px rgba(45,45,45,0.20)`;
            });
            card.addEventListener('mouseleave', () => {
                card.classList.remove('is-hover');
                card.style.transform = 'perspective(2200px) rotateX(0deg) rotateY(0deg) translateY(0)';
                card.style.boxShadow = '0 16px 30px rgba(45,45,45,0.14)';
                card.style.setProperty('--mx', '50%');
                card.style.setProperty('--my', '50%');
            });
        });
    }

    function bindShortcutCards(root) {
        const scope = root || document;
        scope.querySelectorAll('.shortcut-card[data-href]').forEach((card) => {
            const href = card.getAttribute('data-href');
            if (!href) return;
            card.addEventListener('click', () => { window.location.href = href; });
        });
    }

    function bindLoggedHeroCard() {
        const el = document.querySelector('#home-mode-logged .hero-card.cursor-pointer');
        if (!el) return;
        el.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            if (e.target.closest('button')) return;
            if (e.target.closest('.home-card-actions')) return;
            window.location.href = 'profile.html';
        });
    }

    function refreshHomeDashboard() {
        loadHomeCardFromProfile();
        loadHomeRecentGames();
    }

    window.loadHomeCardFromProfile = loadHomeCardFromProfile;
    window.loadHomeRecentGames = loadHomeRecentGames;
    window.refreshHomeDashboard = refreshHomeDashboard;
    window.bindHomeDashboardTilt = bindTilt;

    document.addEventListener('DOMContentLoaded', () => {
        bindShortcutCards(document.getElementById('home-mode-guest'));
        bindShortcutCards(document.getElementById('home-mode-logged'));
        bindLoggedHeroCard();
        bindTilt(document.getElementById('home-mode-guest'));
        bindTilt(document.getElementById('home-mode-logged'));
        renderGuestPreviewAxes();
        loadHomeRecentGames();
    });
})();
