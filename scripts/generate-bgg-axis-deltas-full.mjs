/**
 * 依 public/data/bgg-taxonomy.json 產出全部分類／機制六軸 delta，
 * 寫入 cloudflare/bgg-axis-defaults.js 與 public/js/bgg-axis-deltas-v1.js。
 *
 * 執行：node scripts/generate-bgg-axis-deltas-full.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function normTag(s) {
  return String(s || '').trim().toLowerCase().replace(/\u2019/g, "'");
}

/** 既有手動表（優先保留） */
const CATEGORY_SEED = {
  'abstract strategy': { mood: -1, control: 2, sociality: -2 },
  'card game': { control: 1 },
  "children's game": { entry: -2, mood: 1, control: -1 },
  deduction: { openness: 2, control: 1, mood: -1 },
  dice: { control: -2, mood: 1 },
  economic: { control: 2, openness: 1 },
  family: { entry: -2, mood: 1, control: -0.5 },
  fantasy: { mood: 0.5, sociality: -0.5 },
  fighting: { competition: 2, mood: 1 },
  humor: { mood: 2, sociality: 1 },
  'mature / adult': { mood: 1 },
  negotiation: { sociality: 2, openness: 2 },
  'party game': { mood: 3, sociality: 2, entry: -2, control: -1 },
  political: { sociality: 2, openness: 1 },
  puzzle: { mood: -2, sociality: -2, control: 1 },
  'real-time': { mood: 2, control: -1 },
  'science fiction': { mood: 0.5 },
  strategy: { control: 2, mood: -2, entry: 2 },
  'territory building': { competition: 1, control: 1 },
  thematic: { mood: 1, sociality: -1 },
  travel: { entry: -1 },
  trivia: { mood: 2, sociality: 1, control: -1 },
  wargame: { competition: 3, control: 2, mood: -2 },
  zombies: { mood: 1 }
};

const MECHANIC_SEED = {
  'action points': { control: 1 },
  'area majority / influence': { competition: 2, control: 1 },
  'auction / bidding': { openness: 1, competition: 1, sociality: 1 },
  'betting and bluffing': { openness: 2, control: -1 },
  'card draft': { control: 1, openness: 1 },
  'cooperative game': { competition: -3, sociality: 1 },
  'deck building': { control: 2, entry: 1 },
  deduction: { openness: 2, control: 1 },
  'dice rolling': { control: -2, mood: 1 },
  'grid movement': { control: 1 },
  'hand management': { control: 1 },
  'hidden roles': { openness: 3, sociality: 2 },
  income: { control: 1 },
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
  storytelling: { sociality: 2, mood: 1 },
  'take that': { competition: 2, mood: 2, openness: -1 },
  'tile placement': { control: 1 },
  trading: { sociality: 2, openness: 1 },
  'variable player powers': { entry: 1, openness: 1 },
  'variable set-up': { entry: 0.5 },
  voting: { sociality: 2, openness: 1 },
  'worker placement': { control: 2, openness: -0.5 }
};

function inferCategory(k) {
  const rules = [
    () => k === 'american west' && { mood: 1, competition: 1, sociality: 0.5 },
    () =>
      /^(wargame|american civil war|civil war|american revolutionary war|american indian wars|korean war|vietnam war|napoleonic|post-napoleonic|pike and shot|modern warfare|world war i|world war ii|age of reason)$/.test(
        k
      ) && { competition: 2.5, control: 1.5, mood: -2, sociality: -1.5, openness: 0.5 },
    () => k === 'abstract strategy' && { mood: -1, control: 2, sociality: -2 },
    () => k === 'card game' && { control: 1 },
    () => k.includes('children') && { entry: -2, mood: 1, control: -1 },
    () => /deduction/.test(k) && { openness: 2, control: 1, mood: -1 },
    () => k === 'dice' && { control: -2, mood: 1 },
    () =>
      /economic|city building|industry \/ manufacturing|trains|transportation/.test(k) && {
        control: 2,
        openness: 1,
        competition: 0.5
      },
    () => /negotiation|political|mafia/.test(k) && { sociality: 2, openness: 2 },
    () => /party game|humor|trivia|word game/.test(k) && {
      mood: 2.5,
      sociality: 1.5,
      entry: -1.5,
      control: -0.5
    },
    () => /puzzle|maze|memory|math|number/.test(k) && { mood: -2, sociality: -2, control: 1 },
    () => /real-time|racing/.test(k) && { mood: 2, control: -1 },
    () => /fighting/.test(k) && { competition: 2, mood: 1 },
    () => /territory building/.test(k) && { competition: 1, control: 1 },
    () => /travel/.test(k) && { entry: -1 },
    () => /bluffing/.test(k) && { openness: 2, control: -1, mood: 1 },
    () =>
      /murder \/ mystery|spies \/ secret agents/.test(k) && { openness: 2, control: 1, mood: -0.5 },
    () =>
      /fantasy|science fiction|space exploration|mythology|horror|pirates|nautical|arabian|medieval|ancient|prehistoric|renaissance|civilization|adventure|exploration|zombies|environmental/.test(
        k
      ) && { mood: 1, sociality: -1, openness: 0.5 },
    () =>
      /animals|farming|music|sports|movies|tv|radio|comic|novel-based|video game theme|book|religious|medical|educational|spies|secret agents/.test(
        k
      ) && { mood: 1, sociality: 0.5 },
    () =>
      /action \/ dexterity|electronic|miniatures|collectible components|game system/.test(k) && {
        mood: 1.5,
        control: -0.5,
        sociality: 0.5
      },
    () =>
      /expansion for base-game|fan expansion|third-party expansion|print & play/.test(k) && {
        entry: 0.5
      },
    () => /mature \/ adult/.test(k) && { mood: 1 },
    () => /aviation|flight/.test(k) && { competition: 1.5, control: 1, mood: -0.5 }
  ];
  for (const r of rules) {
    const d = r();
    if (d) return d;
  }
  return { mood: 0.5, sociality: -0.5, control: 0.25 };
}

function inferMechanic(k) {
  const rules = [
    () => /cooperative game/.test(k) && !/semi/.test(k) && { competition: -3, sociality: 1 },
    () => /semi-cooperative game/.test(k) && { competition: -1.5, sociality: 1.5, openness: 1 },
    () => /traitor game/.test(k) && { competition: 0.5, openness: 2, sociality: 1 },
    () => /worker placement/.test(k) && { control: 2, openness: -0.5 },
    () => /auction|bidding/.test(k) && { openness: 1, competition: 1, sociality: 1 },
    () => /deck construction|deck, bag, and pool building/.test(k) && { control: 2, entry: 1 },
    () => /dice rolling|die icon resolution|different dice movement|re-rolling and locking/.test(k) && {
      control: -2,
      mood: 1
    },
    () => /push your luck/.test(k) && { control: -2, mood: 2 },
    () => /hidden roles|roles with asymmetric information/.test(k) && { openness: 3, sociality: 2 },
    () => k === 'deduction' && { openness: 2, control: 1 },
    () => /real-time|elapsed real time ending|action timer/.test(k) && { mood: 2, control: -1, sociality: 0.5 },
    () => /simultaneous action selection/.test(k) && { sociality: 1, control: 1 },
    () => /tile placement/.test(k) && { control: 1 },
    () => /hand management/.test(k) && { control: 1 },
    () => /pattern building|pattern recognition|pattern movement/.test(k) && { control: 1, mood: -0.5 },
    () => /area majority|influence/.test(k) && { competition: 2, control: 1 },
    () => /pick-up and deliver/.test(k) && { control: 1 },
    () => /player elimination/.test(k) && { competition: 2, mood: 1 },
    () => /take that/.test(k) && { competition: 2, mood: 2, openness: -1 },
    () => /betting and bluffing/.test(k) && { openness: 2, control: -1 },
    () => /rock-paper-scissors/.test(k) && { control: -2 },
    () => /role playing|storytelling|acting|singing/.test(k) && { sociality: 2, mood: 1.5, openness: 1 },
    () => /trading|negotiation/.test(k) && !/auction/.test(k) && { sociality: 2, openness: 1 },
    () => /voting/.test(k) && { sociality: 2, openness: 1 },
    () => /set collection/.test(k) && { control: 0.5 },
    () => /solo \/ solitaire/.test(k) && { sociality: -2 },
    () => /legacy game|scenario \/ mission|campaign \/ battle card driven/.test(k) && {
      entry: 2,
      mood: 0.5,
      sociality: 1
    },
    () => /modular board|map addition|map reduction|multiple maps/.test(k) && { entry: 1, control: 0.5 },
    () => /variable player powers|variable set-up/.test(k) && { entry: 1, openness: 1 },
    () => /once-per-game abilities/.test(k) && { control: 1 },
    () =>
      /income|automatic resource growth|stock holding|investment|commodity speculation|market|loans|closed economy auction/.test(
        k
      ) && { control: 1.5, openness: 0.5 },
    () => /grid movement|hexagon grid|square grid|point to point movement|area movement/.test(k) && {
      control: 1
    },
    () => /hidden movement|secret unit deployment/.test(k) && { openness: 2, control: 0.5 },
    () => /^memory$/i.test(k) && { mood: -1, control: 0.5, sociality: -0.5 },
    () => /flicking|stacking and balancing|measurement movement|physical removal|slide \/ push/.test(k) && {
      mood: 2,
      control: -1.5,
      sociality: 0.5
    },
    () => /team-based game/.test(k) && { competition: -1, sociality: 2 },
    () =>
      /programmed movement|action queue|action points|movement points|rondel|impulse movement|track movement/.test(k) && {
        control: 1.5
      },
    () => /trick-taking/.test(k) && { control: 1, openness: 1 },
    () => /roll \/ spin and move/.test(k) && { control: -2, mood: 0.5 },
    () => /bingo|questions and answers|spelling|speed matching/.test(k) && { mood: 1.5, control: -1 },
    () => /paper-and-pencil|line drawing/.test(k) && { sociality: -0.5, mood: 0 },
    () => /turn order:/.test(k) && { sociality: 0.5, control: 0.5 },
    () => /open drafting|closed drafting|action drafting|card play conflict resolution/.test(k) && {
      control: 1,
      openness: 1
    },
    () => /tech trees|tech tracks/.test(k) && { control: 2, entry: 1 },
    () => /network and route building|crayon rail system|connections/.test(k) && {
      control: 1.5,
      competition: 0.5
    },
    () => /cube tower/.test(k) && { control: -1.5, mood: 1 },
    () => /events|interrupts|variable phase order|finale ending|sudden death ending/.test(k) && {
      mood: 0.5,
      control: 0.5
    },
    () =>
      /simulation|ratio \/ combat results table|critical hits and failures|stat check resolution|minimap resolution/.test(
        k
      ) && { mood: -1.5, control: 1.5, competition: 1 }
  ];
  for (const r of rules) {
    const d = r();
    if (d) return d;
  }
  return { control: 0.5, mood: 0.25 };
}

function buildMaps(taxonomy) {
  const cat = {};
  for (const it of taxonomy.categories) {
    const key = normTag(it.name);
    if (CATEGORY_SEED[key] != null) cat[key] = { ...CATEGORY_SEED[key] };
    else cat[key] = inferCategory(key);
  }
  const mech = {};
  for (const it of taxonomy.mechanics) {
    const key = normTag(it.name);
    if (MECHANIC_SEED[key] != null) mech[key] = { ...MECHANIC_SEED[key] };
    else mech[key] = inferMechanic(key);
  }
  return { cat, mech };
}

function escapeKey(k) {
  if (/^[a-z0-9_]+$/.test(k)) return `'${k}'`;
  return JSON.stringify(k);
}

function formatDeltaMap(map, innerPad) {
  const keys = Object.keys(map).sort((a, b) => a.localeCompare(b));
  return keys
    .map((key) => {
      const inner = map[key];
      const innerStr = Object.keys(inner)
        .sort()
        .map((ax) => `${ax}: ${inner[ax]}`)
        .join(', ');
      return `${innerPad}${escapeKey(key)}: { ${innerStr} }`;
    })
    .join(',\n');
}

function writeDefaults(cat, mech) {
  const catStr = formatDeltaMap(cat, '    ');
  const mechStr = formatDeltaMap(mech, '    ');
  const content = `/**
 * 與 public/js/bgg-axis-deltas-v1.js 內容一致；API 無 DB 覆寫時使用。
 * 若改預設值，請同步更新 public/js/bgg-axis-deltas-v1.js。
 * 全表由 scripts/generate-bgg-axis-deltas-full.mjs 依 bgg-taxonomy.json 產生（可重跑）。
 */
export const BGG_AXIS_DEFAULTS = {
  version: 1,
  AXIS_KEYS: ['entry', 'mood', 'control', 'openness', 'sociality', 'competition'],
  AXIS_LABELS_ZH: {
    entry: '進入門檻（高＝複雜）',
    mood: '歡樂 ↔ 燒腦',
    control: '運氣 ↔ 策略',
    openness: '磊落 ↔ 心機',
    sociality: '社交 ↔ 沉浸',
    competition: '合作 ↔ 對抗'
  },
  CATEGORY_AXIS_DELTAS: {
${catStr}
  },
  MECHANIC_AXIS_DELTAS: {
${mechStr}
  }
};
`;
  fs.writeFileSync(path.join(ROOT, 'cloudflare', 'bgg-axis-defaults.js'), content, 'utf8');
}

function writeV1(cat, mech) {
  const catStr = formatDeltaMap(cat, '        ');
  const mechStr = formatDeltaMap(mech, '        ');
  const content = `/**
 * BGG Category（主題）／Mechanic（機制）→ 六軸「加總修正量」（delta）
 * 與 admin-bgg-axis-sync 的 computeSixAxes 一致。
 * 正式環境：後台頁會先請求 GET /api/bgg-axis-deltas（公開）覆寫 window.BGG_AXIS_V1；
 * 此檔為離線／API 失敗時的後備，且應與 cloudflare/bgg-axis-defaults.js 預設值同步。
 * 官方「全部」主題／機制清單見 public/data/bgg-taxonomy.json（由 scripts/build-bgg-taxonomy.mjs 產生）。
 * 全表由 scripts/generate-bgg-axis-deltas-full.mjs 產生（可重跑）。
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
${catStr}
    };

    /** BGG Mechanic → 各軸加總修正 */
    const MECHANIC_AXIS_DELTAS = {
${mechStr}
    };

    global.BGG_AXIS_V1 = {
        version: 1,
        AXIS_KEYS,
        AXIS_LABELS_ZH,
        CATEGORY_AXIS_DELTAS,
        MECHANIC_AXIS_DELTAS
    };
})(typeof window !== 'undefined' ? window : globalThis);
`;
  fs.writeFileSync(path.join(ROOT, 'public', 'js', 'bgg-axis-deltas-v1.js'), content, 'utf8');
}

const taxonomy = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'bgg-taxonomy.json'), 'utf8'));
const { cat, mech } = buildMaps(taxonomy);
writeDefaults(cat, mech);
writeV1(cat, mech);
console.log('OK: categories', Object.keys(cat).length, 'mechanics', Object.keys(mech).length);
