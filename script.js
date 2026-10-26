/* Calma · juegos antiestrés
   Ciempiés y tarántula (canvas + cinemática inversa), fidget spinner personalizable (SVG + inercia)
   teclado gaming con muchos sonidos (WebAudio), coches, Flappy con animales, serpiente, laberinto, bloque rodante,
   cubo de Rubik 3D (CSS 3D) y cara de chicle (malla elástica). */
'use strict';

(() => {
  /* ======================= Utilidades ======================= */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;
  const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } }
  };

  /* ======================= Sonido ======================= */
  const Sound = (() => {
    let ctx = null, master = null, noise = null;
    let enabled = store.get('calma-sound', '1') === '1';
    let theme = store.get('calma-theme', 'mech');
    let lastTick = 0;

    const ORDER = '1234567890QWERTYUIOPASDFGHJKLÑZXCVBNM';
    const PENTA = [0, 2, 4, 7, 9];
    // cada tecla toca una nota de la escala pentatónica: siempre suena bien
    function noteFreq(label) {
      let idx = ORDER.indexOf(label);
      if (label === 'ESPACIO') idx = 0;
      else if (label === '⌫') idx = 7;
      else if (label === '↵') idx = 14;
      else if (idx < 0) idx = 3;
      const p = idx % 15;
      return 130.81 * Math.pow(2, (PENTA[p % 5] + 12 * Math.floor(p / 5)) / 12);
    }

    function ensure() {
      if (!enabled) return null;
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.6;
        master.connect(ctx.destination);
        noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function env(g, t, peak, dur) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    // tono con barrido de frecuencia (f0 -> f1) y envolvente
    function tone(c, type, f0, f1, t, peak, dur, delay = 0) {
      const s = t + delay;
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, s);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, s + dur * 0.8);
      const g = c.createGain();
      env(g, s, peak, dur);
      o.connect(g).connect(master);
      o.start(s); o.stop(s + dur + 0.03);
      return o;
    }
    // ráfaga de ruido filtrado
    function burst(c, t, type, freq, q, peak, dur, delay = 0) {
      const s = t + delay;
      const n = c.createBufferSource();
      n.buffer = noise;
      n.playbackRate.value = 0.8 + Math.random() * 0.4;
      const f = c.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain();
      env(g, s, peak, dur);
      n.connect(f).connect(g).connect(master);
      n.start(s); n.stop(s + Math.min(dur + 0.02, 0.29));
    }

    const THEMES = {
      mech(c, t) {
        burst(c, t, 'bandpass', 1800 + Math.random() * 1200, 0.9, 0.5, 0.06);
        tone(c, 'sine', 180 + Math.random() * 30, 70, t, 0.45, 0.09);
      },
      soft(c, t) {
        const f = 380 + Math.random() * 260;
        tone(c, 'sine', f, f * 1.7, t, 0.35, 0.14);
      },
      wood(c, t) {
        const o = c.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(260 + Math.random() * 50, t);
        o.frequency.exponentialRampToValueAtTime(120, t + 0.06);
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 1400;
        const g = c.createGain();
        env(g, t, 0.55, 0.08);
        o.connect(lp).connect(g).connect(master);
        o.start(t); o.stop(t + 0.1);
      },
      type(c, t, l) {
        if (l === '↵') {            // campanilla de fin de línea
          tone(c, 'sine', 2300, 2300, t, 0.3, 0.9);
          tone(c, 'sine', 3450, 3450, t, 0.1, 0.5);
          burst(c, t, 'highpass', 2600, 0.7, 0.4, 0.04);
          return;
        }
        burst(c, t, 'highpass', 2600, 0.7, 0.6, 0.035);
        tone(c, 'sine', 900, 400, t, 0.25, 0.04);
        tone(c, 'sine', l === 'ESPACIO' ? 90 : 130, 55, t, 0.5, 0.08);
      },
      piano(c, t, l) {
        const f = noteFreq(l) * 2;
        tone(c, 'triangle', f, f, t, 0.35, 1.1);
        tone(c, 'sine', f * 2, f * 2, t, 0.12, 0.5);
        tone(c, 'sine', f * 3, f * 3, t, 0.05, 0.25);
        burst(c, t, 'lowpass', 1200, 0.5, 0.12, 0.02);
      },
      marimba(c, t, l) {
        const f = noteFreq(l) * 2;
        tone(c, 'sine', f, f, t, 0.55, 0.55);
        tone(c, 'sine', f * 4, f * 4, t, 0.18, 0.12);
      },
      bell(c, t, l) {
        const f = noteFreq(l) * 2;
        [[1, 0.4, 1.4], [2.76, 0.25, 1.0], [5.4, 0.15, 0.6], [8.93, 0.08, 0.4]]
          .forEach(([r, p, d]) => tone(c, 'sine', f * r, f * r, t, p, d));
      },
      guitar(c, t, l) {
        const f = noteFreq(l);
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass'; lp.Q.value = 2;
        lp.frequency.setValueAtTime(3800, t);
        lp.frequency.exponentialRampToValueAtTime(350, t + 0.45);
        const g = c.createGain();
        env(g, t, 0.3, 1.0);
        o.connect(lp).connect(g).connect(master);
        o.start(t); o.stop(t + 1.05);
        burst(c, t, 'bandpass', 3000, 1, 0.15, 0.02);
      },
      chip(c, t, l) {
        const f = noteFreq(l) * 2;
        const o = tone(c, 'square', f, f, t, 0.14, 0.16);
        o.frequency.setValueAtTime(f * 2, t + 0.06);
      },
      laser(c, t) {
        tone(c, 'sawtooth', 1800 + Math.random() * 400, 160, t, 0.2, 0.2);
      },
      drum(c, t, l) {
        const k = Math.max(0, ORDER.indexOf(l)) % 4;
        if (l === 'ESPACIO') return THEMES.drum(c, t, '1');
        if (k === 0) tone(c, 'sine', 170, 42, t, 0.9, 0.22);                                   // bombo
        else if (k === 1) { burst(c, t, 'bandpass', 2200, 0.8, 0.5, 0.14); tone(c, 'triangle', 200, 120, t, 0.35, 0.1); } // caja
        else if (k === 2) burst(c, t, 'highpass', 7500, 0.5, 0.3, 0.05);                      // hi-hat
        else tone(c, 'sine', 240, 110, t, 0.6, 0.22);                                          // tom
      },
      drop(c, t) {
        const f = 900 + Math.random() * 500;
        tone(c, 'sine', f, f * 0.38, t, 0.35, 0.16);
        tone(c, 'sine', f * 0.8, f * 0.3, t, 0.15, 0.18, 0.07);
      },
      pen(c, t) {
        burst(c, t, 'highpass', 3500, 0.8, 0.5, 0.025);
        tone(c, 'square', 2600, 1800, t, 0.05, 0.02);
        burst(c, t, 'highpass', 2200, 0.8, 0.35, 0.03, 0.045);
        tone(c, 'sine', 350, 250, t, 0.2, 0.04, 0.045);
      }
    };

    const LIST = [
      ['mech', 'Mecánico'], ['soft', 'Burbuja'], ['wood', 'Madera'], ['type', 'Máquina de escribir'],
      ['piano', 'Piano'], ['marimba', 'Marimba'], ['bell', 'Campanas'], ['guitar', 'Guitarra'],
      ['chip', '8-bit'], ['laser', 'Láser'], ['drum', 'Batería'], ['drop', 'Gotas'],
      ['pen', 'Bolígrafo'], ['random', '🎲 Sorpresa']
    ];
    if (!LIST.some(([id]) => id === theme)) theme = 'mech';

    return {
      THEMES: LIST,
      key(label = 'Q') {
        const c = ensure();
        if (!c) return;
        let id = theme;
        if (id === 'random') {
          const ids = Object.keys(THEMES);
          id = ids[Math.floor(Math.random() * ids.length)];
        }
        (THEMES[id] || THEMES.mech)(c, c.currentTime, label);
      },
      tick(v = 1) {
        const now = performance.now();
        if (now - lastTick < 45) return;
        lastTick = now;
        const c = ensure();
        if (!c) return;
        const t = c.currentTime;
        const o = c.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(1000 + Math.random() * 120, t);
        const g = c.createGain();
        env(g, t, 0.05 + 0.07 * clamp(v, 0, 1), 0.03);
        o.connect(g).connect(master);
        o.start(t); o.stop(t + 0.04);
      },
      sfx(kind) {
        const c = ensure();
        if (!c) return;
        const t = c.currentTime;
        switch (kind) {
          case 'flap': tone(c, 'triangle', 320, 600, t, 0.2, 0.1); break;
          case 'point': tone(c, 'square', 880, 880, t, 0.1, 0.07); tone(c, 'square', 1320, 1320, t, 0.1, 0.1, 0.07); break;
          case 'hit': burst(c, t, 'lowpass', 900, 0.8, 0.6, 0.25); tone(c, 'sawtooth', 220, 50, t, 0.35, 0.25); break;
          case 'crash': burst(c, t, 'lowpass', 1300, 0.7, 0.8, 0.28); tone(c, 'sawtooth', 160, 40, t, 0.5, 0.3); break;
          case 'near': tone(c, 'sine', 500, 1300, t, 0.2, 0.15); break;
          case 'start': tone(c, 'square', 440, 440, t, 0.1, 0.08); tone(c, 'square', 660, 660, t, 0.1, 0.12, 0.09); break;
          case 'combo': tone(c, 'square', 523, 523, t, 0.1, 0.08); tone(c, 'square', 784, 784, t, 0.1, 0.08, 0.08); tone(c, 'square', 1047, 1047, t, 0.12, 0.14, 0.16); break;
        }
      },
      unlock() { ensure(); },
      isOn: () => enabled,
      toggle() { enabled = !enabled; store.set('calma-sound', enabled ? '1' : '0'); if (enabled) ensure(); return enabled; },
      getTheme: () => theme,
      setTheme(t) { theme = t; store.set('calma-theme', t); }
    };
  })();

  /* ======================= Cadenas con inercia (antenas, palpos, patas traseras) ======================= */
  const mkChain = (M, lenF, w0F, w1F, side, splay, curl, wob, fr, stiff, col, col2) => ({
    pts: Array.from({ length: M }, () => ({ x: 0, y: 0 })),
    M, lenF, w0F, w1F, side, splay, curl, wob, fr, stiff, col, col2: col2 || col, len: 1
  });
  const resetChain = (c, x, y) => { for (const p of c.pts) { p.x = x; p.y = y; } };

  function updateChain(c, bx, by, base, dt, t, S) {
    const P = c.pts;
    c.len = c.lenF * S;
    P[0].x = bx; P[0].y = by;
    for (let k = 1; k < c.M; k++) {
      const ang = base + c.side * (c.splay + k * c.curl) + Math.sin(t * c.fr + k * 0.9 + c.side * 1.7) * c.wob;
      const dx = P[k - 1].x + Math.cos(ang) * c.len;
      const dy = P[k - 1].y + Math.sin(ang) * c.len;
      const f = Math.min(1, dt * c.stiff);
      P[k].x += (dx - P[k].x) * f;
      P[k].y += (dy - P[k].y) * f;
      const ex = P[k].x - P[k - 1].x, ey = P[k].y - P[k - 1].y;
      const d = Math.hypot(ex, ey) || 1e-6;
      P[k].x = P[k - 1].x + ex / d * c.len;
      P[k].y = P[k - 1].y + ey / d * c.len;
    }
  }

  function drawChain(ctx, c, S, outline = '#1a0a04') {
    ctx.lineCap = 'round';
    for (let k = 1; k < c.M; k++) {
      const w = lerp(c.w0F, c.w1F, k / (c.M - 1)) * S;
      ctx.beginPath();
      ctx.moveTo(c.pts[k - 1].x, c.pts[k - 1].y);
      ctx.lineTo(c.pts[k].x, c.pts[k].y);
      ctx.strokeStyle = outline; ctx.lineWidth = w + 1.6 * S; ctx.stroke();
      ctx.strokeStyle = k % 2 ? c.col : c.col2; ctx.lineWidth = w; ctx.stroke();
    }
  }

  /* ======================= Ciempiés ======================= */
  function makeCentipede(env) {
    const S = env.S;
    const N = 30; // segmentos del cuerpo
    let segs = [], dpos = [], angs = [], legs = [];
    const head = { ang: 0, sp: 0 };
    let spF = 0, ctx = null;

    // medidas (escalan con S)
    const bw = i => S * (i === 0 ? 16 : 15.5 - 6.5 * (i / N));        // semiancho
    const spacing = i => S * (23 - 6 * (i / N));                       // distancia entre segmentos
    const legTot = i => S * (48 + 26 * (i / N));                       // longitud total de la pata
    const HRX = 21 * S, HRY = 17 * S;                                   // cabeza

    const antennae = [
      mkChain(9, 11, 2.8, 0.8, -1, 0.34, 0.05, 0.12, 2.4, 9, '#8a2f12', '#6a220c'),
      mkChain(9, 11, 2.8, 0.8, 1, 0.34, 0.05, 0.12, 2.9, 9, '#8a2f12', '#6a220c')
    ];
    const tails = [
      mkChain(7, 12, 5.2, 1.6, -1, 0.18, 0.06, 0.08, 1.5, 7, '#c8942f', '#a8741e'),
      mkChain(7, 12, 5.2, 1.6, 1, 0.18, 0.06, 0.08, 1.8, 7, '#c8942f', '#a8741e')
    ];

    const segAngle = i => {
      const a = segs[Math.max(i - 1, 0)], b = segs[Math.min(i + 1, N - 1)];
      return Math.atan2(a.y - b.y, a.x - b.x);
    };
    const computeAngs = () => { for (let i = 0; i < N; i++) angs[i] = segAngle(i); };

    function rest(l, lead) {
      const s = segs[l.i], a = l.a;
      const fx = Math.cos(a), fy = Math.sin(a);
      const nx = -fy * l.side, ny = fx * l.side;
      const out = bw(l.i) + legTot(l.i) * 0.72;
      return [s.x + nx * out + fx * lead, s.y + ny * out + fy * lead];
    }

    (function build() {
      let total = 0;
      for (let i = 1; i < N; i++) total += spacing(i);
      let x = clamp(env.W / 2 + total / 2, 30, Math.max(30, env.W - 30));
      const y = env.H / 2;
      for (let i = 0; i < N; i++) {
        if (i > 0) x -= spacing(i);
        segs.push({ x, y });
        dpos.push({ x, y });
        angs.push(0);
      }
      computeAngs();
      for (let i = 1; i <= N - 2; i++) {
        for (const side of [-1, 1]) {
          const l = { i, side, x: 0, y: 0, sx: 0, sy: 0, tx: 0, ty: 0, u: 0, stepping: false, lift: 0, a: angs[i],
                      hx: 0, hy: 0, kx: 0, ky: 0, ex: 0, ey: 0 };
          const [rx, ry] = rest(l, 0);
          l.x = rx; l.y = ry;
          legs.push(l);
        }
      }
      for (const c of [...antennae, ...tails]) resetChain(c, segs[0].x, segs[0].y);
    })();

    function solveLeg(l) {
      const s = dpos[l.i], a = l.a;
      const fx = Math.cos(a), fy = Math.sin(a);
      const nx = -fy * l.side, ny = fx * l.side;
      const hw = bw(l.i) * 0.7;
      const hx = s.x + nx * hw, hy = s.y + ny * hw;
      const Lt = legTot(l.i), L1 = Lt * 0.48, L2 = Lt * 0.6;
      let dx = l.x - hx, dy = l.y - hy;
      let d = Math.hypot(dx, dy) || 1e-6;
      const maxd = (L1 + L2) * 0.999;
      let ex = l.x, ey = l.y;
      if (d > maxd) { ex = hx + dx / d * maxd; ey = hy + dy / d * maxd; d = maxd; dx = ex - hx; dy = ey - hy; }
      const base = Math.atan2(dy, dx);
      const A = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
      const k1x = hx + Math.cos(base + A) * L1, k1y = hy + Math.sin(base + A) * L1;
      const k2x = hx + Math.cos(base - A) * L1, k2y = hy + Math.sin(base - A) * L1;
      // la rodilla sobresale hacia fuera y un poco hacia atrás
      const px = nx * 0.9 - fx * 0.45, py = ny * 0.9 - fy * 0.45;
      const d1 = (k1x - hx) * px + (k1y - hy) * py;
      const d2 = (k2x - hx) * px + (k2y - hy) * py;
      let kx = d1 >= d2 ? k1x : k2x, ky = d1 >= d2 ? k1y : k2y;
      kx += nx * l.lift * S * 8; ky += ny * l.lift * S * 8;
      l.hx = hx; l.hy = hy; l.kx = kx; l.ky = ky; l.ex = ex; l.ey = ey;
    }

    function update(dt, t, target, boost) {
      // cabeza: gira con velocidad limitada y avanza
      const h = segs[0];
      const dx = target.x - h.x, dy = target.y - h.y;
      const dist = Math.hypot(dx, dy);
      const stopR = 28 * S;
      let desired = 0;
      if (dist > stopR) {
        const want = Math.atan2(dy, dx);
        const diff = wrap(want - head.ang);
        const turn = (3.0 + 2.5 * boost) * (1 + Math.max(0, 1 - dist / (140 * S)) * 1.5);
        head.ang += clamp(diff, -turn * dt, turn * dt);
        const maxSp = S * (300 + 400 * boost);
        desired = Math.min(maxSp, (dist - stopR) * 3.5 + 40 * S) * (0.35 + 0.65 * Math.max(0, Math.cos(diff)));
      }
      head.sp += (desired - head.sp) * Math.min(1, dt * 5);
      if (head.sp < 1) head.sp = 0;
      h.x += Math.cos(head.ang) * head.sp * dt;
      h.y += Math.sin(head.ang) * head.sp * dt;
      spF = clamp(head.sp / (S * 300), 0, 1);

      // el cuerpo sigue a la cabeza con distancia fija
      for (let i = 1; i < N; i++) {
        const p = segs[i - 1], s = segs[i];
        const ddx = p.x - s.x, ddy = p.y - s.y;
        const d = Math.hypot(ddx, ddy) || 1e-6;
        const sp = spacing(i);
        s.x = p.x - ddx / d * sp;
        s.y = p.y - ddy / d * sp;
      }
      computeAngs();

      // ondulación lateral al caminar
      const amp = Math.min(head.sp / (180 * S), 1) * 4 * S;
      for (let i = 0; i < N; i++) {
        const off = Math.sin(t * 7 - i * 0.55) * amp * (i === 0 ? 0.3 : 1);
        dpos[i].x = segs[i].x - Math.sin(angs[i]) * off;
        dpos[i].y = segs[i].y + Math.cos(angs[i]) * off;
      }

      // patas: de la cola a la cabeza, así la onda de pasos avanza hacia delante
      for (let k = legs.length - 1; k >= 0; k--) {
        const l = legs[k];
        l.a = angs[l.i];
        const lead = legTot(l.i) * (0.12 + 0.38 * spF);
        const [rx, ry] = rest(l, lead);
        if (l.stepping) {
          l.u += dt / Math.max(0.07, 0.19 - spF * 0.11);
          l.tx = rx; l.ty = ry;
          const u = Math.min(l.u, 1);
          const e = u * u * (3 - 2 * u);
          l.x = lerp(l.sx, l.tx, e);
          l.y = lerp(l.sy, l.ty, e);
          l.lift = Math.sin(Math.PI * u);
          if (l.u >= 1) { l.stepping = false; l.lift = 0; }
        } else {
          const d = Math.hypot(rx - l.x, ry - l.y);
          const thr = legTot(l.i) * 0.34;
          const nb1 = legs[k - 2], nb2 = legs[k + 2], opp = legs[k ^ 1];
          const blocked = (nb1 && nb1.stepping) || (nb2 && nb2.stepping) || (opp && opp.stepping);
          if (d > thr && (!blocked || d > thr * 2.2)) {
            l.stepping = true; l.u = 0; l.sx = l.x; l.sy = l.y;
          }
        }
        solveLeg(l);
      }

      // antenas y patas traseras (cadenas con inercia)
      {
        const a = angs[0], fx = Math.cos(a), fy = Math.sin(a);
        const p = dpos[0];
        antennae.forEach(c => {
          const nx = -fy * c.side, ny = fx * c.side;
          updateChain(c, p.x + fx * HRX * 0.8 + nx * HRY * 0.45, p.y + fy * HRX * 0.8 + ny * HRY * 0.45, a, dt, t, S);
        });
        const b = angs[N - 1], bx = Math.cos(b), by = Math.sin(b);
        const q = dpos[N - 1];
        tails.forEach(c => {
          const nx = -by * c.side, ny = bx * c.side;
          updateChain(c, q.x - bx * spacing(N - 1) * 0.5 + nx * bw(N - 1) * 0.4,
                         q.y - by * spacing(N - 1) * 0.5 + ny * bw(N - 1) * 0.4, b + Math.PI, dt, t, S);
        });
      }
    }

    /* ---- dibujo ---- */
    function drawSeg(i) {
      const p = dpos[i], a = angs[i];
      const rx = spacing(i) * 0.82, ry = bw(i);
      const f = i / N;
      const hue = 14 + f * 10, sat = 70 - f * 10;
      const l = (i % 2 === 0 ? 34 : 29) + (1 - f) * 3;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a);
      const g = ctx.createLinearGradient(0, -ry, 0, ry);
      g.addColorStop(0, `hsl(${hue} ${sat}% ${l - 13}%)`);
      g.addColorStop(0.5, `hsl(${hue} ${sat}% ${l + 11}%)`);
      g.addColorStop(1, `hsl(${hue} ${sat}% ${l - 13}%)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 1.6 * S;
      ctx.strokeStyle = 'rgba(25,6,2,.7)';
      ctx.stroke();
      // brillo y cresta dorsal
      ctx.fillStyle = 'rgba(255,210,170,.13)';
      ctx.beginPath();
      ctx.ellipse(-rx * 0.05, 0, rx * 0.55, ry * 0.42, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,200,150,.2)';
      ctx.lineWidth = 1.6 * S;
      ctx.beginPath();
      ctx.moveTo(-rx * 0.85, 0); ctx.lineTo(rx * 0.6, 0);
      ctx.stroke();
      // espiráculos laterales
      ctx.fillStyle = 'rgba(20,5,2,.6)';
      ctx.beginPath();
      for (const sd of [-1, 1]) { ctx.moveTo(-rx * 0.1 + 1.8 * S, sd * ry * 0.74); ctx.ellipse(-rx * 0.1, sd * ry * 0.74, 1.8 * S, 1.2 * S, 0, 0, TAU); }
      ctx.fill();
      ctx.restore();
    }

    function drawHead(t) {
      const p = dpos[0], a = angs[0];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a);
      // forcípulas (pinzas venenosas)
      const gap = S * 4 + Math.sin(t * 8) * S * 1.4 * spF;
      ctx.lineCap = 'round';
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(HRX * 0.5, sd * HRY * 0.5);
        ctx.quadraticCurveTo(HRX + S * 18, sd * HRY * 1.05, HRX + S * 24, sd * gap);
        ctx.strokeStyle = '#1c0702'; ctx.lineWidth = 8 * S; ctx.stroke();
        ctx.strokeStyle = '#8a1f0a'; ctx.lineWidth = 4.6 * S; ctx.stroke();
        ctx.strokeStyle = '#e0683a'; ctx.lineWidth = 1.4 * S; ctx.stroke();
      }
      // cápsula de la cabeza
      const g = ctx.createLinearGradient(0, -HRY, 0, HRY);
      g.addColorStop(0, '#54140a');
      g.addColorStop(0.5, '#c4491f');
      g.addColorStop(1, '#54140a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, HRX, HRY, 0, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 1.8 * S;
      ctx.strokeStyle = 'rgba(25,6,2,.8)';
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,200,160,.18)';
      ctx.beginPath();
      ctx.ellipse(HRX * 0.1, 0, HRX * 0.55, HRY * 0.4, 0, 0, TAU);
      ctx.fill();
      // ocelos
      ctx.fillStyle = '#12060a';
      ctx.beginPath();
      for (const sd of [-1, 1]) for (const [ox, oy] of [[0.5, 0.5], [0.28, 0.62], [0.62, 0.3]]) {
        ctx.moveTo(HRX * ox + 1.7 * S, sd * HRY * oy);
        ctx.arc(HRX * ox, sd * HRY * oy, 1.7 * S, 0, TAU);
      }
      ctx.fill();
      // surco central
      ctx.strokeStyle = 'rgba(25,6,2,.5)';
      ctx.lineWidth = 1.4 * S;
      ctx.beginPath();
      ctx.moveTo(-HRX * 0.7, 0); ctx.lineTo(HRX * 0.1, 0);
      ctx.stroke();
      ctx.restore();
    }

    function draw(c, t) {
      ctx = c;

      // sombras
      ctx.save();
      ctx.translate(6 * S, 10 * S);
      ctx.strokeStyle = 'rgba(0,0,0,.28)';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3 * S;
      ctx.beginPath();
      for (const l of legs) { ctx.moveTo(l.hx, l.hy); ctx.lineTo(l.kx, l.ky); ctx.lineTo(l.ex, l.ey); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,.30)';
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const p = dpos[i];
        const rx = i === 0 ? HRX : spacing(i) * 0.82, ry = i === 0 ? HRY : bw(i);
        ctx.moveTo(p.x + rx * Math.cos(angs[i]), p.y + rx * Math.sin(angs[i]));
        ctx.ellipse(p.x, p.y, rx, ry, angs[i], 0, TAU);
      }
      ctx.fill();
      ctx.restore();

      // patas traseras
      tails.forEach(c2 => drawChain(ctx, c2, S));

      // patas
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const pass = (style, w1, w2) => {
        ctx.strokeStyle = style;
        ctx.lineWidth = w1 * S;
        ctx.beginPath();
        for (const l of legs) { ctx.moveTo(l.hx, l.hy); ctx.lineTo(l.kx, l.ky); }
        ctx.stroke();
        ctx.lineWidth = w2 * S;
        ctx.beginPath();
        for (const l of legs) { ctx.moveTo(l.kx, l.ky); ctx.lineTo(l.ex, l.ey); }
        ctx.stroke();
      };
      pass('#2b1206', 6.8, 4.8);   // contorno
      pass('#c8942f', 4.6, 2.9);   // pata amarilla
      pass('#f1cc72', 1.6, 1.0);   // brillo
      // rodillas y garras
      ctx.fillStyle = '#4a2208';
      ctx.beginPath();
      for (const l of legs) { ctx.moveTo(l.kx + 2.6 * S, l.ky); ctx.arc(l.kx, l.ky, 2.6 * S, 0, TAU); }
      ctx.fill();
      ctx.strokeStyle = '#2b1206';
      ctx.lineWidth = 2.6 * S;
      ctx.beginPath();
      for (const l of legs) {
        const dx = l.ex - l.kx, dy = l.ey - l.ky, d = Math.hypot(dx, dy) || 1;
        ctx.moveTo(l.ex, l.ey);
        ctx.lineTo(l.ex + dx / d * 6 * S, l.ey + dy / d * 6 * S);
      }
      ctx.stroke();

      // cuerpo (de la cola hacia la cabeza)
      for (let i = N - 1; i >= 1; i--) drawSeg(i);

      // antenas y cabeza
      antennae.forEach(c2 => drawChain(ctx, c2, S));
      drawHead(t);
    }

    return { update, draw };
  }

  /* ======================= Tarántula ======================= */
  function makeTarantula(env) {
    const S = env.S;
    const B = { x: env.W / 2, y: env.H / 2, ang: 0, sp: 0, ab: 0 };
    let spF = 0, ctx = null;

    const CX = 34 * S, CY = 29 * S;                 // cefalotórax (semiejes)
    const AX = 50 * S, AY = 42 * S, AOFF = 54 * S;  // abdomen
    const HW = 18 * S;                              // separación lateral de las caderas
    const BONE1 = 54, BONE2 = 70;                   // fémur y tibia+tarso (a S=1)
    // 4 pares de patas: posición en el cuerpo, ángulo de reposo y proporción
    const PAIR = [
      { hf: 17, th: 40, k: 0.98 },
      { hf: 6, th: 76, k: 0.9 },
      { hf: -6, th: 110, k: 0.96 },
      { hf: -17, th: 146, k: 1.1 }
    ];

    const mkHairs = () => Array.from({ length: 24 }, () => ({
      b: Math.random() < 0.45 ? 0 : 1,
      u: 0.12 + Math.random() * 0.8,
      s: Math.random() < 0.5 ? -1 : 1,
      len: 4 + Math.random() * 6,
      ang: (Math.random() - 0.5) * 0.9
    }));

    const legs = [];
    for (let p = 0; p < 4; p++) {
      for (const side of [-1, 1]) {
        legs.push({ p, side, g: (p + (side > 0 ? 1 : 0)) % 2, x: 0, y: 0, sx: 0, sy: 0, u: 0, stepping: false, lift: 0,
                    hx: 0, hy: 0, kx: 0, ky: 0, ex: 0, ey: 0, hair: mkHairs() });
      }
    }

    // pelos del abdomen y del cefalotórax (coordenadas locales, precalculadas)
    const ahair = Array.from({ length: 340 }, () => {
      const r = Math.sqrt(Math.random()) * 0.96, th = Math.random() * TAU;
      const x = Math.cos(th) * r * AX, y = Math.sin(th) * r * AY;
      let dx = -0.85 * (0.6 + 0.4 * Math.random()) + 0.5 * (x / AX);
      let dy = 0.5 * (y / AY) + (Math.random() - 0.5) * 0.4;
      const d = Math.hypot(dx, dy) || 1;
      const len = (5 + Math.random() * 7) * S;
      dx /= d; dy /= d;
      return { x, y, ex: x + dx * len, ey: y + dy * len, c: Math.floor(Math.random() * 3) };
    });
    const chair = Array.from({ length: 70 }, () => {
      const r = Math.sqrt(Math.random()) * 0.85, th = Math.random() * TAU;
      const x = Math.cos(th) * r * CX, y = Math.sin(th) * r * CY, len = (3 + Math.random() * 4) * S;
      return { x, y, ex: x + len * (0.5 + 0.5 * Math.cos(th)), ey: y + len * 0.5 * Math.sin(th) };
    });

    const palps = [
      mkChain(4, 13, 8.5, 5, -1, 0.28, 0.18, 0.3, 3.2, 10, '#3d2418', '#2e1a10'),
      mkChain(4, 13, 8.5, 5, 1, 0.28, 0.18, 0.3, 3.6, 10, '#3d2418', '#2e1a10')
    ];

    function geo(l, lead) {
      const a = B.ang, fx = Math.cos(a), fy = Math.sin(a);
      const nx = -fy * l.side, ny = fx * l.side;
      const P = PAIR[l.p];
      const hx = B.x + fx * P.hf * S + nx * HW, hy = B.y + fy * P.hf * S + ny * HW;
      const th = P.th * Math.PI / 180;
      const R = (BONE1 + BONE2) * S * P.k * 0.72;
      return {
        hx, hy, nx, ny, R,
        rx: hx + (fx * Math.cos(th) + nx * Math.sin(th)) * R + fx * lead,
        ry: hy + (fy * Math.cos(th) + ny * Math.sin(th)) * R + fy * lead
      };
    }
    for (const l of legs) { const g = geo(l, 0); l.x = g.rx; l.y = g.ry; }
    for (const c of palps) resetChain(c, B.x, B.y);

    function solve(l) {
      const g = geo(l, 0), P = PAIR[l.p];
      const L1 = BONE1 * S * P.k, L2 = BONE2 * S * P.k;
      const hx = g.hx, hy = g.hy;
      let dx = l.x - hx, dy = l.y - hy;
      let d = Math.hypot(dx, dy) || 1e-6;
      const maxd = (L1 + L2) * 0.999;
      let ex = l.x, ey = l.y;
      if (d > maxd) { ex = hx + dx / d * maxd; ey = hy + dy / d * maxd; d = maxd; dx = ex - hx; dy = ey - hy; }
      const base = Math.atan2(dy, dx);
      const A = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
      const k1x = hx + Math.cos(base + A) * L1, k1y = hy + Math.sin(base + A) * L1;
      const k2x = hx + Math.cos(base - A) * L1, k2y = hy + Math.sin(base - A) * L1;
      // la rodilla se dobla hacia fuera
      const d1 = (k1x - hx) * g.nx + (k1y - hy) * g.ny;
      const d2 = (k2x - hx) * g.nx + (k2y - hy) * g.ny;
      let kx = d1 >= d2 ? k1x : k2x, ky = d1 >= d2 ? k1y : k2y;
      kx += g.nx * l.lift * S * 10; ky += g.ny * l.lift * S * 10;
      l.hx = hx; l.hy = hy; l.kx = kx; l.ky = ky; l.ex = ex; l.ey = ey;
    }

    function update(dt, t, target, boost) {
      const dx = target.x - B.x, dy = target.y - B.y;
      const dist = Math.hypot(dx, dy);
      const stopR = 50 * S;
      let desired = 0;
      if (dist > stopR) {
        const want = Math.atan2(dy, dx);
        const diff = wrap(want - B.ang);
        const turn = (2.8 + 2.4 * boost) * (1 + Math.max(0, 1 - dist / (130 * S)) * 1.2);
        B.ang += clamp(diff, -turn * dt, turn * dt);
        const maxSp = S * (230 + 340 * boost);
        desired = Math.min(maxSp, (dist - stopR) * 3 + 36 * S) * (0.3 + 0.7 * Math.max(0, Math.cos(diff)));
      }
      B.sp += (desired - B.sp) * Math.min(1, dt * 4.5);
      if (B.sp < 1) B.sp = 0;
      B.x += Math.cos(B.ang) * B.sp * dt;
      B.y += Math.sin(B.ang) * B.sp * dt;
      spF = clamp(B.sp / (S * 230), 0, 1);
      B.ab += wrap(B.ang - B.ab) * Math.min(1, dt * 6);   // el abdomen se balancea al girar

      // marcha alternada: dos grupos de 4 patas
      for (const l of legs) {
        const P = PAIR[l.p];
        const g = geo(l, (BONE1 + BONE2) * S * P.k * (0.06 + 0.2 * spF));
        if (l.stepping) {
          l.u += dt / Math.max(0.06, 0.17 - spF * 0.09);
          const u = Math.min(l.u, 1);
          const e = u * u * (3 - 2 * u);
          l.x = lerp(l.sx, g.rx, e);
          l.y = lerp(l.sy, g.ry, e);
          l.lift = Math.sin(Math.PI * u);
          if (l.u >= 1) { l.stepping = false; l.lift = 0; }
        } else {
          const d = Math.hypot(g.rx - l.x, g.ry - l.y);
          const thr = g.R * 0.26;
          const other = legs.some(o => o.g !== l.g && o.stepping);
          if (d > thr && (!other || d > thr * 2.2)) {
            l.stepping = true; l.u = 0; l.sx = l.x; l.sy = l.y;
          }
        }
        solve(l);
      }

      // palpos
      const fx = Math.cos(B.ang), fy = Math.sin(B.ang);
      palps.forEach(c => {
        const nx = -fy * c.side, ny = fx * c.side;
        updateChain(c, B.x + fx * CX * 0.85 + nx * 9 * S, B.y + fy * CX * 0.85 + ny * 9 * S, B.ang, dt, t, S);
      });
    }

    function bone(x0, y0, x1, y1, w, col) {
      ctx.strokeStyle = col; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }

    function drawLeg(l) {
      const m = 1 + 0.2 * l.lift;     // una pata levantada se ve más cerca
      bone(l.hx, l.hy, l.kx, l.ky, 11.5 * S * m, '#150b07');
      bone(l.kx, l.ky, l.ex, l.ey, 7.6 * S * m, '#150b07');
      bone(l.hx, l.hy, l.kx, l.ky, 8.6 * S * m, '#3a2216');
      bone(l.kx, l.ky, l.ex, l.ey, 5.4 * S * m, '#34201a');
      bone(l.hx, l.hy, l.kx, l.ky, 3.2 * S * m, '#6b4630');
      bone(l.kx, l.ky, l.ex, l.ey, 2.0 * S * m, '#6b4630');
      // rodilla y punta
      ctx.fillStyle = '#4a2d1e'; ctx.strokeStyle = '#150b07'; ctx.lineWidth = 1.4 * S;
      ctx.beginPath(); ctx.arc(l.kx, l.ky, 5.4 * S * m, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#0d0705';
      ctx.beginPath(); ctx.arc(l.ex, l.ey, 2.8 * S, 0, TAU); ctx.fill();
      // pelos
      const bones = [[l.hx, l.hy, l.kx, l.ky], [l.kx, l.ky, l.ex, l.ey]];
      ctx.lineWidth = 1.2 * S;
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? 'rgba(120,70,36,.8)' : 'rgba(205,130,64,.75)';
        ctx.beginPath();
        l.hair.forEach((h, idx) => {
          if (idx % 2 !== pass) return;
          const [x0, y0, x1, y1] = bones[h.b];
          const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1;
          const ux = dx / d, uy = dy / d;
          const px = x0 + dx * h.u, py = y0 + dy * h.u;
          const vx = -uy * h.s, vy = ux * h.s;
          const len = h.len * S;
          ctx.moveTo(px, py);
          ctx.lineTo(px + (vx * Math.cos(h.ang) + ux * Math.sin(h.ang)) * len, py + (vy * Math.cos(h.ang) + uy * Math.sin(h.ang)) * len);
        });
        ctx.stroke();
      }
    }

    function drawAbdomen(t) {
      const abx = B.x - Math.cos(B.ab) * AOFF, aby = B.y - Math.sin(B.ab) * AOFF;
      ctx.save();
      ctx.translate(abx, aby);
      ctx.rotate(B.ab);
      const br = 1 + 0.012 * Math.sin(t * 2.2);   // respiración
      ctx.scale(br, br);
      // espineretas
      ctx.fillStyle = '#1b0f0a';
      ctx.beginPath();
      for (const sd of [-1, 1]) { ctx.moveTo(-AX * 0.97 + 9 * S, sd * 5 * S); ctx.ellipse(-AX * 0.97, sd * 5 * S, 9 * S, 4.2 * S, 0, 0, TAU); }
      ctx.fill();
      // cuerpo
      const g = ctx.createRadialGradient(AX * 0.1, -AY * 0.25, AY * 0.1, 0, 0, AX * 1.05);
      g.addColorStop(0, '#6a4430');
      g.addColorStop(0.5, '#3a241a');
      g.addColorStop(1, '#150a06');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, AX, AY, 0, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 1.8 * S;
      ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.stroke();
      // pelos
      ctx.lineWidth = 1.3 * S;
      ctx.lineCap = 'round';
      const cols = ['rgba(210,138,71,.6)', 'rgba(138,84,48,.65)', 'rgba(14,7,5,.55)'];
      for (let c = 0; c < 3; c++) {
        ctx.strokeStyle = cols[c];
        ctx.beginPath();
        for (const h of ahair) if (h.c === c) { ctx.moveTo(h.x, h.y); ctx.lineTo(h.ex, h.ey); }
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawThorax(t) {
      ctx.save();
      ctx.translate(B.x, B.y);
      ctx.rotate(B.ang);
      // caparazón
      const g = ctx.createRadialGradient(CX * 0.2, -CY * 0.2, CY * 0.1, 0, 0, CX * 1.05);
      g.addColorStop(0, '#7a5238');
      g.addColorStop(0.55, '#3f281b');
      g.addColorStop(1, '#1a0d08');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, CX, CY, 0, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 2 * S;
      ctx.strokeStyle = 'rgba(0,0,0,.65)';
      ctx.stroke();
      // estrías radiales y fóvea
      ctx.strokeStyle = 'rgba(0,0,0,.28)';
      ctx.lineWidth = 1.3 * S;
      ctx.beginPath();
      for (let k = 0; k < 12; k++) {
        const th = k * TAU / 12;
        ctx.moveTo(-CX * 0.15 + Math.cos(th) * 6 * S, Math.sin(th) * 4 * S);
        ctx.lineTo(Math.cos(th) * CX * 0.86, Math.sin(th) * CY * 0.86);
      }
      ctx.stroke();
      ctx.fillStyle = '#120905';
      ctx.beginPath();
      ctx.ellipse(-CX * 0.15, 0, 6 * S, 3 * S, 0, 0, TAU);
      ctx.fill();
      // pelos dorados
      ctx.strokeStyle = 'rgba(201,138,74,.7)';
      ctx.lineWidth = 1.2 * S;
      ctx.beginPath();
      for (const h of chair) { ctx.moveTo(h.x, h.y); ctx.lineTo(h.ex, h.ey); }
      ctx.stroke();

      // quelíceros y colmillos
      const open = 0.25 + 0.5 * (Math.sin(t * 3) * 0.5 + 0.5) * (1 - spF);
      ctx.lineCap = 'round';
      for (const sd of [-1, 1]) {
        const bx = CX * 0.78, by = sd * 8 * S;
        bone(bx, by, bx + 13 * S, by * 0.9, 11 * S, '#2a170e');
        bone(bx, by, bx + 13 * S, by * 0.9, 4 * S, '#4d2f20');
        ctx.beginPath();
        ctx.moveTo(bx + 13 * S, by * 0.9);
        ctx.quadraticCurveTo(bx + 24 * S, by * 0.9, bx + 27 * S, sd * (3 - open * 3) * S);
        ctx.strokeStyle = '#0b0503'; ctx.lineWidth = 4.2 * S; ctx.stroke();
        ctx.strokeStyle = '#8a5a48'; ctx.lineWidth = 1.2 * S; ctx.stroke();
      }

      // torreta de ojos
      ctx.fillStyle = '#241308';
      ctx.beginPath();
      ctx.ellipse(CX * 0.55, 0, 9 * S, 8 * S, 0, 0, TAU);
      ctx.fill();
      const eyes = [[0, -4, 3], [0, 4, 3], [5, -8, 2], [5, 8, 2], [9, -3.5, 1.7], [9, 3.5, 1.7], [-3, -7, 1.8], [-3, 7, 1.8]];
      for (const [ox, oy, r] of eyes) {
        ctx.fillStyle = '#050302';
        ctx.beginPath(); ctx.arc(CX * 0.55 + ox * S, oy * S, r * S, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.beginPath(); ctx.arc(CX * 0.55 + (ox - 0.7) * S, (oy - 0.7) * S, r * S * 0.3, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }

    function draw(c, t) {
      ctx = c;
      const abx = B.x - Math.cos(B.ab) * AOFF, aby = B.y - Math.sin(B.ab) * AOFF;

      // sombras
      ctx.save();
      ctx.translate(6 * S, 10 * S);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,.28)';
      ctx.lineWidth = 8 * S;
      ctx.beginPath();
      for (const l of legs) { ctx.moveTo(l.hx, l.hy); ctx.lineTo(l.kx, l.ky); ctx.lineTo(l.ex, l.ey); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,.30)';
      ctx.beginPath();
      ctx.ellipse(B.x, B.y, CX, CY, B.ang, 0, TAU);
      ctx.moveTo(abx + AX * Math.cos(B.ab), aby + AX * Math.sin(B.ab));
      ctx.ellipse(abx, aby, AX, AY, B.ab, 0, TAU);
      ctx.fill();
      ctx.restore();

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const l of legs) drawLeg(l);
      drawAbdomen(t);
      drawThorax(t);
      palps.forEach(p => drawChain(ctx, p, S, '#120905'));
    }

    return { update, draw };
  }

  /* ======================= Escenario de criaturas ======================= */
  function Arena({ stage, canvas, hint, make, div, smin, smax }) {
    const ctx = canvas.getContext('2d');
    const env = { W: 0, H: 0, S: 1 };
    const target = { x: 0, y: 0 };
    let dpr = 1, builtS = 0, active = false, raf = 0, last = 0, t = 0;
    let lastInput = -999, boost = 0, cr = null, ripples = [];

    function resize() {
      const w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      env.W = w; env.H = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ns = clamp(Math.min(w, h) / div, smin, smax);
      if (!cr || Math.abs(ns - builtS) > 0.05) {
        env.S = ns; builtS = ns;
        cr = make(env);
        target.x = w / 2; target.y = h / 2;
      }
      target.x = clamp(target.x, 0, w); target.y = clamp(target.y, 0, h);
    }

    function setTarget(e) {
      const r = canvas.getBoundingClientRect();
      target.x = clamp(e.clientX - r.left, 0, env.W);
      target.y = clamp(e.clientY - r.top, 0, env.H);
      lastInput = t;
      hint.classList.add('gone');
    }
    stage.addEventListener('pointermove', setTarget);
    stage.addEventListener('pointerdown', e => {
      setTarget(e);
      boost = 1;
      ripples.push({ x: target.x, y: target.y, r: 6, life: 1 });
    });

    function frame(ts) {
      if (!active) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
      last = ts;
      t += dt;
      boost = Math.max(0, boost - dt * 1.4);

      // si nadie mueve el puntero, pasea tranquilo
      if (t - lastInput > 6) {
        target.x = env.W / 2 + Math.cos(t * 0.37) * env.W * 0.32 + Math.sin(t * 0.91) * env.W * 0.08;
        target.y = env.H / 2 + Math.sin(t * 0.53) * env.H * 0.30 + Math.cos(t * 1.07) * env.H * 0.06;
      }
      cr.update(dt, t, target, boost);

      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.r += dt * 240 * env.S;
        r.life -= dt * 1.5;
        if (r.life <= 0) ripples.splice(i, 1);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, env.W, env.H);
      for (const r of ripples) {
        ctx.strokeStyle = `rgba(255,235,200,${(r.life * 0.35).toFixed(3)})`;
        ctx.lineWidth = 2 * env.S;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, TAU);
        ctx.stroke();
      }
      cr.draw(ctx, t);
    }

    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
    window.addEventListener('resize', resize);

    return {
      setActive(a) {
        if (a) {
          resize();
          if (!active && cr) {
            active = true;
            last = performance.now();
            raf = requestAnimationFrame(frame);
          }
        } else {
          active = false;
          cancelAnimationFrame(raf);
        }
      }
    };
  }

  const Centi = Arena({
    stage: $('#view-centipede'), canvas: $('#centi-canvas'), hint: $('#centi-hint'),
    make: makeCentipede, div: 430, smin: 0.7, smax: 1.45
  });
  const Taran = Arena({
    stage: $('#view-tarantula'), canvas: $('#tara-canvas'), hint: $('#tara-hint'),
    make: makeTarantula, div: 480, smin: 0.7, smax: 1.5
  });

  /* ======================= Fidget spinner ======================= */
  const Spin = (() => {
    const view = $('#view-spinner');
    const pad = $('#spin-pad');
    const svg = $('#spinner');
    const rot = $('#spinner-rot');
    const panel = $('#spin-panel');
    const rpmEl = $('#spin-rpm'), turnsEl = $('#spin-turns'), bestEl = $('#spin-best');
    const MAXW = 45; // rad/s (~430 rpm): por encima el ojo ve el giro al revés
    const FR = [0.05, 0.1, 0.16, 0.26, 0.45]; // rozamiento (1 = gira mucho tiempo)

    /* ---- modelos ---- */
    const pt = (a, R) => [+(R * Math.sin(a * Math.PI / 180)).toFixed(2), +(-R * Math.cos(a * Math.PI / 180)).toFixed(2)];
    const arms = (n, R, W) => {
      let geo = '';
      const lobes = [];
      for (let i = 0; i < n; i++) {
        const a = i * 360 / n;
        geo += `<rect x="${-W / 2}" y="${-(R + W / 2)}" width="${W}" height="${R + W}" rx="${W / 2}" transform="rotate(${a})"/>`;
        lobes.push(pt(a, R));
      }
      return { geo: geo + `<circle r="${W * 0.6}"/>`, lobes };
    };
    const starPath = (n, ro, ri) => {
      let d = '';
      for (let i = 0; i < n * 2; i++) {
        const r = i % 2 ? ri : ro, a = i * Math.PI / n;
        d += (i ? 'L' : 'M') + (r * Math.sin(a)).toFixed(1) + ',' + (-r * Math.cos(a)).toFixed(1);
      }
      return d + 'Z';
    };
    const gearPath = (n, rr, ro) => {
      const step = 360 / n;
      let d = '', first = true;
      for (let i = 0; i < n; i++) {
        const a = i * step;
        for (const [da, r] of [[-0.27, rr], [-0.17, ro], [0.17, ro], [0.27, rr]]) {
          const [x, y] = pt(a + da * step, r);
          d += (first ? 'M' : 'L') + x + ',' + y;
          first = false;
        }
      }
      return d + 'Z';
    };

    const MODELS = {
      classic: { name: 'Clásico', build: () => ({ ...arms(3, 62, 64), capR: 18, cc: 23 }) },
      quad: { name: 'Cuádruple', build: () => ({ ...arms(4, 62, 52), capR: 15, cc: 21 }) },
      penta: { name: 'Penta', build: () => ({ ...arms(5, 60, 44), capR: 12, cc: 19 }) },
      duo: { name: 'Doble', build: () => ({ ...arms(2, 62, 58), capR: 17, cc: 22 }) },
      shuriken: {
        name: 'Shuriken',
        build: () => ({
          geo: '<path d="M0,-96 Q26,-26 96,0 Q26,26 0,96 Q-26,26 -96,0 Q-26,-26 0,-96Z"/><circle r="30"/>',
          lobes: [0, 90, 180, 270].map(a => pt(a, 52)), capR: 10, cc: 19
        })
      },
      gear: {
        name: 'Engranaje',
        build: () => ({
          geo: `<path d="${gearPath(10, 78, 92)}"/>`,
          lobes: [0, 1, 2, 3, 4].map(i => pt(i * 72 + 36, 50)), capR: 15, cc: 21
        })
      },
      flower: {
        name: 'Flor',
        build: () => {
          let geo = '<circle r="38"/>';
          const lobes = [];
          for (let i = 0; i < 6; i++) {
            const [x, y] = pt(i * 60, 56);
            geo += `<circle cx="${x}" cy="${y}" r="34"/>`;
            lobes.push([x, y]);
          }
          return { geo, lobes, capR: 15, cc: 20 };
        }
      },
      turbine: {
        name: 'Hélice',
        build: () => {
          let geo = '<circle r="30"/>';
          const lobes = [];
          for (let i = 0; i < 3; i++) {
            const a = i * 120;
            geo += `<ellipse cx="0" cy="-50" rx="24" ry="50" transform="rotate(${a}) rotate(28 0 -50)"/>`;
            lobes.push(pt(a, 50));
          }
          return { geo, lobes, capR: 11, cc: 21 };
        }
      },
      star: {
        name: 'Estrella',
        build: () => ({
          geo: `<path d="${starPath(5, 92, 46)}"/><circle r="34"/>`,
          lobes: [0, 1, 2, 3, 4].map(i => pt(i * 72, 60)), capR: 13, cc: 20
        })
      }
    };

    /* ---- piezas ---- */
    const capSVG = (x, y, r, style) => {
      const ring = `<circle class="lobe-ring" r="${r * 1.5}"/>`;
      let inner;
      if (style === 'color') inner = ring + `<circle class="cap2" r="${r}"/><circle class="hole" r="${r * 0.44}"/>`;
      else if (style === 'gem') inner = ring + `<circle class="cap2" r="${r * 1.1}"/><circle r="${r * 1.1}" fill="url(#gShine)"/>`;
      else if (style === 'hole') inner = `<circle class="lobe-ring" r="${r * 1.2}"/><circle class="hole" r="${r * 1.05}"/>`;
      else inner = ring + `<circle class="steel" r="${r}"/><circle class="hole" r="${r * 0.44}"/>`;
      return `<g transform="translate(${x},${y})">${inner}</g>`;
    };
    const centerSVG = cc =>
      `<circle class="lobe-ring" r="${cc * 1.38}"/><circle class="steel" r="${cc}"/>` +
      `<circle class="core" r="${cc * 0.52}"/><circle class="hole" r="${cc * 0.2}"/>`;

    /* ---- configuración ---- */
    const DEFAULT = { model: 'classic', c1: '#ff5d73', c2: '#dfe5ee', finish: 'solid', cap: 'steel', fric: 3, bg: 'night', glow: true };
    const SW1 = ['#ff5d73', '#ffb347', '#ffd84d', '#4fd1a5', '#4da3ff', '#b583ff', '#ff7bd5', '#2b2f3a'];
    const SW2 = ['#dfe5ee', '#ffd166', '#ffffff', '#111418', '#00e5ff', '#ff3d71', '#7cfc00', '#b36b00'];
    const FINISHES = [['solid', 'Liso'], ['metal', 'Metálico'], ['neon', 'Neón'], ['glass', 'Cristal'], ['rainbow', 'Arcoíris']];
    const CAPS = [['steel', 'Acero'], ['color', 'Color'], ['gem', 'Gema'], ['hole', 'Hueco']];
    const BGS = [['night', 'Noche'], ['aurora', 'Aurora'], ['sunset', 'Atardecer'], ['ocean', 'Océano']];

    const cfg = { ...DEFAULT };
    try { Object.assign(cfg, JSON.parse(store.get('calma-spin-cfg', '{}'))); } catch { /* ignorar */ }
    if (!MODELS[cfg.model]) cfg.model = DEFAULT.model;
    if (!FINISHES.some(f => f[0] === cfg.finish)) cfg.finish = DEFAULT.finish;
    if (!CAPS.some(f => f[0] === cfg.cap)) cfg.cap = DEFAULT.cap;
    if (!BGS.some(f => f[0] === cfg.bg)) cfg.bg = DEFAULT.bg;
    cfg.fric = clamp(Math.round(+cfg.fric || 3), 1, 5);
    cfg.glow = cfg.glow !== false;

    let nLobes = 3;
    function build() {
      const m = MODELS[cfg.model].build();
      nLobes = Math.max(2, m.lobes.length);
      const caps = m.lobes.map(([x, y]) => capSVG(x, y, m.capR, cfg.cap)).join('');
      rot.innerHTML =
        `<defs><g id="sp-shape">${m.geo}</g></defs>` +
        `<use href="#sp-shape" class="L-rim"/><use href="#sp-shape" class="L-body"/><use href="#sp-shape" class="L-gloss"/>` +
        caps + centerSVG(m.cc);
    }

    function syncUI() {
      $$('[data-opt]', panel).forEach(b => {
        const v = String(cfg[b.dataset.opt]).toLowerCase();
        b.setAttribute('aria-pressed', String(v === b.dataset.v.toLowerCase()));
      });
      $('#opt-fric').value = cfg.fric;
      $('#opt-glow').checked = cfg.glow;
      $('#c1-pick').value = cfg.c1;
      $('#c2-pick').value = cfg.c2;
    }

    function applyCfg(rebuild = true) {
      view.style.setProperty('--spin', cfg.c1);
      view.style.setProperty('--spin2', cfg.c2);
      view.dataset.finish = cfg.finish;
      view.dataset.bg = cfg.bg;
      view.dataset.glow = cfg.glow ? 'on' : 'off';
      if (rebuild) build();
      syncUI();
      store.set('calma-spin-cfg', JSON.stringify(cfg));
    }

    /* ---- panel de personalización ---- */
    const mk = (host, opt, items, cls, html) => {
      items.forEach(([v, label]) => {
        const b = document.createElement('button');
        b.className = cls;
        b.dataset.opt = opt;
        b.dataset.v = v;
        b.innerHTML = html(v, label);
        host.appendChild(b);
      });
    };
    const thumb = key => {
      const m = MODELS[key].build();
      const holes = m.lobes.map(([x, y]) => `<circle class="th" cx="${x}" cy="${y}" r="${m.capR * 0.9}"/>`).join('');
      return `<svg class="thumb" viewBox="-104 -104 208 208" aria-hidden="true"><g>${m.geo}</g>${holes}<circle class="th" r="${m.cc * 0.5}"/></svg>`;
    };
    mk($('#opt-model'), 'model', Object.keys(MODELS).map(k => [k, MODELS[k].name]), 'opt', (k, n) => thumb(k) + `<span>${n}</span>`);
    mk($('#opt-c1'), 'c1', SW1.map(c => [c, c]), 'swatch', () => '');
    mk($('#opt-c2'), 'c2', SW2.map(c => [c, c]), 'swatch', () => '');
    $$('#opt-c1 .swatch, #opt-c2 .swatch').forEach(b => { b.style.setProperty('--c', b.dataset.v); b.setAttribute('aria-label', 'Color ' + b.dataset.v); });
    mk($('#opt-finish'), 'finish', FINISHES, 'chip', (v, l) => l);
    mk($('#opt-cap'), 'cap', CAPS, 'chip', (v, l) => l);
    mk($('#opt-bg'), 'bg', BGS, 'chip', (v, l) => l);
    for (const id of ['c1', 'c2']) {
      const inp = document.createElement('input');
      inp.type = 'color'; inp.id = id + '-pick'; inp.className = 'swatch-input';
      inp.setAttribute('aria-label', 'Color personalizado');
      inp.addEventListener('input', () => { cfg[id] = inp.value; applyCfg(false); });
      $('#opt-' + id).appendChild(inp);
    }

    panel.addEventListener('click', e => {
      const b = e.target.closest('[data-opt]');
      if (!b) return;
      cfg[b.dataset.opt] = b.dataset.v;
      applyCfg(b.dataset.opt === 'model' || b.dataset.opt === 'cap');
    });
    $('#opt-fric').addEventListener('input', e => { cfg.fric = clamp(+e.target.value, 1, 5); applyCfg(false); });
    $('#opt-glow').addEventListener('change', e => { cfg.glow = e.target.checked; applyCfg(false); });

    const hsl2hex = (h, s, l) => {
      s /= 100; l /= 100;
      const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
      const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      const x = v => Math.round(255 * v).toString(16).padStart(2, '0');
      return '#' + x(f(0)) + x(f(8)) + x(f(4));
    };
    $('#cfg-rand').addEventListener('click', () => {
      const pick = a => a[Math.floor(Math.random() * a.length)];
      cfg.model = pick(Object.keys(MODELS));
      cfg.c1 = hsl2hex(Math.floor(Math.random() * 360), 80, 60);
      cfg.c2 = pick(SW2);
      cfg.finish = pick(FINISHES)[0];
      cfg.cap = pick(CAPS)[0];
      applyCfg(true);
    });
    $('#cfg-reset').addEventListener('click', () => { Object.assign(cfg, DEFAULT); applyCfg(true); });
    $('#cfg-btn').addEventListener('click', () => panel.classList.toggle('open'));
    $('#cfg-close').addEventListener('click', () => panel.classList.remove('open'));

    /* ---- física ---- */
    let angle = 0, w = 0, turns = 0, best = 0;
    let active = false, raf = 0, last = 0;
    let dragging = false, pid = null, lastA = 0, lastT = 0, wSmooth = 0, moved = 0;
    let downT = 0, wBefore = 0, tickIdx = 0, shownRpm = -1;

    const center = () => { const r = svg.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

    pad.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      Sound.unlock();
      panel.classList.remove('open');
      dragging = true; pid = e.pointerId;
      const [cx, cy] = center();
      lastA = Math.atan2(e.clientY - cy, e.clientX - cx);
      lastT = downT = performance.now();
      wBefore = w; w = 0; wSmooth = 0; moved = 0;
      try { pad.setPointerCapture(e.pointerId); } catch { /* ignorar */ }
    });

    pad.addEventListener('pointermove', e => {
      if (!dragging || e.pointerId !== pid) return;
      const [cx, cy] = center();
      const a = Math.atan2(e.clientY - cy, e.clientX - cx);
      const d = wrap(a - lastA);
      const now = performance.now();
      const dt = Math.max(1, now - lastT) / 1000;
      angle += d;
      turns += Math.abs(d) / TAU;
      wSmooth = wSmooth * 0.6 + (d / dt) * 0.4;
      moved += Math.abs(d);
      lastA = a; lastT = now;
    });

    function release(e) {
      if (!dragging || e.pointerId !== pid) return;
      dragging = false;
      const now = performance.now();
      if (moved < 0.12 && now - downT < 350) {
        const [cx] = center();
        const dir = e.clientX >= cx ? 1 : -1;
        w = clamp(wBefore + dir * 14, -MAXW, MAXW);
      } else {
        if (now - lastT > 90) wSmooth = 0;
        w = clamp(wSmooth, -MAXW, MAXW);
      }
    }
    pad.addEventListener('pointerup', release);
    pad.addEventListener('pointercancel', release);

    function frame(ts) {
      if (!active) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
      last = ts;

      if (!dragging) {
        w *= Math.exp(-FR[cfg.fric - 1] * dt);
        const aw = Math.abs(w);
        if (aw < 2.5) w *= Math.exp(-0.7 * dt);
        if (aw < 0.05) w = 0;
        angle += w * dt;
        turns += Math.abs(w * dt) / TAU;
      }

      rot.setAttribute('transform', `rotate(${(angle * 180 / Math.PI).toFixed(2)})`);

      if (cfg.finish === 'rainbow') {
        const h = (((angle * 180 / Math.PI) % 360) + 360) % 360;
        view.style.setProperty('--hue', h.toFixed(0));
        view.style.setProperty('--hue2', ((h + 180) % 360).toFixed(0));
      }

      // sonido: un "tic" cada vez que pasa un brazo
      const idx = Math.floor(angle / (TAU / nLobes));
      if (idx !== tickIdx) {
        tickIdx = idx;
        const sp = Math.abs(dragging ? wSmooth : w);
        if (sp < 22) Sound.tick(sp / 22);
      }

      const rpm = Math.round(Math.abs(w) * 60 / TAU);
      if (rpm > best) { best = rpm; bestEl.textContent = best; }
      if (rpm !== shownRpm) { shownRpm = rpm; rpmEl.textContent = rpm; }
      turnsEl.textContent = Math.floor(turns);
      view.style.setProperty('--glow', clamp(Math.abs(w) / 35, 0, 1).toFixed(2));
    }

    applyCfg(true);

    return {
      kick(dir = 1) { w = clamp(w + dir * 12, -MAXW, MAXW); Sound.unlock(); },
      setActive(a) {
        if (a) {
          if (!active) { active = true; last = performance.now(); raf = requestAnimationFrame(frame); }
        } else {
          active = false; dragging = false;
          panel.classList.remove('open');
          cancelAnimationFrame(raf);
        }
      }
    };
  })();

  /* ======================= Utilidades de canvas (juegos) ======================= */
  function fitCanvas(cv) {
    const r = cv.parentElement.getBoundingClientRect();
    const d = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(r.width * d);
    cv.height = Math.round(r.height * d);
    cv.getContext('2d').setTransform(d, 0, 0, d, 0, 0);
    return { W: r.width, H: r.height };
  }
  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  // panel de texto centrado para los carteles de "listo" y "game over"
  function panel(g, W, H, lines) {
    const fs = clamp(W / 18, 16, 26);
    const w = Math.min(W * 0.86, 340), h = fs * 1.5 * lines.length + fs * 1.6;
    const x = (W - w) / 2, y = (H - h) / 2;
    g.fillStyle = 'rgba(8, 10, 18, .78)';
    rr(g, x, y, w, h, 18); g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach(([txt, color, scale], i) => {
      g.font = `700 ${Math.round(fs * (scale || 1))}px system-ui, sans-serif`;
      g.fillStyle = color || '#e8ecf3';
      g.fillText(txt, W / 2, y + fs * 0.8 + fs * 1.5 * i + fs * 0.75);
    });
  }

  /* ======================= Teclado gaming ======================= */
  const Keys = (() => {
    const stage = $('#view-keyboard');
    const board = $('#board');
    const typedEl = $('#typed');
    const countEl = $('#key-count');
    const floats = $('#floats');
    const themesEl = $('#themes');
    const comboEl = $('#k-combo'), kpsEl = $('#k-kps'), bestEl = $('#k-best');
    const rankEl = $('#k-rank'), barEl = $('#k-bar'), rgbBtn = $('#k-rgb');

    const ROWS = [
      '1234567890'.split(''),
      'QWERTYUIOP'.split(''),
      'ASDFGHJKLÑ'.split(''),
      [...'ZXCVBNM'.split(''), '⌫'],
      ['ESPACIO', '↵']
    ];
    const WIDTHS = { '⌫': 1.7, 'ESPACIO': 6.2, '↵': 1.9 };
    const ARIA = { '⌫': 'Borrar', 'ESPACIO': 'Espacio', '↵': 'Intro' };
    const WIN = 1300; // ms para mantener el combo
    const RANKS = [[200, 'Dios del teclado'], [100, 'Leyenda'], [50, 'Imparable'], [25, '¡En racha!'], [10, 'Calentando']];
    const RGBS = [['rainbow', '🌈 Arcoíris'], ['cyan', '💠 Cian'], ['red', '🔥 Rojo'], ['green', '☢️ Verde'], ['off', '⚫ Apagado']];

    let typed = '', count = 0, active = false, timer = 0;
    let combo = 0, best = +store.get('calma-key-best', '0') || 0, lastPress = 0;
    let rgb = store.get('calma-rgb', 'rainbow');
    if (!RGBS.some(([id]) => id === rgb)) rgb = 'rainbow';
    const times = [];
    const pressed = new Set();
    const keyEls = new Map();

    ROWS.forEach((row, ri) => {
      const r = document.createElement('div');
      r.className = 'row';
      row.forEach((k, ci) => {
        const b = document.createElement('button');
        b.className = 'key' + (k === 'ESPACIO' ? ' small' : '');
        b.dataset.k = k;
        b.textContent = k === 'ESPACIO' ? 'espacio' : k;
        b.setAttribute('aria-label', ARIA[k] || k);
        b.style.setProperty('--d', ci + ri * 2); // retardo de la ola RGB
        if (WIDTHS[k]) b.style.setProperty('--w', WIDTHS[k]);
        b.addEventListener('pointerdown', e => { e.preventDefault(); Sound.unlock(); press(b); });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, () => release(b)));
        // teclado físico / lectores de pantalla: "click" sin puntero
        b.addEventListener('click', e => { if (e.detail === 0) { press(b); setTimeout(() => release(b), 90); } });
        r.appendChild(b);
        keyEls.set(k, b);
      });
      board.appendChild(r);
    });

    const maxChars = () => (window.innerWidth < 520 ? 14 : 30);
    const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

    function render() {
      typedEl.textContent = typed;
      countEl.textContent = count;
    }
    function paintCombo() {
      comboEl.textContent = 'x' + combo;
      bestEl.textContent = best;
      const r = RANKS.find(([n]) => combo >= n);
      rankEl.textContent = r ? r[1] : '';
    }

    function spawnFloat(el, label) {
      const sr = stage.getBoundingClientRect(), kr = el.getBoundingClientRect();
      const f = document.createElement('span');
      f.className = 'float';
      f.textContent = label === 'ESPACIO' ? '·' : label;
      f.style.left = (kr.left + kr.width / 2 - sr.left) + 'px';
      f.style.top = (kr.top - sr.top) + 'px';
      f.style.fontSize = (18 + Math.random() * 20) + 'px';
      f.style.setProperty('--h', Math.floor(Math.random() * 360));
      f.style.setProperty('--dx', (Math.random() * 80 - 40) + 'px');
      floats.appendChild(f);
      const kill = () => f.remove();
      f.addEventListener('animationend', kill);
      setTimeout(kill, 1600);
      while (floats.children.length > 60) floats.firstChild.remove();
    }

    function press(el) {
      if (pressed.has(el)) return;
      pressed.add(el);
      const k = el.dataset.k;
      el.classList.add('down');
      el.style.setProperty('--h', Math.floor(Math.random() * 360));
      el.classList.add('glow');
      setTimeout(() => el.classList.remove('glow'), 380);
      Sound.key(k);
      count++;

      // combo estilo juego: se mantiene mientras sigas pulsando
      const now = performance.now();
      if (now - lastPress > WIN) combo = 0;
      lastPress = now;
      combo++;
      times.push(now);
      if (combo > best) { best = combo; store.set('calma-key-best', String(best)); }
      if (combo % 25 === 0) { restart(stage, 'shake'); Sound.sfx('combo'); }
      paintCombo();
      restart(comboEl, 'pop');

      if (k === '⌫') typed = typed.slice(0, -1);
      else if (k === '↵') typed = '';
      else if (k === 'ESPACIO') typed += ' ';
      else typed += k;
      typed = typed.slice(-maxChars());
      render();
      if (k !== '↵' && k !== '⌫') spawnFloat(el, k);
    }

    function release(el) {
      pressed.delete(el);
      el.classList.remove('down');
    }

    function tick() {
      const now = performance.now();
      while (times.length && now - times[0] > 1000) times.shift();
      kpsEl.textContent = times.length;
      const left = combo ? 1 - (now - lastPress) / WIN : 0;
      if (combo && left <= 0) { combo = 0; paintCombo(); }
      barEl.style.width = Math.max(0, left) * 100 + '%';
    }

    // temas de sonido
    Sound.THEMES.forEach(([id, label]) => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.dataset.theme = id;
      b.textContent = label;
      themesEl.appendChild(b);
    });
    const chips = $$('.chip', themesEl);
    const setTheme = th => {
      Sound.setTheme(th);
      chips.forEach(c => c.setAttribute('aria-pressed', String(c.dataset.theme === th)));
    };
    chips.forEach(c => c.addEventListener('click', () => { Sound.unlock(); setTheme(c.dataset.theme); Sound.key('G'); }));
    setTheme(Sound.getTheme());

    // barra de sonidos: se desliza arrastrando (dedo o ratón), con la rueda o con la barra de abajo
    let drag = null, moved = false;
    themesEl.addEventListener('pointerdown', e => { drag = { x: e.clientX, s: themesEl.scrollLeft, id: e.pointerId }; moved = false; });
    themesEl.addEventListener('pointermove', e => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x;
      if (!moved && Math.abs(dx) > 6) { moved = true; try { themesEl.setPointerCapture(e.pointerId); } catch { /* sin captura */ } }
      if (moved) themesEl.scrollLeft = drag.s - dx;
    });
    ['pointerup', 'pointercancel'].forEach(ev => themesEl.addEventListener(ev, () => { drag = null; }));
    themesEl.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    themesEl.addEventListener('wheel', e => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { themesEl.scrollLeft += e.deltaY; e.preventDefault(); }
    }, { passive: false });

    // luces RGB del teclado
    const paintRgb = () => {
      board.dataset.rgb = rgb;
      rgbBtn.textContent = RGBS.find(([id]) => id === rgb)[1];
    };
    rgbBtn.addEventListener('click', () => {
      rgb = RGBS[(RGBS.findIndex(([id]) => id === rgb) + 1) % RGBS.length][0];
      store.set('calma-rgb', rgb);
      paintRgb();
    });
    paintRgb();

    // teclado físico
    function mapKey(e) {
      if (e.key === ' ') return 'ESPACIO';
      if (e.key === 'Backspace') return '⌫';
      if (e.key === 'Enter') return '↵';
      if (e.key.length === 1) return e.key.toUpperCase();
      return null;
    }
    window.addEventListener('keydown', e => {
      if (!active || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.closest && e.target.closest('.tabs, #sound-btn, .themes, #k-rgb')) return;
      const k = mapKey(e);
      const el = k && keyEls.get(k);
      if (!el) return;
      e.preventDefault();
      if (e.repeat) return;
      press(el);
    });
    window.addEventListener('keyup', e => {
      if (!active) return;
      const k = mapKey(e);
      const el = k && keyEls.get(k);
      if (el) release(el);
    });

    render();
    paintCombo();

    return {
      setActive(a) {
        active = a;
        clearInterval(timer);
        if (a) timer = setInterval(tick, 80);
        else { pressed.forEach(el => el.classList.remove('down')); pressed.clear(); }
      }
    };
  })();

  /* ======================= Coches (esquiva el tráfico) ======================= */
  const Cars = (() => {
    const cv = $('#cars-canvas');
    const g = cv.getContext('2d');
    const COLORS = ['#ff5a5f', '#ffd166', '#06d6a0', '#c77dff', '#ff9f1c', '#f1f3f6', '#ff7eb6'];
    const SLOW = [0.55, 0.4, 0.5, 0.35]; // cada carril lleva su velocidad: los coches nunca se montan
    let W = 0, H = 0, u = 1, rx = 0, rw = 0, lane = 0, cw = 0, ch = 0, py = 0;
    let active = false, raf = 0, last = 0;
    let state = 'ready', score = 0, best = +store.get('calma-cars-best', '0') || 0;
    let speed = 0, offset = 0, px = 0, tx = 0, cars = [], spawnT = 0, texts = [], shake = 0, overAt = 0, t = 0;
    const keys = { L: false, R: false };
    let drag = null;

    function layout() {
      ({ W, H } = fitCanvas(cv));
      u = clamp(H / 700, 0.55, 1.3);
      rw = Math.min(W * 0.94, 420);
      rx = (W - rw) / 2;
      lane = rw / 4;
      cw = Math.min(lane * 0.58, H * 0.115);
      ch = cw * 1.9;
      py = H - ch * 1.35;
    }
    function reset() {
      state = 'ready'; score = 0; t = 0;
      speed = 220 * u; px = tx = W / 2;
      cars = []; texts = []; spawnT = 0.6; shake = 0;
    }
    function begin() {
      Sound.unlock();
      if (state === 'ready') { state = 'play'; Sound.sfx('start'); }
      else if (state === 'over' && performance.now() - overAt > 500) { reset(); state = 'play'; Sound.sfx('start'); }
    }
    function crash() {
      state = 'over'; overAt = performance.now(); shake = 0.4;
      Sound.sfx('crash');
      if (score > best) { best = Math.floor(score); store.set('calma-cars-best', String(best)); }
    }

    function update(dt) {
      if (state === 'play') {
        t += dt;
        speed += (Math.min((320 + t * 8) * u, 760 * u) - speed) * Math.min(1, dt * 2);
        const lat = W * 0.9 * dt;
        if (keys.L) tx -= lat;
        if (keys.R) tx += lat;
        tx = clamp(tx, rx + cw / 2 + 5, rx + rw - cw / 2 - 5);
        px += (tx - px) * Math.min(1, dt * 14);
        score += speed * dt / (55 * u);

        // aparece tráfico nuevo (máximo 3 carriles ocupados arriba para que siempre haya hueco)
        spawnT -= dt;
        if (spawnT <= 0) {
          const upper = new Set(cars.filter(c => c.y < H * 0.5).map(c => c.l));
          const free = [0, 1, 2, 3].filter(l => !cars.some(c => c.l === l && c.y < ch * 2.2));
          if (upper.size < 3 && free.length) {
            const l = free[Math.floor(Math.random() * free.length)];
            cars.push({ l, x: rx + lane * (l + 0.5), y: -ch * 1.2, col: COLORS[Math.floor(Math.random() * COLORS.length)], min: 1e9, done: false });
          }
          spawnT = (0.5 + Math.random() * 0.8) * (300 * u / speed);
        }

        for (const c of cars) {
          c.y += speed * (1 - SLOW[c.l]) * dt;
          const dx = Math.abs(c.x - px);
          if (c.y < py + ch && c.y + ch > py) {
            c.min = Math.min(c.min, dx - cw);
            if (dx < cw * 0.88 && c.y + ch * 0.92 > py + ch * 0.08 && c.y + ch * 0.08 < py + ch * 0.92) { crash(); break; }
          }
          if (!c.done && c.y > py + ch) {
            c.done = true;
            if (c.min < cw * 0.4) { // ¡pasó rozando!
              score += 25;
              texts.push({ x: px, y: py - 10, s: '¡Rozando! +25', life: 1 });
              Sound.sfx('near');
            }
          }
        }
        cars = cars.filter(c => c.y < H + ch);
      } else if (state === 'over') {
        speed *= Math.max(0, 1 - dt * 2.5);
      } else {
        speed = 220 * u;
      }
      offset = (offset + speed * dt) % (80 * u);
      shake = Math.max(0, shake - dt);
      texts.forEach(s => { s.y -= 40 * dt; s.life -= dt; });
      texts = texts.filter(s => s.life > 0);
    }

    function drawCar(x, y, col, player) {
      g.fillStyle = 'rgba(0,0,0,.35)';
      rr(g, x - cw / 2 + 3, y + 4, cw, ch, cw * 0.22); g.fill();
      g.fillStyle = col;
      rr(g, x - cw / 2, y, cw, ch, cw * 0.22); g.fill();
      if (player) { // franja deportiva
        g.fillStyle = 'rgba(255,255,255,.85)';
        g.fillRect(x - cw * 0.08, y, cw * 0.16, ch);
      }
      g.fillStyle = '#18202e';
      rr(g, x - cw * 0.36, y + ch * 0.2, cw * 0.72, ch * 0.2, cw * 0.1); g.fill();
      rr(g, x - cw * 0.34, y + ch * 0.64, cw * 0.68, ch * 0.14, cw * 0.08); g.fill();
      g.fillStyle = 'rgba(255,255,255,.16)';
      rr(g, x - cw * 0.3, y + ch * 0.41, cw * 0.6, ch * 0.21, cw * 0.08); g.fill();
      g.fillStyle = '#fff6c8';
      g.fillRect(x - cw * 0.42, y + ch * 0.03, cw * 0.22, ch * 0.05);
      g.fillRect(x + cw * 0.2, y + ch * 0.03, cw * 0.22, ch * 0.05);
      g.fillStyle = '#ff3b3b';
      g.fillRect(x - cw * 0.42, y + ch * 0.92, cw * 0.22, ch * 0.04);
      g.fillRect(x + cw * 0.2, y + ch * 0.92, cw * 0.22, ch * 0.04);
    }

    function draw() {
      g.save();
      if (shake > 0) g.translate((Math.random() - 0.5) * 14 * shake * 2.5, (Math.random() - 0.5) * 14 * shake * 2.5);
      g.fillStyle = '#173321'; g.fillRect(-20, -20, W + 40, H + 40);
      // árboles a los lados
      if (rx > 24) {
        const step = 130 * u, o = (offset * 1.0) % step;
        g.fillStyle = '#1f5a33';
        for (let y = -step + o; y < H + step; y += step) {
          g.beginPath(); g.arc(rx / 2, y, Math.min(14, rx / 3), 0, TAU); g.fill();
          g.beginPath(); g.arc(W - rx / 2, y + step / 2, Math.min(14, rx / 3), 0, TAU); g.fill();
        }
      }
      // carretera
      g.fillStyle = '#2a2e3a'; g.fillRect(rx, -20, rw, H + 40);
      g.fillStyle = '#e8ecf3'; g.fillRect(rx - 4, -20, 4, H + 40); g.fillRect(rx + rw, -20, 4, H + 40);
      const dl = 46 * u, gp = 34 * u;
      g.fillStyle = 'rgba(255,255,255,.55)';
      for (let l = 1; l < 4; l++) {
        for (let y = -(dl + gp) + (offset / (80 * u)) * (dl + gp); y < H; y += dl + gp) g.fillRect(rx + lane * l - 2, y, 4, dl);
      }
      cars.forEach(c => drawCar(c.x, c.y, c.col, false));
      if (state !== 'over' || Math.floor(performance.now() / 120) % 2) drawCar(px, py, '#4cc9f0', true);

      // textos flotantes y marcador
      g.textAlign = 'center'; g.textBaseline = 'middle';
      texts.forEach(s => {
        g.globalAlpha = clamp(s.life, 0, 1);
        g.font = '800 18px system-ui, sans-serif';
        g.fillStyle = '#ffe14d';
        g.fillText(s.s, s.x, s.y);
      });
      g.globalAlpha = 1;
      g.restore();

      const fs = clamp(W / 20, 14, 22);
      g.textBaseline = 'top';
      g.font = `800 ${fs}px ui-monospace, Menlo, Consolas, monospace`;
      g.textAlign = 'left'; g.fillStyle = '#fff';
      g.fillText(Math.floor(score) + ' m', 14, 12);
      g.textAlign = 'right'; g.fillStyle = '#ffe14d';
      g.fillText('Récord ' + Math.floor(best), W - 14, 12);
      g.fillStyle = '#9fb3c8'; g.font = `700 ${fs * 0.75}px ui-monospace, Menlo, Consolas, monospace`;
      g.fillText(Math.round(speed / u * 0.3) + ' km/h', W - 14, 12 + fs * 1.3);

      if (state === 'ready') {
        panel(g, W, H, [['🚗 Esquiva el tráfico', '#fff', 1.1], ['Arrastra o usa ← →', '#9fb3c8', 0.8], ['¡Pasa rozando para sumar!', '#ffe14d', 0.8], ['Toca para empezar', '#4cc9f0', 0.9]]);
      } else if (state === 'over') {
        panel(g, W, H, [['💥 ¡Choque!', '#ff5a5f', 1.3], [Math.floor(score) + ' m', '#fff', 1.1], ['Récord ' + Math.floor(best) + ' m', '#ffe14d', 0.8], ['Toca para reintentar', '#4cc9f0', 0.9]]);
      }
    }

    function frame(ts) {
      if (!active) return;
      const dt = Math.min(0.033, (ts - last) / 1000 || 0);
      last = ts;
      update(dt);
      draw();
      raf = requestAnimationFrame(frame);
    }

    const posX = e => e.clientX - cv.getBoundingClientRect().left;
    cv.addEventListener('pointerdown', e => {
      begin();
      drag = { id: e.pointerId, x: posX(e), tx };
      try { cv.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
      if (e.pointerType === 'mouse') tx = posX(e);
    });
    cv.addEventListener('pointermove', e => {
      if (state === 'over') return;
      if (e.pointerType === 'mouse') tx = posX(e);                      // ratón: el coche sigue al cursor
      else if (drag && drag.id === e.pointerId) tx = drag.tx + (posX(e) - drag.x); // táctil: arrastre relativo
    });
    ['pointerup', 'pointercancel'].forEach(ev => cv.addEventListener(ev, () => { drag = null; }));

    window.addEventListener('keydown', e => {
      if (!active || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.closest && e.target.closest('.tabs, #sound-btn')) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') { keys.L = true; e.preventDefault(); begin(); }
      else if (k === 'arrowright' || k === 'd') { keys.R = true; e.preventDefault(); begin(); }
      else if (k === ' ' || k === 'enter') { e.preventDefault(); begin(); }
    });
    window.addEventListener('keyup', e => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') keys.L = false;
      if (k === 'arrowright' || k === 'd') keys.R = false;
    });
    window.addEventListener('resize', () => { if (active) { layout(); reset(); } });

    return {
      setActive(a) {
        active = a;
        cancelAnimationFrame(raf);
        keys.L = keys.R = false;
        if (a) { layout(); reset(); last = performance.now(); raf = requestAnimationFrame(frame); }
      }
    };
  })();

  /* ======================= Flappy animal ======================= */
  const Flappy = (() => {
    const cv = $('#flap-canvas');
    const g = cv.getContext('2d');
    const pick = $('#animals');
    // emoji, nombre, cielo arriba, cielo abajo
    const ANIMALS = [
      ['🐥', 'Pollito', '#6ec6ff', '#e3f6ff'],
      ['🐷', 'Cerdito', '#ff9fc4', '#ffeaf3'],
      ['🐸', 'Rana', '#6fdc98', '#e6faee'],
      ['🐵', 'Mono', '#ffc76e', '#fff2dc'],
      ['🐱', 'Gato', '#b5a0ff', '#f0ebff'],
      ['🐼', 'Panda', '#8fe0dc', '#e8fbfa'],
      ['🦊', 'Zorro', '#ff9266', '#ffe6d9'],
      ['🐰', 'Conejo', '#d6a8ff', '#f7ecff']
    ];
    let sel = store.get('calma-animal', '🐥');
    if (!ANIMALS.some(a => a[0] === sel)) sel = '🐥';

    let W = 0, H = 0, u = 1, gh = 0, pw = 0, gap = 0, bx = 0, r = 0;
    let active = false, raf = 0, last = 0;
    let state = 'ready', score = 0, best = +store.get('calma-flappy-best', '0') || 0;
    let by = 0, vy = 0, pipes = [], clouds = [], gx = 0, t = 0, overAt = 0, shake = 0;

    function layout() {
      ({ W, H } = fitCanvas(cv));
      u = clamp(H / 640, 0.6, 1.3);
      gh = 56 * u; pw = 62 * u; gap = 175 * u; bx = W * 0.28; r = 19 * u;
      clouds = Array.from({ length: 5 }, (_, i) => ({ x: Math.random() * W, y: 70 * u + Math.random() * H * 0.4, s: (0.6 + Math.random() * 0.8) * u, v: 8 + Math.random() * 12 }));
    }
    function reset() {
      state = 'ready'; score = 0; t = 0; by = H * 0.45; vy = 0; pipes = []; shake = 0;
    }
    function flap() {
      Sound.unlock();
      if (state === 'ready') state = 'play';
      if (state === 'play') { vy = -460 * u; Sound.sfx('flap'); }
      else if (state === 'over' && performance.now() - overAt > 600) { reset(); }
    }
    function die() {
      state = 'over'; overAt = performance.now(); vy = -160 * u; shake = 0.3;
      Sound.sfx('hit');
      if (score > best) { best = score; store.set('calma-flappy-best', String(best)); }
    }

    function update(dt) {
      t += dt;
      gx = (gx + (state === 'over' ? 0 : 160 * u * dt)) % (24 * u);
      clouds.forEach(c => { c.x -= c.v * dt; if (c.x < -90 * c.s) c.x = W + 90 * c.s; });
      if (state === 'ready') {
        by = H * 0.45 + Math.sin(t * 3) * 8 * u;
        return;
      }
      vy += 1500 * u * dt;
      by += vy * dt;
      if (by < r) { by = r; vy = Math.max(vy, 0); }
      if (state === 'play') {
        const spd = 160 * u;
        pipes.forEach(p => { p.x -= spd * dt; });
        const lastP = pipes[pipes.length - 1];
        if (!lastP || lastP.x < W - 250 * u) {
          const lo = gap / 2 + 60 * u, hi = H - gh - gap / 2 - 60 * u;
          pipes.push({ x: W + pw, gy: lo + Math.random() * Math.max(10, hi - lo), passed: false });
        }
        pipes = pipes.filter(p => p.x > -pw - 10);
        for (const p of pipes) {
          if (!p.passed && p.x + pw < bx - r) { p.passed = true; score++; Sound.sfx('point'); }
          if (bx + r * 0.8 > p.x && bx - r * 0.8 < p.x + pw && (by - r * 0.8 < p.gy - gap / 2 || by + r * 0.8 > p.gy + gap / 2)) { die(); break; }
        }
      }
      if (by + r >= H - gh) {
        by = H - gh - r; vy = 0;
        if (state === 'play') die();
      }
      shake = Math.max(0, shake - dt);
    }

    function pipe(x, y, h, flip) {
      const capH = 24 * u;
      g.fillStyle = '#4cb85a'; g.fillRect(x + 4, y, pw - 8, h);
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x + 9, y, 7 * u, h);
      const cy = flip ? y + h - capH : y;
      g.fillStyle = '#5fd06c'; rr(g, x, cy, pw, capH, 6); g.fill();
      g.strokeStyle = '#2f7d3a'; g.lineWidth = 2; rr(g, x, cy, pw, capH, 6); g.stroke();
    }

    function draw() {
      const a = ANIMALS.find(x => x[0] === sel);
      g.save();
      if (shake > 0) g.translate((Math.random() - 0.5) * 12 * shake * 3, (Math.random() - 0.5) * 12 * shake * 3);
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, a[2]); sky.addColorStop(1, a[3]);
      g.fillStyle = sky; g.fillRect(-20, -20, W + 40, H + 40);
      g.fillStyle = 'rgba(255,255,255,.75)';
      clouds.forEach(c => {
        g.beginPath();
        g.arc(c.x, c.y, 22 * c.s, 0, TAU); g.arc(c.x + 24 * c.s, c.y + 4 * c.s, 18 * c.s, 0, TAU); g.arc(c.x - 22 * c.s, c.y + 6 * c.s, 16 * c.s, 0, TAU);
        g.fill();
      });
      pipes.forEach(p => {
        pipe(p.x, 0, p.gy - gap / 2, true);
        pipe(p.x, p.gy + gap / 2, H - gh - (p.gy + gap / 2), false);
      });
      // suelo
      g.fillStyle = '#e8d49a'; g.fillRect(-20, H - gh, W + 40, gh + 20);
      g.fillStyle = '#6cc04a'; g.fillRect(-20, H - gh, W + 40, 12 * u);
      g.fillStyle = 'rgba(0,0,0,.08)';
      for (let x = -gx; x < W + 24 * u; x += 24 * u) g.fillRect(x, H - gh + 12 * u, 12 * u, 8 * u);
      // animal
      g.save();
      g.translate(bx, by);
      g.rotate(state === 'ready' ? 0 : clamp(vy / (700 * u), -0.5, 1.1));
      g.font = `${Math.round(r * 2.5)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#000'; // el emoji hereda la opacidad del último color
      g.fillText(sel, 0, 2);
      g.restore();
      g.restore();

      // marcador
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (state !== 'ready') {
        g.font = `800 ${Math.round(46 * u)}px system-ui, sans-serif`;
        g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeText(score, W / 2, 96 * u);
        g.fillStyle = '#fff'; g.fillText(score, W / 2, 96 * u);
      }
      if (state === 'ready') {
        panel(g, W, H, [[a[0] + ' ' + a[1], '#fff', 1.2], ['Toca o pulsa Espacio para aletear', '#9fb3c8', 0.75], ['Elige otro animal arriba', '#ffe14d', 0.75], ['Récord ' + best, '#4cc9f0', 0.85]]);
      } else if (state === 'over') {
        panel(g, W, H, [['¡Auch! ' + a[0], '#ff7a7a', 1.3], ['Puntos: ' + score, '#fff', 1.1], ['Récord: ' + best, '#ffe14d', 0.9], ['Toca para reintentar', '#4cc9f0', 0.9]]);
      }
    }

    function frame(ts) {
      if (!active) return;
      const dt = Math.min(0.033, (ts - last) / 1000 || 0);
      last = ts;
      update(dt);
      draw();
      raf = requestAnimationFrame(frame);
    }

    // selector de animales
    ANIMALS.forEach(([emo, name]) => {
      const b = document.createElement('button');
      b.textContent = emo;
      b.dataset.a = emo;
      b.title = name;
      b.setAttribute('aria-label', name);
      b.addEventListener('click', () => {
        sel = emo; store.set('calma-animal', emo);
        $$('button', pick).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.a === sel)));
        Sound.unlock(); Sound.sfx('point');
        b.blur();
      });
      pick.appendChild(b);
    });
    $$('button', pick).forEach(x => x.setAttribute('aria-pressed', String(x.dataset.a === sel)));

    cv.addEventListener('pointerdown', e => { e.preventDefault(); flap(); });
    window.addEventListener('keydown', e => {
      if (!active || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.closest && e.target.closest('.tabs, #sound-btn')) return;
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'arrowup' || k === 'w' || k === 'enter') { e.preventDefault(); if (!e.repeat) flap(); }
    });
    window.addEventListener('resize', () => { if (active) { layout(); reset(); } });

    return {
      setActive(a) {
        active = a;
        cancelAnimationFrame(raf);
        if (a) { layout(); reset(); last = performance.now(); raf = requestAnimationFrame(frame); }
      }
    };
  })();

  /* ======================= Utilidades de juegos de cuadrícula ======================= */
  const DV = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] };
  const OPP = { L: 'R', R: 'L', U: 'D', D: 'U' };
  const dirOf = e => ({ arrowleft: 'L', a: 'L', arrowright: 'R', d: 'R', arrowup: 'U', w: 'U', arrowdown: 'D', s: 'D' })[e.key.toLowerCase()];
  const inUi = e => e.target.closest && e.target.closest('.tabs, #sound-btn');
  // gesto de deslizar con el dedo o el ratón (se puede encadenar varios giros sin soltar)
  function swipe(el, cb, min = 22) {
    let s = null;
    el.addEventListener('pointerdown', e => { s = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointermove', e => {
      if (!s || s.id !== e.pointerId) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return;
      cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U'));
      s.x = e.clientX; s.y = e.clientY;
    });
    ['pointerup', 'pointercancel'].forEach(ev => el.addEventListener(ev, () => { s = null; }));
  }

  /* ======================= Serpiente ======================= */
  const Snake = (() => {
    const cv = $('#snake-canvas');
    const g = cv.getContext('2d');
    const FRUITS = ['🍎', '🍌', '🍇', '🍓', '🍒', '🍉', '🍊', '🍍'];
    let W = 0, H = 0, cell = 20, cols = 10, rows = 10, ox = 0, oy = 0;
    let active = false, raf = 0, last = 0;
    let state = 'ready', score = 0, best = +store.get('calma-snake-best', '0') || 0;
    let body = [], dir = 'R', queue = [], fruit = null, acc = 0, stepT = 0.14, overAt = 0;

    function layout() {
      ({ W, H } = fitCanvas(cv));
      cell = clamp(Math.floor(W / 18), 16, 32);
      cols = Math.min(30, Math.floor(W / cell));
      rows = Math.min(24, Math.floor((H - 56) / cell));
      ox = Math.floor((W - cols * cell) / 2);
      oy = 56 + Math.floor((H - 56 - rows * cell) / 2);
    }
    function place() {
      for (let i = 0; i < 600; i++) {
        const x = Math.floor(Math.random() * cols), y = Math.floor(Math.random() * rows);
        if (!body.some(s => s.x === x && s.y === y)) { fruit = { x, y, e: FRUITS[Math.floor(Math.random() * FRUITS.length)] }; return; }
      }
    }
    function reset() {
      const mx = Math.floor(cols / 2), my = Math.floor(rows / 2);
      body = [{ x: mx, y: my }, { x: mx - 1, y: my }, { x: mx - 2, y: my }];
      dir = 'R'; queue = []; score = 0; stepT = 0.14; acc = 0; state = 'ready';
      place();
    }
    function begin() {
      Sound.unlock();
      if (state === 'ready') { state = 'play'; Sound.sfx('start'); }
      else if (state === 'over' && performance.now() - overAt > 500) { reset(); state = 'play'; Sound.sfx('start'); }
    }
    function turn(d) {
      if (!d) return;
      const ref = queue.length ? queue[queue.length - 1] : dir;
      if (d === ref || d === OPP[ref]) return;
      if (queue.length < 3) queue.push(d);
    }
    function die() {
      state = 'over'; overAt = performance.now();
      Sound.sfx('hit');
      if (score > best) { best = score; store.set('calma-snake-best', String(best)); }
    }
    function tick() {
      dir = queue.shift() || dir;
      const h = body[0], nx = h.x + DV[dir][0], ny = h.y + DV[dir][1];
      const eat = fruit && nx === fruit.x && ny === fruit.y;
      const len = eat ? body.length : body.length - 1; // si no come, la cola se aparta
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || body.slice(0, len).some(s => s.x === nx && s.y === ny)) { die(); return; }
      body.unshift({ x: nx, y: ny });
      if (!eat) body.pop();
      else { score++; Sound.sfx('point'); place(); stepT = Math.max(0.065, 0.14 - score * 0.0025); }
    }

    function draw() {
      g.fillStyle = '#0c1812'; g.fillRect(0, 0, W, H);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        g.fillStyle = (x + y) % 2 ? '#13271d' : '#112218';
        g.fillRect(ox + x * cell, oy + y * cell, cell, cell);
      }
      g.strokeStyle = '#2f6b49'; g.lineWidth = 2; g.strokeRect(ox - 1, oy - 1, cols * cell + 2, rows * cell + 2);
      if (fruit) {
        g.font = `${Math.round(cell * 0.85)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000';
        g.fillText(fruit.e, ox + (fruit.x + 0.5) * cell, oy + (fruit.y + 0.55) * cell);
      }
      const n = body.length;
      for (let i = n - 1; i >= 0; i--) {
        const s = body[i];
        g.fillStyle = i === 0 ? '#5dff9a' : `hsl(${140 + (i / n) * 40} 65% ${52 - (i / n) * 16}%)`;
        rr(g, ox + s.x * cell + 1.5, oy + s.y * cell + 1.5, cell - 3, cell - 3, cell * 0.35); g.fill();
      }
      const h = body[0], cx = ox + (h.x + 0.5) * cell, cy = oy + (h.y + 0.5) * cell, v = DV[dir];
      g.fillStyle = '#fff';
      for (const sd of [-1, 1]) {
        const ex = cx + v[0] * cell * 0.18 - v[1] * sd * cell * 0.2, ey = cy + v[1] * cell * 0.18 + v[0] * sd * cell * 0.2;
        g.beginPath(); g.arc(ex, ey, cell * 0.14, 0, TAU); g.fill();
        g.fillStyle = '#10201a'; g.beginPath(); g.arc(ex + v[0] * cell * 0.05, ey + v[1] * cell * 0.05, cell * 0.07, 0, TAU); g.fill();
        g.fillStyle = '#fff';
      }
      const fs = clamp(W / 20, 15, 22);
      g.font = `800 ${fs}px ui-monospace, Menlo, Consolas, monospace`; g.textBaseline = 'top';
      g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText('🍎 ' + score, 14, 16);
      g.textAlign = 'right'; g.fillStyle = '#ffe14d'; g.fillText('Récord ' + best, W - 14, 16);
      if (state === 'ready') panel(g, W, H, [['🐍 Serpiente', '#fff', 1.2], ['Desliza o usa las flechas', '#9fb3c8', 0.8], ['Come fruta y crece', '#ffe14d', 0.8], ['Toca para empezar', '#4cc9f0', 0.9]]);
      else if (state === 'over') panel(g, W, H, [['💥 ¡Game over!', '#ff5a5f', 1.2], ['Frutas: ' + score, '#fff', 1.1], ['Récord: ' + best, '#ffe14d', 0.9], ['Toca para reintentar', '#4cc9f0', 0.9]]);
    }

    function frame(ts) {
      if (!active) return;
      const dt = Math.min(0.05, (ts - last) / 1000 || 0);
      last = ts;
      if (state === 'play') { acc += dt; while (acc >= stepT && state === 'play') { acc -= stepT; tick(); } }
      draw();
      raf = requestAnimationFrame(frame);
    }

    cv.addEventListener('pointerdown', begin);
    swipe(cv, d => { begin(); turn(d); });
    window.addEventListener('keydown', e => {
      if (!active || e.ctrlKey || e.metaKey || e.altKey || inUi(e)) return;
      const d = dirOf(e);
      if (d) { e.preventDefault(); begin(); turn(d); }
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); begin(); }
    });
    window.addEventListener('resize', () => { if (active) { layout(); reset(); } });

    return {
      setActive(a) {
        active = a;
        cancelAnimationFrame(raf);
        if (a) { layout(); reset(); last = performance.now(); raf = requestAnimationFrame(frame); }
      }
    };
  })();

  /* ======================= Laberinto (estilo comecocos, con laberintos aleatorios) ======================= */
  const Pac = (() => {
    const cv = $('#pac-canvas');
    const g = cv.getContext('2d');
    const DIRS = ['L', 'R', 'U', 'D'];
    const GCOL = ['#ff3b3b', '#ff8ad8', '#33e0ff', '#ffa63b'];
    let W = 0, H = 0, cell = 20, cols = 15, rows = 21, ox = 0, oy = 0;
    let active = false, raf = 0, last = 0;
    let grid = [], dots = [], dotsLeft = 0, maze = null, startP = [1, 1], startG = [1, 1];
    let state = 'ready', level = 1, score = 0, lives = 3, best = +store.get('calma-pac-best', '0') || 0;
    let pac = null, ghosts = [], t = 0, want = 'L', fright = 0, combo = 0, pause = 0, modeT = 0, overAt = 0;

    const wrapx = x => (x + cols) % cols;
    const pass = (x, y) => y >= 0 && y < rows && grid[y][wrapx(x)] === 0;
    const odd = n => (n % 2 ? n : n - 1);
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const nearest = (tx, ty) => {
      let b = null, bd = 1e9;
      for (let y = 0; y < rows; y++) for (let x = 1; x < cols - 1; x++) {
        if (grid[y][x]) continue;
        const d = (x - tx) ** 2 + (y - ty) ** 2;
        if (d < bd) { bd = d; b = [x, y]; }
      }
      return b;
    };

    function layout() {
      ({ W, H } = fitCanvas(cv));
      const c0 = W < 520 ? 22 : 26;
      cols = clamp(odd(Math.floor(W / c0)), 11, 27);
      rows = clamp(odd(Math.floor((H - 50) / c0)), 11, 25);
      cell = Math.floor(Math.min(W / cols, (H - 50) / rows));
      ox = Math.floor((W - cols * cell) / 2);
      oy = 50 + Math.floor((H - 50 - rows * cell) / 2);
    }

    // laberinto aleatorio: caminos con bucles, túnel lateral y 4 píldoras de poder
    function genLevel() {
      grid = Array.from({ length: rows }, () => Array(cols).fill(1));
      const st = [[1, 1]]; grid[1][1] = 0;
      while (st.length) {
        const [x, y] = st[st.length - 1];
        const nb = [[2, 0], [-2, 0], [0, 2], [0, -2]]
          .map(([a, b]) => [x + a, y + b, x + a / 2, y + b / 2])
          .filter(([nx, ny]) => nx > 0 && ny > 0 && nx < cols - 1 && ny < rows - 1 && grid[ny][nx] === 1);
        if (!nb.length) { st.pop(); continue; }
        const [nx, ny, mx, my] = pick(nb);
        grid[my][mx] = 0; grid[ny][nx] = 0; st.push([nx, ny]);
      }
      for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) {
        if (grid[y][x] && ((x % 2 && !(y % 2)) || (!(x % 2) && y % 2)) && Math.random() < 0.2) grid[y][x] = 0;
      }
      let tr = rows >> 1; if (tr % 2 === 0) tr++;
      grid[tr][0] = 0; grid[tr][cols - 1] = 0;

      startP = nearest(cols >> 1, rows - 2);
      startG = nearest(cols >> 1, rows >> 1);
      dots = grid.map((row, y) => row.map((v, x) => (v === 0 && x > 0 && x < cols - 1 ? 1 : 0)));
      dots[startP[1]][startP[0]] = 0;
      [[1, 1], [cols - 2, 1], [1, rows - 2], [cols - 2, rows - 2]].forEach(([cx, cy]) => {
        const [x, y] = nearest(cx, cy);
        if (dots[y][x]) dots[y][x] = 2;
      });
      dotsLeft = dots.flat().filter(Boolean).length;

      // paredes dibujadas una sola vez en un lienzo aparte
      maze = document.createElement('canvas');
      maze.width = cols * cell; maze.height = rows * cell;
      const m = maze.getContext('2d');
      m.fillStyle = '#05060f'; m.fillRect(0, 0, maze.width, maze.height);
      m.fillStyle = '#10157a'; m.strokeStyle = '#4a63ff'; m.lineWidth = 1.5;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        if (!grid[y][x]) continue;
        let near = false;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
          const xx = x + i, yy = y + j;
          if (xx >= 0 && yy >= 0 && xx < cols && yy < rows && !grid[yy][xx]) near = true;
        }
        if (!near) continue;
        rr(m, x * cell + 1, y * cell + 1, cell - 2, cell - 2, cell * 0.3); m.fill(); m.stroke();
      }
    }

    function resetEntities(wait = 0.5) {
      pac = { x: startP[0], y: startP[1], dir: null, last: null, p: 0 };
      want = 'L';
      ghosts = [0, 1, 2, 3].map(i => ({ i, x: startG[0], y: startG[1], dir: null, last: null, p: 0, delay: wait + i * 2.2 }));
      fright = 0; combo = 0;
    }
    function newGame() {
      level = 1; score = 0; lives = 3; state = 'ready'; t = 0; modeT = 0;
      genLevel(); resetEntities();
    }
    function begin() {
      Sound.unlock();
      if (state === 'ready') { state = 'play'; Sound.sfx('start'); }
      else if (state === 'over' && performance.now() - overAt > 600) { newGame(); state = 'play'; Sound.sfx('start'); }
    }
    function setWant(d) {
      if (!d) return;
      want = d;
      if (pac && pac.dir && d === OPP[pac.dir]) { // marcha atrás inmediata
        pac.x = wrapx(pac.x + DV[pac.dir][0]); pac.y += DV[pac.dir][1];
        pac.p = 1 - pac.p; pac.dir = d;
      }
    }
    const posOf = e => { const v = e.dir ? DV[e.dir] : [0, 0]; return [e.x + v[0] * e.p, e.y + v[1] * e.p]; };

    function advance(e, dt, speed, decide, arrive) {
      let m = speed * dt;
      while (m > 0) {
        if (!e.dir) { decide(e); if (!e.dir) return; }
        const s = Math.min(m, 1 - e.p);
        e.p += s; m -= s;
        if (e.p >= 0.99999) {
          e.x = wrapx(e.x + DV[e.dir][0]); e.y += DV[e.dir][1];
          e.p = 0; e.last = e.dir; e.dir = null;
          if (arrive) arrive(e);
        }
      }
    }
    function decidePac(e) {
      if (pass(e.x + DV[want][0], e.y + DV[want][1])) e.dir = want;
      else if (e.last && pass(e.x + DV[e.last][0], e.y + DV[e.last][1])) e.dir = e.last;
    }
    function target(gh) {
      const scatter = (modeT % 20) < Math.max(2, 6 - level * 0.5);
      if (scatter) return [[cols - 2, 1], [1, 1], [cols - 2, rows - 2], [1, rows - 2]][gh.i];
      const v = DV[pac.last || 'L'];
      if (gh.i === 0) return [pac.x, pac.y];                                   // persigue de frente
      if (gh.i === 1) return [pac.x + v[0] * 4, pac.y + v[1] * 4];             // embosca por delante
      if (gh.i === 2) return [2 * pac.x - ghosts[0].x, 2 * pac.y - ghosts[0].y]; // te acorrala con el rojo
      return Math.hypot(gh.x - pac.x, gh.y - pac.y) > 8 ? [pac.x, pac.y] : [1, rows - 2]; // tímido
    }
    function decideGhost(gh) {
      const opts = DIRS.filter(d => pass(gh.x + DV[d][0], gh.y + DV[d][1]));
      let c = opts.filter(d => !gh.last || d !== OPP[gh.last]);
      if (!c.length) c = opts;
      if (!c.length) return;
      if (fright > 0 || Math.random() < 0.06) { gh.dir = pick(c); return; }
      const [tx, ty] = target(gh);
      let bd = 1e9, bs = [];
      c.forEach(d => {
        const dd = (gh.x + DV[d][0] - tx) ** 2 + (gh.y + DV[d][1] - ty) ** 2;
        if (dd < bd - 1e-6) { bd = dd; bs = [d]; } else if (Math.abs(dd - bd) < 1e-6) bs.push(d);
      });
      gh.dir = pick(bs);
    }
    function eat(e) {
      const v = dots[e.y][e.x];
      if (!v) return;
      dots[e.y][e.x] = 0; dotsLeft--;
      if (v === 2) { score += 50; fright = Math.max(3, 8 - level * 0.5); combo = 0; Sound.sfx('start'); }
      else { score += 10; Sound.tick(1); }
      if (dotsLeft <= 0) nextLevel();
    }
    function nextLevel() {
      level++; Sound.sfx('combo');
      genLevel(); resetEntities(0.8); pause = 1.5; modeT = 0;
    }
    function die() {
      lives--; Sound.sfx('hit');
      if (lives <= 0) {
        state = 'over'; overAt = performance.now();
        if (score > best) { best = score; store.set('calma-pac-best', String(best)); }
      } else { resetEntities(0.8); pause = 1.4; }
    }

    function update(dt) {
      t += dt;
      if (state !== 'play') return;
      if (pause > 0) { pause -= dt; return; }
      modeT += dt; fright = Math.max(0, fright - dt);
      advance(pac, dt, 6.4, decidePac, eat);
      const gs = Math.min(5.2 + level * 0.25, 6.3);
      for (const gh of ghosts) {
        if (gh.delay > 0) { gh.delay -= dt; continue; }
        advance(gh, dt, fright > 0 ? 3.4 : gs, decideGhost);
      }
      const [px, py] = posOf(pac);
      for (const gh of ghosts) {
        if (gh.delay > 0) continue;
        const [gx, gy] = posOf(gh);
        if (Math.hypot(px - gx, py - gy) > 0.6) continue;
        if (fright > 0) {
          score += 200 * 2 ** Math.min(combo, 3); combo++; Sound.sfx('near');
          Object.assign(gh, { x: startG[0], y: startG[1], dir: null, last: null, p: 0, delay: 2.5 });
        } else { die(); break; }
      }
    }

    function draw() {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      g.drawImage(maze, ox, oy);
      const cx = x => ox + (x + 0.5) * cell, cy = y => oy + (y + 0.5) * cell;
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const v = dots[y][x];
        if (!v) continue;
        g.fillStyle = v === 2 ? '#ffe9c2' : '#ffd9a8';
        g.beginPath(); g.arc(cx(x), cy(y), v === 2 ? cell * 0.3 * (0.8 + 0.2 * Math.sin(t * 8)) : cell * 0.1, 0, TAU); g.fill();
      }
      // comecocos
      const [px, py] = posOf(pac), a = { R: 0, D: Math.PI / 2, L: Math.PI, U: -Math.PI / 2 }[pac.dir || pac.last || 'L'];
      const mo = (pac.dir ? 0.05 + 0.3 * Math.abs(Math.sin(t * 14)) : 0.12) * Math.PI, r = cell * 0.43;
      g.fillStyle = '#ffe14d'; g.beginPath(); g.moveTo(cx(px), cy(py)); g.arc(cx(px), cy(py), r, a + mo, a + TAU - mo); g.closePath(); g.fill();
      // fantasmas
      ghosts.forEach(gh => {
        const [gx, gy] = posOf(gh), x = cx(gx), y = cy(gy), gr = cell * 0.42;
        const scared = fright > 0 && gh.delay <= 0;
        g.fillStyle = scared ? (fright < 2 && Math.floor(t * 6) % 2 ? '#e8ecff' : '#2a3cff') : GCOL[gh.i];
        g.beginPath(); g.arc(x, y - gr * 0.1, gr, Math.PI, 0);
        for (let k = 0; k <= 6; k++) g.lineTo(x + gr - k * (gr / 3), y + gr * 0.9 - (k % 2 ? gr * 0.25 : 0));
        g.closePath(); g.fill();
        g.fillStyle = '#fff';
        for (const s of [-1, 1]) { g.beginPath(); g.arc(x + s * gr * 0.38, y - gr * 0.25, gr * 0.27, 0, TAU); g.fill(); }
        const v = DV[gh.dir || gh.last || 'L'];
        g.fillStyle = scared ? '#fff' : '#11204a';
        for (const s of [-1, 1]) { g.beginPath(); g.arc(x + s * gr * 0.38 + v[0] * gr * 0.1, y - gr * 0.25 + v[1] * gr * 0.1, gr * 0.12, 0, TAU); g.fill(); }
      });
      const fs = clamp(W / 22, 13, 20);
      g.font = `800 ${fs}px ui-monospace, Menlo, Consolas, monospace`; g.textBaseline = 'top';
      g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText(String(score), 14, 14);
      g.textAlign = 'center'; g.fillStyle = '#4cc9f0'; g.fillText('Nivel ' + level + '  ' + '❤️'.repeat(Math.max(0, lives)), W / 2, 14);
      g.textAlign = 'right'; g.fillStyle = '#ffe14d'; g.fillText('Récord ' + best, W - 14, 14);
      if (pause > 0 && state === 'play') { g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffe14d'; g.font = `800 ${fs * 1.4}px system-ui, sans-serif`; g.fillText('¡Listo!', W / 2, H / 2); }
      if (state === 'ready') panel(g, W, H, [['🟡 Laberinto', '#fff', 1.2], ['Desliza o usa las flechas', '#9fb3c8', 0.8], ['4 fantasmas con trucos distintos', '#ff8ad8', 0.75], ['Cada nivel, un laberinto nuevo', '#ffe14d', 0.75], ['Toca para empezar', '#4cc9f0', 0.9]]);
      else if (state === 'over') panel(g, W, H, [['👻 ¡Te atraparon!', '#ff5a5f', 1.2], ['Puntos: ' + score, '#fff', 1.1], ['Récord: ' + best, '#ffe14d', 0.9], ['Toca para reintentar', '#4cc9f0', 0.9]]);
    }

    function frame(ts) {
      if (!active) return;
      const dt = Math.min(0.04, (ts - last) / 1000 || 0);
      last = ts;
      update(dt); draw();
      raf = requestAnimationFrame(frame);
    }

    cv.addEventListener('pointerdown', begin);
    swipe(cv, d => { begin(); setWant(d); });
    window.addEventListener('keydown', e => {
      if (!active || e.ctrlKey || e.metaKey || e.altKey || inUi(e)) return;
      const d = dirOf(e);
      if (d) { e.preventDefault(); begin(); setWant(d); }
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); begin(); }
    });
    window.addEventListener('resize', () => { if (active) { layout(); newGame(); } });

    return {
      setActive(a) {
        active = a;
        cancelAnimationFrame(raf);
        if (a) { layout(); newGame(); last = performance.now(); raf = requestAnimationFrame(frame); }
      }
    };
  })();

  /* ======================= Bloque (estilo Bloxorz, niveles aleatorios) ======================= */
  const Blox = (() => {
    const cv = $('#blox-canvas');
    const g = cv.getContext('2d');
    let W = 0, H = 0, ts = 40, ox = 0, oy = 0;
    let active = false, raf = 0, last = 0;
    let level = 1, best = +store.get('calma-blox-best', '1') || 1;
    let tiles = new Set(), bw = 5, bh = 5, goal = { x: 0, y: 0 }, par = 0, moves = 0;
    let blk = { x: 0, y: 0, o: 0 }, anim = null, phase = 'play', phaseT = 0, started = false, startCell = { x: 0, y: 0 };

    const key = (x, y) => x + ',' + y;
    const cellsOf = b => (b.o === 0 ? [[b.x, b.y]] : b.o === 1 ? [[b.x, b.y], [b.x + 1, b.y]] : [[b.x, b.y], [b.x, b.y + 1]]);
    const rectOf = b => (b.o === 0 ? [b.x, b.y, 1, 1] : b.o === 1 ? [b.x, b.y, 2, 1] : [b.x, b.y, 1, 2]);
    function roll(b, d) {
      const { x, y, o } = b;
      if (o === 0) return d === 'R' ? { x: x + 1, y, o: 1 } : d === 'L' ? { x: x - 2, y, o: 1 } : d === 'D' ? { x, y: y + 1, o: 2 } : { x, y: y - 2, o: 2 };
      if (o === 1) return d === 'R' ? { x: x + 2, y, o: 0 } : d === 'L' ? { x: x - 1, y, o: 0 } : d === 'D' ? { x, y: y + 1, o: 1 } : { x, y: y - 1, o: 1 };
      return d === 'D' ? { x, y: y + 2, o: 0 } : d === 'U' ? { x, y: y - 1, o: 0 } : d === 'R' ? { x: x + 1, y, o: 2 } : { x: x - 1, y, o: 2 };
    }
    const valid = (b, set) => cellsOf(b).every(([x, y]) => set.has(key(x, y)));

    // movimientos mínimos para llegar de pie a la meta (búsqueda en anchura)
    function solve(set, s, goalCell) {
      const seen = new Set([s.x + ',' + s.y + ',' + s.o]);
      let frontier = [s], n = 0;
      while (frontier.length && n < 80) {
        const next = [];
        for (const b of frontier) {
          if (b.o === 0 && b.x === goalCell.x && b.y === goalCell.y) return n;
          for (const d of ['L', 'R', 'U', 'D']) {
            const nb = roll(b, d), k = nb.x + ',' + nb.y + ',' + nb.o;
            if (!seen.has(k) && valid(nb, set)) { seen.add(k); next.push(nb); }
          }
        }
        frontier = next; n++;
      }
      return -1;
    }

    // nivel aleatorio: el bloque da un paseo al azar y las casillas pisadas forman el mapa (siempre tiene solución)
    function gen() {
      const steps = clamp(8 + level * 2, 8, 34);
      const maxC = clamp(Math.floor(W / 36), 5, 12), maxR = clamp(Math.floor((H - 150) / 36), 6, 15);
      for (let tries = 0; tries < 400; tries++) {
        let b = { x: 0, y: 0, o: 0 }, lastD = null, n = 0;
        const set = new Map([[key(0, 0), [0, 0]]]);
        while ((n < steps || b.o !== 0 || (b.x === 0 && b.y === 0)) && n < steps + 40) {
          const d = lastD && Math.random() < 0.5 ? lastD : ['L', 'R', 'U', 'D'][Math.floor(Math.random() * 4)];
          b = roll(b, d); lastD = d; n++;
          cellsOf(b).forEach(([x, y]) => set.set(key(x, y), [x, y]));
        }
        if (b.o !== 0 || (b.x === 0 && b.y === 0)) continue;
        const arr = [...set.values()];
        for (let i = 0, extra = Math.floor(arr.length * 0.25); i < extra; i++) { // casillas de más para despistar
          const [x, y] = arr[Math.floor(Math.random() * arr.length)], v = DV[['L', 'R', 'U', 'D'][Math.floor(Math.random() * 4)]];
          set.set(key(x + v[0], y + v[1]), [x + v[0], y + v[1]]);
        }
        const all = [...set.values()];
        const minx = Math.min(...all.map(c => c[0])), miny = Math.min(...all.map(c => c[1]));
        const maxx = Math.max(...all.map(c => c[0])), maxy = Math.max(...all.map(c => c[1]));
        const w = maxx - minx + 1, h = maxy - miny + 1;
        if (w > maxC || h > maxR || all.length < 8) continue;
        const ns = new Set(all.map(([x, y]) => key(x - minx, y - miny)));
        const s = { x: -minx, y: -miny, o: 0 }, gc = { x: b.x - minx, y: b.y - miny };
        const p = solve(ns, s, gc);
        if (p < Math.max(4, steps / 3)) continue;
        tiles = ns; bw = w; bh = h; goal = gc; par = p; startCell = { x: s.x, y: s.y };
        return s;
      }
      tiles = new Set(['0,0', '1,0', '2,0', '3,0', '4,0']); bw = 5; bh = 1; goal = { x: 3, y: 0 }; par = 2; startCell = { x: 0, y: 0 };
      return { x: 0, y: 0, o: 0 };
    }

    function layout() {
      ({ W, H } = fitCanvas(cv));
    }
    function setup() {
      const s = gen();
      ts = Math.floor(clamp(Math.min(W / (bw + 1.5), (H - 150) / (bh + 1.5)), 26, 64));
      ox = Math.floor((W - bw * ts) / 2); oy = Math.floor(70 + (H - 150 - bh * ts) / 2);
      restart(s);
    }
    function restart(s) {
      blk = s || { x: startCell.x, y: startCell.y, o: 0 };
      anim = null; phase = 'play'; phaseT = 0; moves = 0;
    }
    function newLevelFresh() { layout(); setup(); }

    function move(d) {
      if (!d || phase !== 'play' || anim) return;
      Sound.unlock();
      const nb = roll(blk, d);
      anim = { from: blk, to: nb, t: 0 };
      moves++; started = true;
      Sound.tick(1);
    }
    function land() {
      blk = anim.to; anim = null;
      if (!valid(blk, tiles)) { phase = 'fall'; phaseT = 0; Sound.sfx('hit'); }
      else if (blk.o === 0 && blk.x === goal.x && blk.y === goal.y) {
        phase = 'win'; phaseT = 0; Sound.sfx('combo');
        if (level + 1 > best) { best = level + 1; store.set('calma-blox-best', String(best)); }
      }
    }

    function update(dt) {
      if (anim) { anim.t += dt / 0.14; if (anim.t >= 1) land(); }
      if (phase === 'fall') { phaseT += dt; if (phaseT > 0.7) restart(); }
      if (phase === 'win') { phaseT += dt; if (phaseT > 1.5) { level++; setup(); } }
    }

    function draw() {
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#101a38'); bg.addColorStop(1, '#070a14');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        if (!tiles.has(key(x, y))) continue;
        const px = ox + x * ts, py = oy + y * ts;
        const isGoal = x === goal.x && y === goal.y, isStart = x === startCell.x && y === startCell.y;
        g.fillStyle = 'rgba(0,0,0,.35)'; rr(g, px + 2, py + 5, ts - 4, ts - 4, ts * 0.12); g.fill();
        g.fillStyle = isStart ? '#7fd1b9' : '#8ea4cc'; rr(g, px + 2, py + 1, ts - 4, ts - 4, ts * 0.12); g.fill();
        g.fillStyle = 'rgba(255,255,255,.18)'; rr(g, px + 5, py + 4, ts - 10, ts * 0.22, 4); g.fill();
        if (isGoal) {
          g.fillStyle = '#04060c'; rr(g, px + ts * 0.2, py + ts * 0.2, ts * 0.6, ts * 0.6, ts * 0.12); g.fill();
          g.strokeStyle = '#ffd34d'; g.lineWidth = 3; g.shadowColor = '#ffd34d'; g.shadowBlur = 10;
          rr(g, px + ts * 0.2, py + ts * 0.2, ts * 0.6, ts * 0.6, ts * 0.12); g.stroke(); g.shadowBlur = 0;
        }
      }
      // bloque (con animación de giro)
      let r = rectOf(blk), lift = 0, alpha = 1, sc = 1;
      if (anim) {
        const e = anim.t * anim.t * (3 - 2 * anim.t), a = rectOf(anim.from), b = rectOf(anim.to);
        r = a.map((v, i) => v + (b[i] - v) * e); lift = Math.sin(Math.PI * e);
      }
      if (phase === 'fall') { const f = Math.min(1, phaseT / 0.6); sc = 1 - f * 0.6; alpha = 1 - f; r = rectOf(blk); }
      if (phase === 'win') { const f = Math.min(1, phaseT / 0.6); sc = 1 - f * 0.7; alpha = 1 - f * 0.9; }
      const bx = ox + r[0] * ts, by = oy + r[1] * ts, bwid = r[2] * ts, bhei = r[3] * ts;
      const cxm = bx + bwid / 2, cym = by + bhei / 2, w2 = bwid * sc / 2 - 3, h2 = bhei * sc / 2 - 3;
      g.globalAlpha = alpha;
      g.fillStyle = 'rgba(0,0,0,.4)'; rr(g, cxm - w2 + 3, cym - h2 + 6 + lift * 6, w2 * 2, h2 * 2, ts * 0.14); g.fill();
      const grd = g.createLinearGradient(0, cym - h2 - lift * 8, 0, cym + h2 - lift * 8);
      grd.addColorStop(0, '#ffc15a'); grd.addColorStop(1, '#e8730c');
      g.fillStyle = grd; rr(g, cxm - w2, cym - h2 - lift * 8 - 2, w2 * 2, h2 * 2, ts * 0.14); g.fill();
      g.fillStyle = 'rgba(255,255,255,.28)'; rr(g, cxm - w2 + 4, cym - h2 - lift * 8 + 1, w2 * 2 - 8, h2 * 0.5, 5); g.fill();
      g.globalAlpha = 1;

      // marcador
      const fs = clamp(W / 20, 14, 22);
      g.font = `800 ${fs}px ui-monospace, Menlo, Consolas, monospace`; g.textBaseline = 'top';
      g.textAlign = 'left'; g.fillStyle = '#fff'; g.fillText('Nivel ' + level, 14, 14);
      g.textAlign = 'right'; g.fillStyle = moves > par + 3 ? '#ff8a8a' : '#ffe14d'; g.fillText('Movs ' + moves + ' / par ' + par, W - 14, 14);
      g.textAlign = 'center'; g.fillStyle = '#9fb3c8'; g.font = `700 ${fs * 0.75}px system-ui, sans-serif`;
      g.fillText('Llega de pie al hueco dorado · no te caigas', W / 2, 14 + fs * 1.5);
      if (!started) { g.fillStyle = '#4cc9f0'; g.textBaseline = 'bottom'; g.fillText('Desliza o usa las flechas para rodar el bloque', W / 2, H - 70); }
      if (phase === 'win') {
        const stars = moves <= par ? 3 : moves <= par + 3 ? 2 : 1;
        panel(g, W, H, [['¡Nivel superado!', '#7dff9a', 1.2], ['⭐'.repeat(stars) + '☆'.repeat(3 - stars), '#ffe14d', 1.3], [moves + ' movimientos (par ' + par + ')', '#fff', 0.8]]);
      } else if (phase === 'fall' && phaseT > 0.2) {
        panel(g, W, H, [['¡Te caíste!', '#ff7a7a', 1.2]]);
      }
    }

    function frame(ts2) {
      if (!active) return;
      const dt = Math.min(0.04, (ts2 - last) / 1000 || 0);
      last = ts2;
      update(dt); draw();
      raf = requestAnimationFrame(frame);
    }

    swipe(cv, move, 24);
    $('#blox-new').addEventListener('click', e => { Sound.unlock(); setup(); e.currentTarget.blur(); });
    $('#blox-reset').addEventListener('click', e => { restart(); e.currentTarget.blur(); });
    window.addEventListener('keydown', e => {
      if (!active || e.ctrlKey || e.metaKey || e.altKey || inUi(e)) return;
      const d = dirOf(e);
      if (d) { e.preventDefault(); move(d); }
      else if (e.key.toLowerCase() === 'r') restart();
      else if (e.key.toLowerCase() === 'n') setup();
    });
    window.addEventListener('resize', () => { if (active) newLevelFresh(); });

    return {
      setActive(a) {
        active = a;
        cancelAnimationFrame(raf);
        if (a) { layout(); level = 1; started = false; setup(); last = performance.now(); raf = requestAnimationFrame(frame); }
      }
    };
  })();

  /* ======================= Cubo de Rubik 3x3 ======================= */
  const Rubik = (() => {
    const view = $('#view-rubik'), stage = $('#rb-stage'), cubeEl = $('#rb-cube');
    const elMoves = $('#rb-moves'), elTime = $('#rb-time'), elBest = $('#rb-best'), msg = $('#rb-msg');
    const FIDS = ['F', 'B', 'R', 'L', 'U', 'D'];
    const FN = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, -1, 0], [0, 1, 0]];
    const FCOL = ['#18b04a', '#1e5bd8', '#d6262b', '#ff8a1f', '#f4f4f4', '#ffd400'];
    let active = false, raf = 0, last = 0;
    let rx = -28, ry = -38, s = 70;
    let cubies = [], queue = [], cur = null, drag = null;
    let state = 'free', moves = 0, t0 = 0, elapsed = 0;
    let best = +store.get('calma-rubik-best', '0') || 0;

    const I3 = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const mulV = (A, v) => A.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
    const mulM = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
    // giro de 90° (dir = ±1) alrededor de un eje, igual que rotateX/Y/Z de CSS
    function rotM(axis, dir) {
      const c = 0, n = dir;
      if (axis === 0) return [[1, 0, 0], [0, c, -n], [0, n, c]];
      if (axis === 1) return [[c, 0, n], [0, 1, 0], [-n, 0, c]];
      return [[c, -n, 0], [n, c, 0], [0, 0, 1]];
    }
    const fmt = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');

    function paint(c, ang = 0, axis = -1) {
      const [x, y, z] = c.pos, R = c.R;
      const pre = axis < 0 || !ang ? '' : 'rotate' + 'XYZ'[axis] + '(' + ang + 'deg) ';
      c.el.style.transform = pre + 'translate3d(' + x * s + 'px,' + y * s + 'px,' + z * s + 'px) matrix3d(' +
        [R[0][0], R[1][0], R[2][0], 0, R[0][1], R[1][1], R[2][1], 0, R[0][2], R[1][2], R[2][2], 0, 0, 0, 0, 1].join(',') + ')';
    }

    function build() {
      cubeEl.textContent = ''; cubies = [];
      for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
        const el = document.createElement('div');
        el.className = 'rb-cubie';
        const c = { el, pos: [x, y, z], R: I3(), col: [] };
        FIDS.forEach((id, fi) => {
          const n = FN[fi], f = document.createElement('div');
          f.className = 'rb-f ' + id; f.dataset.f = fi; f.dataset.c = cubies.length;
          const on = n[0] * x + n[1] * y + n[2] * z === 1;
          c.col[fi] = on ? FCOL[fi] : null;
          if (on) { const i = document.createElement('i'); i.style.setProperty('--c', FCOL[fi]); f.appendChild(i); }
          el.appendChild(f);
        });
        cubeEl.appendChild(el); cubies.push(c);
      }
      cubies.forEach(c => paint(c));
    }

    function solved() {
      const seen = {};
      for (const c of cubies) for (let fi = 0; fi < 6; fi++) {
        if (!c.col[fi]) continue;
        const k = mulV(c.R, FN[fi]).join(',');
        (seen[k] = seen[k] || new Set()).add(c.col[fi]);
      }
      return Object.values(seen).every(set => set.size === 1);
    }

    function hud() {
      elMoves.textContent = moves;
      elTime.textContent = fmt(elapsed);
      elBest.textContent = best ? fmt(best) : '–';
    }
    function applyView() { cubeEl.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)'; }
    function layout() {
      const r = view.getBoundingClientRect();
      s = clamp(Math.min(r.width * 0.2, r.height * 0.14), 38, 110);
      stage.style.setProperty('--s', s + 'px');
      cubies.forEach(c => paint(c));
      applyView();
    }

    function reset() {
      queue = []; cur = null; state = 'free'; moves = 0; elapsed = 0; msg.hidden = true;
      build(); hud();
    }
    function shuffle() {
      reset();
      let la = -1, ll = 9;
      for (let i = 0; i < 24; i++) {
        let axis, layer;
        do { axis = Math.floor(Math.random() * 3); layer = Math.floor(Math.random() * 3) - 1; } while (axis === la && layer === ll);
        la = axis; ll = layer;
        queue.push({ axis, layer, dir: Math.random() < 0.5 ? -1 : 1, dur: 70, user: false });
      }
      state = 'scrambled';
    }
    const busy = () => (cur && !cur.user) || queue.some(q => !q.user);
    function userMove(axis, layer, dir) {
      if (busy() || queue.length > 2) return;
      if (state === 'won') { state = 'free'; moves = 0; elapsed = 0; msg.hidden = true; hud(); }
      Sound.unlock();
      queue.push({ axis, layer, dir, dur: 200, user: true });
    }

    function finish(m) {
      if (!m.user) return;
      moves++;
      if (state === 'scrambled') { state = 'solving'; t0 = performance.now() - m.dur; }
      if (state === 'solving' && solved()) {
        state = 'won';
        elapsed = (performance.now() - t0) / 1000;
        if (!best || elapsed < best) { best = elapsed; store.set('calma-rubik-best', String(best)); }
        msg.textContent = '¡Resuelto en ' + fmt(elapsed) + ' con ' + moves + ' movimientos!';
        msg.hidden = false;
        Sound.sfx('combo');
      }
      hud();
    }

    function step(dt) {
      if (!cur) {
        if (!queue.length) return;
        const m = queue.shift();
        cur = { ...m, t: 0, cubs: cubies.filter(c => c.pos[m.axis] === m.layer) };
      }
      cur.t += dt * 1000;
      const k = Math.min(1, cur.t / cur.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      cur.cubs.forEach(c => paint(c, cur.dir * 90 * e, cur.axis));
      if (k >= 1) {
        const Rm = rotM(cur.axis, cur.dir), m = cur;
        m.cubs.forEach(c => {
          c.pos = mulV(Rm, c.pos).map(Math.round);
          c.R = mulM(Rm, c.R).map(r => r.map(Math.round));
          paint(c);
        });
        cur = null;
        finish(m);
      }
    }

    function frame(now) {
      if (!active) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      step(dt);
      if (state === 'solving') { elapsed = (now - t0) / 1000; elTime.textContent = fmt(elapsed); }
      raf = requestAnimationFrame(frame);
    }

    // proyección de un vector del cubo a la pantalla (misma rotación que el CSS)
    function toScreen(v) {
      const a = ry * Math.PI / 180, b = rx * Math.PI / 180;
      const x = v[0] * Math.cos(a) + v[2] * Math.sin(a), z = -v[0] * Math.sin(a) + v[2] * Math.cos(a);
      return [x, v[1] * Math.cos(b) - z * Math.sin(b)];
    }
    // arrastrar sobre una pegatina: gira la fila en la dirección del dedo
    function faceDrag(c, fi, dx, dy) {
      const n = mulV(c.R, FN[fi]), na = n.findIndex(v => v !== 0);
      let best2 = null;
      for (let t = 0; t < 3; t++) {
        if (t === na) continue;
        const tv = [0, 0, 0]; tv[t] = 1;
        const sv = toScreen(tv), len = Math.hypot(sv[0], sv[1]) || 1e-6;
        const d = (sv[0] * dx + sv[1] * dy) / len;
        if (!best2 || Math.abs(d) > Math.abs(best2.d)) best2 = { t, d };
      }
      const tv = [0, 0, 0]; tv[best2.t] = best2.d > 0 ? 1 : -1;
      const a = [n[1] * tv[2] - n[2] * tv[1], n[2] * tv[0] - n[0] * tv[2], n[0] * tv[1] - n[1] * tv[0]];
      const axis = a.findIndex(v => v !== 0);
      userMove(axis, c.pos[axis], a[axis]);
    }

    stage.addEventListener('pointerdown', e => {
      if (drag) return;
      const f = e.target.closest && e.target.closest('.rb-f');
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, face: f ? { c: cubies[+f.dataset.c], fi: +f.dataset.f } : null, done: false };
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.face) {
        ry += (e.clientX - drag.x) * 0.5; rx = clamp(rx - (e.clientY - drag.y) * 0.5, -89, 89);
        drag.x = e.clientX; drag.y = e.clientY; applyView();
        return;
      }
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (drag.done || Math.hypot(dx, dy) < 14) return;
      drag.done = true;
      faceDrag(drag.face.c, drag.face.fi, dx, dy);
    });
    const endDrag = e => { if (drag && e.pointerId === drag.id) drag = null; };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    window.addEventListener('keydown', e => {
      if (!active || e.ctrlKey || e.metaKey || e.altKey || inUi(e)) return;
      const m = { f: [2, 1], b: [2, -1], r: [0, 1], l: [0, -1], u: [1, -1], d: [1, 1] }[e.key.toLowerCase()];
      if (!m) return;
      e.preventDefault();
      userMove(m[0], m[1], m[1] * (e.shiftKey ? -1 : 1));
    });
    $('#rb-shuffle').addEventListener('click', e => { Sound.unlock(); shuffle(); e.currentTarget.blur(); });
    $('#rb-reset').addEventListener('click', e => { reset(); e.currentTarget.blur(); });
    window.addEventListener('resize', () => { if (active) layout(); });

    return {
      setActive(a) {
        active = a;
        cancelAnimationFrame(raf);
        if (a) {
          if (!cubies.length) build();
          layout(); hud();
          last = performance.now(); raf = requestAnimationFrame(frame);
        }
      }
    };
  })();

  /* ======================= Cara de chicle (malla elástica) ======================= */
  const Chicle = (() => {
    const view = $('#view-chicle'), cv = $('#chi-canvas'), g = cv.getContext('2d');
    const ANIMALS = [['🐶', 'Perro'], ['🐱', 'Gato'], ['🦊', 'Zorro'], ['🐺', 'Lobo'], ['🐻', 'Oso'], ['🐼', 'Panda'], ['🐨', 'Koala'],
      ['🦁', 'León'], ['🐯', 'Tigre'], ['🐵', 'Mono'], ['🐷', 'Cerdo'], ['🐮', 'Vaca'], ['🐴', 'Caballo'], ['🐰', 'Conejo'], ['🐸', 'Rana']];
    const PEOPLE = [['🧑', 'Persona'], ['👨', 'Hombre'], ['👩', 'Mujer'], ['👴', 'Abuelo'], ['👵', 'Abuela'], ['👦', 'Chico'], ['👧', 'Chica'],
      ['👶', 'Bebé'], ['🧔', 'Barbudo'], ['👱‍♀️', 'Rubia'], ['👨‍🦰', 'Pelirrojo'], ['👩‍🦱', 'Rizos'], ['👨‍🦲', 'Calvo'], ['👩‍🦳', 'Canosa']];
    const LIST = [...ANIMALS.map(([e, n]) => ({ e, n, p: false })), ...PEOPLE.map(([e, n]) => ({ e, n, p: true }))];
    const TONES = ['', '\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}'];
    const TONE_COL = ['#ffcf3f', '#f7d7c4', '#e0b48f', '#c08a5d', '#8d5a3b', '#5a3a28'];
    const BGS = [['#2c3e66', '#0b1020'], ['#5a2a6b', '#150a1f'], ['#1f6b57', '#07201a'], ['#d98a3d', '#4a1f10'], ['#f5f7fb', '#aeb9cc']];
    // 1 = chicle blando y lento … 5 = rebote loco
    const PARAMS = [{ k: 30, z: 0.28 }, { k: 60, z: 0.2 }, { k: 110, z: 0.15 }, { k: 180, z: 0.11 }, { k: 300, z: 0.08 }];
    const withTone = (e, t) => { if (!t) return e; const a = Array.from(e); return a[0] + t + a.slice(1).join(''); };

    let sel = clamp(+store.get('calma-face', '0') || 0, 0, LIST.length - 1);
    let tone = clamp(+store.get('calma-tone', '0') || 0, 0, 5);
    let bg = clamp(+store.get('calma-fbg', '0') || 0, 0, BGS.length - 1);
    let el = clamp(+store.get('calma-elas', '3') || 3, 1, 5);

    const N = 15, TS = 640, n2 = N * N;
    const tex = document.createElement('canvas'); tex.width = tex.height = TS;
    const rxA = new Float32Array(n2), ryA = new Float32Array(n2), pxA = new Float32Array(n2), pyA = new Float32Array(n2);
    const vxA = new Float32Array(n2), vyA = new Float32Array(n2), wt = new Float32Array(n2);
    let W = 0, H = 0, S = 200, cx = 0, cy = 0, dpr = 1;
    let active = false, raf = 0, last = 0;
    let held = false, pid = null, px0 = 0, py0 = 0, ptx = 0, pty = 0, a0x = 0, a0y = 0;

    function drawTex() {
      const t = tex.getContext('2d'), f = LIST[sel];
      t.clearRect(0, 0, TS, TS);
      t.font = (TS * 0.78) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
      t.textAlign = 'center'; t.textBaseline = 'middle';
      t.fillText(f.p ? withTone(f.e, TONES[tone]) : f.e, TS / 2, TS / 2 + TS * 0.04);
    }
    function layout() {
      const r = view.getBoundingClientRect();
      W = r.width; H = r.height; dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      S = clamp(Math.min(W * 0.78, H * 0.56), 150, 520); cx = W / 2; cy = H / 2 + 8;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const id = j * N + i;
        rxA[id] = pxA[id] = cx - S / 2 + i * S / (N - 1);
        ryA[id] = pyA[id] = cy - S / 2 + j * S / (N - 1);
        vxA[id] = vyA[id] = 0;
      }
    }

    function release() {
      if (!held) return;
      held = false;
      if (Math.hypot(ptx - px0 + a0x, pty - py0 + a0y) > S * 0.25) Sound.sfx('flap');
      cv.style.cursor = 'grab';
      try { cv.releasePointerCapture(pid); } catch { /* ya liberado */ }
      pid = null;
    }
    cv.addEventListener('pointerdown', e => {
      if (held) return;
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      let bi = -1, bd = 1e12;
      for (let i = 0; i < n2; i++) { const d = (pxA[i] - x) ** 2 + (pyA[i] - y) ** 2; if (d < bd) { bd = d; bi = i; } }
      if (Math.sqrt(bd) > S * 0.4) return;
      Sound.unlock();
      held = true; pid = e.pointerId; cv.setPointerCapture(pid);
      px0 = ptx = x; py0 = pty = y;
      a0x = pxA[bi] - rxA[bi]; a0y = pyA[bi] - ryA[bi];
      const sg = S * 0.3;
      for (let i = 0; i < n2; i++) wt[i] = Math.exp(-((rxA[i] - rxA[bi]) ** 2 + (ryA[i] - ryA[bi]) ** 2) / (2 * sg * sg));
      cv.style.cursor = 'grabbing';
      e.preventDefault();
    });
    cv.addEventListener('pointermove', e => {
      if (!held || e.pointerId !== pid) return;
      const r = cv.getBoundingClientRect();
      ptx = e.clientX - r.left; pty = e.clientY - r.top;
    });
    cv.addEventListener('pointerup', release);
    cv.addEventListener('pointercancel', release);
    cv.addEventListener('lostpointercapture', release);

    function step(dt) {
      const P = PARAMS[el - 1], k = P.k, kn = k * 2.2, cn = 0.6 * Math.sqrt(kn), damp = 2 * P.z * Math.sqrt(k), kh = 1400;
      const sub = 4, h = Math.min(dt, 1 / 30) / sub;
      let dX = a0x + (ptx - px0), dY = a0y + (pty - py0);
      // estiramiento con resistencia (como un chicle): suave y sin que la malla se pliegue
      const dm = Math.hypot(dX, dY), Lm = S * 0.45;
      if (dm > 1) { const f = Lm * Math.tanh(dm / Lm) / dm; dX *= f; dY *= f; }
      for (let s = 0; s < sub; s++) {
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          const id = j * N + i, x = pxA[id], y = pyA[id], ux = vxA[id], uy = vyA[id];
          let fx = -k * (x - rxA[id]) - damp * ux, fy = -k * (y - ryA[id]) - damp * uy;
          for (let q = 0; q < 4; q++) {
            let o;
            if (q === 0) { if (i === 0) continue; o = id - 1; }
            else if (q === 1) { if (i === N - 1) continue; o = id + 1; }
            else if (q === 2) { if (j === 0) continue; o = id - N; }
            else { if (j === N - 1) continue; o = id + N; }
            fx += kn * ((pxA[o] - x) - (rxA[o] - rxA[id])) + cn * (vxA[o] - ux);
            fy += kn * ((pyA[o] - y) - (ryA[o] - ryA[id])) + cn * (vyA[o] - uy);
          }
          if (held) {
            const w = wt[id];
            if (w > 0.003) { fx += kh * w * (rxA[id] + w * dX - x); fy += kh * w * (ryA[id] + w * dY - y); }
          }
          vxA[id] = ux + fx * h; vyA[id] = uy + fy * h;
        }
        for (let i = 0; i < n2; i++) { pxA[i] += vxA[i] * h; pyA[i] += vyA[i] * h; }
      }
    }

    // dibuja un triángulo de la malla con la textura deformada (transformación afín)
    function tri(i0, i1, i2, s0, t0, s1, t1, s2, t2, su, sv, cs) {
      const x0 = pxA[i0], y0 = pyA[i0], x1 = pxA[i1], y1 = pyA[i1], x2 = pxA[i2], y2 = pyA[i2];
      const det = (s1 - s0) * (t2 - t0) - (s2 - s0) * (t1 - t0);
      const A = ((x1 - x0) * (t2 - t0) - (x2 - x0) * (t1 - t0)) / det;
      const C = (-(x1 - x0) * (s2 - s0) + (x2 - x0) * (s1 - s0)) / det;
      const B = ((y1 - y0) * (t2 - t0) - (y2 - y0) * (t1 - t0)) / det;
      const D = (-(y1 - y0) * (s2 - s0) + (y2 - y0) * (s1 - s0)) / det;
      const E = x0 - A * s0 - C * t0, F = y0 - B * s0 - D * t0;
      const mx = (x0 + x1 + x2) / 3, my = (y0 + y1 + y2) / 3;
      g.save();
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.beginPath();
      [[x0, y0], [x1, y1], [x2, y2]].forEach(([x, y], n) => {
        const dx = x - mx, dy = y - my, l = Math.hypot(dx, dy) || 1;
        const qx = x + dx / l * 1.1, qy = y + dy / l * 1.1;
        if (n) g.lineTo(qx, qy); else g.moveTo(qx, qy);
      });
      g.closePath(); g.clip();
      g.setTransform(dpr * A, dpr * B, dpr * C, dpr * D, dpr * E, dpr * F);
      const sx = Math.max(0, su - 3), sy = Math.max(0, sv - 3);
      const sw = Math.min(TS, su + cs + 3) - sx, sh = Math.min(TS, sv + cs + 3) - sy;
      g.drawImage(tex, sx, sy, sw, sh, sx, sy, sw, sh);
      g.restore();
    }
    function draw() {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const sy = cy + S * 0.56;
      g.save();
      g.translate(cx, sy); g.scale(1, 0.18);
      const gr = g.createRadialGradient(0, 0, 2, 0, 0, S * 0.5);
      gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, S * 0.5, 0, TAU); g.fill();
      g.restore();
      const cs = TS / (N - 1);
      for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
        const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
        const u0 = i * cs, v0 = j * cs, u1 = u0 + cs, v1 = v0 + cs;
        tri(a, b, c, u0, v0, u1, v0, u0, v1, u0, v0, cs);
        tri(b, d, c, u1, v0, u1, v1, u0, v1, u0, v0, cs);
      }
    }
    function frame(now) {
      if (!active) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      step(dt); draw();
      raf = requestAnimationFrame(frame);
    }

    /* ---- opciones ---- */
    const facesEl = $('#chi-faces'), tonesEl = $('#chi-tones'), bgsEl = $('#chi-bgs'), elasEl = $('#chi-el'), toneGrp = $('#chi-tone-grp');
    LIST.forEach((f, i) => {
      if (i === ANIMALS.length) { const sp = document.createElement('span'); sp.className = 'sep'; facesEl.appendChild(sp); }
      const b = document.createElement('button');
      b.textContent = f.e; b.title = f.n; b.setAttribute('aria-label', f.n);
      b.addEventListener('click', () => { sel = i; paintOpts(); });
      facesEl.appendChild(b);
    });
    TONE_COL.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'sw'; b.style.setProperty('--c', c); b.setAttribute('aria-label', 'Tono de piel ' + (i + 1));
      b.addEventListener('click', () => { tone = i; paintOpts(); });
      tonesEl.appendChild(b);
    });
    BGS.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'sw'; b.style.setProperty('--c', c[0]); b.setAttribute('aria-label', 'Fondo ' + (i + 1));
      b.addEventListener('click', () => { bg = i; paintOpts(); });
      bgsEl.appendChild(b);
    });
    elasEl.addEventListener('input', () => { el = +elasEl.value; paintOpts(); });
    $('#chi-rand').addEventListener('click', e => {
      sel = Math.floor(Math.random() * LIST.length); tone = Math.floor(Math.random() * 6); bg = Math.floor(Math.random() * BGS.length);
      paintOpts(); e.currentTarget.blur();
    });
    function paintOpts() {
      const fb = [...facesEl.querySelectorAll('button')];
      fb.forEach((b, i) => b.setAttribute('aria-pressed', String(i === sel)));
      [...tonesEl.children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === tone)));
      [...bgsEl.children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === bg)));
      toneGrp.hidden = !LIST[sel].p;
      elasEl.value = el;
      view.style.background = 'radial-gradient(circle at 50% 40%,' + BGS[bg][0] + ',' + BGS[bg][1] + ')';
      store.set('calma-face', String(sel)); store.set('calma-tone', String(tone));
      store.set('calma-fbg', String(bg)); store.set('calma-elas', String(el));
      drawTex();
    }
    window.addEventListener('resize', () => { if (active) layout(); });
    paintOpts();

    return {
      setActive(a) {
        active = a;
        cancelAnimationFrame(raf);
        if (a) { layout(); drawTex(); last = performance.now(); raf = requestAnimationFrame(frame); }
        else release();
      }
    };
  })();

  /* ======================= Navegación y sonido global ======================= */
  const NAMES = ['home', 'centipede', 'tarantula', 'spinner', 'keyboard', 'cars', 'flappy', 'snake', 'pac', 'blox', 'rubik', 'chicle'];
  const mods = { home: { setActive() {} }, centipede: Centi, tarantula: Taran, spinner: Spin, keyboard: Keys, cars: Cars, flappy: Flappy, snake: Snake, pac: Pac, blox: Blox, rubik: Rubik, chicle: Chicle };
  let current = 'home';

  function show(name) {
    if (!NAMES.includes(name)) name = 'home';
    current = name;
    NAMES.forEach(n => {
      const on = n === name;
      $('#view-' + n).hidden = !on;
      const tab = $('#tab-' + n);
      if (tab) {
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
      }
      mods[n].setActive(on);
    });
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  }

  $$('.tab, .card').forEach(el => el.addEventListener('click', () => show(el.dataset.view)));
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));

  const soundBtn = $('#sound-btn');
  const paintSound = () => {
    const on = Sound.isOn();
    soundBtn.textContent = on ? '🔊' : '🔇';
    soundBtn.setAttribute('aria-pressed', String(on));
  };
  soundBtn.addEventListener('click', () => { Sound.toggle(); paintSound(); });
  paintSound();

  // Espacio / flechas dan un empujón al spinner
  window.addEventListener('keydown', e => {
    if (current !== 'spinner' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('button, input, label')) return;
    if (e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); Spin.kick(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); Spin.kick(-1); }
  });

  show(location.hash.slice(1) || 'home');
})();
