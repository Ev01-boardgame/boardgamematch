/**
 * 從 scripts/bgg-snapshots/*.md 解析 BGG 官方 browse 頁連結，產生 public/data/bgg-taxonomy.json
 * 若 BGG 新增主題／機制：更新快照檔後執行 node scripts/build-bgg-taxonomy.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function parseLinks(md, pathSeg) {
    const fullRe = new RegExp(
        '^\\[([^\\]]+)\\]\\(https://boardgamegeek\\.com/' + pathSeg + '/(\\d+)/[^)]+\\)\\s*$',
        'gm'
    );
    const byId = new Map();
    let m;
    while ((m = fullRe.exec(md)) !== null) {
        byId.set(Number(m[2]), { id: Number(m[2]), name: m[1] });
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

const catMd = fs.readFileSync(path.join(root, 'scripts/bgg-snapshots/categories.md'), 'utf8');
const mechMd = fs.readFileSync(path.join(root, 'scripts/bgg-snapshots/mechanics.md'), 'utf8');

const out = {
    meta: {
        sources: [
            'https://boardgamegeek.com/browse/boardgamecategory',
            'https://boardgamegeek.com/browse/boardgamemechanic'
        ],
        note: 'Parsed from scripts/bgg-snapshots/*.md. Update snapshots if BGG adds items, then re-run this script.',
        generatedAt: new Date().toISOString().slice(0, 10)
    },
    categories: parseLinks(catMd, 'boardgamecategory'),
    mechanics: parseLinks(mechMd, 'boardgamemechanic')
};

const outDir = path.join(root, 'public', 'data');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'bgg-taxonomy.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote public/data/bgg-taxonomy.json — categories:', out.categories.length, 'mechanics:', out.mechanics.length);
