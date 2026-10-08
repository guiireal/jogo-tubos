
(() => {
  "use strict";

  const R = window.TubeRules;
  const LEVEL_COUNT = 100;
  const levelPath = (n) => `levels/level-${String(n).padStart(3, "0")}.json`;

  const $ = (id) => document.getElementById(id);
  const ui = {
    board: $("board"),
    name: $("level-name"),
    moves: $("moves"),
    bar: $("bar"),
    status: $("status"),
    undo: $("undo"),
    retry: $("retry"),
    help: $("help"),
    next: $("next"),
    prev: $("prev"),
    fwd: $("fwd"),
    restart: $("restart"),
    tutorial: $("tutorial"),
  };

  let level = null; 
  let tubes = []; 
  let totals = {}; 
  let tubeEls = []; 
  let undoStack = []; 
  let moves = 0;
  let selected = null;
  let completed = false; 
  let levelNum = null; 
  const pours = new Set(); 
  let winTimer = 0; 
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  
  
  async function load(src) {
    settle(true);
    levelNum = typeof src === "number" ? src : null;
    if (levelNum) src = levelPath(levelNum);
    try {
      const res = await fetch(src, { cache: "no-store" });
      if (!res.ok)
        throw new Error(
          `Não foi possível carregar "${src}" (HTTP ${res.status}).`,
        );
      start(R.normalizeLevel(await res.json()));
    } catch (err) {
      showError(err, src);
    }
  }

  function start(lvl) {
    level = lvl;
    totals = R.countColors(level.tubes);
    ui.name.textContent = level.name;
    document.title = `${level.name} · Tubos`;
    ui.retry.disabled = false;
    buildBoard();
    reset();
  }

  function reset() {
    settle(true);
    clearTimeout(winTimer);
    winTimer = 0;
    tubes = R.cloneTubes(level.tubes);
    undoStack = [];
    moves = 0;
    selected = null;
    completed = false;
    tubes.forEach((_, i) => drawTube(i));
    updateHud();
  }

  function undo() {
    if (!undoStack.length || completed) return;
    settle(true);
    tubes = undoStack.pop();
    moves--;
    selected = null;
    tubes.forEach((_, i) => drawTube(i));
    updateHud();
  }

  
  function buildBoard() {
    ui.board.replaceChildren();
    tubeEls = [];
    level.layout.forEach((group, g) => {
      if (g > 0) ui.board.append(el("div", "divider"));
      const groupEl = el("div", "group");
      group.forEach((row) => {
        const rowEl = el("div", "row");
        row.forEach((i) => {
          const btn = el("button", "tube");
          btn.type = "button";
          btn.style.setProperty("--cap", level.tubes[i].capacity);
          btn.append(el("span", "rim"), el("span", "glass"));
          btn.addEventListener("click", () => onTubeClick(i));
          tubeEls[i] = btn;
          rowEl.append(btn);
        });
        groupEl.append(rowEl);
      });
      ui.board.append(groupEl);
    });
  }

  function drawTube(i) {
    const btn = tubeEls[i];
    const glass = btn.querySelector(".glass");
    const contents = tubes[i].contents;
    glass.replaceChildren(
      ...contents.map((id) => {
        const seg = el("span", "seg");
        const c = level.colors[id];
        seg.style.setProperty("--c", c.color);
        if (c.pattern !== "solid") seg.dataset.p = c.pattern;
        return seg;
      }),
    );
    btn.classList.toggle("selected", selected === i);
    btn.classList.toggle("complete", isTubeDone(i));
    const desc = contents.length
      ? contents.map((id) => level.colors[id].label).join(", ")
      : "vazio";
    btn.setAttribute(
      "aria-label",
      `Tubo ${i + 1} (${contents.length}/${tubes[i].capacity}): ${desc}`,
    );
    btn.setAttribute("aria-pressed", String(selected === i));
  }

  
  
  function isTubeDone(i) {
    const c = tubes[i].contents;
    return (
      R.isTubeComplete(tubes, i, totals) ||
      (c.length > 0 &&
        c.length === tubes[i].capacity &&
        c.every((id) => id === c[0]))
    );
  }

  function updateHud() {
    const won = completed && !pours.size && !winTimer; 
    ui.moves.textContent = moves;
    ui.undo.disabled = !undoStack.length || completed;
    ui.bar.classList.toggle("done", won);
    ui.status.textContent = !won
      ? "Em jogo"
      : levelNum === LEVEL_COUNT
        ? "Todos os níveis completos!"
        : "Completo!";
    ui.next.hidden = !(won && levelNum && levelNum < LEVEL_COUNT);
    ui.prev.disabled = !levelNum || levelNum <= 1;
    ui.fwd.disabled = !levelNum || levelNum >= maxUnlocked;
    ui.prev.style.visibility = levelNum === 1 ? "hidden" : "";
    ui.fwd.style.visibility = levelNum === LEVEL_COUNT ? "hidden" : "";
  }

  
  
  function onTubeClick(i) {
    if (completed) return;

    if (selected === null) {
      if (tubes[i].contents.length) {
        select(i);
        sfx.lift();
      } else shake(i);
      return;
    }
    if (selected === i) {
      select(null);
      sfx.drop();
      return;
    }

    const from = selected;
    if (R.pourAmount(tubes, from, i) === 0) {
      
      if (tubes[i].contents.length) {
        select(i);
        sfx.lift();
      } else {
        shake(i);
        select(null);
      }
      return;
    }

    settle(false, [from, i]); 
    undoStack.push(R.cloneTubes(tubes));
    const before = tubes[i].contents.length;
    const n = R.pour(tubes, from, i);
    moves++;
    select(null);
    completed = R.isSolved(tubes);
    const closed = isTubeDone(i);

    animatePour(from, i, n, before, () => {
      if (completed) {
        if (levelNum) unlock(levelNum + 1);
        sfx.win();
        tubes.forEach(
          (t, k) =>
            t.contents.length &&
            setTimeout(() => completed && celebrate(k), k * 70), 
        );
        
        winTimer = setTimeout(() => {
          winTimer = 0;
          updateHud();
        }, tubes.length * 70 + 900);
      } else if (closed) {
        sfx.complete();
        celebrate(i);
      }
    });
    updateHud(); 
  }

  
  
  function settle(silent, only) {
    for (const job of [...pours]) {
      if (!only || only.includes(job.from) || only.includes(job.to))
        job.finish(silent);
    }
  }

  
  
  
  function animatePour(from, to, n, before, onDone) {
    const src = tubeEls[from],
      dst = tubeEls[to];
    const cap = tubes[to].capacity;
    const pourSec = 0.25 + n * 0.18;
    const anims = [];
    let stream = null;

    const job = {
      from,
      to,
      done: false,
      finish(silent) {
        if (job.done) return;
        job.done = true;
        pours.delete(job);
        anims.forEach((a) => a.cancel());
        stream?.remove();
        src.style.zIndex = "";
        drawTube(from);
        drawTube(to);
        if (!silent) onDone();
        updateHud();
      },
    };
    pours.add(job);

    if (reduceMotion.matches) {
      playPour(pourSec, before / cap, (before + n) / cap);
      job.finish();
      return;
    }

    const animate = (target, frames, opts) => {
      const a = target.animate(frames, opts);
      anims.push(a);
      return a;
    };
    const wait = (a) => a.finished.catch(() => {}); 

    (async () => {
      
      const lift = getComputedStyle(src).transform; 
      const liftY = lift === "none" ? 0 : new DOMMatrix(lift).m42;
      const s = src.getBoundingClientRect(),
        d = dst.getBoundingClientRect();
      const side = d.left >= s.left ? 1 : -1;
      const mouthX = d.left + d.width / 2 - side * d.width * 0.2;
      const mouthY = d.top - 22;
      const tilted = `translate(${mouthX - (s.left + s.width / 2)}px, ${mouthY - (s.top - liftY)}px) rotate(${side * 70}deg)`;

      src.style.zIndex = 10;
      const go = animate(src, [{ transform: lift }, { transform: tilted }], {
        duration: 320,
        easing: "ease-in-out",
        fill: "forwards",
      });
      await wait(go);
      if (job.done) return;

      
      const segPx = (d.height - 8) / cap;
      const w = Math.max(4, d.width * 0.2);
      stream = el("div", "stream");
      Object.assign(stream.style, {
        left: `${mouthX - w / 2}px`,
        top: `${mouthY}px`,
        width: `${w}px`,
        height: `${d.bottom - 3 - before * segPx - mouthY}px`,
        background: level.colors[tubes[to].contents[before]].color,
      });
      document.body.append(stream);
      animate(
        stream,
        [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }],
        { duration: 90, easing: "ease-in" },
      );

      
      drawTube(to);
      const opts = {
        duration: pourSec * 1000,
        easing: "linear",
        fill: "forwards",
      };
      const drain = [...src.querySelector(".glass").children]
        .slice(-n)
        .map((seg) =>
          animate(
            seg,
            [{ flexBasis: `${segPx}px` }, { flexBasis: "0px" }],
            opts,
          ),
        );
      [...dst.querySelector(".glass").children]
        .slice(-n)
        .forEach((seg) =>
          animate(
            seg,
            [{ flexBasis: "0px" }, { flexBasis: `${segPx}px` }],
            opts,
          ),
        );
      playPour(pourSec, before / cap, (before + n) / cap);
      await Promise.all(drain.map(wait));
      if (job.done) return;

      
      stream.style.transformOrigin = "bottom";
      animate(
        stream,
        [{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }],
        { duration: 120, fill: "forwards" },
      );
      drawTube(from);
      go.cancel();
      await wait(
        animate(src, [{ transform: tilted }, { transform: "none" }], {
          duration: 300,
          easing: "ease-in-out",
        }),
      );
      job.finish();
    })();
  }

  
  
  
  let audio = null;
  let glub = null; 

  function ctx() {
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      audio.resume();
      return audio;
    } catch {
      return null;
    }
  }

  async function loadGlub() {
    const a = ctx();
    if (!a) return;
    try {
      const res = await fetch("sounds/glub.mp3");
      glub = await a.decodeAudioData(await res.arrayBuffer());
    } catch (err) {
      console.warn("[tubos] som do despejo indisponível", err);
    }
  }

  
  function playPour(sec, fromFill, toFill) {
    const a = ctx();
    if (!a || !glub) return;
    const t0 = a.currentTime,
      end = t0 + sec;
    const src = a.createBufferSource();
    src.buffer = glub;
    src.playbackRate.setValueAtTime(0.85 + fromFill * 0.4, t0);
    src.playbackRate.linearRampToValueAtTime(0.85 + toFill * 0.4, end);
    const g = a.createGain();
    g.gain.setValueAtTime(0.7, t0);
    g.gain.setValueAtTime(0.7, end - 0.08);
    g.gain.linearRampToValueAtTime(0, end);
    src.connect(g).connect(a.destination);
    
    src.start(t0, Math.random() * Math.max(0, glub.duration - sec * 1.3));
    src.stop(end);
  }

  
  function chime(notes, { type = "triangle", vol = 0.18, len = 0.35 } = {}) {
    const a = ctx();
    if (!a) return;
    const t0 = a.currentTime;
    for (const [f, dt] of notes) {
      const t = t0 + dt;
      const o = a.createOscillator(),
        g = a.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g).connect(a.destination);
      o.start(t);
      o.stop(t + len + 0.02);
    }
  }

  
  function blip(f0, f1, len, vol, type = "sine") {
    const a = ctx();
    if (!a) return;
    const t = a.currentTime;
    const o = a.createOscillator(),
      g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + len);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + len + 0.02);
  }

  const sfx = {
    lift: () => blip(900, 380, 0.07, 0.25), 
    drop: () => blip(600, 260, 0.06, 0.15), 
    click: () => blip(1400, 900, 0.04, 0.12, "triangle"), 
    complete: () =>
      chime([
        [784, 0],
        [1047, 0.08],
        [1319, 0.16],
      ]), 
    win: () =>
      chime(
        [
          [523, 0],
          [659, 0.12],
          [784, 0.24],
          [1047, 0.36],
          [1319, 0.5],
          [1568, 0.5],
        ],
        { len: 0.8 },
      ),
    invalid: () =>
      chime(
        [
          [180, 0],
          [140, 0.07],
        ],
        { type: "square", vol: 0.05, len: 0.12 },
      ),
  };

  
  
  function celebrate(i) {
    const t = tubeEls[i];
    t.classList.remove("glow");
    void t.offsetWidth; 
    t.classList.add("glow");
    if (reduceMotion.matches) return;

    t.animate(
      [
        { transform: "none" },
        { transform: "translateY(-10px) scale(1.06)" },
        { transform: "none" },
      ],
      { duration: 380, easing: "ease-out" },
    );

    const r = t.getBoundingClientRect();
    const color = level.colors[tubes[i].contents[0]].color;
    for (let k = 0; k < 14; k++) {
      const spark = el("span", "spark");
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3; 
      const dist = 30 + Math.random() * 45;
      Object.assign(spark.style, {
        left: `${r.left + r.width / 2}px`,
        top: `${r.top}px`,
        background: k % 3 ? color : "#fff",
      });
      document.body.append(spark);
      spark
        .animate(
          [
            { transform: "translate(0, 0) scale(1)", opacity: 1 },
            { opacity: 1, offset: 0.6 },
            {
              transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px) scale(.4)`,
              opacity: 0,
            },
          ],
          {
            duration: 600 + Math.random() * 300,
            easing: "cubic-bezier(.2,.7,.4,1)",
          },
        )
        .finished.then(() => spark.remove());
    }
  }

  function select(i) {
    const prev = selected;
    selected = i;
    if (prev !== null) tubeEls[prev].classList.remove("selected");
    if (i !== null) tubeEls[i].classList.add("selected");
    if (prev !== null) tubeEls[prev].setAttribute("aria-pressed", "false");
    if (i !== null) tubeEls[i].setAttribute("aria-pressed", "true");
  }

  function shake(i) {
    sfx.invalid();
    const t = tubeEls[i];
    t.classList.remove("shake");
    void t.offsetWidth; 
    t.classList.add("shake");
  }

  
  function el(tag, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function showError(err, src) {
    ui.name.textContent = "Erro ao carregar o nível";
    const box = el("div", "error");
    const p = el("p");
    p.textContent = err.message;
    p.style.margin = 0;
    box.append(p);
    if (err.details) {
      const ul = el("ul");
      err.details.forEach((d) => {
        const li = el("li");
        li.textContent = d;
        ul.append(li);
      });
      box.append(ul);
    }
    if (location.protocol === "file:") {
      const hint = el("p");
      hint.innerHTML =
        "Abrindo direto do disco o navegador bloqueia o <code>fetch</code> do JSON. " +
        "Rode um servidor local na pasta, ex.: <code>npx serve</code> ou <code>python -m http.server</code>.";
      box.append(hint);
    }
    ui.board.replaceChildren(box);
    ui.retry.disabled = true;
    console.error(`[tubos] ${src}`, err);
  }

  
  let maxUnlocked = Math.min(
    Number(readStore("tubos.liberado")) || 1,
    LEVEL_COUNT,
  );

  function unlock(n) {
    if (n <= maxUnlocked || n > LEVEL_COUNT) return;
    maxUnlocked = n;
    writeStore("tubos.liberado", n);
  }
  function readStore(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  function writeStore(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  }

  
  ui.undo.addEventListener("click", undo);
  ui.retry.addEventListener("click", () => level && reset());
  ui.next.addEventListener("click", () => load(levelNum + 1));
  ui.prev.addEventListener("click", () => load(levelNum - 1));
  ui.fwd.addEventListener("click", () => load(levelNum + 1));
  ui.restart.addEventListener("click", () => {
    if (!confirm("Zerar o progresso e voltar ao nível 1?")) return;
    maxUnlocked = 1;
    writeStore("tubos.liberado", 1);
    load(1);
  });
  ui.help.addEventListener("click", () => ui.tutorial.showModal());
  ui.tutorial.addEventListener(
    "click",
    (e) => e.target === ui.tutorial && ui.tutorial.close(),
  ); 
  document.addEventListener(
    "click",
    (e) => e.target.closest(".icon-btn, .next, .nav-btn") && sfx.click(),
  );
  addEventListener("pointerdown", loadGlub, { once: true }); 

  const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
  const devLevel = isLocal && new URLSearchParams(location.search).get("level");
  if (!devLevel && location.search) history.replaceState(null, "", location.pathname);
  load(devLevel || maxUnlocked);

  if (!readStore("tubos.tutorial")) {
    
    ui.tutorial.showModal();
    writeStore("tubos.tutorial", "1");
  }
})();
