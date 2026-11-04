/* =====================================================================
   HERO — multilingual greeting sequence + Typegarden garden

   The garden engine below is adapted (not re-imagined) from hmm.html
   (Typegarden). Reused 1:1:
     - seeded PRNG (rng), sin-hash (h), easings (spr / eo)
     - vine / curl / bez / weave + layerAt
     - wordParams / grow / gen  (procedural stems, leaves, roses,
       letter-to-letter vines, recursive branches)
     - path + backend drawing abstraction, strokeRange, thorn, leaf, rose
     - two-pass layered render: layer 0 -> glyphs -> layer 1
       (this is what makes plants weave BEHIND and IN FRONT of the text)
     - jit() "boiling line" hand-drawn wobble + birth wobble (wpt)

   Dropped (not needed for a static hero):
     typing/editor input, poster mode + presets, PNG/SVG/video/zip
     export, butterflies, mouse-follow lean, cut/wither/recoil.
   ===================================================================== */

(function () {
'use strict';

const hero = document.getElementById('hero');
const cv   = document.getElementById('garden-canvas');
if (!hero || !cv) return;

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------------------
   Palette — hmm.html "Paper" palette tuned to the site's warm cream:
   cream background, near-black glyphs, cobalt stems, red/orange flowers
   --------------------------------------------------------------------- */
const PAL = { bg: '#F5F1E6', red: '#FF3B1F', blue: '#1C2B8F', line: '#FFD2C4', text: '#111111' };
const C   = { red: PAL.red, blue: PAL.blue, line: PAL.line, text: PAL.text, vein: PAL.bg };

const CFG = {
    boil: true,
    density: 0.85        // light hand — keep SAHIB readable, not a jungle
};

const F = '"Playfair Display",Georgia,serif';   // hero serif, same stack as Typegarden

/* ---------------------------------------------------------------------
   Greeting sequence
   --------------------------------------------------------------------- */
const WORDS = [
    { t: 'Hello',                          f: F,                                     cls: '' },
    { t: '\u0928\u092E\u0938\u094D\u0924\u0947',   // नमस्ते
      f: '"Noto Serif Devanagari",Georgia,serif',                                    cls: 'greet-word--deva' },
    { t: 'Bonjour',                        f: F,                                     cls: '' },
    { t: '\u0A38\u0A24 \u0A38\u0A4D\u0A30\u0A40 \u0A05\u0A15\u0A3E\u0A32',  // ਸਤ ਸ੍ਰੀ ਅਕਾਲ
      f: '"Noto Serif Gurmukhi",Georgia,serif',                                      cls: 'greet-word--gurm' },
    { t: 'Hola',                           f: F,                                     cls: '' }
];
const WORD_MS     = 520;   // each word visible ~0.5s
const FADE_MS     = 140;   // quick in/out, no slideshow feel
const BLANK_MS    = 280;   // brief clear before the hero reveal
const STAGGER_MS  = 130;   // garden letters start one after another

/* =====================================================================
   ENGINE  (adapted from Typegarden)
   ===================================================================== */

class Garden {

    constructor(canvas) {
        this.cv = canvas;
        this.g  = canvas.getContext('2d');
        this.F  = F;
        this.W = 0; this.H = 0; this.dpr = 1;
        this.letters = []; this.uid = 1; this.cache = {};
        this.S = 0; this.S_h = 28; this.helloY = 0;
        this.helloAppear = null;
        this._now = 0; this._f = 0; this._amp = 0;
        this.cc = C;
    }

    /* ---------- math (verbatim from Typegarden) ---------- */
    h(n)      { const x = Math.sin(n) * 43758.5453; return x - Math.floor(x); }
    spr(t, k = 7, w = 16) { if (t <= 0) return 0; return 1 - Math.exp(-t * k) * Math.cos(t * w); }
    eo(t)     { if (t <= 0) return 0; if (t >= 1) return 1; return 1 - Math.pow(1 - t, 3); }
    rng(seed) {
        let s = seed | 0;
        return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    jit(id, f, amp) {
        if (!amp) return [0, 0, 0];
        return [(this.h(id * 1.37 + f * 7.13) * 2 - 1) * amp,
                (this.h(id * 2.71 + f * 3.11) * 2 - 1) * amp,
                (this.h(id * 5.3  + f * 1.7 ) * 2 - 1) * 0.035];
    }
    bez(a, b, c, d, n) {
        const P = [];
        for (let i = 0; i <= n; i++) {
            const t = i / n, u = 1 - t;
            P.push([u*u*u*a[0] + 3*u*u*t*b[0] + 3*u*t*t*c[0] + t*t*t*d[0],
                    u*u*u*a[1] + 3*u*u*t*b[1] + 3*u*t*t*c[1] + t*t*t*d[1]]);
        }
        return P;
    }
    at(P, u) {
        const n = P.length;
        const i = Math.min(n - 2, Math.max(1, Math.round(u * (n - 1))));
        return [P[i], Math.atan2(P[i + 1][1] - P[i - 1][1], P[i + 1][0] - P[i - 1][0])];
    }
    vine(base, dir, len, amp, waves, ph, bend, n) {
        n = n || 40;
        const P = [[base[0], base[1]]], step = len / n;
        let x = base[0], y = base[1];
        for (let i = 1; i <= n; i++) {
            const u = i / n;
            const a = dir + bend * u + amp * Math.sin(u * Math.PI * waves + ph) * Math.min(1, u * 3);
            x += Math.cos(a) * step; y += Math.sin(a) * step; P.push([x, y]);
        }
        return P;
    }
    curl(P, sign, rad) {
        const n = P.length, e = P[n - 1];
        const a = Math.atan2(e[1] - P[n - 2][1], e[0] - P[n - 2][0]);
        const c = [e[0] - Math.sin(a) * sign * rad, e[1] + Math.cos(a) * sign * rad];
        const a0 = Math.atan2(e[1] - c[1], e[0] - c[0]);
        for (let i = 1; i <= 14; i++) {
            const u = i / 14, t = a0 + sign * u * Math.PI * 1.6, rr = rad * (1 - 0.5 * u);
            P.push([c[0] + Math.cos(t) * rr, c[1] + Math.sin(t) * rr]);
        }
        return P;
    }
    weave(r, startLayer) {
        const cuts = []; const nc = 1 + Math.floor(r() * 3);
        for (let i = 0; i < nc; i++) cuts.push(0.15 + r() * 0.7);
        cuts.sort((a, b) => a - b);
        const segs = []; let u0 = 0, layer = startLayer;
        for (const c of cuts) {
            if (c <= u0) continue;
            segs.push({ u0, u1: c, layer });
            if (r() < 0.3) { const g = 0.02 + r() * 0.03; u0 = Math.min(0.98, c + g); } else u0 = c;
            layer = 1 - layer;
        }
        segs.push({ u0, u1: 1, layer });
        return segs;
    }
    layerAt(segs, u) {
        for (const s of segs) if (u >= s.u0 && u <= s.u1) return s.layer;
        return segs[segs.length - 1].layer;
    }

    /* ---------- glyph metrics (Typegarden mw) ---------- */
    mw(ch) {
        if (this.cache[ch] != null) return this.cache[ch];
        this.g.font = `700 100px ${this.F}`;
        let w = this.g.measureText(ch).width / 100;
        if (ch === ' ') w *= 1.4;
        return (this.cache[ch] = w);
    }

    /* ---------- generation (verbatim from Typegarden gen/grow) ---------- */
    wordParams(ws) {
        const r = this.rng(ws * 7 + 13), dens = CFG.density;
        return { roseP: 0.16 + r() * 0.16, leafy: (0.6 + r() * 0.8) * dens, dens,
                 lean: (r() - 0.5) * 0.6, big: 0.85 + r() * 0.45,
                 curvy: 0.8 + r() * 0.6, bridgeP: Math.min(0.95, (0.45 + r() * 0.35) * dens), w: 0.5 };
    }
    grow(r, E, nid, p, o) {
        const tip = o.tip || (r() < p.roseP ? 'rose' : r() < 0.45 ? 'fan' : r() < 0.6 ? 'leaf' : 'curl');
        let P = o.pts || this.vine(o.base, o.dir, o.len, (0.35 + r() * 0.45) * p.curvy,
                                   1 + r() * 1.6, r() * 6.28, (r() - 0.5) * 1.2, 40);
        if (tip === 'curl') P = this.curl(P, r() < 0.5 ? -1 : 1, 0.05 + r() * 0.05);
        const segs = this.weave(r, o.layer0 != null ? o.layer0 : (r() < 0.5 ? 0 : 1));
        const dur = Math.max(320, (o.len || 0.8) * 620);
        const thorns = []; const nt = Math.floor(r() * 2.5);
        for (let i = 0; i < nt; i++) thorns.push({ u: 0.15 + r() * 0.65, s: r() < 0.5 ? -1 : 1 });

        E.push({ t: 'stem', id: nid(), pts: P, segs, d0: o.d0, dur, w: o.depth ? 0.82 : 1, thorns });

        const nl = Math.floor(r() * 2.8 * p.leafy);
        let sd = r() < 0.5 ? -1 : 1;
        for (let i = 0; i < nl; i++) {
            const u = 0.25 + r() * 0.6, [q, a] = this.at(P, u); sd = -sd;
            E.push({ t: 'leaf', id: nid(), x: q[0], y: q[1], a: a + sd * (0.55 + r() * 0.5),
                     L: (0.14 + r() * 0.2) * (o.depth ? 0.8 : 1), bend: (r() - 0.5) * 1.2,
                     layer: this.layerAt(segs, u), d0: o.d0 + dur * u });
        }

        const [tp, ta] = this.at(P, 1), td = o.d0 + dur * 0.8, tl = this.layerAt(segs, 1);
        if (tip === 'rose') {
            const R = (0.13 + r() * 0.15) * p.big * (o.depth ? 0.75 : 1) * 0.62;
            // legibility: a rose sitting over the letter body mostly goes behind it
            const over = tp[1] > -0.78 && tp[1] < 0.05 && Math.abs(tp[0]) < p.w * 0.5;
            const layer = over ? (r() < 0.22 ? 1 : 0) : (r() < 0.6 ? 1 : tl);
            E.push({ t: 'rose', id: nid(), x: tp[0], y: tp[1], R, rot: (r() - 0.5) * 1.0,
                     ph1: r() * 6.28, ph2: r() * 6.28, turns: 1.8 + r() * 1, layer, d0: td });
            if (r() < 0.2) {
                const oo = ta + (r() < 0.5 ? 1 : -1) * 1.3;
                E.push({ t: 'rose', id: nid(), x: tp[0] + Math.cos(oo) * R * 1.4, y: tp[1] + Math.sin(oo) * R * 1.4,
                         R: R * (0.6 + r() * 0.3), rot: (r() - 0.5) * 1.2, ph1: r() * 6.28, ph2: r() * 6.28,
                         turns: 1.8 + r(), layer, d0: td + 120 });
            }
        } else if (tip === 'fan') {
            const spread = 0.6 + r() * 0.3;
            for (let j = 0; j < 2; j++) E.push({ t: 'leaf', id: nid(), x: tp[0], y: tp[1],
                     a: ta + (j - 0.5) * spread, L: 0.2 + r() * 0.2, bend: (j - 0.5) * 0.8,
                     layer: tl, d0: td + j * 60 });
        } else if (tip === 'leaf') {
            E.push({ t: 'leaf', id: nid(), x: tp[0], y: tp[1], a: ta + (r() - 0.5) * 0.3,
                     L: 0.16 + r() * 0.16, bend: (r() - 0.5), layer: tl, d0: td });
        }

        if (!o.depth && r() < 0.3) {
            const u = 0.35 + r() * 0.35, [q, a] = this.at(P, u);
            this.grow(r, E, nid, p, { base: q, dir: a + (r() < 0.5 ? -1 : 1) * (0.7 + r() * 0.4),
                     len: (o.len || 0.8) * (0.35 + r() * 0.2), d0: o.d0 + dur * u, depth: 1,
                     layer0: this.layerAt(segs, u) });
        }
        return P;
    }
    gen(l) {
        const r = this.rng((l.ws ^ Math.imul(l.wi + 1, 2654435761)) + Math.floor(Math.random() * 1e6));
        const p = this.wordParams(l.ws), E = []; let k0 = 0;
        const nid = () => l.id * 100 + (k0++);
        const w = this.mw(l.ch), inX = () => (r() - 0.5) * w * 0.7; p.w = w;

        const nUp = 1 + (r() < 0.45 * p.dens ? 1 : 0);
        for (let i = 0; i < nUp; i++) {
            this.grow(r, E, nid, p, { base: [inX(), -r() * 0.3],
                     dir: -Math.PI / 2 + p.lean * 0.5 + (r() - 0.5) * 0.7,
                     len: 0.6 + r() * 0.5, d0: 40 + i * 130,
                     tip: l.wi === 0 && i === 0 ? 'rose' : null });
        }
        if (r() < 0.4 * p.dens) {
            this.grow(r, E, nid, p, { base: [inX(), -0.1 - r() * 0.35],
                     dir: Math.PI / 2 + (r() - 0.5) * 0.8, len: 0.35 + r() * 0.35, d0: 160 });
        }
        if (l.prev && r() < p.bridgeP) {
            const px = -(this.mw(l.prev.ch) + w) / 2;
            const a = [inX(), -0.05 - r() * 0.55], b = [px + (r() - 0.5) * 0.25, -0.05 - r() * 0.55];
            const bulge = (r() < 0.55 ? -1 : 1) * (0.4 + r() * 0.4), dx = b[0] - a[0];
            let P = this.bez(a, [a[0] + dx * 0.15, a[1] + bulge], [b[0] - dx * 0.15, b[1] + bulge * 0.9], b, 40);
            if (r() < 0.45) P = P.slice(0, Math.floor(P.length * (0.7 + r() * 0.2)));
            this.grow(r, E, nid, p, { pts: P, len: Math.abs(dx) + Math.abs(bulge), d0: 90,
                     tip: r() < 0.5 ? 'curl' : r() < 0.5 ? 'leaf' : 'rose' });
        }
        if (l.wi === 0) {
            this.grow(r, E, nid, p, { base: [-w * 0.3, -0.15 - r() * 0.4],
                     dir: Math.PI + (r() - 0.5) * 1.2, len: 0.45 + r() * 0.3, d0: 120, tip: 'curl' });
        }
        l.els = E;
    }

    /* ---------- drawing primitives (verbatim from Typegarden) ---------- */
    path(c, p, closed) {
        const n = p.length; if (n < 2) return;
        const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (closed) {
            const s = m(p[n - 1], p[0]); c.moveTo(s[0], s[1]);
            for (let i = 0; i < n; i++) { const q = m(p[i], p[(i + 1) % n]); c.quadraticCurveTo(p[i][0], p[i][1], q[0], q[1]); }
            c.closePath();
        } else {
            c.moveTo(p[0][0], p[0][1]);
            for (let i = 1; i < n - 1; i++) { const q = m(p[i], p[i + 1]); c.quadraticCurveTo(p[i][0], p[i][1], q[0], q[1]); }
            c.lineTo(p[n - 1][0], p[n - 1][1]);
        }
    }
    backend(g) {
        const self = this;
        return {
            fill: (p, col)  => { g.beginPath(); self.path(g, p, true);  g.fillStyle = col; g.fill(); },
            stroke: (p, col, w) => { g.beginPath(); self.path(g, p, false); g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); },
            rect: (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); }
        };
    }
    strokeRange(B, P, a, b, col, w) {
        const n = P.length - 1, ia = a * n, ib = b * n;
        const lerp = t => { const i = Math.min(n - 1, Math.floor(t)), f = t - i;
            return [P[i][0] + (P[i + 1][0] - P[i][0]) * f, P[i][1] + (P[i + 1][1] - P[i][1]) * f]; };
        const pts = [lerp(ia)];
        for (let i = Math.floor(ia) + 1; i < ib; i++) pts.push(P[i]);
        pts.push(lerp(ib));
        if (pts.length >= 2) B.stroke(pts, col, w);
    }
    thorn(B, P, u, s, S) {
        const [p, a] = this.at(P, u), d = a + s * 2.3, L = S * 0.045;
        B.stroke([p, [p[0] + Math.cos(d) * L, p[1] + Math.sin(d) * L]], this.cc.blue, S * 0.022);
    }
    leaf(B, bx, by, a, L, bend) {
        if (L < 0.5) return;
        const ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca;
        const ax = u => { const b = Math.sin(Math.PI * u) * bend * 0.15 * L;
            return [bx + ca * u * L + px * b, by + sa * u * L + py * b]; };
        const hw = u => L * 0.18 * Math.sin(Math.PI * Math.pow(u, 0.8));
        const N = 12, s1 = [], s2 = [];
        for (let i = 0; i <= N; i++) { const u = i / N, c = ax(u), w = hw(u);
            s1.push([c[0] + px * w, c[1] + py * w]); s2.push([c[0] - px * w, c[1] - py * w]); }
        const tip = ax(1), base = ax(0);
        B.fill([base, ...s1.slice(1, N), tip, tip, ...s2.slice(1, N).reverse(), base], this.cc.blue);
        if (L > 6) { const v = []; for (let i = 0; i <= 8; i++) v.push(ax(0.08 + 0.72 * i / 8));
            B.stroke(v, this.cc.vein, Math.max(0.8, L * 0.03)); }
    }
    rose(B, cx, cy, R, rot, e, a) {
        const cr = Math.cos(rot), sr = Math.sin(rot);
        const T = (x, y) => [cx + x * cr - y * sr, cy + x * sr + y * cr];
        // petals, back to front: [cx, cy, rx, ry, angle, depth, edge]
        const P = [
            [ 0,    -0.36, 0.56, 0.54,  0,    0,    0],
            [-0.5,  -0.06, 0.6,  0.6,  -0.35, 0,    0],
            [ 0.52, -0.06, 0.6,  0.6,   0.35, 0,    0],
            [-0.42,  0.3,  0.62, 0.48,  0.2,  0.12, 1],
            [ 0.47,  0.3,  0.62, 0.48, -0.2,  0.12, 1],
            [ 0.05,  0.42, 0.56, 0.38,  0,    0.14, 0]
        ];
        const lw = Math.max(0.8, R * 0.045), st = 85, ax0 = 0, ay0 = 0.5;
        P.forEach((q, i) => {
            const s = this.spr((a - i * st) / 1000, 8, 14); if (s <= 0.001) return;
            const open = (1 - Math.min(1, s)) * (q[0] < 0 ? 0.5 : -0.5), ang = q[4] + open;
            const ca = Math.cos(ang), sa = Math.sin(ang);
            const pt = (th, j) => {
                const rr = 1 + 0.08 * Math.sin(3 * th + e.ph1 + i) + 0.04 * Math.sin(5 * th + e.ph2);
                const lx = Math.cos(th) * q[2] * rr, ly = Math.sin(th) * q[3] * rr;
                const px = q[0] + lx * ca - ly * sa, py = q[1] + lx * sa + ly * ca;
                return T((ax0 + (px - ax0) * s) * R, (ay0 + (py - ay0) * s) * R);
            };
            const pts = []; for (let k = 0; k < 26; k++) pts.push(pt(k / 26 * Math.PI * 2));
            B.fill(pts, this.cc.red);
            if (q[6] && R >= 12 && s > 0.4) {
                const arc = []; for (let k = 0; k <= 14; k++) arc.push(pt(Math.PI * (1.18 + 0.64 * k / 14)));
                this.strokeRange(B, arc, 0, Math.min(1, (s - 0.4) / 0.5), this.cc.line, lw * 0.8);
            }
        });
        const fr = this.eo((a - P.length * st - 80) / 520);
        if (fr > 0 && R > 3) {
            const sp = [], scl = [];
            const turns = R < 20 ? Math.min(e.turns, 1.3) : R < 32 ? e.turns * 0.8 : e.turns;
            for (let i = 0; i <= 70; i++) {
                const u = i / 70, th = e.ph1 + u * turns * Math.PI * 2, rr = R * (0.08 + 0.57 * u);
                sp.push(T(Math.cos(th) * rr * 1.05, Math.sin(th) * rr * 0.72 - 0.12 * R));
            }
            this.strokeRange(B, sp, 0, fr, this.cc.line, lw);
            if (R >= 14) {
                for (let i = 0; i <= 36; i++) {
                    const u = i / 36;
                    scl.push(T((-0.72 + 1.5 * u) * R, 0.36 * R + 0.16 * R * Math.abs(Math.sin(u * Math.PI * 3))));
                }
                this.strokeRange(B, scl, 0, fr, this.cc.line, lw);
            }
        }
    }

    /* ---------- render (adapted: no wither/cut, no butterflies) ---------- */
    wpt(l, x, y) {
        // birth wobble — damped sway while a freshly grown letter settles
        const now = this._now, S = this.S;
        if (l.birth != null && now != null) {
            const t = (now - l.birth) / 1000;
            if (t > 0 && t < 2.5) {
                const hh = Math.max(0, (l.y - y) / S), dmp = Math.exp(-t * 3.2), dir = (l.id % 2 ? 1 : -1);
                x += S * 0.07 * hh * dmp * Math.sin(t * 11) * dir;
                y += S * 0.035 * hh * dmp * Math.sin(t * 11 + 1.2);
            }
        }
        return [x, y];
    }
    drawLayer(layer, B, now) {
        const S = this.S, f = this._f, amp = this._amp;
        for (const l of this.letters) {
            if (l.appear == null || now < l.appear) continue;
            const age = now - l.birth;
            for (const e of l.els) {
                if (e.t === 'stem') this.drawStem(B, e, l, age, layer, S);
                else if (e.layer === layer) this.drawEl(B, e, l, age, S, f, amp);
            }
        }
    }
    drawStem(B, e, l, age, layer, S) {
        const fr = this.eo((age - e.d0) / e.dur); if (fr <= 0) return;
        const j = this.jit(e.id, this._f, this._amp);
        const P = e.pts.map(p => this.wpt(l, l.x + p[0] * S + j[0], l.y + p[1] * S + j[1]));
        for (const sg of e.segs) {
            if (sg.layer !== layer) continue;
            const b = Math.min(sg.u1, fr); if (b <= sg.u0) continue;
            this.strokeRange(B, P, sg.u0, b, this.cc.blue, S * 0.022 * (e.w || 1));
        }
        for (const th of e.thorns)
            if (fr > th.u && this.layerAt(e.segs, th.u) === layer) this.thorn(B, P, th.u, th.s, S);
    }
    drawEl(B, e, l, age, S, f, amp) {
        const j = this.jit(e.id, f, amp), wx = (x, y) => this.wpt(l, l.x + x * S + j[0], l.y + y * S + j[1]);
        if (e.t === 'leaf') {
            const sc = this.spr((age - e.d0) / 1000, 7, 15); if (sc <= 0) return;
            const p = wx(e.x, e.y);
            this.leaf(B, p[0], p[1], e.a + j[2], e.L * S * sc, e.bend);
        } else if (e.t === 'rose') {
            const a = age - e.d0; if (a < 0) return;
            const p = wx(e.x, e.y);
            this.rose(B, p[0], p[1], e.R * S, e.rot + j[2], e, a);
        }
    }
    paint(now) {
        const g = this.g, d = this.dpr;
        g.setTransform(d, 0, 0, d, 0, 0);
        g.fillStyle = PAL.bg; g.fillRect(0, 0, this.W, this.H);
        const B = this.backend(g);
        this.render(B, now);
    }
    render(B, now) {
        const S = this.S;
        this.cc = C;
        this._now = now;
        this._f = CFG.boil && !REDUCED ? Math.floor(now / 120) : 0;
        this._amp = this._f > 0 ? Math.max(0.8, S * 0.01) : 0;

        /* layer 0 — stems, leaves and roses BEHIND the letters */
        this.drawLayer(0, B, now);

        /* "hello! I'm" — small editorial line above SAHIB (plain text, no plants) */
        if (this.helloAppear != null && now >= this.helloAppear) {
            const g = this.g;
            const t = REDUCED ? 1 : Math.min(1, (now - this.helloAppear) / 500);
            g.globalAlpha = t;
            g.fillStyle = C.text;
            g.font = `700 ${this.S_h}px ${this.F}`;
            g.textAlign = 'center'; g.textBaseline = 'alphabetic';
            g.fillText('hello! I\u2019m', this.W / 2, this.helloY);
            g.globalAlpha = 1;
        }

        /* glyphs — big Playfair letters, quick rise-in as each one appears */
        const g = this.g;
        for (const l of this.letters) {
            if (l.appear == null || now < l.appear) continue;
            const t = REDUCED ? 1 : Math.min(1, Math.max(0, (now - l.appear) / 420));
            const rise = (1 - this.eo(t)) * S * 0.22;
            g.globalAlpha = t;
            g.fillStyle = C.text;
            g.font = `700 ${S}px ${this.F}`;
            g.textAlign = 'center'; g.textBaseline = 'alphabetic';
            g.fillText(l.ch, l.x, l.y + rise);
            g.globalAlpha = 1;
        }

        /* layer 1 — stems, leaves and roses IN FRONT of the letters */
        this.drawLayer(1, B, now);
    }

    /* ---------- build + layout ---------- */
    build() {
        const word = 'SAHIB';
        const ws = Math.floor(Math.random() * 1e9);   // one word seed shared by all letters
        let wi = 0, prev = null;
        this.letters = [];
        for (const ch of word) {
            const l = { ch, id: this.uid++, birth: null, appear: null,
                        ws, wi: wi++, prev: prev && prev.ch !== ' ' ? prev : null };
            this.gen(l);
            this.letters.push(l); prev = l;
        }
    }
    layout() {
        if (!this.W) return;
        const g = this.g;
        const widths = this.letters.map(l => this.mw(l.ch));
        const unit = widths.reduce((s, w) => s + w, 0);
        const maxW = this.W * 0.86;
        const S = Math.min(this.H * 0.30, maxW / unit);

        const ty = this.H * 0.5 + S * 0.45;                 // SAHIB baseline
        const S_h = Math.max(16, Math.min(44, S * 0.30));   // "hello! I'm" size
        const helloY = ty - S * 1.18;                       // above the bloom zone

        let x = (this.W - unit * S) / 2;
        this.letters.forEach((l, i) => {
            const w = widths[i] * S;
            l.tx = x + w / 2; l.ty = ty; x += w;
        });
        this.S = S; this.S_h = S_h; this.helloY = helloY;
    }
    snap() { this.letters.forEach(l => { l.x = l.tx; l.y = l.ty; }); }

    resize() {
        const r = this.cv.getBoundingClientRect();
        if (!r.width) return;
        this.W = r.width; this.H = r.height;
        this.dpr = window.devicePixelRatio || 1;
        this.cv.width  = Math.round(r.width  * this.dpr);
        this.cv.height = Math.round(r.height * this.dpr);
        this.layout(); this.snap();
    }
}

/* =====================================================================
   TIMELINE
   ===================================================================== */

const garden = new Garden(cv);

const sleep = ms => new Promise(r => setTimeout(r, ms));

function startLoop() {
    if (startLoop.started) return;
    startLoop.started = true;
    // pause painting while the hero is scrolled out of view
    let visible = true;
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0.01 })
            .observe(hero);
    }
    const loop = () => {
        if (visible && !REDUCED) garden.paint(performance.now());
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
}

function reveal(permanentHeroTime) {
    const gr = document.getElementById('greeting');
    if (gr) gr.remove();
    document.body.classList.add('intro-done');

    const now = performance.now();
    garden.helloAppear = permanentHeroTime || now;
    garden.letters.forEach((l, i) => {
        l.appear = now + i * STAGGER_MS;
        l.birth  = l.appear + 90;
    });
    startLoop();
}

async function runGreetings() {
    const gw = document.getElementById('greet-word');
    if (!gw) { reveal(); return; }
    for (const w of WORDS) {
        gw.textContent = w.t;
        gw.style.fontFamily = w.f;
        gw.className = 'greet-word ' + w.cls;
        // force reflow so the transition replays while content is set
        void gw.offsetWidth;
        gw.classList.add('show');
        await sleep(WORD_MS);
        gw.classList.remove('show');
        await sleep(FADE_MS);
    }
    await sleep(BLANK_MS);      // briefly clear the screen
    reveal();
}

function reducedReveal() {
    // no animations: greetings skipped, garden shown fully grown, static
    garden.letters.forEach(l => { l.appear = 0; l.birth = -1e7; });
    garden.helloAppear = 0;
    document.body.classList.add('intro-done');
    const gr = document.getElementById('greeting');
    if (gr) gr.remove();
    garden.paint(performance.now());
}

/* ---------------------------------------------------------------------
   Boot: wait for the fonts (canvas metrics need real Playfair), build,
   then either run the greeting sequence once or render statically.
   --------------------------------------------------------------------- */
(async function boot() {

    try {
        const loads = [
            document.fonts.load(`700 100px ${F}`),
            document.fonts.load('700 100px "Noto Serif Devanagari"'),
            document.fonts.load('700 100px "Noto Serif Gurmukhi"')
        ];
        await Promise.race([Promise.all(loads).catch(() => {}), sleep(2000)]);
    } catch (e) { /* fonts optional — fallbacks render anyway */ }

    garden.build();
    garden.resize();
    if (REDUCED) reducedReveal();
    else runGreetings();

    // late font arrival would invalidate measured widths — rebuild metrics
    if (document.fonts) {
        document.fonts.ready.then(() => { garden.cache = {}; garden.layout(); garden.snap(); }).catch(() => {});
    }

})();

window.addEventListener('resize', () => {
    garden.resize();
    if (REDUCED) garden.paint(performance.now());
});

})();
