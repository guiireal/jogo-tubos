#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const R = require('../rules.js');

const [cmd, file, ...rest] = process.argv.slice(2);
const opt = parseOpts(cmd === 'campaign' ? [file, ...rest] : rest);


const LEVELS = 100;


const BANDS = [[2, 2], [5, 3], [9, 4], [14, 5], [20, 6], [27, 7], [35, 8], [43, 9], [50, 10], [62, 10], [75, 11], [88, 12], [100, 12]];



const MIXED = n => n >= 4 && n % 3 === 1;

const SPECIAL = { 12: 'levels/bases/classico-4.json', 25: 'levels/bases/torres-5.json', 40: 'levels/bases/designer-eye.json' };

const PALETTE = {
  red:    { color: '#ef4444', pattern: 'solid',    label: 'vermelho' },
  blue:   { color: '#3b82f6', pattern: 'stripes',  label: 'azul' },
  green:  { color: '#22c55e', pattern: 'dots',     label: 'verde' },
  yellow: { color: '#facc15', pattern: 'diagonal', label: 'amarelo' },
  violet: { color: '#a855f7', pattern: 'checker',  label: 'roxo' },
  orange: { color: '#f97316', pattern: 'vstripes', label: 'laranja' },
  cyan:   { color: '#67e8f9', pattern: 'grid',     label: 'ciano' },
  pink:   { color: '#f9a8d4', pattern: 'dots',     label: 'rosa' },
  brown:  { color: '#a2692f', pattern: 'wood',     label: 'marrom' },
  teal:   { color: '#0f766e', pattern: 'checker',  label: 'verde-petróleo' },
  lime:   { color: '#a3e635', pattern: 'vstripes', label: 'verde-limão' },
  magenta:{ color: '#ea3fe0', pattern: 'diagonal', label: 'magenta' },
};

if (cmd === 'campaign') { campaign(); process.exit(0); }

if (!cmd || !file || !['check', 'shuffle'].includes(cmd)) {
  console.error('Uso: node tools/tubos.mjs <check|shuffle> <nivel.json> [--seed N] [--id ID] [--name NOME]');
  console.error('     node tools/tubos.mjs campaign');
  process.exit(1);
}

const raw = JSON.parse(readFileSync(file, 'utf8'));
let level;
try {
  level = R.normalizeLevel(raw);
} catch (e) {
  console.error('✗ ' + e.message + '\n  - ' + (e.details || []).join('\n  - '));
  process.exit(1);
}

if (cmd === 'check') {
  const sol = bestOf(level.tubes, 25);
  if (!sol) { console.error('✗ Válido, mas SEM solução.'); process.exit(2); }
  console.error(`✓ Válido e solucionável — solução encontrada com ${sol.length} jogadas (não necessariamente a mínima).`);
}

if (cmd === 'shuffle') {
  const rand = mulberry32(Number(opt.seed ?? Date.now()));
  const units = level.tubes.flatMap(t => t.contents);
  let tubes, sol, tries = 0;
  do {
    if (++tries > 500) { console.error('✗ Não achei embaralhamento com solução em 500 tentativas.'); process.exit(2); }
    const pool = shuffle(units.slice(), rand);
    tubes = level.tubes.map(t => ({ capacity: t.capacity, contents: pool.splice(0, t.contents.length) }));
    const totals = R.countColors(tubes);
    
    if (tubes.some((_, i) => R.isTubeComplete(tubes, i, totals))) continue;
    sol = bestOf(tubes, 10, rand);
  } while (!sol);

  const out = {
    $schema: '../level.schema.json',
    id: opt.id ?? raw.id,
    name: opt.name ?? raw.name,
    colors: raw.colors,
    tubes: tubes.map(t => ({ capacity: t.capacity, contents: t.contents })),
    ...(raw.layout ? { layout: raw.layout } : {}),
  };
  process.stdout.write(formatLevel(out) + '\n');
  console.error(`✓ Embaralhado (tentativa ${tries}) — solução encontrada com ${sol.length} jogadas.`);
}



function campaign() {
  for (let n = Number(opt.from ?? 1); n <= LEVELS; n++) {
    const rand = mulberry32(Number(opt.seed ?? 0) + n * 7919);
    const bandIdx = BANDS.findIndex(([last]) => n <= last);
    const first = bandIdx ? BANDS[bandIdx - 1][0] + 1 : 1;
    const last = BANDS[bandIdx][0];
    const pos = last === first ? 0.5 : (n - first) / (last - first);

    let template, colors, layout, make, name = `Nível ${n}`;
    if (SPECIAL[n]) {
      const raw = JSON.parse(readFileSync(SPECIAL[n], 'utf8'));
      template = R.normalizeLevel(raw).tubes;
      colors = raw.colors;
      layout = raw.layout?.groups;
    } else {
      const k = BANDS[bandIdx][1];
      const ids = shuffle(Object.keys(PALETTE), rand).slice(0, k);
      colors = Object.fromEntries(ids.map(id => [id, PALETTE[id]]));
      if (MIXED(n)) {
        
        const sizes = n < 20 ? [3, 4, 4, 5] : n < 35 ? [3, 4, 5, 6] : n <= 50 ? [3, 4, 5, 6, 7] : [4, 5, 6, 7];
        const pickSize = () => sizes[Math.floor(rand() * sizes.length)];
        const goals = ids.map(id => ({ id, cap: pickSize() }));
        const lo = n > 50 ? 4 : 3;
        const extras = [lo + Math.floor(rand() * 3), lo + Math.floor(rand() * 3)];   
        const caps = shuffle([...goals.map(g => g.cap), ...extras], rand)
          .sort((a, b) => (b >= 6) - (a >= 6));                                    
        const units = goals.flatMap(g => Array(g.cap).fill(g.id));
        make = () => randomFill(caps, units, rand);
        const tall = caps.filter(c => c >= 6).length;
        layout = tall ? [rowsOf(range(0, tall)), rowsOf(range(tall, caps.length))] : [rowsOf(range(0, caps.length))];
      } else {
        const cap = n > 75 || (n > 50 && n % 2) || (n >= 15 && n % 5 === 0) ? 5 : 4;
        template = [
          ...ids.map(id => ({ capacity: cap, contents: Array(cap).fill(id) })),
          ...Array.from({ length: k === 2 ? 1 : 2 }, () => ({ capacity: cap, contents: [] })),
        ];
      }
    }

    make ??= () => shuffleKeepingCounts(template, rand);
    const lim = n > 50 ? 200000 : 60000;
    const cands = MIXED(n) ? candidates(make, rand, 10, 3, lim) : candidates(make, rand, 24, 6, lim);
    if (!cands.length) { console.error(`✗ Nível ${n}: nenhum embaralhamento solucionável.`); process.exit(2); }
    const p = n > 50 ? 0.5 + 0.5 * pos : MIXED(n) ? 0.1 + 0.5 * pos : 0.1 + 0.8 * pos;   
    const pick = cands[Math.round(p * (cands.length - 1))];

    const total = pick.tubes.length;
    const out = {
      $schema: '../level.schema.json',
      id: `level-${String(n).padStart(3, '0')}`,
      name,
      colors,
      tubes: pick.tubes,
      
      ...(layout ? { layout: { groups: layout } }
        : total > 7 ? { layout: { groups: [[range(0, Math.ceil(total / 2)), range(Math.ceil(total / 2), total)]] } }
        : {}),
    };
    writeFileSync(`levels/${out.id}.json`, formatLevel(out) + '\n');
    console.error(`✓ ${out.id}  ${String(Object.keys(colors).length).padStart(2)} cores  ${String(total).padStart(2)} tubos  ~${pick.moves} jogadas`);
  }
}


function candidates(make, rand, count, attempts = 6, limit = 60000) {
  const out = [];
  for (let tries = 0; out.length < count && tries < count * 20; tries++) {
    const tubes = make();
    const totals = R.countColors(tubes);
    if (tubes.some((_, i) => R.isTubeComplete(tubes, i, totals))) continue;
    const sol = bestOf(tubes, attempts, rand, limit);   
    if (sol?.length) out.push({ tubes, moves: sol.length });
  }
  return out.sort((a, b) => a.moves - b.moves);
}


function shuffleKeepingCounts(template, rand) {
  const pool = shuffle(template.flatMap(t => t.contents), rand);
  return template.map(t => ({ capacity: t.capacity, contents: pool.splice(0, t.contents.length) }));
}


function randomFill(caps, units, rand) {
  const tubes = caps.map(capacity => ({ capacity, contents: [] }));
  const small = caps.map((c, i) => i).filter(i => caps[i] <= 5);
  const empty = small[Math.floor(rand() * small.length)];
  for (const u of shuffle(units.slice(), rand)) {
    const open = tubes.filter((t, i) => i !== empty && t.contents.length < t.capacity);
    if (!open.length) return tubes.map(t => ({ capacity: t.capacity, contents: [] }));   
    open[Math.floor(rand() * open.length)].contents.push(u);
  }
  return tubes;
}


function rowsOf(idx) {
  const rows = Math.ceil(idx.length / 6), per = Math.ceil(idx.length / rows);
  return Array.from({ length: rows }, (_, r) => idx.slice(r * per, (r + 1) * per));
}

function range(a, b) { return Array.from({ length: b - a }, (_, i) => a + i); }


function solve(tubes, rand, limit) { return R.solve(tubes, { rand, limit }); }

function bestOf(tubes, attempts, rand = mulberry32(1), limit) {
  let best = null;
  for (let i = 0; i < attempts; i++) {
    const s = solve(tubes, rand, limit);
    if (s && (!best || s.length < best.length)) best = s;
    if (!s && i === 0) return null;
  }
  return best;
}


function parseOpts(args) {
  const o = {};
  for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) o[args[i].slice(2)] = args[++i];
  return o;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}


function formatLevel(obj) {
  return JSON.stringify(obj, null, 2)
    .replace(/\[\s+((?:"[^"]*"|\d+)(?:,\s+(?:"[^"]*"|\d+))*)\s+\]/g, (_, inner) => '[' + inner.replace(/,\s+/g, ', ') + ']')
    .replace(/\{\s+"capacity": (\d+),\s+"contents": (\[[^\]]*\])\s+\}/g, '{ "capacity": $1, "contents": $2 }')
    .replace(/\{\s+"color": ("[^"]*"),\s+"pattern": ("[^"]*")(?:,\s+"label": ("[^"]*"))?\s+\}/g,
      (_, c, p, l) => `{ "color": ${c}, "pattern": ${p}${l ? `, "label": ${l}` : ''} }`);
}
