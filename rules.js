(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TubeRules = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PATTERNS = ['solid', 'stripes', 'vstripes', 'diagonal', 'dots', 'checker', 'grid', 'wood'];

  function normalizeLevel(raw) {
    const errors = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw Object.assign(new Error('Nível inválido'), { details: ['O arquivo deve conter um objeto JSON.'] });
    }

    const defaultCapacity = raw.defaultCapacity ?? 4;
    if (!Number.isInteger(defaultCapacity) || defaultCapacity < 1) errors.push('"defaultCapacity" deve ser inteiro ≥ 1.');

    const colors = {};
    if (!raw.colors || typeof raw.colors !== 'object' || Array.isArray(raw.colors)) {
      errors.push('"colors" é obrigatório e deve ser um objeto.');
    } else {
      for (const [id, def] of Object.entries(raw.colors)) {
        const d = typeof def === 'string' ? { color: def } : def;
        if (!d || typeof d.color !== 'string' || !d.color.trim()) { errors.push(`colors.${id}: "color" é obrigatório.`); continue; }
        const pattern = d.pattern ?? 'solid';
        if (!PATTERNS.includes(pattern)) errors.push(`colors.${id}: pattern "${pattern}" não existe (${PATTERNS.join(', ')}).`);
        colors[id] = { color: d.color, pattern, label: d.label ?? id };
      }
    }

    const tubes = [];
    if (!Array.isArray(raw.tubes) || raw.tubes.length === 0) {
      errors.push('"tubes" deve ser um array com pelo menos 1 tubo.');
    } else {
      raw.tubes.forEach((t, i) => {
        const obj = Array.isArray(t) ? { contents: t } : t;
        if (!obj || typeof obj !== 'object') { errors.push(`tubes[${i}]: formato inválido.`); return; }
        const capacity = obj.capacity ?? defaultCapacity;
        const contents = obj.contents ?? [];
        if (!Number.isInteger(capacity) || capacity < 1) errors.push(`tubes[${i}]: "capacity" deve ser inteiro ≥ 1.`);
        if (!Array.isArray(contents)) { errors.push(`tubes[${i}]: "contents" deve ser um array.`); return; }
        if (contents.length > capacity) errors.push(`tubes[${i}]: ${contents.length} unidades excedem a capacidade ${capacity}.`);
        contents.forEach((c, j) => { if (!(c in colors)) errors.push(`tubes[${i}].contents[${j}]: cor "${c}" não definida em "colors".`); });
        tubes.push({ capacity, contents: contents.slice() });
      });
    }

    if (tubes.length) {
      const maxCap = Math.max(...tubes.map(t => t.capacity));
      for (const [id, n] of Object.entries(countColors(tubes))) {
        if (n > maxCap) errors.push(`A cor "${id}" tem ${n} unidades, mas o maior tubo comporta ${maxCap}.`);
      }
    }

    let layout = raw.layout?.groups ?? [[tubes.map((_, i) => i)]];
    if (!Array.isArray(layout)) { errors.push('"layout.groups" deve ser um array.'); layout = [[tubes.map((_, i) => i)]]; }
    const seen = new Map();
    layout.forEach((group, g) => (Array.isArray(group) ? group : []).forEach((row, r) => (Array.isArray(row) ? row : []).forEach(idx => {
      if (!Number.isInteger(idx) || idx < 0 || idx >= tubes.length) errors.push(`layout.groups[${g}][${r}]: índice ${idx} não existe.`);
      seen.set(idx, (seen.get(idx) || 0) + 1);
    })));
    if (raw.layout) tubes.forEach((_, i) => {
      if (!seen.has(i)) errors.push(`layout: tubo ${i} não aparece no layout.`);
      else if (seen.get(i) > 1) errors.push(`layout: tubo ${i} aparece mais de uma vez.`);
    });

    if (errors.length) throw Object.assign(new Error('Nível inválido'), { details: errors });

    return {
      id: raw.id ?? null,
      name: raw.name ?? 'Tubos',
      colors,
      tubes,
      layout,
    };
  }

  function countColors(tubes) {
    const count = {};
    for (const t of tubes) for (const c of t.contents) count[c] = (count[c] || 0) + 1;
    return count;
  }

  function cloneTubes(tubes) {
    return tubes.map(t => ({ capacity: t.capacity, contents: t.contents.slice() }));
  }

  function topRun(tube) {
    const c = tube.contents;
    if (!c.length) return null;
    const color = c[c.length - 1];
    let n = 0;
    for (let i = c.length - 1; i >= 0 && c[i] === color; i--) n++;
    return { color, n };
  }

  function pourAmount(tubes, from, to) {
    if (from === to) return 0;
    const a = tubes[from], b = tubes[to];
    const run = topRun(a);
    if (!run) return 0;
    const space = b.capacity - b.contents.length;
    if (space <= 0) return 0;
    if (b.contents.length && b.contents[b.contents.length - 1] !== run.color) return 0;
    return Math.min(run.n, space);
  }

  function pour(tubes, from, to) {
    const n = pourAmount(tubes, from, to);
    for (let i = 0; i < n; i++) tubes[to].contents.push(tubes[from].contents.pop());
    return n;
  }

  function isSolved(tubes) {
    const where = {};
    for (const t of tubes) {
      if (!t.contents.length) continue;
      const color = t.contents[0];
      if (t.contents.some(c => c !== color)) return false;
      if (where[color]) return false;
      where[color] = true;
    }
    return true;
  }

  function isTubeComplete(tubes, i, totals) {
    const t = tubes[i];
    if (!t.contents.length) return false;
    const color = t.contents[0];
    return t.contents.every(c => c === color) && t.contents.length === totals[color];
  }

  function solve(start, { rand = Math.random, limit = 400000 } = {}) {
    const caps = start.map(t => t.capacity);
    const key = st => st.map((t, i) => caps[i] + ':' + t.contents.join(',')).sort().join('|');
    const seen = new Set();

    const options = st => {
      const list = [];
      for (let a = 0; a < st.length; a++) {
        const run = topRun(st[a]);
        if (!run) continue;
        const wholeTube = run.n === st[a].contents.length;
        for (let b = 0; b < st.length; b++) {
          if (!pourAmount(st, a, b)) continue;
          if (wholeTube && !st[b].contents.length) continue;
          list.push({ a, b, w: (st[b].contents.length ? 0 : 1) + rand() * 0.9 });
        }
      }
      return list.sort((x, y) => y.w - x.w);
    };

    const root = cloneTubes(start);
    if (isSolved(root)) return [];
    seen.add(key(root));
    const stack = [{ st: root, opts: options(root), move: null }];

    while (stack.length) {
      const top = stack[stack.length - 1];
      const m = top.opts.pop();
      if (!m) { stack.pop(); continue; }
      const next = cloneTubes(top.st);
      pour(next, m.a, m.b);
      const k = key(next);
      if (seen.has(k)) continue;
      seen.add(k);
      stack.push({ st: next, opts: options(next), move: [m.a, m.b] });
      if (isSolved(next)) return stack.slice(1).map(f => f.move);
      if (seen.size > limit) return null;
    }
    return null;
  }

  return { PATTERNS, normalizeLevel, countColors, cloneTubes, topRun, pourAmount, pour, isSolved, isTubeComplete, solve };
});
