// ---------- 3D cockpit: shell, panels, switches, lit windows ----------
// Frame: origin at the pilot's eye, x right, y up, -z forward.
const CK = { scene: null, cam: null, panels: [], hots: [], screens: [], hover: null, highlightId: null, tl3d: [], wipers: [], du: {}, knobRot: {} };
const PANEL_COL = '#5b6a75', LEGEND = '#eef1f3';
const ANN = { amber: '#ffa21a', white: '#f5f7f8', blue: '#3fd0ff', green: '#3df23d', red: '#ff3b30' };
const LCD_ON = '#ff9d2a', LCD_GHOST = 'rgba(255,140,40,0.075)';
let EG = null; // emissive (light) layer of the panel being drawn
function both(g, f) { f(g); if (EG && EG !== g) f(EG); }

// ================= drawing primitives =================
let _grain = null;
function grainPattern(g) {
  if (!_grain) {
    const c = mkCanvas(256, 256), x = c.getContext('2d'); const id = x.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 9; }
    x.putImageData(id, 0, 0);
    for (let i = 0; i < 50; i++) { x.strokeStyle = `rgba(255,255,255,${Math.random() * 0.06})`; x.lineWidth = 0.7; x.beginPath(); const a = Math.random() * 256, b = Math.random() * 256; x.moveTo(a, b); x.lineTo(a + Math.random() * 40 - 20, b + Math.random() * 8 - 4); x.stroke(); }
    _grain = c;
  }
  return g.createPattern(_grain, 'repeat');
}
function drawScrew(g, x, y) { const gr = g.createRadialGradient(x - 1, y - 1, 0, x, y, 5); gr.addColorStop(0, '#b8c0c6'); gr.addColorStop(1, '#4a545c'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); g.strokeStyle = '#2b3237'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 3, y + 1); g.lineTo(x + 3, y - 1); g.stroke(); }
function legend(g, t, x, y, size = 13, col = LEGEND, align = 'center') { g.fillStyle = col; g.font = `bold ${size}px Arial, Helvetica, sans-serif`; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(t, x, y); }
function legendMulti(g, t, x, y, size = 12, col = LEGEND) { const lines = String(t).split('\n'); lines.forEach((l, i) => legend(g, l, x, y + (i - (lines.length - 1) / 2) * (size + 2), size, col)); }
function subPanel(g, x, y, w, h, title) {
  g.fillStyle = PANEL_COL; g.fillRect(x, y, w, h);
  g.fillStyle = grainPattern(g); g.fillRect(x, y, w, h);
  const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, 'rgba(255,255,255,.05)'); gr.addColorStop(1, 'rgba(0,0,0,.08)'); g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  g.strokeStyle = 'rgba(255,255,255,.13)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 3, y + h - 3); g.lineTo(x + 3, y + 3); g.lineTo(x + w - 3, y + 3); g.stroke();
  drawScrew(g, x + 9, y + 9); drawScrew(g, x + w - 9, y + 9); drawScrew(g, x + 9, y + h - 9); drawScrew(g, x + w - 9, y + h - 9);
  if (title) { g.font = 'bold 15px Arial, sans-serif'; const tw = g.measureText(title).width; const cx = x + w / 2; g.strokeStyle = LEGEND; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 20, y + 17); g.lineTo(cx - tw / 2 - 8, y + 17); g.moveTo(cx + tw / 2 + 8, y + 17); g.lineTo(x + w - 20, y + 17); g.stroke(); legend(g, title, cx, y + 17, 15); }
}
function bezel(g, x, y, w, h) { g.fillStyle = '#16191b'; g.fillRect(x - 6, y - 6, w + 12, h + 12); g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.strokeRect(x - 5.5, y - 5.5, w + 11, h + 11); g.fillStyle = '#050605'; g.fillRect(x, y, w, h); }
// Airbus push button: upper legend (FAULT/AVAIL), lower legend (OFF/ON)
function drawPB(g, x, y, w, h, top, bot) {
  g.fillStyle = '#121518'; g.fillRect(x - 3, y - 3, w + 6, h + 6);
  const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#30373c'); gr.addColorStop(1, '#1a1e21'); g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.strokeStyle = '#535c62'; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, w - 1, h - 1);
  const pw = S.elec.dc, test = S.annTest && pw;
  const half = (lg, yy) => {
    if (!lg || !lg.t) return; const on = (lg.on && pw) || test; const fs = Math.max(9, Math.round(h * (lg.t.length > 5 ? 0.21 : 0.26)));
    const font = `bold ${fs}px Arial, sans-serif`;
    if (!on) { g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#9ba8af'; g.fillText(lg.t, x + w / 2, yy); return; }
    both(g, gg => { gg.font = font; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillStyle = lg.c; gg.shadowColor = lg.c; gg.shadowBlur = 6;
      if (lg.box) { gg.strokeStyle = lg.c; gg.lineWidth = 2; gg.strokeRect(x + 5, yy - h * 0.17, w - 10, h * 0.34); }
      gg.fillText(lg.t, x + w / 2, yy); gg.shadowBlur = 0; });
  };
  half(top, y + h * 0.28); half(bot, y + h * 0.72);
}
function drawGuard(g, x, y, w, h, open, col) {
  if (open) { g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x - 6, y - 24, w + 12, 16); g.fillStyle = col; g.fillRect(x - 6, y - 28, w + 12, 14); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x - 6, y - 28, w + 12, 3); return; }
  g.save(); g.beginPath(); g.rect(x - 6, y - 6, w + 12, h + 12); g.clip(); g.globalAlpha = .5; g.fillStyle = col; g.fillRect(x - 6, y - 6, w + 12, h + 12);
  g.globalAlpha = .35; g.strokeStyle = '#111'; g.lineWidth = 5; for (let k = -h; k < w + h + 20; k += 14) { g.beginPath(); g.moveTo(x + k, y - 6); g.lineTo(x + k - h - 12, y + h + 6); g.stroke(); }
  g.restore(); g.globalAlpha = 1; g.strokeStyle = col; g.lineWidth = 2.5; g.strokeRect(x - 6, y - 6, w + 12, h + 12);
}
function drawLight(g, x, y, w, h, t, col, on, size) {
  g.fillStyle = '#0d0f10'; g.fillRect(x, y, w, h); g.strokeStyle = '#3b4247'; g.strokeRect(x + .5, y + .5, w - 1, h - 1);
  const lit = on && S.elec.dc || (S.annTest && S.elec.dc);
  const f = `bold ${size || Math.round(h * 0.42)}px Arial, sans-serif`;
  if (lit) both(g, gg => { gg.font = f; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillStyle = col; gg.shadowColor = col; gg.shadowBlur = 8; t.split('\n').forEach((l, i, a) => gg.fillText(l, x + w / 2, y + h / 2 + (i - (a.length - 1) / 2) * (h * 0.4))); gg.shadowBlur = 0; });
  else { g.font = f; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#8f9da4'; t.split('\n').forEach((l, i, a) => g.fillText(l, x + w / 2, y + h / 2 + (i - (a.length - 1) / 2) * (h * 0.4))); }
}
function drawToggle(g, x, y, idx, labels) {
  const n = labels.length, sp = 26;
  labels.forEach((l, i) => legend(g, l, x + 30, y + (i - (n - 1) / 2) * sp, 12, LEGEND, 'left'));
  g.fillStyle = '#1b2023'; g.beginPath(); g.arc(x, y, 14, 0, 7); g.fill(); g.strokeStyle = '#9aa3a9'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 14, 0, 7); g.stroke();
  const ty = y + (idx - (n - 1) / 2) * sp * 0.8;
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(x + 3, ty + 4, 8, 6, 0, 0, 7); g.fill();
  const gr = g.createLinearGradient(x - 6, 0, x + 6, 0); gr.addColorStop(0, '#9aa3a9'); gr.addColorStop(.5, '#eef1f3'); gr.addColorStop(1, '#7d878d'); g.strokeStyle = gr; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x, ty); g.stroke(); g.lineCap = 'butt';
  const g2 = g.createRadialGradient(x - 2, ty - 2, 1, x, ty, 8); g2.addColorStop(0, '#ffffff'); g2.addColorStop(1, '#a9b1b6'); g.fillStyle = g2; g.beginPath(); g.arc(x, ty, 8, 0, 7); g.fill();
}
function drawSelector(g, x, y, r, angleDeg, labels, fs = 12) {
  labels.forEach(l => legend(g, l.t, x + Math.sin(l.a * D2R) * (r + fs * 1.5), y - Math.cos(l.a * D2R) * (r + fs * 1.3), fs));
  labels.forEach(l => { g.strokeStyle = LEGEND; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + Math.sin(l.a * D2R) * (r + 2), y - Math.cos(l.a * D2R) * (r + 2)); g.lineTo(x + Math.sin(l.a * D2R) * (r + 6), y - Math.cos(l.a * D2R) * (r + 6)); g.stroke(); });
  g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.arc(x + 3, y + 4, r, 0, 7); g.fill();
  g.fillStyle = '#1b1f22'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.save(); g.translate(x, y); g.rotate(angleDeg * D2R);
  const gr = g.createLinearGradient(-r * 0.3, 0, r * 0.3, 0); gr.addColorStop(0, '#2b3135'); gr.addColorStop(.5, '#5b6369'); gr.addColorStop(1, '#2b3135'); g.fillStyle = gr;
  g.beginPath(); g.moveTo(-r * 0.28, r * 0.9); g.lineTo(-r * 0.2, -r * 0.95); g.lineTo(r * 0.2, -r * 0.95); g.lineTo(r * 0.28, r * 0.9); g.closePath(); g.fill();
  g.fillStyle = '#fff'; g.fillRect(-1.5, -r * 0.92, 3, r * 0.55); g.restore();
}
function drawKnob(g, x, y, r, rot = 0) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.arc(3, 5, r + 2, 0, 7); g.fill();
  const gr = g.createRadialGradient(-r * .35, -r * .4, 1, 0, 0, r); gr.addColorStop(0, '#636b70'); gr.addColorStop(.7, '#23282b'); gr.addColorStop(1, '#101315'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
  g.rotate(rot); g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 1.4;
  for (let a = 0; a < 6.283; a += 0.15) { g.beginPath(); g.moveTo(Math.cos(a) * r * .84, Math.sin(a) * r * .84); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.stroke(); }
  const g2 = g.createRadialGradient(-r * .2, -r * .25, 1, 0, 0, r * .62); g2.addColorStop(0, '#474e53'); g2.addColorStop(1, '#1b1f22'); g.fillStyle = g2; g.beginPath(); g.arc(0, 0, r * .62, 0, 7); g.fill();
  g.fillStyle = '#e8e8e8'; g.fillRect(-1.6, -r * .96, 3.2, r * .3);
  g.restore();
}
// ---- 7-segment LCD (FCU, RMP, clock, transponder) ----
const SEG7 = { '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '', '+': 'gP',
  S: 'acdfg', t: 'defg', d: 'bcdeg', A: 'abcefg', b: 'cdefg', C: 'adef', E: 'adefg', F: 'aefg', H: 'bcefg', L: 'def', o: 'cdeg', r: 'eg', n: 'ceg', P: 'abefg', U: 'bcdef', c: 'deg', h: 'cefg', R: 'eg' };
function segDraw(g, x, y, w, h, t, sk, segs, col, glow) {
  if (!segs) return; g.save(); g.translate(x, y); g.transform(1, 0, -sk / h, 1, sk, 0); g.fillStyle = col; if (glow) { g.shadowColor = col; g.shadowBlur = glow; }
  const e = t * 0.2, hh = h / 2;
  const H = (x0, x1, yc) => { g.beginPath(); g.moveTo(x0, yc); g.lineTo(x0 + t / 2, yc - t / 2); g.lineTo(x1 - t / 2, yc - t / 2); g.lineTo(x1, yc); g.lineTo(x1 - t / 2, yc + t / 2); g.lineTo(x0 + t / 2, yc + t / 2); g.closePath(); g.fill(); };
  const V = (xc, y0, y1) => { g.beginPath(); g.moveTo(xc, y0); g.lineTo(xc + t / 2, y0 + t / 2); g.lineTo(xc + t / 2, y1 - t / 2); g.lineTo(xc, y1); g.lineTo(xc - t / 2, y1 - t / 2); g.lineTo(xc - t / 2, y0 + t / 2); g.closePath(); g.fill(); };
  for (const s of segs) switch (s) {
    case 'a': H(t / 2 + e, w - t / 2 - e, t / 2); break; case 'g': H(t / 2 + e, w - t / 2 - e, hh); break; case 'd': H(t / 2 + e, w - t / 2 - e, h - t / 2); break;
    case 'b': V(w - t / 2, t / 2 + e, hh - e); break; case 'c': V(w - t / 2, hh + e, h - t / 2 - e); break; case 'e': V(t / 2, hh + e, h - t / 2 - e); break; case 'f': V(t / 2, t / 2 + e, hh - e); break;
    case 'P': V(w / 2, hh - h * 0.24, hh + h * 0.24); break;
  }
  g.restore();
}
function seg7(g, str, xr, y, h, o = {}) {
  const w = h * 0.52, t = h * 0.13, sp = h * 0.2, sk = h * 0.1;
  const chars = []; for (const ch of String(str)) { if (ch === '.' || ch === ':') { if (!chars.length) chars.push({ ch: ' ' }); chars[chars.length - 1][ch === '.' ? 'dot' : 'colon'] = true; } else chars.push({ ch }); }
  const cg = h * 0.3; const total = chars.length * (w + sp) - sp + chars.filter(c => c.colon).length * cg; let x = o.align === 'left' ? xr : o.align === 'center' ? xr - total / 2 : xr - total;
  const col = o.col || LCD_ON, ghost = o.ghost === false ? null : (o.ghostCol || LCD_GHOST);
  for (const c of chars) {
    if (ghost) segDraw(g, x, y, w, h, t, sk, 'abcdefg', ghost, 0);
    segDraw(g, x, y, w, h, t, sk, SEG7[c.ch] ?? '', col, o.glow ?? 7);
    if (c.dot) { g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 5; g.fillRect(x + w + sp * 0.15, y + h - t, t, t); g.shadowBlur = 0; }
    if (c.colon) { const cx = x + w + (sp + cg) / 2 - t * 0.45; g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 5; g.fillRect(cx + sk * 0.7, y + h * 0.27, t * 0.9, t * 0.9); g.fillRect(cx + sk * 0.3, y + h * 0.66, t * 0.9, t * 0.9); g.shadowBlur = 0; x += cg; }
    x += w + sp;
  }
  return x;
}
function lcdBg(g, W, H) { g.fillStyle = '#060706'; g.fillRect(0, 0, W, H); }
function lcdGlass(g, W, H) { const gr = g.createLinearGradient(0, 0, W * 0.35, H); gr.addColorStop(0, 'rgba(255,255,255,.08)'); gr.addColorStop(.5, 'rgba(255,255,255,.015)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
function lcdLabel(g, t, x, y, size, on = true, align = 'center', col = LCD_ON) { g.font = `bold ${Math.round(size)}px Arial, sans-serif`; g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = on ? col : LCD_GHOST; g.shadowColor = col; g.shadowBlur = on ? 6 : 0; g.fillText(t, x, y); g.shadowBlur = 0; }
function lcdDot(g, x, y, r) { g.fillStyle = LCD_ON; g.shadowColor = LCD_ON; g.shadowBlur = 8; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.shadowBlur = 0; }

// ================= panels & screens =================
class Panel {
  constructor(name, pxW, pxH, mW, mH) {
    this.name = name; this.W = pxW; this.H = pxH; this.mW = mW; this.mH = mH; this.hots = []; this.sig = ''; this.static = null;
    this.c = mkCanvas(pxW, pxH); this.g = this.c.getContext('2d'); this.tex = new THREE.CanvasTexture(this.c); this.tex.anisotropy = 8;
    this.ec = mkCanvas(pxW, pxH); this.eg = this.ec.getContext('2d'); this.etex = new THREE.CanvasTexture(this.ec);
    this.mat = new THREE.MeshStandardMaterial({ map: this.tex, emissive: 0xffffff, emissiveMap: this.etex, roughness: 0.78, metalness: 0.05 });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(mW, mH), this.mat); this.mesh.userData.panel = this; this.mesh.receiveShadow = true; CK.panels.push(this);
  }
  local(x, y) { return new THREE.Vector3((x / this.W - 0.5) * this.mW, (0.5 - y / this.H) * this.mH, 0); }
  hot(h) { h.panel = this; if (h.click) { const c = h.click; h.click = (e) => { CK.pressT[h.id] = performance.now(); return c(e); }; } this.hots.push(h); CK.hots.push(h); return h; }
  redraw(force) {
    const hl = this.hots.some(h => h.id === CK.highlightId);
    const sig = `${S.elec.dc}|${S.annTest}|${CK.highlightId}|${CK.hover && CK.hover.panel === this ? CK.hover.id : ''}|` + this.hots.map(h => h.get ? JSON.stringify(h.get()) : '').join('|') + (this.extraSig ? this.extraSig() : '');
    const now = performance.now();
    if (!force && sig === this.sig && (!hl || now - (this._pt || 0) < 90)) return;
    this.sig = sig; this._pt = now;
    const g = this.g, eg = this.eg; if (this.static) g.drawImage(this.static, 0, 0);
    eg.fillStyle = '#000'; eg.fillRect(0, 0, this.W, this.H); EG = eg;
    this.drawDyn && this.drawDyn(g);
    for (const h of this.hots) h.draw && h.draw(g, h);
    for (const h of this.hots) {
      if (h.id === CK.highlightId) { const a = 0.55 + 0.45 * Math.sin(now / 160); both(g, gg => { gg.strokeStyle = `rgba(255,214,0,${a})`; gg.lineWidth = 5; gg.strokeRect(h.x - 7, h.y - 7, h.w + 14, h.h + 14); }); }
      if (CK.hover === h) { g.strokeStyle = 'rgba(120,220,255,.75)'; g.lineWidth = 2; g.strokeRect(h.x - 4, h.y - 4, h.w + 8, h.h + 8); }
    }
    EG = null; this.tex.needsUpdate = true; this.etex.needsUpdate = true;
  }
  worldPos(h) { return this.mesh.localToWorld(this.local(h.x + h.w / 2, h.y + h.h / 2)); }
}
function buildStatic(p, fn) { p.static = mkCanvas(p.W, p.H); fn(p.static.getContext('2d')); }
// A small lit window drawn on its own canvas, mounted flush on a panel
function addScreen(panel, x, y, w, h, scale, draw, sig) {
  const cw = Math.round(w * scale), ch = Math.round(h * scale); const c = mkCanvas(cw, ch), g = c.getContext('2d'); const t = new THREE.CanvasTexture(c); t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w / panel.W * panel.mW, h / panel.H * panel.mH), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
  m.position.copy(panel.local(x + w / 2, y + h / 2)); m.position.z = 0.0012; panel.mesh.add(m);
  const s = { c, g, t, draw, sig, last: null, mesh: m }; CK.screens.push(s); return s;
}
function updateScreens(force) {
  for (const s of CK.screens) { const k = s.sig ? s.sig() : Math.random(); if (!force && k === s.last) continue; s.last = k; s.draw(s.g, s.c.width, s.c.height); s.t.needsUpdate = true; }
}

// ================= generic controls =================
const SWDEF = {};
function swGet(id) { const v = S.sw[id]; if (v !== undefined) return v; const d = SWDEF[id]; return d ? d.def : true; }
function swSet(id, v) { S.sw[id] = v; }
function engRunning() { return S.eng[0].run || S.eng[1].run; }
// type: 'off' (pushed in = normal, white OFF when released), 'on' (blue ON when pushed), 'open' (green OPEN), 'mom' (momentary)
function gpb(p, id, x, y, label, type, def, o = {}) {
  SWDEF[id] = { def, type, abn: o.abn, when: o.when, memo: o.memo };
  const w = o.w || 48, h = o.h || 44;
  const bot = () => {
    const v = swGet(id);
    if (o.botFn) return o.botFn();
    if (type === 'off') return { t: o.bot || 'OFF', c: ANN.white, on: !v };
    if (type === 'on') return { t: o.bot || 'ON', c: ANN.blue, on: !!v, box: o.box };
    if (type === 'open') return { t: o.bot || 'OPEN', c: ANN.green, on: !!v };
    if (type === 'mom') return { t: o.bot || '', c: o.botC || ANN.white, on: S.time - (S.momT[id] ?? -99) < (o.dur || 1.5) };
    return null;
  };
  const noTop = o.top === null || (type === 'mom' && !o.top && !o.fault);
  const top = () => o.topFn ? o.topFn() : noTop ? null : { t: o.top || 'FAULT', c: o.topC || ANN.amber, on: !!(o.fault && o.fault()) };
  return p.hot({ id, x, y, w, h, cap: type === 'mom' ? true : () => !!swGet(id), label: o.tip || label.replace('\n', ' '), get: () => [swGet(id), top() && top().on, bot() && bot().on, o.guard ? !!S.guard[id] : 0],
    click: () => {
      if (o.guard && !S.guard[id]) { S.guard[id] = true; Audio2.toggle(); setTimeout(() => { S.guard[id] = false; }, 5000); return; }
      if (type === 'mom') { S.momT[id] = S.time; o.onClick && o.onClick(); }
      else { swSet(id, !swGet(id)); o.onClick && o.onClick(swGet(id)); }
      Audio2.click(); Tut.event(id);
    },
    draw: (g, hh) => { drawPB(g, hh.x, hh.y, hh.w, hh.h, top(), bot()); if (o.guard) drawGuard(g, hh.x, hh.y, hh.w, hh.h, !!S.guard[id], o.guard); legendMulti(g, label, hh.x + hh.w / 2, hh.y + hh.h + (label.includes('\n') ? 20 : 14), 11); } });
}
function pbHot(panel, id, x, y, label, top, bot, onClick, tip, pressed) {
  return panel.hot({ id, x, y, w: 48, h: 44, cap: pressed || true, label: tip || label, get: () => [top && top(), bot && bot()], click: (e) => { onClick(e); Tut.event(id); },
    draw: (g, h) => { drawPB(g, h.x, h.y, h.w, h.h, top ? top() : null, bot ? bot() : null); legendMulti(g, label, h.x + h.w / 2, h.y + h.h + 14, 11); } });
}
function togHot(p, id, x, y, labels, get, set, title, o = {}) {
  return p.hot({ id, x: x - 22, y: y - 44, w: 44, h: 88, label: o.tip || (() => `${title.replace('\n', ' ')}: ${labels[get()]} · click upper / lower half to move`), get: () => [get()],
    click: (e) => { const n = labels.length; let v = get(); if (e && e.v != null) v = e.v < 0.5 ? v - 1 : v + 1; else v = (v + 1) % n; set(clamp(v, 0, n - 1)); Audio2.toggle(); Tut.event(id); },
    draw: (g, h) => { drawToggleBase(g, x, y, labels); legendMulti(g, title, x, y - 50, 12); }, init3d: () => tog3D(p, x, y, labels.length, get) });
}
function selHot(p, id, x, y, r, labels, angles, get, set, title, o = {}) {
  return p.hot({ id, x: x - r - 8, y: y - r - 8, w: 2 * r + 16, h: 2 * r + 16, label: o.tip || (() => `${(title || id).replace('\n', ' ')}: ${labels[get()]} · click = clockwise, right-click = anticlockwise`), get: () => [get()],
    click: (e) => { const n = labels.length; const v = get(); let d = e && (e.right || e.shift) ? -1 : 1; if (v + d < 0 || v + d >= n) d = -d; set(clamp(v + d, 0, n - 1)); Audio2.toggle(); Tut.event(id); },
    wheel: (d) => { set(clamp(get() + Math.sign(d), 0, labels.length - 1)); Audio2.toggle(); },
    draw: (g, h) => { drawSelLabels(g, x, y, r, labels.map((t, i) => ({ t, a: angles[i] })), o.fs || 12); if (title) legendMulti(g, title, x, y + r + (o.titleDy || 26), 12); }, init3d: () => sel3D(p, x, y, r, () => angles[get()]) });
}
function knobHot(p, id, x, y, r, title, info, wheel, push, pull) {
  return p.hot({ id, x: x - r - 4, y: y - r - 4, w: 2 * r + 8, h: 2 * r + 8,
    label: () => `${title}: ${info()} · scroll to turn (Shift = fast)` + (push ? ' · click = PUSH' : '') + (pull ? ' · right-click = PULL' : ''),
    get: () => [0],
    wheel: (d) => { wheel(d); CK.knobRot[id] = (CK.knobRot[id] || 0) + Math.sign(d) * 0.3; Tut.event(id); },
    click: (push || pull) ? (e) => { const isPull = e && (e.right || e.shift) && pull; const f = isPull ? pull : (push || pull); CK.knobAnim[id] = { t: performance.now(), dir: isPull ? 1 : -1 }; f(); Audio2.click(); Tut.event(id); } : undefined,
    draw: (g) => drawRecess(g, x, y, r), init3d: () => knob3D(p, x, y, r, id) });
}

// ================= real 3D control hardware mounted on the panels =================
const M3 = {};
function m3() {
  if (M3.knob) return M3;
  M3.knob = new THREE.MeshStandardMaterial({ color: 0x1c1f22, roughness: 0.42, metalness: 0.25, flatShading: true });
  M3.knobCap = new THREE.MeshStandardMaterial({ color: 0x2c3135, roughness: 0.35, metalness: 0.3 });
  M3.white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5, emissive: 0x222222 });
  M3.side = new THREE.MeshStandardMaterial({ color: 0x1a1d20, roughness: 0.6 });
  M3.metal = new THREE.MeshStandardMaterial({ color: 0xc9cfd3, roughness: 0.25, metalness: 0.85 });
  M3.nut = new THREE.MeshStandardMaterial({ color: 0x8e979d, roughness: 0.3, metalness: 0.8, flatShading: true });
  M3.red = new THREE.MeshStandardMaterial({ color: 0xc8302c, roughness: 0.45 });
  M3.gearKnob = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.4 });
  return M3;
}
CK.anim3d = []; CK.pressT = {}; CK.knobAnim = {};
function sxy(p) { return [p.mW / p.W, p.mH / p.H]; }
function mount(p, x, y, obj) { const v = p.local(x, y); obj.position.x = v.x; obj.position.y = v.y; p.mesh.add(obj); obj.traverse(o => { if (o.isMesh) o.castShadow = true; }); return obj; }
function knob3D(p, x, y, r, id) {
  const M = m3(), [sx] = sxy(p), R = r * sx, grp = new THREE.Group(), spin = new THREE.Group(); grp.add(spin);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.05, R * 0.6, 40), M.knob); skirt.rotation.x = Math.PI / 2; skirt.position.z = R * 0.3; spin.add(skirt);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.68, R * 0.74, R * 0.28, 32), M.knobCap); cap.rotation.x = Math.PI / 2; cap.position.z = R * 0.74; spin.add(cap);
  const mark = new THREE.Mesh(new THREE.BoxGeometry(R * 0.1, R * 0.34, R * 0.04), M.white); mark.position.set(0, R * 0.72, R * 0.62); spin.add(mark);
  mount(p, x, y, grp);
  CK.anim3d.push(() => { spin.rotation.z = -(CK.knobRot[id] || 0); const a = CK.knobAnim[id]; const k = a ? Math.max(0, 1 - (performance.now() - a.t) / 350) : 0; grp.position.z = a ? a.dir * k * R * 0.35 : 0; });
}
function sel3D(p, x, y, r, getAngle) {
  const M = m3(), [sx] = sxy(p), R = r * sx, grp = new THREE.Group(), spin = new THREE.Group(); grp.add(spin);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.02, R * 1.08, R * 0.3, 32), M.knob); base.rotation.x = Math.PI / 2; base.position.z = R * 0.15; grp.add(base);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(R * 0.62, R * 1.9, R * 0.62), M.knobCap); bar.position.z = R * 0.55; spin.add(bar);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(R * 0.12, R * 0.7, R * 0.05), M.white); tip.position.set(0, R * 0.55, R * 0.88); spin.add(tip);
  mount(p, x, y, grp); let cur = getAngle();
  CK.anim3d.push(() => { cur = lerp(cur, getAngle(), 0.35); spin.rotation.z = -cur * D2R; });
}
function tog3D(p, x, y, n, getIdx) {
  const M = m3(), [sx] = sxy(p), U = 14 * sx, grp = new THREE.Group();
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(U * 0.75, U * 0.75, U * 0.35, 6), M.nut); nut.rotation.x = Math.PI / 2; nut.position.z = U * 0.18; grp.add(nut);
  const bat = new THREE.Group(); bat.position.z = U * 0.3; grp.add(bat);
  const L = U * 2.3; const stem = new THREE.Mesh(new THREE.CylinderGeometry(U * 0.16, U * 0.24, L, 12), M.metal); stem.position.y = L / 2; bat.add(stem);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(U * 0.3, 14, 10), M.metal); ball.position.y = L; bat.add(ball);
  mount(p, x, y, grp); const tilt = (i) => n === 1 ? 0 : lerp(34, -34, i / (n - 1)) * D2R; let cur = tilt(getIdx());
  // the bat points out of the panel (+z) and leans toward the top label for the first position
  CK.anim3d.push(() => { cur = lerp(cur, tilt(getIdx()), 0.45); bat.rotation.x = Math.PI / 2 - cur; });
}
// raised push-button cap whose face shows the panel artwork (legends, lights) under it
function cap3D(p, x, y, w, h, pressed, depth) {
  const M = m3(), [sx, sy] = sxy(p); const d = depth || Math.min(w * sx, h * sy) * 0.22 + 0.002;
  const geo = new THREE.BoxGeometry(w * sx, h * sy, d); const uv = geo.attributes.uv;
  const u0 = x / p.W, u1 = (x + w) / p.W, v0 = 1 - (y + h) / p.H, v1 = 1 - y / p.H;
  for (let i = 16; i < 20; i++) uv.setXY(i, lerp(u0, u1, uv.getX(i)), lerp(v0, v1, uv.getY(i)));
  const m = new THREE.Mesh(geo, [M.side, M.side, M.side, M.side, p.mat, M.side]); const v = p.local(x + w / 2, y + h / 2); m.position.set(v.x, v.y, d / 2); p.mesh.add(m); m.castShadow = true;
  let z = d / 2; CK.anim3d.push(() => { const t = pressed() ? d / 2 - d * 0.55 : d / 2; z = lerp(z, t, 0.4); m.position.z = z; });
  return m;
}
function momPressed(id) { return () => performance.now() - (CK.pressT[id] || 0) < 160; }
function addCaps() { for (const h of CK.hots) if (h.cap) cap3D(h.panel, h.x, h.y, h.w, h.h, typeof h.cap === 'function' ? h.cap : momPressed(h.id), h.capDepth); }
function drawRecess(g, x, y, r) { g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(x + 2, y + 3, r * 1.12, 0, 7); g.fill(); g.fillStyle = '#16191b'; g.beginPath(); g.arc(x, y, r * 1.06, 0, 7); g.fill(); }
function drawSelLabels(g, x, y, r, labels, fs) {
  labels.forEach(l => legend(g, l.t, x + Math.sin(l.a * D2R) * (r + fs * 1.5), y - Math.cos(l.a * D2R) * (r + fs * 1.3), fs));
  labels.forEach(l => { g.strokeStyle = LEGEND; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + Math.sin(l.a * D2R) * (r + 2), y - Math.cos(l.a * D2R) * (r + 2)); g.lineTo(x + Math.sin(l.a * D2R) * (r + 6), y - Math.cos(l.a * D2R) * (r + 6)); g.stroke(); });
  drawRecess(g, x, y, r);
}
function drawToggleBase(g, x, y, labels) { const n = labels.length, sp = 26; labels.forEach((l, i) => legend(g, l, x + 30, y + (i - (n - 1) / 2) * sp, 12, LEGEND, 'left')); g.fillStyle = '#1b2023'; g.beginPath(); g.arc(x, y, 14, 0, 7); g.fill(); g.strokeStyle = '#9aa3a9'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 14, 0, 7); g.stroke(); }

// ================= shell =================
function buildCockpit() {
  const scene = new THREE.Scene(); CK.scene = scene;
  const cam = new THREE.PerspectiveCamera(62, 1, 0.02, 20); CK.cam = cam; scene.add(cam);
  const shellM = new THREE.MeshStandardMaterial({ color: 0x59656e, roughness: 0.9, side: THREE.DoubleSide });
  const liningM = new THREE.MeshStandardMaterial({ color: 0x59656e, roughness: .94, side: THREE.DoubleSide });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x24292d, roughness: 0.75, side: THREE.DoubleSide });
  const glareM = new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.95 });
  const lightM = new THREE.MeshStandardMaterial({ color: 0x6e7a82, roughness: 0.85, side: THREE.DoubleSide });
  const floorM = new THREE.MeshStandardMaterial({ color: 0x2e3438, roughness: 1 });
  const add = (m, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; scene.add(m); m.updateMatrixWorld(true); return m; };
  // front window frame
  const fb = new THREE.Vector3(0, -0.15, -0.95), ft = new THREE.Vector3(0, 0.40, -0.56);
  const slopeLen = fb.distanceTo(ft);
  const sh = new THREE.Shape(); sh.moveTo(-1.0, -0.02); sh.lineTo(2.1, -0.02); sh.lineTo(2.1, slopeLen + 0.05); sh.lineTo(-1.0, slopeLen + 0.05); sh.closePath();
  const hole = (u0, u1, v0, v1, r) => { const p = new THREE.Path(); p.moveTo(u0 + r, v0); p.lineTo(u1 - r, v0); p.quadraticCurveTo(u1, v0, u1, v0 + r); p.lineTo(u1, v1 - r); p.quadraticCurveTo(u1, v1, u1 - r, v1); p.lineTo(u0 + r, v1); p.quadraticCurveTo(u0, v1, u0, v1 - r); p.lineTo(u0, v0 + r); p.quadraticCurveTo(u0, v0, u0 + r, v0); return p; };
  sh.holes.push(hole(-0.70, 0.47, 0.03, slopeLen - 0.07, 0.06)); sh.holes.push(hole(0.57, 1.74, 0.03, slopeLen - 0.07, 0.06));
  const frame = new THREE.Mesh(new THREE.ShapeGeometry(sh, 6), darkM);
  frame.position.copy(fb); const tilt = Math.atan2(ft.z - fb.z, ft.y - fb.y); frame.rotation.x = tilt; add(frame);
  const sealM = new THREE.MeshStandardMaterial({ color: 0x101416, roughness: .86 });
  for (const [u0, u1] of [[-0.70, 0.47], [0.57, 1.74]]) {
    const v0 = .03, v1 = slopeLen - .07, rr = .06;
    const points = [[u0 + rr, v0], [u1 - rr, v0], [u1, v0 + rr], [u1, v1 - rr], [u1 - rr, v1], [u0 + rr, v1], [u0, v1 - rr], [u0, v0 + rr]];
    const path = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, .006)), true, 'centripetal');
    frame.add(new THREE.Mesh(new THREE.TubeGeometry(path, 64, .008, 6, true), sealM));
  }
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, slopeLen, 0.06), darkM); post.position.copy(fb.clone().lerp(ft, 0.5)).add(new THREE.Vector3(0.52, 0, 0.02)); post.rotation.x = tilt; add(post);
  // windscreen wipers (outside the glass, parked along the bottom)
  const wiperM = new THREE.MeshStandardMaterial({ color: 0x15181a, roughness: 0.6, metalness: 0.3 });
  for (const [u, dir] of [[-0.62, 1], [1.66, -1]]) {
    const piv = new THREE.Group(); piv.position.set(u, 0.015, -0.025); frame.add(piv);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.009, 0.01), wiperM); arm.position.x = dir * 0.27; piv.add(arm);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.009, 0.014), wiperM); blade.position.set(dir * 0.32, 0.004, -0.006); piv.add(blade);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12), wiperM); hub.rotation.x = Math.PI / 2; piv.add(hub);
    CK.wipers.push({ piv, dir, ph: 0 });
  }
  frame.updateMatrixWorld(true);
  // side walls with windows
  const sideWall = (x) => {
    const s = new THREE.Shape(); s.moveTo(-0.95, -1.3); s.lineTo(0.9, -1.3); s.lineTo(0.9, 0.7); s.lineTo(-0.95, 0.7); s.closePath();
    s.holes.push(hole(-0.82, -0.18, -0.02, 0.33, 0.07)); s.holes.push(hole(-0.12, 0.40, 0.0, 0.31, 0.07));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s, 6), liningM); m.rotation.y = -Math.PI / 2; m.position.x = x; return add(m);
  };
  sideWall(-0.82); sideWall(1.86);
  for (const x of [-0.82, 1.86]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 1.3), darkM); b.position.set(x, -0.04, -0.2); add(b); const t = b.clone(); t.position.y = 0.35; add(t); }
  // side window handles
  for (const x of [-0.79, 1.83]) { const hdl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.14), new THREE.MeshStandardMaterial({ color: 0xc8c8c0, roughness: .4 })); hdl.position.set(x, -0.08, 0.15); add(hdl); }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.2), lightM); ceil.rotation.x = Math.PI / 2; ceil.position.set(0.52, 0.66, 0.4); add(ceil);
  const ceilF = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.35), lightM); ceilF.position.set(0.52, 0.55, -0.52); ceilF.rotation.x = -0.6; add(ceilF);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.6), floorM); floor.rotation.x = -Math.PI / 2; floor.position.set(0.52, -1.18, 0.2); add(floor, false);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.0), shellM); back.position.set(0.52, -0.3, 1.45); back.rotation.y = Math.PI; add(back);
  // glareshield
  const gsTop = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.03, 0.30), glareM); gsTop.position.set(0.52, -0.152, -0.84); add(gsTop);
  const brow = new THREE.Mesh(new THREE.CylinderGeometry(.034, .034, 2.60, 14), glareM); brow.rotation.z = Math.PI / 2; brow.position.set(0.52, -0.13, -0.80); add(brow);
  const gsFace = new THREE.Mesh(new THREE.PlaneGeometry(2.62, 0.17), glareM); gsFace.position.set(0.52, -0.218, -0.648); gsFace.rotation.x = -0.3; add(gsFace);
  // standby compass hanging from the centre post
  const comp = new THREE.Group(); comp.position.set(0.52, 0.29, -0.59);
  comp.add(new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.06, 0.06), darkM));
  const cScr = { c: mkCanvas(256, 128) }; cScr.g = cScr.c.getContext('2d'); cScr.t = new THREE.CanvasTexture(cScr.c);
  const cFace = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.025), new THREE.MeshBasicMaterial({ map: cScr.t })); cFace.position.z = 0.031; comp.add(cFace);
  CK.screens.push({ ...cScr, sig: () => Math.round(S.psi * R2D * 2), draw: (g, W, H) => {
    g.fillStyle = '#e9e4d6'; g.fillRect(0, 0, W, H); const hd = S.psi * R2D;
    for (let k = -40; k <= 40; k++) { const h = Math.round(hd) + k; if (h % 5) continue; const x = W / 2 + (h - hd) * 6; g.fillStyle = '#111'; g.fillRect(x - 1, 0, 2, h % 10 ? 18 : 30); if (h % 30 === 0) { const v = wrap360(h); g.font = 'bold 34px Arial'; g.textAlign = 'center'; g.fillText(v === 0 ? 'N' : v === 90 ? 'E' : v === 180 ? 'S' : v === 270 ? 'W' : String(v / 10), x, 74); } }
    g.fillStyle = '#c00'; g.fillRect(W / 2 - 1.5, 0, 3, H); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, 30, H); g.fillRect(W - 30, 0, 30, H); } });
  add(comp);
  // first officer's seat (empty)
  const seatM = new THREE.MeshStandardMaterial({ color: 0x8b8070, roughness: 1 }), seatF = new THREE.MeshStandardMaterial({ color: 0x2a2e31, roughness: .7 });
  const seat = new THREE.Group(); seat.position.set(1.04, -0.95, 0.42);
  const sp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), seatM); seat.add(sp);
  const sb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.78, 0.13), seatM); sb.position.set(0, 0.44, 0.26); sb.rotation.x = -0.14; seat.add(sb);
  const hr = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.12), seatM); hr.position.set(0, 0.92, 0.33); seat.add(hr);
  const seamM = new THREE.MeshStandardMaterial({ color: 0x665f55, roughness: 1 });
  for (const side of [-1, 1]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(.006, .66, .009), seamM); seam.position.set(side * .18, .44, .332); seam.rotation.x = -.14; seat.add(seam);
    const bolster = new THREE.Mesh(new THREE.BoxGeometry(.07, .62, .16), seatM); bolster.position.set(side * .24, .42, .25); bolster.rotation.x = -.14; seat.add(bolster);
  }
  for (const s of [-1, 1]) { const ar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.4), seatF); ar.position.set(s * 0.29, 0.25, 0.02); seat.add(ar); }
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.4), seatF); base.position.y = -0.16; seat.add(base);
  add(seat);
  const knee = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.42), new THREE.MeshStandardMaterial({ color: 0x3d474f, roughness: .9, side: THREE.DoubleSide })); knee.position.set(0.52, -0.99, -0.80); add(knee);
  for (const x of [-0.78, 1.82]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.3), shellM); f.position.set(x, -0.55, -0.82); add(f); }
  // side wall lining
  const wc = mkCanvas(512, 512); const wg = wc.getContext('2d'); wg.fillStyle = '#56626b'; wg.fillRect(0, 0, 512, 512);
  wg.strokeStyle = 'rgba(0,0,0,.35)'; wg.lineWidth = 3; for (const y of [140, 300]) { wg.beginPath(); wg.moveTo(0, y); wg.lineTo(512, y); wg.stroke(); } for (const x of [170, 360]) { wg.beginPath(); wg.moveTo(x, 300); wg.lineTo(x, 512); wg.stroke(); }
  for (let i = 0; i < 4000; i++) { wg.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},.04)`; wg.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
  wg.fillStyle = '#2a3136'; wg.fillRect(200, 330, 130, 90); wg.fillStyle = '#ddd'; wg.font = 'bold 14px Arial'; wg.fillText('OXY MASK', 225, 360); wg.fillStyle = '#c8b400'; wg.fillRect(210, 395, 110, 12);
  const wt = new THREE.CanvasTexture(wc); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(0.8, 0.8); liningM.map = wt; liningM.color.setHex(0xb8c4cc); liningM.needsUpdate = true;
  // ---------------- main instrument panel ----------------
  const mp = new Panel('main', 2048, 426, 2.5, 0.52);
  mp.mesh.position.set(0.52, -0.53, -0.86); mp.mesh.rotation.x = -0.18; add(mp.mesh, false);
  buildMainPanel(mp);
  const duSize = 0.175;
  const glareC = mkCanvas(64, 64); const glg = glareC.getContext('2d'); const glr = glg.createLinearGradient(0, 0, 64, 64); glr.addColorStop(0, 'rgba(255,255,255,.10)'); glr.addColorStop(.45, 'rgba(255,255,255,.02)'); glr.addColorStop(1, 'rgba(255,255,255,0)'); glg.fillStyle = glr; glg.fillRect(0, 0, 64, 64);
  const glareT = new THREE.CanvasTexture(glareC);
  const addDU = (name, x, y) => {
    const d = DU[name]; const m = new THREE.Mesh(new THREE.PlaneGeometry(duSize, duSize), new THREE.MeshBasicMaterial({ map: d.tex, toneMapped: false }));
    m.position.copy(mp.mesh.localToWorld(new THREE.Vector3(x - 0.52, y + 0.53, 0.004))); m.rotation.copy(mp.mesh.rotation); scene.add(m); CK.du[name] = m;
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(duSize, duSize), new THREE.MeshBasicMaterial({ map: glareT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    gl.position.copy(mp.mesh.localToWorld(new THREE.Vector3(x - 0.52, y + 0.53, 0.0055))); gl.rotation.copy(mp.mesh.rotation); scene.add(gl);
    const bez = new THREE.Mesh(new THREE.BoxGeometry(duSize + 0.03, duSize + 0.03, 0.012), darkM); bez.position.copy(mp.mesh.localToWorld(new THREE.Vector3(x - 0.52, y + 0.53, -0.003))); bez.rotation.copy(mp.mesh.rotation); add(bez, false);
  };
  addDU('pfd', -0.165, -0.47); addDU('nd', 0.04, -0.47); addDU('ewd', 0.52, -0.47); addDU('sd', 0.52, -0.665); addDU('nd2', 1.0, -0.47); addDU('pfd2', 1.205, -0.47);
  // ---------------- glareshield: FCU, EFIS, master lights ----------------
  const fcuP = new Panel('fcu', 4096, 350, 1.9, 0.1624);
  fcuP.mesh.position.set(0.52, -0.218, -0.642); fcuP.mesh.rotation.x = -0.3; add(fcuP.mesh, false);
  buildFCU(fcuP);
  // ---------------- overhead ----------------
  const oh = new Panel('overhead', 2048, 1408, 1.0, 0.6875);
  oh.mesh.position.set(0.52, 0.46, -0.16); oh.mesh.rotation.x = Math.PI / 2 - 0.42; add(oh.mesh, false);
  buildOverhead(oh);
  const ohBox = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.06, 0.74), darkM); ohBox.rotation.x = -0.42; ohBox.position.copy(oh.mesh.position).add(new THREE.Vector3(0, Math.cos(0.42), -Math.sin(0.42)).multiplyScalar(0.036)); add(ohBox);
  // ---------------- pedestal ----------------
  const pedBody = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.4, 1.3), shellM); pedBody.position.set(0.52, -1.065, -0.15); add(pedBody);
  const ped = new Panel('pedestal', 1024, 2304, 0.44, 0.99);
  ped.mesh.position.set(0.52, -0.858, -0.055); ped.mesh.rotation.x = -Math.PI / 2; add(ped.mesh, false);
  buildPedestal(ped);
  const mcdu = new Panel('mcdu', 512, 768, 0.2, 0.30);
  mcdu.mesh.position.set(0.36, -0.82, -0.69); mcdu.mesh.rotation.x = -1.2; add(mcdu.mesh, false);
  buildMCDU(mcdu);
  const mcd = du('mcdu', 384, 300); const ms = new THREE.Mesh(new THREE.PlaneGeometry(0.108, 0.085), new THREE.MeshBasicMaterial({ map: mcd.tex, toneMapped: false }));
  ms.position.copy(mcdu.mesh.localToWorld(new THREE.Vector3(0, 0.083, 0.002))); ms.rotation.copy(mcdu.mesh.rotation); scene.add(ms);
  const mcdu2 = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.30), mcdu.mat); mcdu2.position.set(0.70, -0.82, -0.69); mcdu2.rotation.x = -1.2; add(mcdu2, false);
  const ms2 = ms.clone(); ms2.position.copy(mcdu2.localToWorld(new THREE.Vector3(0, 0.083, 0.002))); scene.add(ms2);
  // side consoles + sidesticks
  const con = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 1.2), shellM); con.position.set(-0.62, -0.88, -0.1); add(con);
  const con2 = con.clone(); con2.position.x = 1.66; add(con2);
  for (const x of [-0.62, 1.66]) { const ct = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 1.2), new THREE.MeshStandardMaterial({ color: 0x4e5961, roughness: .85 })); ct.rotation.x = -Math.PI / 2; ct.position.set(x, -0.699, -0.1); add(ct, false); }
  const mkStick = (x) => {
    const ss = new THREE.Group(); ss.position.set(x, -0.70, -0.30);
    ss.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.03, 16), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 })));
    const stick = new THREE.Group(); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.08, 12), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: .6 })); shaft.position.y = 0.04; stick.add(shaft);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.025, 0.11, 14), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: .55 })); grip.position.set(0, 0.125, 0.005); grip.rotation.x = 0.25; stick.add(grip);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10), grip.material); top.position.set(0, 0.18, -0.008); stick.add(top);
    const apBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.01, 12), new THREE.MeshStandardMaterial({ color: 0xbb1111, roughness: .5 })); apBtn.position.set(0.018, 0.155, -0.012); apBtn.rotation.z = Math.PI / 2; stick.add(apBtn);
    ss.add(stick); add(ss); return stick;
  };
  CK.stick = mkStick(-0.58); CK.stick2 = mkStick(1.62);
  buildLevers(ped);
  // 3D hardware on every panel
  const press = { bat1: () => S.elec.bat1, bat2: () => S.elec.bat2, apu_bleed: () => S.apu.bleed, apu_master: () => S.apu.master, apu_start: () => S.apu.start, ab_LO: () => S.autobrake === 1, ab_MED: () => S.autobrake === 2, ab_MAX: () => S.autobrake === 3 };
  for (const id in press) { const h = hotById(id); if (h) h.cap = press[id]; }
  CK.hots.forEach(h => h.init3d && h.init3d()); addCaps();
  mcdu.mesh.children.forEach(c => { if (c.isMesh && c.geometry.type === 'BoxGeometry') mcdu2.add(c.clone()); });
  // windscreen glass
  const glassC = mkCanvas(512, 256); const gg = glassC.getContext('2d'); for (let i = 0; i < 900; i++) { gg.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`; gg.fillRect(Math.random() * 512, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  for (let i = 0; i < 18; i++) { gg.strokeStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.04})`; gg.lineWidth = 1 + Math.random() * 3; gg.beginPath(); const x = Math.random() * 512; gg.moveTo(x, 256); gg.quadraticCurveTo(x + 40 - Math.random() * 80, 128, x + 60 - Math.random() * 120, 0); gg.stroke(); }
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.5, slopeLen), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glassC), transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending }));
  glass.position.copy(fb.clone().lerp(ft, 0.5)).add(new THREE.Vector3(0.52, 0, 0.01)); glass.rotation.x = tilt; scene.add(glass); CK.glass = glass;
  // lights
  const hemi = new THREE.HemisphereLight(0xe4ecf4, 0x4a4540, 0.75); hemi.position.set(0, 0.5, 1); scene.add(hemi); CK.hemi = hemi;
  scene.add(new THREE.AmbientLight(0x9aa8b4, 0.38));
  const ohFill = new THREE.PointLight(0xf4f0e8, 0.55, 2.2); ohFill.position.set(0.52, -0.1, 0.25); scene.add(ohFill);
  const sun = new THREE.DirectionalLight(0xfff4e2, 1.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.01;
  const sc = sun.shadow.camera; sc.left = -2; sc.right = 2; sc.top = 2; sc.bottom = -2; sc.near = 0.1; sc.far = 8; scene.add(sun); scene.add(sun.target); sun.target.position.set(0.5, -0.4, -0.3);
  CK.sunLight = sun;
  CK.dome = new THREE.PointLight(0xfff0dc, 0.1, 3); CK.dome.position.set(0.5, 0.45, 0.3); scene.add(CK.dome);
  CK.floorLt = new THREE.PointLight(0xfff0dc, 0, 1.5); CK.floorLt.position.set(0.1, -1.0, -0.2); scene.add(CK.floorLt);
  return scene;
}

// ================= MAIN PANEL =================
function setGear(v) { if (v === 0 && S.onGround) { toast('Gear lever is locked down on the ground'); return; } S.gearLever = v; Audio2.gearLever(); Tut.event(v ? 'gear_down' : 'gear_up'); }
function buildMainPanel(p) {
  // layout (px): PFD 463, ND 631, ECAM 1024, F/O ND 1417, F/O PFD 1585; top row centre y 164, SD y 324
  buildStatic(p, g => {
    g.fillStyle = PANEL_COL; g.fillRect(0, 0, p.W, p.H); g.fillStyle = grainPattern(g); g.fillRect(0, 0, p.W, p.H);
    const shade = g.createLinearGradient(0, 0, 0, p.H);
    shade.addColorStop(0, 'rgba(0,0,0,.17)'); shade.addColorStop(.28, 'rgba(0,0,0,0)'); shade.addColorStop(.72, 'rgba(255,255,255,.025)'); shade.addColorStop(1, 'rgba(0,0,0,.10)');
    g.fillStyle = shade; g.fillRect(0, 0, p.W, p.H);
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3; for (const x of [370, 715, 935, 1113, 1335, 1680]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, p.H); g.stroke(); }
    for (let i = 0; i < 26; i++) drawScrew(g, 20 + i * 79, 12);
    // ISIS & clock bezels
    bezel(g, 754, 70, 140, 140); legend(g, 'ISIS', 824, 225, 11);
    bezel(g, 764, 255, 120, 150); legend(g, 'CLOCK', 824, 417, 10);
    // brake triple indicator bezel
    bezel(g, 1128, 318, 110, 92);
    legend(g, 'AUTO/BRK', 1214, 236, 12);
    legendMulti(g, 'A/SKID &\nN/W STRG', 1292, 318, 10);
    // captain side legends
    legend(g, 'PFD', 200, 70, 12); legend(g, 'ND', 290, 70, 12); legend(g, 'OFF  BRT', 245, 175, 10);
    legend(g, 'LOUDSPEAKER', 245, 248, 11); legend(g, 'CONSOLE/FLOOR', 100, 248, 11);
    legend(g, 'F/O', 1865, 70, 12); legend(g, 'LOUDSPEAKER', 1800, 248, 11);
  });
  // brightness knobs
  knobHot(p, 'pfd_brt', 200, 120, 30, 'PFD brightness', () => Math.round(S.duBrt.pfd * 100) + ' %', d => { S.duBrt.pfd = clamp(S.duBrt.pfd + d * 0.05, 0, 1); });
  knobHot(p, 'nd_brt', 290, 120, 30, 'ND brightness', () => Math.round(S.duBrt.nd * 100) + ' %', d => { S.duBrt.nd = clamp(S.duBrt.nd + d * 0.05, 0, 1); });
  knobHot(p, 'loudspk', 245, 300, 30, 'Loudspeaker volume (master volume)', () => Math.round(S.vol * 100) + ' %', d => { S.vol = clamp(S.vol + d * 0.05, 0, 1); Audio2.setVolume(S.vol); });
  togHot(p, 'floor', 100, 320, ['BRT', 'DIM', 'OFF'], () => 2 - (S.sw.floor || 0), v => { S.sw.floor = 2 - v; }, '');
  knobHot(p, 'fo_loudspk', 1800, 300, 30, 'F/O loudspeaker', () => Math.round(S.vol * 100) + ' %', d => { S.vol = clamp(S.vol + d * 0.05, 0, 1); Audio2.setVolume(S.vol); });
  // under the captain's displays
  gpb(p, 'pfdxfr', 520, 290, 'PFD/ND\nXFR', 'mom', false, {});
  gpb(p, 'terronnd', 640, 290, 'TERR\nON ND', 'on', false, {});
  p.hot({ id: 'gpwsgs', x: 400, y: 290, w: 70, h: 44, label: 'GPWS warning light', get: () => [!!S.warn.gpwsLt],
    draw: (g, h) => { drawLight(g, h.x, h.y, h.w, h.h / 2 - 2, 'GPWS', ANN.red, !!S.warn.gpwsLt, 13); drawLight(g, h.x, h.y + h.h / 2 + 2, h.w, h.h / 2 - 2, 'G/S', ANN.amber, false, 13); } });
  // ISIS standby instrument (battery-powered)
  addScreen(p, 754, 70, 140, 140, 2.2, scrISIS, () => S.elec.dc ? `${Math.round(S.theta * R2D * 4)}|${Math.round(S.phi * R2D * 2)}|${Math.round(S.ias)}|${Math.round(indicatedAlt() / 10)}|${Math.floor(S.time - (S.dcOnT ?? S.time))}|${S.baro.std}|${S.baro.qnh}` : 'off');
  // clock: CHR / UTC / ET
  addScreen(p, 764, 255, 120, 150, 2.4, scrClock, () => S.elec.dc ? `${Math.floor(S.time)}|${S.chrono.run}|${Math.floor(S.chrono.t)}` : 'off');
  p.hot({ id: 'chr', cap: true, x: 726, y: 262, w: 32, h: 28, label: 'Clock CHR: start / stop / reset the chronometer', get: () => [S.chrono.run], click: chronoClick, draw: (g, h) => { drawPB(g, h.x, h.y, h.w, h.h, null, { t: 'CHR', c: ANN.white, on: false }); } });
  p.hot({ id: 'et', x: 890, y: 370, w: 40, h: 40, label: () => `Elapsed time: ${S.et.run ? 'RUN' : 'STP'} · click to run / stop / reset`, get: () => [S.et.run], click: () => { if (S.et.run) S.et.run = false; else if (S.et.t > 0 && !S.et.run && S.et._stopped) { S.et.t = 0; S.et._stopped = false; } else { S.et.run = true; S.et._stopped = true; } Audio2.toggle(); },
    draw: (g, h) => { drawSelector(g, h.x + 20, h.y + 22, 13, S.et.run ? 30 : -30, [{ t: 'STP', a: -40 }, { t: 'RUN', a: 40 }], 9); } });
  // brake & accumulator pressure triple indicator
  addScreen(p, 1128, 318, 110, 92, 2.2, scrBrakes, () => `${S.parkBrake}|${Math.round(Math.max(S.brakeL, S.brakeR) * 20)}|${S.abActive}|${hydState().y > 0}`);
  // landing gear lever with indicator
  p.hot({ id: 'gear', x: 1252, y: 30, w: 76, h: 190, label: () => `Landing gear lever: ${S.gearLever ? 'DOWN' : 'UP'} (G)`, get: () => [S.gearLever, Math.round(S.gearPos * 20), gearRedArrow()], click: () => { setGear(S.gearLever ? 0 : 1); },
    draw: (g, h) => {
      const cx = h.x + 38; g.fillStyle = '#20262a'; g.fillRect(cx - 12, h.y + 10, 24, h.h - 20); g.strokeStyle = '#000'; g.strokeRect(cx - 12, h.y + 10, 24, h.h - 20);
      legend(g, 'UP', cx + 34, h.y + 18, 12); legend(g, 'DN', cx + 34, h.y + h.h - 18, 12); legend(g, 'LDG GEAR', cx, h.y - 8, 11);
      // red arrow (gear not down in landing configuration)
      const arrowOn = gearRedArrow(); both(g, gg => { if (!arrowOn && gg === EG) return; gg.fillStyle = arrowOn ? ANN.red : '#3a1a1a'; if (arrowOn) { gg.shadowColor = ANN.red; gg.shadowBlur = 10; } gg.beginPath(); gg.moveTo(cx - 34, h.y + 70); gg.lineTo(cx - 18, h.y + 90); gg.lineTo(cx - 50, h.y + 90); gg.closePath(); gg.fill(); gg.shadowBlur = 0; });
    } });
  p.hot({ id: 'gear_3d', x: 0, y: 0, w: 0, h: 0, get: () => [0], init3d: () => {
    const M = m3(), [sx] = sxy(p); const g3 = new THREE.Group(); const L = 0.07;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, L, 12), M.metal); stem.rotation.x = Math.PI / 2; stem.position.z = L / 2; g3.add(stem);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.032, 28), M.gearKnob); wheel.rotation.z = Math.PI / 2; wheel.position.z = L; g3.add(wheel);
    mount(p, 1290, 125, g3); const yTop = p.local(0, 58).y, yBot = p.local(0, 192).y; let yy = S.gearLever ? yBot : yTop;
    CK.anim3d.push(() => { yy = lerp(yy, S.gearLever ? yBot : yTop, 0.25); g3.position.y = yy; });
  } });
  p.hot({ id: 'ldgind', x: 1135, y: 40, w: 104, h: 150, label: 'Landing gear indicator: green = down and locked, red UNLK = in transit', get: () => [Math.round(S.gearPos * 20)],
    draw: (g, h) => {
      legend(g, 'L/G', h.x + h.w / 2, h.y + 6, 11);
      const pos = [[h.x + h.w / 2, h.y + 40], [h.x + 22, h.y + 100], [h.x + h.w - 22, h.y + 100]];
      const dn = S.gearPos > 0.995, tr = S.gearPos > 0.005 && !dn;
      for (const [x, y] of pos) { g.fillStyle = '#0c0e0f'; g.fillRect(x - 20, y - 22, 40, 44); g.strokeStyle = '#3b4247'; g.strokeRect(x - 20, y - 22, 40, 44);
        if (S.elec.dc && tr) both(g, gg => { gg.font = 'bold 11px Arial'; gg.textAlign = 'center'; gg.fillStyle = ANN.red; gg.shadowColor = ANN.red; gg.shadowBlur = 6; gg.fillText('UNLK', x, y - 8); gg.shadowBlur = 0; });
        if (S.elec.dc && dn) both(g, gg => { gg.fillStyle = ANN.green; gg.shadowColor = ANN.green; gg.shadowBlur = 8; gg.beginPath(); gg.moveTo(x - 13, y + 2); gg.lineTo(x + 13, y + 2); gg.lineTo(x, y + 18); gg.closePath(); gg.fill(); gg.shadowBlur = 0; }); }
    } });
  // autobrake
  ['LO', 'MED', 'MAX'].forEach((n, i) => pbHot(p, 'ab_' + n, 1135 + i * 58, 250, n, () => ({ t: 'DECEL', c: ANN.green, on: S.abActive && S.autobrake === i + 1 }), () => ({ t: 'ON', c: ANN.blue, on: S.autobrake === i + 1 }), () => { S.autobrake = S.autobrake === i + 1 ? 0 : i + 1; Audio2.click(); Tut.event('autobrake'); }, 'AUTO/BRK ' + n));
  togHot(p, 'askid', 1292, 372, ['ON', 'OFF'], () => swGet('askid') ? 0 : 1, v => swSet('askid', v === 0), '', { tip: 'A/SKID & N/W STRG: nosewheel steering and anti-skid' });
  SWDEF.askid = { def: true };
}
function gearRedArrow() { return !S.onGround && S.gearPos < 0.99 && S.ra < 750 && S.flapLever >= 3; }
function chronoClick() { const c = S.chrono; if (!c.run && c.t === 0) c.run = true; else if (c.run) c.run = false; else c.t = 0; Audio2.click(); }
function scrISIS(g, W, H) {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H); if (!S.elec.dc) return;
  const up = S.time - (S.dcOnT ?? S.time);
  if (up < 90) { g.fillStyle = '#ffb000'; g.font = `bold ${W * 0.09}px ${FONT}`; g.textAlign = 'center'; g.fillText('ATT', W / 2, H * 0.42); g.fillText(Math.ceil(90 - up) + 's', W / 2, H * 0.58); return; }
  const cx = W / 2, cy = H * 0.48, ppd = W * 0.018;
  g.save(); g.beginPath(); g.rect(W * 0.2, H * 0.08, W * 0.6, H * 0.8); g.clip();
  g.translate(cx, cy); g.rotate(S.phi); g.translate(0, S.theta * R2D * ppd);
  g.fillStyle = '#1a78c4'; g.fillRect(-W, -W * 2, W * 2, W * 2); g.fillStyle = '#7a4219'; g.fillRect(-W, 0, W * 2, W * 2);
  g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-W, 0); g.lineTo(W, 0); g.stroke();
  for (let p2 = -20; p2 <= 20; p2 += 5) { if (!p2) continue; const y = -p2 * ppd, w = p2 % 10 ? W * 0.05 : W * 0.1; g.beginPath(); g.moveTo(-w, y); g.lineTo(w, y); g.stroke(); }
  g.restore();
  g.fillStyle = '#ffd400'; g.fillRect(cx - W * 0.16, cy - 2, W * 0.1, 5); g.fillRect(cx + W * 0.06, cy - 2, W * 0.1, 5); g.fillRect(cx - 4, cy - 4, 8, 8);
  g.fillStyle = '#222'; g.fillRect(0, 0, W * 0.2, H); g.fillRect(W * 0.8, 0, W * 0.2, H);
  g.font = `${W * 0.075}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let v = Math.floor(S.ias / 10) * 10 - 20; v <= S.ias + 30; v += 10) { const y = cy - (v - S.ias) * W * 0.012; if (v > 0 && v % 20 === 0) { g.fillStyle = '#fff'; g.fillText(String(v), W * 0.1, y); } }
  const ia = indicatedAlt(); for (let a = Math.floor(ia / 100) * 100 - 300; a <= ia + 300; a += 100) { const y = cy - (a - ia) * W * 0.0012; if (a % 200 === 0) { g.fillStyle = '#fff'; g.fillText(String(Math.round(a / 100)), W * 0.9, y); } }
  g.fillStyle = '#000'; g.strokeStyle = '#ffd400'; g.lineWidth = 2; g.fillRect(2, cy - 16, W * 0.19, 32); g.strokeRect(2, cy - 16, W * 0.19, 32); g.fillRect(W * 0.79, cy - 16, W * 0.2 - 2, 32); g.strokeRect(W * 0.79, cy - 16, W * 0.2 - 2, 32);
  g.fillStyle = '#3df23d'; g.font = `bold ${W * 0.08}px ${FONT}`; g.fillText(String(Math.round(S.ias)), W * 0.105, cy); g.font = `bold ${W * 0.062}px ${FONT}`; g.fillText(String(Math.round(ia)), W * 0.895, cy);
  g.fillStyle = '#2fd6ff'; g.font = `${W * 0.07}px ${FONT}`; g.fillText(S.baro.std ? 'STD' : S.baro.qnh + ' hPa', cx, H * 0.94);
}
function scrClock(g, W, H) {
  g.fillStyle = '#0a0b0b'; g.fillRect(0, 0, W, H); if (!S.elec.dc) return;
  const lab = (t, y) => { g.fillStyle = '#c9ced1'; g.font = `bold ${H * 0.06}px Arial`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(t, W * 0.06, y); };
  lab('CHR', H * 0.08); lab('UTC', H * 0.4); lab('ET', H * 0.73);
  const c = Math.floor(S.chrono.t); seg7(g, `${String(Math.floor(c / 60) % 100).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`, W * 0.92, H * 0.12, H * 0.16);
  const tt = new Date(Date.UTC(2026, 9, 17, 13, 5) + S.time * 1000);
  seg7(g, `${String(tt.getUTCHours()).padStart(2, '0')}:${String(tt.getUTCMinutes()).padStart(2, '0')}`, W * 0.8, H * 0.42, H * 0.2);
  seg7(g, String(tt.getUTCSeconds()).padStart(2, '0'), W * 0.97, H * 0.52, H * 0.1);
  const e = Math.floor(S.et.t / 60); seg7(g, `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`, W * 0.92, H * 0.77, H * 0.16);
  lcdGlass(g, W, H);
}
function scrBrakes(g, W, H) {
  g.fillStyle = '#0b0c0c'; g.fillRect(0, 0, W, H);
  const lt = S.elec.dc; const tc = lt ? '#e8eef0' : '#6d7376';
  const needle = (cx, cy, r, a0, a1, v) => { const a = (a0 + (a1 - a0) * clamp(v / 4, 0, 1)) * D2R; g.strokeStyle = tc; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(a) * r, cy - Math.cos(a) * r); g.stroke(); };
  const arc = (cx, cy, r, a0, a1) => { g.strokeStyle = tc; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r, (a0 - 90) * D2R, (a1 - 90) * D2R); g.stroke(); for (let k = 0; k <= 4; k++) { const a = (a0 + (a1 - a0) * k / 4) * D2R; g.beginPath(); g.moveTo(cx + Math.sin(a) * r, cy - Math.cos(a) * r); g.lineTo(cx + Math.sin(a) * (r - 7), cy - Math.cos(a) * (r - 7)); g.stroke(); } };
  g.font = `bold ${H * 0.085}px Arial`; g.textAlign = 'center'; g.fillStyle = tc;
  g.fillText('ACCU', W * 0.5, H * 0.09); g.fillText('PRESS', W * 0.5, H * 0.17);
  arc(W * 0.5, H * 0.52, H * 0.3, -60, 60); g.strokeStyle = '#3df23d'; g.lineWidth = 5; g.beginPath(); g.arc(W * 0.5, H * 0.52, H * 0.3 - 3, (-90 + 15) * D2R, (-90 + 45) * D2R); g.stroke();
  needle(W * 0.5, H * 0.52, H * 0.27, -60, 60, 3.0);
  const bp = S.parkBrake ? 2.0 : clamp(Math.max(S.brakeL, S.brakeR) * 2.6 + (S.abActive ? 1.2 : 0), 0, 3);
  arc(W * 0.22, H * 0.95, H * 0.36, 0, 80); arc(W * 0.78, H * 0.95, H * 0.36, -80, 0);
  needle(W * 0.22, H * 0.95, H * 0.33, 0, 80, bp); needle(W * 0.78, H * 0.95, H * 0.33, -80, 0, bp);
  g.fillText('L', W * 0.1, H * 0.62); g.fillText('R', W * 0.9, H * 0.62); g.fillText('BRAKES', W * 0.5, H * 0.75); g.fillText('PSI x1000', W * 0.5, H * 0.86);
  lcdGlass(g, W, H);
}

// ================= FCU / EFIS (glareshield) =================
const ND_RANGES = [10, 20, 40, 80, 160, 320];
const ND_MODES = ['LS', 'VOR', 'NAV', 'ARC', 'PLAN'];
function buildFCU(p) {
  const K = p.W / p.mW; const X = (m) => (m + 0.95) * K;  // metres from glareshield centre -> px
  const WY = 18, WH = 92, KY = 186, BY = 290;               // window top/height, knob centre y, lower button row y
  const scr = [['spd', -0.28, 190], ['hdg', -0.13, 236], ['alt', 0.125, 300], ['vs', 0.265, 200], ['baro', -0.735, 180], ['baro2', 0.755, 180]];
  buildStatic(p, g => {
    g.fillStyle = '#23272b'; g.fillRect(0, 0, p.W, p.H); g.fillStyle = grainPattern(g); g.fillRect(0, 0, p.W, p.H);
    const box = (m0, m1) => subPanel(g, X(m0), 4, X(m1) - X(m0), p.H - 8, '');
    box(-0.365, 0.365); box(-0.79, -0.51); box(0.525, 0.815); box(-0.9, -0.83); box(0.83, 0.9);
    for (const [, c, w] of scr) bezel(g, X(c) - w / 2, WY, w, WH);
    legendMulti(g, 'SPD\nMACH', X(-0.338), KY + 44, 11);
    legendMulti(g, 'HDG V/S\nTRK FPA', X(-0.062), KY + 44, 11);
    legend(g, '100', X(0.188) - 30, KY - 36, 12); legend(g, '1000', X(0.188) + 32, KY - 36, 12);
    legend(g, 'QFE', X(-0.735) - 70, KY - 30, 12); legend(g, 'QNH', X(-0.735) + 70, KY - 30, 12); legend(g, 'PUSH STD', X(-0.735), KY + 62, 10);
    legend(g, 'QFE', X(0.755) - 70, KY - 30, 12); legend(g, 'QNH', X(0.755) + 70, KY - 30, 12); legend(g, 'PUSH STD', X(0.755), KY + 62, 10);
    legend(g, 'MODE', X(-0.605), KY + 66, 11); legend(g, 'RANGE', X(-0.537), KY + 66, 11);
    legend(g, 'MODE', X(0.625), KY + 66, 11); legend(g, 'RANGE', X(0.555), KY + 66, 11);
    legend(g, 'MASTER', X(-0.865), 20, 11); legend(g, 'MASTER', X(0.865), 20, 11);
    legend(g, 'SIDE STICK', X(-0.865), 268, 10); legend(g, 'PRIORITY', X(-0.865), 280, 10);
    legend(g, 'SIDE STICK', X(0.865), 268, 10); legend(g, 'PRIORITY', X(0.865), 280, 10);
  });
  // ---- lit windows ----
  const S2 = 2;
  addScreen(p, X(-0.28) - 95, WY, 190, WH, S2, scrSPD, () => `${S.elec.dc}|${S.fcu.spd}|${S.fcu.spdMan}|${S.fcu.mach}|${S.fcu.machV}`);
  addScreen(p, X(-0.13) - 118, WY, 236, WH, S2, scrHDG, () => `${S.elec.dc}|${S.fcu.hdg}|${S.fcu.hdgMan}|${S.fcu.trkFpa}|${S.ap.lat}|${S.ap.latArm}|${S.time - (S.fcu.hdgShowT ?? -99) < 10}`);
  addScreen(p, X(0.125) - 150, WY, 300, WH, S2, scrALT, () => `${S.elec.dc}|${S.fcu.alt}|${S.ap.vert}|${S.ap.vertArm}`);
  addScreen(p, X(0.265) - 100, WY, 200, WH, S2, scrVS, () => `${S.elec.dc}|${S.fcu.vs}|${S.ap.vert}|${S.fcu.trkFpa}|${S.time - (S.fcu.vsShowT ?? -99) < 10}`);
  for (const c of [-0.735, 0.755]) addScreen(p, X(c) - 90, WY, 180, WH, S2, scrBaro, () => `${S.elec.dc}|${S.baro.std}|${S.baro.qnh}|${S.baro.inhg}`);
  // ---- knobs ----
  const f = () => S.fcu;
  knobHot(p, 'fcu_spd', X(-0.28), KY, 46, 'SPD/MACH knob', () => f().spdMan ? (f().mach ? 'M.' + Math.round(f().machV * 100) : f().spd + ' kt selected') : 'managed speed',
    d => { if (f().mach) f().machV = clamp(+(f().machV + d * 0.01).toFixed(2), 0.10, 0.82); else f().spd = clamp(f().spd + d, 100, 399); if (!f().spdMan) { f().spdMan = true; f().spd = Math.round(S.ias || 150) + d; } },
    () => { f().spdMan = false; Tut.event('spd_push'); }, () => { f().spdMan = true; f().spd = Math.round(S.ias || 150); Tut.event('spd_pull'); });
  knobHot(p, 'fcu_hdg', X(-0.13), KY, 46, 'HDG/TRK knob', () => (f().hdgMan ? 'selected ' : 'managed, preset ') + String(f().hdg).padStart(3, '0') + '°',
    d => { f().hdg = wrap360(f().hdg + d - 1) + 1; if (!f().hdgMan) f().hdgShowT = S.time; Tut.event('hdg_set'); },
    () => { if (S.fms.coRte) { if (S.onGround) S.ap.latArm = 'NAV'; else { S.ap.lat = 'NAV'; S.ap.latArm = ''; } f().hdgMan = false; Tut.event('hdg_push'); } else toast('No flight plan: load the route in the MCDU first'); },
    () => { f().hdgMan = true; if (!S.onGround) { S.ap.lat = 'HDG'; S.ap.latArm = ''; } Tut.event('hdg_pull'); });
  knobHot(p, 'fcu_alt', X(0.125), KY, 46, 'ALT knob', () => `${f().alt} ft (steps of ${f().altInc})`,
    d => { const st = f().altInc; f().alt = clamp(Math.round((f().alt + Math.sign(d) * st * Math.max(1, Math.abs(d) / 10 * (st === 100 ? 10 : 1))) / st) * st, 100, 39000); Tut.event('alt_set'); },
    () => { if (!S.onGround) { const up = f().alt > indicatedAlt(); S.ap.vert = up ? 'CLB' : 'DES'; S.ap.gammaC = S.gamma; } Tut.event('alt_push'); },
    () => { if (!S.onGround) { const up = f().alt > indicatedAlt(); S.ap.vert = up ? 'OP CLB' : 'OP DES'; S.ap.gammaC = S.gamma; } Tut.event('alt_pull'); });
  knobHot(p, 'fcu_vs', X(0.265), KY, 46, 'V/S knob', () => S.ap.vert === 'V/S' ? `${f().vs} ft/min active` : `preset ${f().vs} ft/min (pull to engage)`,
    d => { f().vs = clamp(f().vs + Math.sign(d) * 100, -6000, 6000); f().vsShowT = S.time; if (S.ap.vert === 'V/S') { } },
    () => { if (!S.onGround) { S.ap.vert = 'V/S'; f().vs = 0; } },
    () => { if (!S.onGround) { if (S.time - (f().vsShowT ?? -99) > 10) f().vs = Math.round(S.vs / 100) * 100; S.ap.vert = 'V/S'; } Tut.event('vs_pull'); });
  selHot(p, 'altinc', X(0.188), KY, 18, ['100', '1000'], [-45, 45], () => f().altInc === 100 ? 0 : 1, v => { f().altInc = v ? 1000 : 100; }, '', { fs: 1, tip: '100/1000: ALT knob step size' });
  // ---- FCU push buttons ----
  const fbtn = (id, cx, cy, w, label, on, click, tip) => p.hot({ id, x: cx - w / 2, y: cy - 22, w, h: 44, cap: true, label: tip, get: () => [!!on()], click: () => { click(); Audio2.click(); Tut.event(id); },
    draw: (g, h) => { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(h.x + 2, h.y + 4, h.w, h.h); const gr = g.createLinearGradient(0, h.y, 0, h.y + h.h); gr.addColorStop(0, '#2c3236'); gr.addColorStop(1, '#16191b'); g.fillStyle = gr; g.fillRect(h.x, h.y, h.w, h.h); g.strokeStyle = '#555d63'; g.strokeRect(h.x + .5, h.y + .5, h.w - 1, h.h - 1);
      legend(g, label, h.x + h.w / 2, h.y + h.h * 0.62, label.length > 5 ? 12 : 15);
      const lit = on() && S.elec.dc; if (lit) both(g, gg => { gg.fillStyle = ANN.green; gg.shadowColor = ANN.green; gg.shadowBlur = 8; gg.fillRect(h.x + 12, h.y + 5, h.w - 24, 5); gg.shadowBlur = 0; }); else { g.fillStyle = '#1f2a20'; g.fillRect(h.x + 12, h.y + 5, h.w - 24, 5); } } });
  fbtn('spdmach', X(-0.338), KY, 60, 'S/M', () => f().mach, () => { if (f().mach) { f().mach = false; f().spd = Math.round(machToIas(f().machV)); } else { f().mach = true; f().machV = +iasToMach(f().spd).toFixed(2); } }, 'SPD/MACH: switch the speed window between knots and Mach');
  fbtn('fcu_loc', X(-0.205), BY, 76, 'LOC', () => S.ap.latArm === 'LOC' || S.ap.lat.startsWith('LOC'), () => { if (S.ap.latArm === 'LOC') S.ap.latArm = ''; else S.ap.latArm = 'LOC'; Tut.event('loc'); }, 'LOC: arm the localiser only');
  fbtn('trkfpa', X(-0.062), KY, 60, 'H/T', () => f().trkFpa, () => { f().trkFpa = !f().trkFpa; }, 'HDG-V/S / TRK-FPA: switch the FCU reference');
  fbtn('fcu_ap1', X(-0.027), 44, 92, 'AP1', () => S.fcu.ap1, () => { if (ap_engage(1)) Tut.event('ap1'); else if (!S.fcu.ap1) toast('Autopilot needs to be airborne and above 100 ft'); }, 'AP1: autopilot 1 (key A)');
  fbtn('fcu_ap2', X(0.027), 44, 92, 'AP2', () => S.fcu.ap2, () => { if (!ap_engage(2) && !S.fcu.ap2) toast('Autopilot needs to be airborne and above 100 ft'); }, 'AP2: autopilot 2');
  fbtn('fcu_athr', X(0), 104, 110, 'A/THR', () => S.fcu.athr, () => { athr_toggle(); Tut.event('athr'); }, 'A/THR: autothrust (Shift+R)');
  fbtn('fcu_exped', X(0.188), BY, 84, 'EXPED', () => S.ap.exped, () => { if (S.onGround) return; S.ap.exped = !S.ap.exped; if (S.ap.exped) { const up = f().alt > indicatedAlt(); S.ap.vert = up ? 'CLB' : 'DES'; } }, 'EXPED: expedite climb (green dot speed) or descent (340 kt)');
  fbtn('fcu_appr', X(0.33), BY, 76, 'APPR', () => S.ap.vertArm === 'G/S' || ['G/S', 'G/S*', 'LAND', 'FLARE'].includes(S.ap.vert), () => { if (S.ap.vertArm === 'G/S') { S.ap.vertArm = ''; S.ap.latArm = ''; } else { S.ap.vertArm = 'G/S'; if (!S.ap.lat.startsWith('LOC')) S.ap.latArm = 'LOC'; } Tut.event('appr'); }, 'APPR: arm the ILS approach (localiser and glideslope)');
  // ---- EFIS (captain at -0.65, first officer mirrored at +0.67) ----
  for (const [side, bx, fdx, mx, rx] of [['', -0.735, -0.655, -0.605, -0.537], ['2', 0.755, 0.675, 0.625, 0.555]]) {
    knobHot(p, 'baro' + side, X(bx), KY, 44, 'BARO knob', () => S.baro.std ? 'STD (1013)' : `QNH ${S.baro.qnh} hPa`,
      d => { if (S.baro.std) return; S.baro.qnh = clamp(S.baro.qnh + Math.sign(d) * (Math.abs(d) > 5 ? 5 : 1), 950, 1050); Tut.event('baro'); },
      () => { S.baro.std = !S.baro.std; Tut.event('baro_std'); }, () => { S.baro.std = false; Tut.event('baro_std'); });
    selHot(p, 'inhg' + side, X(bx + (side ? 0.038 : -0.038)), 262, 12, ['inHg', 'hPa'], [-40, 40], () => S.baro.inhg ? 0 : 1, v => S.baro.inhg = v === 0, '', { fs: 10, tip: 'Altimeter units: inHg / hPa' });
    fbtn('efis_fd' + side, X(fdx), 60, 70, 'FD', () => S.fcu.fd, () => { S.fcu.fd = !S.fcu.fd; }, 'FD: flight director bars on the PFD');
    fbtn('efis_ls' + side, X(fdx), 124, 70, 'LS', () => !!S.efisLS, () => { S.efisLS = !S.efisLS; Tut.event('ls'); }, 'LS: show the ILS scales on the PFD');
    selHot(p, 'ndmode' + side, X(mx), KY, 34, ND_MODES, [-70, -35, 0, 35, 70], () => S.efis.mode, v => S.efis.mode = v, '', { fs: 12, tip: () => `ND mode: ${ND_MODES[S.efis.mode]} · click / right-click to turn` });
    selHot(p, 'nd_range' + side, X(rx), KY, 34, ND_RANGES.map(String), [-75, -45, -15, 15, 45, 75], () => S.ndRange, v => S.ndRange = v, '', { fs: 12, tip: () => `ND range: ${ND_RANGES[S.ndRange]} NM · scroll or click` });
    ['CSTR', 'WPT', 'VOR.D', 'NDB', 'ARPT'].forEach((n, i) => {
      const key = n.replace('.', '').toLowerCase(); const cx = side ? X(0.795 - i * 0.052) : X(-0.773 + i * 0.052);
      fbtn('efis_' + key + side, cx, 312, 86, n, () => S.efis[key], () => { S.efis[key] = !S.efis[key]; }, `${n}: show ${{ cstr: 'altitude constraints', wpt: 'waypoints', vord: 'VOR beacons', ndb: 'NDB beacons', arpt: 'airports' }[key]} on the ND`);
    });
  }
  // ---- master warning / caution, chrono, side stick priority ----
  for (const sx of [-0.865, 0.865]) {
    p.hot({ id: 'mw' + sx, cap: true, x: X(sx) - 52, y: 32, w: 104, h: 64, label: 'MASTER WARN: press to silence', get: () => [S.warn.master && !S.warn.silenced, Math.floor(S.time * 3) % 2],
      click: () => { S.warn.silenced = true; Audio2.click(); },
      draw: (g, h) => drawLight(g, h.x, h.y, h.w, h.h, 'MASTER\nWARN', ANN.red, S.warn.master && !S.warn.silenced && Math.floor(S.time * 3) % 2 === 0, 15) });
    p.hot({ id: 'mc' + sx, cap: true, x: X(sx) - 52, y: 104, w: 104, h: 64, label: 'MASTER CAUT: press to acknowledge', get: () => [S.warn.caution],
      click: () => { S.warn.ack = [...(S.warn.cautions || [])]; S.warn.caution = false; Audio2.click(); },
      draw: (g, h) => drawLight(g, h.x, h.y, h.w, h.h, 'MASTER\nCAUT', ANN.amber, S.warn.caution, 15) });
    p.hot({ id: 'chrono' + sx, cap: true, x: X(sx) - 40, y: 186, w: 80, h: 44, label: 'CHRONO: start / stop the ND chronometer', get: () => [S.chrono.run], click: chronoClick,
      draw: (g, h) => { drawPB(g, h.x, h.y, h.w, h.h, null, { t: 'CHRONO', c: ANN.white, on: false }); } });
    p.hot({ id: 'ssp' + sx, x: X(sx) - 46, y: 292, w: 92, h: 40, label: 'Side stick priority lights', get: () => [0],
      draw: (g, h) => { drawLight(g, h.x, h.y, h.w / 2 - 2, h.h, 'CAPT', ANN.red, false, 11); drawLight(g, h.x + h.w / 2 + 2, h.y, h.w / 2 - 2, h.h, 'F/O', ANN.green, false, 11); } });
  }
}
function scrSPD(g, W, H) {
  lcdBg(g, W, H);
  if (S.elec.dc) { const f = S.fcu; lcdLabel(g, 'SPD', W * 0.28, H * 0.17, H * 0.17, !f.mach); lcdLabel(g, 'MACH', W * 0.66, H * 0.17, H * 0.17, f.mach);
    const t = !f.spdMan ? '---' : f.mach ? '.' + String(Math.round(f.machV * 100)).padStart(2, '0') : String(Math.round(f.spd)).padStart(3, '0');
    seg7(g, t, W * 0.8, H * 0.34, H * 0.54); if (!f.spdMan) lcdDot(g, W * 0.9, H * 0.62, H * 0.065); }
  lcdGlass(g, W, H);
}
function scrHDG(g, W, H) {
  lcdBg(g, W, H);
  if (S.elec.dc) { const f = S.fcu, trk = !!f.trkFpa; lcdLabel(g, 'HDG', W * 0.2, H * 0.17, H * 0.17, !trk); lcdLabel(g, 'TRK', W * 0.48, H * 0.17, H * 0.17, trk); lcdLabel(g, 'LAT', W * 0.78, H * 0.17, H * 0.17, true);
    const show = f.hdgMan || S.time - (f.hdgShowT ?? -99) < 10;
    seg7(g, show ? String(Math.round(f.hdg) % 360 || 360).padStart(3, '0') : '---', W * 0.74, H * 0.34, H * 0.54);
    if (!f.hdgMan) lcdDot(g, W * 0.84, H * 0.62, H * 0.065); }
  lcdGlass(g, W, H);
}
function scrALT(g, W, H) {
  lcdBg(g, W, H);
  if (S.elec.dc) { const f = S.fcu; lcdLabel(g, 'ALT', W * 0.13, H * 0.17, H * 0.17, true);
    g.strokeStyle = LCD_ON; g.lineWidth = 2.5; g.shadowColor = LCD_ON; g.shadowBlur = 5; g.beginPath(); g.moveTo(W * 0.24, H * 0.17); g.lineTo(W * 0.58, H * 0.17); g.stroke(); g.shadowBlur = 0;
    lcdLabel(g, 'LVL/CH', W * 0.78, H * 0.17, H * 0.17, true);
    seg7(g, String(f.alt).padStart(5, '0'), W * 0.82, H * 0.34, H * 0.54);
    if (['CLB', 'DES'].includes(S.ap.vert) || (S.onGround && S.ap.vertArm === 'CLB')) lcdDot(g, W * 0.9, H * 0.62, H * 0.065); }
  lcdGlass(g, W, H);
}
function scrVS(g, W, H) {
  lcdBg(g, W, H);
  if (S.elec.dc) { const f = S.fcu; lcdLabel(g, 'V/S', W * 0.32, H * 0.17, H * 0.17, !f.trkFpa); lcdLabel(g, 'FPA', W * 0.68, H * 0.17, H * 0.17, !!f.trkFpa);
    const act = S.ap.vert === 'V/S' || S.time - (f.vsShowT ?? -99) < 10;
    if (act) { const v = Math.round(f.vs / 100); const x = seg7(g, (v >= 0 ? '+' : '-') + String(Math.abs(v)).padStart(2, '0'), W * 0.08, H * 0.34, H * 0.54, { align: 'left' }); seg7(g, 'oo', x + W * 0.01, H * 0.52, H * 0.34, { align: 'left', ghost: false }); }
    else seg7(g, '-----', W * 0.92, H * 0.34, H * 0.54); }
  lcdGlass(g, W, H);
}
function scrBaro(g, W, H) {
  lcdBg(g, W, H);
  if (S.elec.dc) { const b = S.baro; lcdLabel(g, 'QFE', W * 0.22, H * 0.17, H * 0.16, false); lcdLabel(g, 'QNH', W * 0.75, H * 0.17, H * 0.16, !b.std);
    const t = b.std ? ' Std' : b.inhg ? (b.qnh * 0.02953).toFixed(2) : String(b.qnh); seg7(g, t, W * 0.9, H * 0.36, H * 0.5); }
  lcdGlass(g, W, H);
}

// ================= OVERHEAD =================
// canvas top = aft, bottom = forward (nearest the windscreen)
function buildOverhead(p) {
  const secs = [
    [0, 0, 560, 420, 'ADIRS'], [0, 420, 560, 120, 'EVAC'], [0, 540, 560, 220, 'GPWS'], [0, 760, 560, 200, 'RCDR · OXYGEN'], [0, 960, 560, 140, 'CALLS'], [0, 1100, 560, 158, 'WIPER'],
    [560, 0, 1000, 220, 'FIRE'], [560, 220, 1000, 200, 'HYD'], [560, 420, 1000, 220, 'FUEL'], [560, 640, 1000, 260, 'ELEC'], [560, 900, 1000, 170, 'AIR COND'], [560, 1070, 500, 188, 'ANTI ICE'], [1060, 1070, 500, 188, 'CABIN PRESS'],
    [1560, 0, 488, 260, 'FLT CTL'], [1560, 260, 488, 200, 'CARGO · VENT'], [1560, 460, 488, 180, 'ENG'], [1560, 640, 488, 260, 'EMER ELEC PWR'], [1560, 900, 488, 358, 'WIPER'],
    [0, 1258, 1180, 150, 'EXT LT'], [1180, 1258, 280, 150, 'APU'], [1460, 1258, 340, 150, 'SIGNS'], [1800, 1258, 248, 150, 'INT LT']
  ];
  buildStatic(p, g => {
    g.fillStyle = '#3e4a53'; g.fillRect(0, 0, p.W, p.H);
    for (const [x, y, w, h, t] of secs) subPanel(g, x, y, w, h, t);
    // ELEC synoptic lines
    g.strokeStyle = LEGEND; g.lineWidth = 2; g.beginPath(); g.moveTo(664, 820); g.lineTo(664, 790); g.lineTo(1464, 790); g.lineTo(1464, 820); g.moveTo(924, 820); g.lineTo(924, 790); g.moveTo(1204, 820); g.lineTo(1204, 790); g.stroke();
    legend(g, 'AC ESS FEED', 1205, 680, 10);
  });
  const T = (t, c, on, box) => ({ t, c, on, box });
  // ---- ADIRS ----
  for (let i = 0; i < 3; i++) {
    const x = 120 + i * 170;
    p.hot({ id: 'ir' + (i + 1), x: x - 24, y: 60, w: 48, h: 44, cap: () => S.adirs[i] > 0, label: `IR ${i + 1}: ALIGN light shows while aligning`, get: () => [S.adirs[i] && S.adirsT[i] < 1],
      draw: (g, h) => { drawPB(g, h.x, h.y, h.w, h.h, T('FAULT', ANN.amber, false), T('ALIGN', ANN.white, S.adirs[i] && S.adirsT[i] < 1)); legend(g, 'IR ' + (i + 1), x, h.y + h.h + 14, 11); } });
    selHot(p, 'adirs' + (i + 1), x, 260, 32, ['OFF', 'NAV', 'ATT'], [-50, 0, 50], () => S.adirs[i], v => { S.adirs[i] = v; Tut.event('adirs'); }, String(i + 1), { fs: 12, tip: () => `ADIRS ${i + 1}: ${['OFF', 'NAV', 'ATT'][S.adirs[i]]} · click = clockwise, right-click = back` });
  }
  p.hot({ id: 'onbat', x: 60, y: 160, w: 60, h: 34, label: 'ON BAT: IRS running on battery', get: () => [S.elec.dc && !S.elec.ac && S.adirs.some(a => a)], draw: (g, h) => drawLight(g, h.x, h.y, h.w, h.h, 'ON BAT', ANN.amber, S.elec.dc && !S.elec.ac && S.adirs.some(a => a), 11) });
  // ---- EVAC ----
  gpb(p, 'evac', 90, 455, 'COMMAND', 'on', false, { guard: '#c8262b', bot: 'ON', topFn: () => T('EVAC', ANN.red, swGet('evac') && Math.floor(S.time * 2) % 2 === 0), tip: 'EVAC COMMAND (guarded): sounds the evacuation horn' });
  gpb(p, 'horn', 250, 455, 'HORN\nSHUT OFF', 'mom', false, { onClick: () => swSet('evac', false) });
  // ---- GPWS ----
  [['gpws_sys', 'SYS'], ['gpws_gs', 'G/S MODE'], ['gpws_flap', 'FLAP MODE'], ['gpws_terr', 'TERR']].forEach(([id, l], i) => gpb(p, id, 50 + i * 120, 600, l, 'off', true, {}));
  gpb(p, 'gpws_flap3', 50 + 4 * 100, 680, 'LDG\nFLAP 3', 'on', false, {});
  // ---- RCDR / OXYGEN ----
  gpb(p, 'gnd_ctl', 60, 815, 'GND CTL', 'on', false, {});
  gpb(p, 'cvr_erase', 170, 815, 'CVR\nERASE', 'mom', false, {});
  gpb(p, 'cvr_test', 280, 815, 'CVR\nTEST', 'mom', false, { onClick: () => Audio2.tone(600, 1.0, 0.05) });
  gpb(p, 'crew_oxy', 430, 815, 'CREW\nSUPPLY', 'off', true, { abn: 'OXY CREW SUPPLY OFF', when: () => true });
  // ---- CALLS ----
  gpb(p, 'call_mech', 60, 1010, 'MECH', 'mom', false, { onClick: () => { Audio2.hiLo(); setTimeout(() => { showATC('Ground mechanic', S.onGround ? 'Ground here, go ahead.' : '(no answer: we are airborne)'); }, 1200); } });
  gpb(p, 'call_fwd', 180, 1010, 'FWD', 'mom', false, { onClick: () => { Audio2.hiLo(); setTimeout(() => { showATC('Purser', 'Yes Captain? Cabin is all fine back here.'); Audio2.say('Yes Captain?', 'atc'); }, 1500); } });
  gpb(p, 'call_aft', 300, 1010, 'AFT', 'mom', false, { onClick: () => { Audio2.hiLo(); setTimeout(() => showATC('Aft cabin', 'Aft galley, go ahead.'), 1500); } });
  gpb(p, 'call_all', 420, 1010, 'ALL', 'mom', false, { onClick: () => Audio2.hiLo() });
  // ---- WIPERS ----
  selHot(p, 'wiper_l', 140, 1185, 30, ['OFF', 'SLOW', 'FAST'], [-50, 0, 50], () => S.sw.wiper_l || 0, v => S.sw.wiper_l = v, '', { tip: () => `Captain's wiper: ${['OFF', 'SLOW', 'FAST'][S.sw.wiper_l || 0]}` });
  gpb(p, 'rain_l', 360, 1160, 'RAIN\nRPLNT', 'mom', false, {});
  selHot(p, 'wiper_r', 1700, 1080, 30, ['OFF', 'SLOW', 'FAST'], [-50, 0, 50], () => S.sw.wiper_r || 0, v => S.sw.wiper_r = v, '', { tip: () => `First officer's wiper: ${['OFF', 'SLOW', 'FAST'][S.sw.wiper_r || 0]}` });
  gpb(p, 'rain_r', 1900, 1060, 'RAIN\nRPLNT', 'mom', false, {});
  // ---- FIRE ----
  const fireBtn = (id, x, label, key) => {
    p.hot({ id, x, y: 50, w: 140, h: 64, cap: true, label: `${label.replace('\n', ' ')} push button (guarded): lights red with fire or during TEST`, get: () => [fireLit(key), !!S.guard[id]],
      click: () => { if (!S.guard[id]) { S.guard[id] = true; Audio2.toggle(); setTimeout(() => S.guard[id] = false, 5000); } else { toast('Fire handle pressed: no fire detected, nothing happens'); Audio2.click(); } },
      draw: (g, h) => { drawLight(g, h.x, h.y, h.w, h.h, label, ANN.red, fireLit(key), 15); drawGuard(g, h.x, h.y, h.w, h.h, !!S.guard[id], '#c8262b'); } });
    p.hot({ id: id + '_ag1', cap: () => false, x: x + 160, y: 50, w: 48, h: 44, label: 'AGENT 1', get: () => [fireLit(key)], draw: (g, h) => { drawPB(g, h.x, h.y, h.w, h.h, T('SQUIB', ANN.white, fireLit(key)), T('DISCH', ANN.amber, false)); legend(g, 'AGENT 1', h.x + 24, h.y + 58, 10); } });
    if (key !== 'apu') p.hot({ id: id + '_ag2', cap: () => false, x: x + 220, y: 50, w: 48, h: 44, label: 'AGENT 2', get: () => [fireLit(key)], draw: (g, h) => { drawPB(g, h.x, h.y, h.w, h.h, T('SQUIB', ANN.white, fireLit(key)), T('DISCH', ANN.amber, false)); legend(g, 'AGENT 2', h.x + 24, h.y + 58, 10); } });
    gpb(p, id + '_test', x + 46, 150, 'TEST', 'mom', false, { dur: 3, onClick: () => { S.fireTest[key] = S.time; }, tip: `${label.replace('\n', ' ')} TEST: checks the fire detection (lights, bell, ECAM)` });
  };
  fireBtn('fire_eng1', 600, 'ENG 1\nFIRE', 'eng1'); fireBtn('fire_apu', 920, 'APU\nFIRE', 'apu'); fireBtn('fire_eng2', 1180, 'ENG 2\nFIRE', 'eng2');
  // ---- HYD ----
  const hydLo = (sys) => () => engRunning() && hydState()[sys] === 0;
  gpb(p, 'hyd_eng1', 620, 280, 'ENG 1\nPUMP', 'off', true, { fault: () => S.elec.dc && !(S.eng[0].run && swGet('hyd_eng1')), abn: 'HYD G ENG 1 PUMP LO PR', when: () => S.eng[0].run });
  gpb(p, 'rat', 770, 280, 'RAT\nMAN ON', 'mom', false, { guard: '#c8262b', onClick: () => toast('RAT deployment simulated: no effect while the engines run') });
  gpb(p, 'hyd_blue', 920, 280, 'BLUE\nELEC PUMP', 'off', true, { fault: hydLo('b'), abn: 'HYD B ELEC PUMP LO PR', when: engRunning });
  gpb(p, 'ptu', 1070, 280, 'PTU', 'off', true, { abn: 'HYD PTU OFF', when: engRunning });
  gpb(p, 'hyd_eng2', 1220, 280, 'ENG 2\nPUMP', 'off', true, { fault: () => S.elec.dc && !(S.eng[1].run && swGet('hyd_eng2')), abn: 'HYD Y ENG 2 PUMP LO PR', when: () => S.eng[1].run });
  gpb(p, 'hyd_yelec', 1380, 280, 'YELLOW\nELEC PUMP', 'on', false, {});
  // ---- FUEL ----
  [['fuel_l1', 'L TK\nPUMP 1', 610], ['fuel_l2', 'L TK\nPUMP 2', 700], ['fuel_c1', 'CTR TK\nPUMP 1', 830], ['fuel_c2', 'CTR TK\nPUMP 2', 1030], ['fuel_r1', 'R TK\nPUMP 1', 1330], ['fuel_r2', 'R TK\nPUMP 2', 1420]].forEach(([id, l, x]) =>
    gpb(p, id, x, 480, l, 'off', true, { fault: () => engRunning() && !swGet(id), abn: 'FUEL ' + l.replace('\n', ' ') + ' OFF', when: engRunning }));
  gpb(p, 'fuel_mode', 930, 480, 'MODE SEL', 'on', false, { bot: 'MAN', box: false, tip: 'Fuel MODE SEL: AUTO (normal) / MAN' });
  gpb(p, 'xfeed', 1180, 480, 'X FEED', 'open', false, { bot: 'OPEN', tip: 'Fuel cross-feed valve' });
  // ---- ELEC ----
  addScreen(p, 610, 668, 108, 48, 2.5, (g, W, H) => scrVolt(g, W, H, S.elec.bat1), () => `${S.elec.dc}|${S.elec.bat1}`);
  addScreen(p, 760, 668, 108, 48, 2.5, (g, W, H) => scrVolt(g, W, H, S.elec.bat2), () => `${S.elec.dc}|${S.elec.bat2}`);
  pbHot(p, 'bat1', 640, 730, 'BAT 1', () => T('FAULT', ANN.amber, false), () => T('OFF', ANN.white, !S.elec.bat1 && (S.elec.bat2 || S.elec.ac)), () => { S.elec.bat1 = !S.elec.bat1; Audio2.click(); Tut.event('bat'); }, () => `BAT 1: ${S.elec.bat1 ? 'ON' : 'OFF'}`);
  pbHot(p, 'bat2', 790, 730, 'BAT 2', () => T('FAULT', ANN.amber, false), () => T('OFF', ANN.white, !S.elec.bat2 && (S.elec.bat1 || S.elec.ac)), () => { S.elec.bat2 = !S.elec.bat2; Audio2.click(); Tut.event('bat'); }, () => `BAT 2: ${S.elec.bat2 ? 'ON' : 'OFF'}`);
  gpb(p, 'bustie', 1040, 730, 'BUS TIE', 'off', true, { abn: 'ELEC BUS TIE OFF', when: () => S.elec.ac });
  gpb(p, 'acess', 1180, 730, '', 'off', true, { bot: 'ALTN', tip: 'AC ESS FEED' });
  gpb(p, 'galley', 1320, 730, 'GALLEY', 'off', true, {});
  gpb(p, 'gen1', 640, 830, 'GEN 1', 'off', true, { fault: () => S.elec.dc && !(S.eng[0].run && swGet('gen1')), abn: 'ELEC GEN 1 OFF', when: () => S.eng[0].run });
  gpb(p, 'idg1', 770, 830, 'IDG 1', 'mom', false, { guard: '#c8262b', onClick: () => toast('IDG disconnect is irreversible in flight: simulated as no effect') });
  gpb(p, 'apu_gen', 900, 830, 'APU GEN', 'off', true, { fault: () => S.elec.dc && S.apu.avail && !swGet('apu_gen') });
  pbHot(p, 'extpwr', 1180, 830, 'EXT PWR', () => T('AVAIL', ANN.green, false), () => T('ON', ANN.blue, false), () => { Audio2.click(); toast('No ground power at this stand: use the APU'); }, 'EXT PWR');
  gpb(p, 'idg2', 1310, 830, 'IDG 2', 'mom', false, { guard: '#c8262b', onClick: () => toast('IDG disconnect simulated as no effect') });
  gpb(p, 'gen2', 1440, 830, 'GEN 2', 'off', true, { fault: () => S.elec.dc && !(S.eng[1].run && swGet('gen2')), abn: 'ELEC GEN 2 OFF', when: () => S.eng[1].run });
  // ---- AIR COND ----
  gpb(p, 'pack1', 610, 950, 'PACK 1', 'off', true, { fault: () => false, abn: 'AIR PACK 1 OFF', when: () => !S.onGround });
  gpb(p, 'bleed1', 740, 950, 'ENG 1\nBLEED', 'off', true, { fault: () => S.elec.dc && S.eng[0].run && !swGet('bleed1'), abn: 'AIR ENG 1 BLEED OFF', when: () => S.eng[0].run });
  pbHot(p, 'apu_bleed', 900, 950, 'APU BLEED', () => T('FAULT', ANN.amber, false), () => T('ON', ANN.blue, S.apu.bleed, true), () => { S.apu.bleed = !S.apu.bleed; Audio2.click(); Tut.event('apu_bleed'); }, 'APU BLEED');
  selHot(p, 'xbleed', 1070, 975, 24, ['SHUT', 'AUTO', 'OPEN'], [-50, 0, 50], () => S.sw.xbleed ?? 1, v => S.sw.xbleed = v, 'X BLEED', { titleDy: 34 });
  gpb(p, 'bleed2', 1210, 950, 'ENG 2\nBLEED', 'off', true, { fault: () => S.elec.dc && S.eng[1].run && !swGet('bleed2'), abn: 'AIR ENG 2 BLEED OFF', when: () => S.eng[1].run });
  gpb(p, 'pack2', 1340, 950, 'PACK 2', 'off', true, { abn: 'AIR PACK 2 OFF', when: () => !S.onGround });
  selHot(p, 'packflow', 1480, 975, 24, ['LO', 'NORM', 'HI'], [-50, 0, 50], () => S.sw.packflow ?? 1, v => S.sw.packflow = v, 'PACK FLOW', { titleDy: 34 });
  // ---- ANTI ICE ----
  gpb(p, 'wai', 600, 1130, 'WING', 'on', false, { memo: 'WING A.ICE' });
  gpb(p, 'eai1', 720, 1130, 'ENG 1', 'on', false, { memo: 'ENG A.ICE' });
  gpb(p, 'eai2', 840, 1130, 'ENG 2', 'on', false, { memo: 'ENG A.ICE' });
  gpb(p, 'probe', 960, 1130, 'PROBE/\nWINDOW HEAT', 'on', false, { bot: 'ON' });
  // ---- CABIN PRESS ----
  gpb(p, 'press_mode', 1090, 1130, 'MODE SEL', 'on', false, { bot: 'MAN', box: false });
  knobHot(p, 'ldg_elev', 1260, 1160, 30, 'LDG ELEV', () => S.sw.ldgElev ? (S.sw.ldgElev > 0 ? '+' : '') + S.sw.ldgElev * 500 + ' ft' : 'AUTO', d => { S.sw.ldgElev = clamp((S.sw.ldgElev || 0) + Math.sign(d), -4, 20); });
  gpb(p, 'ditching', 1420, 1130, 'DITCHING', 'on', false, { guard: '#c8262b', abn: 'CAB PR DITCHING ON', when: () => true });
  // ---- FLT CTL ----
  [['elac1', 'ELAC 1', 1600, 60], ['sec1', 'SEC 1', 1700, 60], ['fac1', 'FAC 1', 1800, 60], ['elac2', 'ELAC 2', 1600, 165], ['sec2', 'SEC 2', 1700, 165], ['sec3', 'SEC 3', 1800, 165], ['fac2', 'FAC 2', 1900, 165]].forEach(([id, l, x, y]) =>
    gpb(p, id, x, y, l, 'off', true, { fault: () => false, abn: 'F/CTL ' + l + ' OFF', when: () => S.elec.ac }));
  // ---- CARGO / VENT ----
  gpb(p, 'cargo_test', 1600, 320, 'CARGO\nSMOKE TEST', 'mom', false, { dur: 3, topFn: () => T('SMOKE', ANN.red, S.time - (S.momT.cargo_test ?? -99) < 3), onClick: () => { Audio2.chime(); } });
  gpb(p, 'blower', 1760, 320, 'BLOWER', 'off', true, {});
  gpb(p, 'extract', 1880, 320, 'EXTRACT', 'off', true, {});
  gpb(p, 'cabfans', 1760, 400, 'CAB FANS', 'off', true, {});
  // ---- ENG ----
  gpb(p, 'manstart1', 1650, 530, 'ENG 1\nMAN START', 'on', false, {});
  gpb(p, 'manstart2', 1850, 530, 'ENG 2\nMAN START', 'on', false, {});
  // ---- EMER ELEC ----
  gpb(p, 'gen1line', 1600, 710, 'GEN 1\nLINE', 'off', true, { abn: 'ELEC GEN 1 LINE OFF', when: () => S.eng[0].run });
  p.hot({ id: 'ratgen', x: 1730, y: 710, w: 90, h: 44, label: 'RAT & EMER GEN fault light', get: () => [0], draw: (g, h) => { drawLight(g, h.x, h.y, h.w, h.h, 'RAT & EMER\nGEN FAULT', ANN.red, false, 10); } });
  gpb(p, 'emer_man', 1880, 710, 'EMER GEN\nTEST', 'mom', false, { guard: '#c8262b' });
  // ---- EXT LT ----
  togHot(p, 'strobe', 70, 1352, ['ON', 'AUTO', 'OFF'], () => 2 - S.lt.strobe, v => { S.lt.strobe = 2 - v; Tut.event('strobe'); }, 'STROBE');
  togHot(p, 'beacon', 200, 1352, ['ON', 'OFF'], () => S.lt.beacon ? 0 : 1, v => { S.lt.beacon = v === 0; Tut.event('beacon'); }, 'BEACON');
  togHot(p, 'wing', 330, 1352, ['ON', 'OFF'], () => S.lt.wing ? 0 : 1, v => { S.lt.wing = v === 0; }, 'WING');
  togHot(p, 'navlt', 460, 1352, ['1', '2', 'OFF'], () => S.lt.nav ? (S.sw.navpos || 0) : 2, v => { S.lt.nav = v !== 2; if (v !== 2) S.sw.navpos = v; Tut.event('nav'); }, 'NAV & LOGO');
  togHot(p, 'rwyto', 600, 1352, ['ON', 'OFF'], () => S.lt.rwyto ? 0 : 1, v => { S.lt.rwyto = v === 0; }, 'RWY TURN OFF');
  togHot(p, 'land', 760, 1352, ['ON', 'OFF', 'RETRACT'], () => S.lt.land ? 0 : 2, v => { S.lt.land = v === 0; Tut.event('land'); }, 'LAND');
  togHot(p, 'nose', 940, 1352, ['T.O', 'TAXI', 'OFF'], () => 2 - S.lt.nose, v => { S.lt.nose = 2 - v; Tut.event('nose'); }, 'NOSE');
  // ---- APU ----
  pbHot(p, 'apu_master', 1215, 1310, 'MASTER SW', () => T('FAULT', ANN.amber, false), () => T('ON', ANN.blue, S.apu.master, true), () => { S.apu.master = !S.apu.master; Audio2.click(); Tut.event('apu_master'); }, 'APU MASTER SW');
  pbHot(p, 'apu_start', 1360, 1310, 'START', () => T('AVAIL', ANN.green, S.apu.avail), () => T('ON', ANN.blue, S.apu.start, true), () => { if (S.apu.master && !S.apu.avail) { S.apu.start = true; Audio2.click(); Tut.event('apu_start'); } else if (!S.apu.master) toast('Switch the APU MASTER SW on first'); }, 'APU START');
  // ---- SIGNS ----
  togHot(p, 'belts', 1510, 1352, ['ON', 'OFF'], () => S.lt.belts ? 0 : 1, v => { const was = S.lt.belts; S.lt.belts = v === 0; if (S.lt.belts !== was) Audio2.ding(); Tut.event('belts'); }, 'SEAT BELTS');
  togHot(p, 'nosmoke', 1620, 1352, ['ON', 'AUTO', 'OFF'], () => S.lt.nosmoke ? 0 : 2, v => { const was = S.lt.nosmoke; S.lt.nosmoke = v !== 2; if (S.lt.nosmoke !== was) Audio2.ding(); }, 'NO SMOKING');
  togHot(p, 'emerexit', 1730, 1352, ['ON', 'ARM', 'OFF'], () => S.sw.emerexit ?? 1, v => { S.sw.emerexit = v; }, 'EMER EXIT LT');
  // ---- INT LT ----
  togHot(p, 'dome', 1840, 1352, ['BRT', 'DIM', 'OFF'], () => 2 - (S.sw.dome || 0), v => { S.sw.dome = 2 - v; }, 'DOME');
  togHot(p, 'annlt', 1950, 1352, ['TEST', 'BRT', 'DIM'], () => S.annTest ? 0 : S.sw.annDim ? 2 : 1, v => { S.annTest = v === 0; S.sw.annDim = v === 2; }, 'ANN LT');
}
function fireLit(key) { return S.elec.dc && S.time - (S.fireTest[key] ?? -99) < 3; }
function scrVolt(g, W, H, on) { lcdBg(g, W, H); if (S.elec.dc && on) { seg7(g, '25.6', W * 0.8, H * 0.2, H * 0.6); lcdLabel(g, 'V', W * 0.9, H * 0.68, H * 0.3); } else seg7(g, '    ', W * 0.8, H * 0.2, H * 0.6); lcdGlass(g, W, H); }
function hydState() {
  const g = S.eng[0].run && swGet('hyd_eng1'), y0 = (S.eng[1].run && swGet('hyd_eng2')) || (swGet('hyd_yelec') && S.elec.ac);
  const ptu = swGet('ptu') && (S.eng[0].run || S.eng[1].run);
  const G2 = g || (ptu && y0), Y2 = y0 || (ptu && g), B = engRunning() && swGet('hyd_blue');
  return { g: G2 ? 3000 : 0, y: Y2 ? 3000 : 0, b: B ? 3000 : 0, ptuRun: ptu && (g !== y0) };
}
function swAbnormals() {
  const out = [];
  for (const id in SWDEF) { const d = SWDEF[id]; if (!d.abn) continue; if (swGet(id) === d.def) continue; if (d.when && !d.when()) continue; out.push(d.abn); }
  return out;
}
function swMemos() { const out = new Set(); for (const id in SWDEF) { const d = SWDEF[id]; if (d.memo && swGet(id)) out.add(d.memo); } return [...out]; }

// ================= PEDESTAL =================
const SD_PAGES = ['ENG', 'BLEED', 'PRESS', 'ELEC', 'HYD', 'FUEL', 'APU', 'COND', 'DOOR', 'WHEEL', 'F/CTL'];
function buildPedestal(p) {
  const pxm = p.W / 0.44; const Y = (m) => m * pxm;
  buildStatic(p, g => {
    g.fillStyle = '#3e4a53'; g.fillRect(0, 0, p.W, p.H);
    subPanel(g, 0, 0, 1024, Y(0.17), 'ECAM');
    subPanel(g, 0, Y(0.17), 512, Y(0.15), 'RMP 1'); subPanel(g, 512, Y(0.17), 512, Y(0.15), 'ATC · TCAS');
    subPanel(g, 0, Y(0.32), 1024, Y(0.30), '');
    g.fillStyle = '#1b1f22'; for (const x of [410, 614]) g.fillRect(x - 22, Y(0.34), 44, Y(0.26));
    [['TO/GA', 0.36], ['FLX/MCT', 0.41], ['CL', 0.46], ['IDLE', 0.535], ['REV', 0.585]].forEach(([t, y]) => { legend(g, t, 512, Y(y), 16); g.strokeStyle = LEGEND; g.lineWidth = 2; g.beginPath(); g.moveTo(450, Y(y)); g.lineTo(470, Y(y)); g.moveTo(554, Y(y)); g.lineTo(574, Y(y)); g.stroke(); });
    legend(g, 'FLAPS', 900, Y(0.335), 15); ['0', '1', '2', '3', 'FULL'].forEach((t, i) => legend(g, t, 960, Y(0.36 + i * 0.05), 15));
    legend(g, 'SPEED BRAKE', 130, Y(0.335), 14); legend(g, 'RET', 60, Y(0.40), 13); legend(g, '1/2', 60, Y(0.48), 13); legend(g, 'FULL', 60, Y(0.56), 13);
    g.fillStyle = '#1b1f22'; g.fillRect(860, Y(0.35), 30, Y(0.23)); g.fillRect(110, Y(0.36), 30, Y(0.22));
    subPanel(g, 0, Y(0.62), 1024, Y(0.20), 'ENG');
    subPanel(g, 0, Y(0.82), 1024, Y(0.17), '');
    legend(g, 'ENG 1', 254, Y(0.643), 18); legend(g, 'MASTER', 254, Y(0.652) + 4, 11); legend(g, 'ENG 2', 770, Y(0.643), 18); legend(g, 'MASTER', 770, Y(0.652) + 4, 11);
    legend(g, 'PARK BRK', 760, Y(0.845), 15); legend(g, 'RUDDER TRIM', 260, Y(0.835), 13); legend(g, 'COCKPIT DOOR', 500, Y(0.845), 12);
    bezel(g, 40, Y(0.18) + 30, 190, 64); bezel(g, 282, Y(0.18) + 30, 190, 64); legend(g, 'ACTIVE', 135, Y(0.18) + 18, 11); legend(g, 'STBY/CRS', 377, Y(0.18) + 18, 11);
    bezel(g, 560, Y(0.18) + 30, 170, 64); bezel(g, 200, Y(0.86), 120, 50);
  });
  // ---- ECAM control panel ----
  const cols = [250, 340, 430, 520, 610, 700, 790];
  const ebtn = (id, x, y, label, lit, click, tip) => p.hot({ id, x: x - 38, y, w: 76, h: 40, cap: true, label: tip || label, get: () => [!!lit()], click: () => { click(); Audio2.click(); Tut.event(id); },
    draw: (g, h) => { const gr = g.createLinearGradient(0, h.y, 0, h.y + h.h); gr.addColorStop(0, '#2c3236'); gr.addColorStop(1, '#16191b'); g.fillStyle = gr; g.fillRect(h.x, h.y, h.w, h.h); g.strokeStyle = '#000'; g.strokeRect(h.x + .5, h.y + .5, h.w - 1, h.h - 1);
      const on = lit() && S.elec.dc; const f = `bold ${label.length > 6 ? 11 : 14}px Arial`;
      if (on) both(g, gg => { gg.font = f; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillStyle = gg === EG ? '#9aa4a8' : '#ffffff'; gg.shadowColor = '#fff'; gg.shadowBlur = gg === EG ? 3 : 0; label.split('\n').forEach((l, i, a) => gg.fillText(l, h.x + h.w / 2, h.y + h.h / 2 + (i - (a.length - 1) / 2) * 13)); gg.shadowBlur = 0; });
      else legendMulti(g, label, h.x + h.w / 2, h.y + h.h / 2, label.length > 6 ? 11 : 14, '#d6dbde'); } });
  const pageBtn = (pg, x, y) => ebtn('sd_' + pg, x, y, pg, () => S.sdPage === pg, () => { S.sdPage = S.sdPage === pg ? null : pg; }, `ECAM ${pg} page on the lower screen`);
  ebtn('emercanc', cols[0], 40, 'EMER\nCANC', () => false, () => { S.warn.silenced = true; S.warn.ack = [...(S.warn.cautions || [])]; }, 'EMER CANC: cancel the current warning or caution');
  ['ENG', 'BLEED', 'PRESS', 'ELEC', 'HYD', 'FUEL'].forEach((pg, i) => pageBtn(pg, cols[i + 1], 40));
  pbHot(p, 'toconfig', cols[0] - 24, 135, 'T.O CONFIG', () => null, () => ({ t: 'TEST', c: ANN.white, on: S.time - (S.toTestT ?? -99) < 1 }), () => {
    Audio2.click(); S.toTestT = S.time; S.toConfigTested = true;
    const faults = takeoffConfigFaults();
    if (!faults.length) toast('T.O CONFIG NORMAL');
    else { Audio2.chime(); toast('CONFIG: ' + faults.join(', '), 5000); }
  }, 'T.O CONFIG: test flaps, spoilers, autobrake, rudder trim and gear');
  ['APU', 'COND', 'DOOR', 'WHEEL', 'F/CTL'].forEach((pg, i) => pageBtn(pg, cols[i + 1], 135));
  ebtn('sd_all', cols[6], 135, 'ALL', () => false, () => { const i = SD_PAGES.indexOf(S.sdPage); S.sdPage = SD_PAGES[(i + 1) % SD_PAGES.length]; }, 'ALL: step through every system page');
  ebtn('clr_l', cols[0], 240, 'CLR', () => S.warn.caution, () => { S.warn.ack = [...(S.warn.cautions || [])]; S.sdPage = null; }, 'CLR: clear the ECAM message');
  ebtn('sts', cols[2], 240, 'STS', () => S.sdPage === 'STS', () => { S.sdPage = S.sdPage === 'STS' ? null : 'STS'; }, 'STS: status page');
  ebtn('rcl', cols[4], 240, 'RCL', () => false, () => { S.warn.ack = []; }, 'RCL: recall cleared messages');
  ebtn('clr_r', cols[6], 240, 'CLR', () => S.warn.caution, () => { S.warn.ack = [...(S.warn.cautions || [])]; S.sdPage = null; }, 'CLR: clear the ECAM message');
  knobHot(p, 'ewd_brt', 100, 110, 34, 'Upper ECAM brightness', () => Math.round(S.duBrt.ewd * 100) + ' %', d => { S.duBrt.ewd = clamp(S.duBrt.ewd + d * 0.05, 0, 1); });
  knobHot(p, 'sd_brt', 924, 110, 34, 'Lower ECAM brightness', () => Math.round(S.duBrt.sd * 100) + ' %', d => { S.duBrt.sd = clamp(S.duBrt.sd + d * 0.05, 0, 1); });
  p.hot({ id: 'ecamlbl', x: 60, y: 160, w: 80, h: 30, label: 'UPPER DISPLAY', get: () => [0], draw: (g) => { legend(g, 'UPPER', 100, 166, 11); legend(g, 'DISPLAY', 100, 180, 11); legend(g, 'LOWER', 924, 166, 11); legend(g, 'DISPLAY', 924, 180, 11); } });
  // ---- RMP 1 ----
  const ry = Y(0.18) + 30;
  addScreen(p, 40, ry, 190, 64, 2.4, (g, W, H) => scrFreq(g, W, H, S.rmp.act), () => `${S.elec.dc}|${S.rmp.act}`);
  addScreen(p, 282, ry, 190, 64, 2.4, (g, W, H) => scrFreq(g, W, H, S.rmp.stby), () => `${S.elec.dc}|${S.rmp.stby}`);
  p.hot({ id: 'rmp_xfer', cap: true, x: 236, y: ry + 12, w: 40, h: 40, label: 'Transfer: swap ACTIVE and STANDBY frequencies', get: () => [0], click: () => { const t = S.rmp.act; S.rmp.act = S.rmp.stby; S.rmp.stby = t; Audio2.click(); },
    draw: (g, h) => { drawPB(g, h.x, h.y, h.w, h.h, null, null); g.strokeStyle = LEGEND; g.lineWidth = 2; g.beginPath(); g.moveTo(h.x + 8, h.y + 14); g.lineTo(h.x + 32, h.y + 14); g.lineTo(h.x + 26, h.y + 8); g.moveTo(h.x + 32, h.y + 26); g.lineTo(h.x + 8, h.y + 26); g.lineTo(h.x + 14, h.y + 32); g.stroke(); } });
  knobHot(p, 'rmp_knob', 377, ry + 135, 36, 'RMP tuning knob (standby)', () => (S.rmp.stby / 1000).toFixed(3) + ' MHz', d => { const step = Math.abs(d) >= 10 ? 1000 : 25; let v = S.rmp.stby + Math.sign(d) * step; if (v > 136975) v = 118000; if (v < 118000) v = 136975; S.rmp.stby = v; });
  ['VHF1', 'VHF2', 'VHF3'].forEach((n, i) => p.hot({ id: 'rmp_' + n, cap: () => S.rmp.sel === i, x: 50 + i * 62, y: ry + 110, w: 52, h: 40, label: n + ' selection', get: () => [S.rmp.sel === i], click: () => { S.rmp.sel = i; Audio2.click(); },
    draw: (g, h) => { drawPB(g, h.x, h.y, h.w, h.h, null, { t: n, c: ANN.green, on: S.rmp.sel === i }); } }));
  // ---- ATC transponder / TCAS ----
  addScreen(p, 560, ry, 170, 64, 2.4, (g, W, H) => { lcdBg(g, W, H); if (S.elec.dc) { lcdLabel(g, 'ATC', W * 0.12, H * 0.25, H * 0.2); seg7(g, (S.xpdr.entry || S.xpdr.code).padEnd(4, ' '), W * 0.92, H * 0.2, H * 0.62); } lcdGlass(g, W, H); }, () => `${S.elec.dc}|${S.xpdr.code}|${S.xpdr.entry}`);
  const keys = ['1', '2', '3', '4', '5', '6', '7', '0', 'CLR'];
  keys.forEach((k, i) => p.hot({ id: 'xpdr_' + k, cap: true, x: 770 + (i % 3) * 74, y: ry - 6 + Math.floor(i / 3) * 52, w: 64, h: 42, label: 'Transponder key ' + k, get: () => [0],
    click: () => { Audio2.click(); if (k === 'CLR') { S.xpdr.entry = ''; return; } S.xpdr.entry = (S.xpdr.entry || '') + k; if (S.xpdr.entry.length === 4) { S.xpdr.code = S.xpdr.entry; S.xpdr.entry = ''; Tut.event('xpdr_code'); } },
    draw: (g, h) => { const gr = g.createLinearGradient(0, h.y, 0, h.y + h.h); gr.addColorStop(0, '#2c3236'); gr.addColorStop(1, '#16191b'); g.fillStyle = gr; g.fillRect(h.x, h.y, h.w, h.h); g.strokeStyle = '#000'; g.strokeRect(h.x, h.y, h.w, h.h); legend(g, k, h.x + h.w / 2, h.y + h.h / 2, k.length > 1 ? 12 : 17); } }));
  selHot(p, 'xpdr_mode', 600, ry + 165, 26, ['STBY', 'AUTO', 'ON'], [-50, 0, 50], () => S.xpdr.mode, v => { S.xpdr.mode = v; }, 'XPDR', { titleDy: 30 });
  selHot(p, 'tcas', 720, ry + 165, 26, ['STBY', 'TA', 'TA/RA'], [-50, 0, 50], () => S.xpdr.tcas, v => { S.xpdr.tcas = v; Tut.event('tcas'); }, 'TCAS', { titleDy: 30 });
  // ---- engine masters & mode ----
  // Each master is a large lever in a slot: ON is forward (top of the panel), OFF is aft. FIRE and FAULT lights sit beside it.
  const yTop = Y(0.66), yBot = Y(0.80), slotH = yBot - yTop;
  for (let i = 0; i < 2; i++) {
    const x = i ? 770 : 254, side = i ? -1 : 1;   // lights on the inboard side of each slot
    const lx = x + side * 100;
    p.hot({ id: 'eng' + (i + 1), x: x - 58, y: yTop - 8, w: 116, h: slotH + 16, label: () => `ENG ${i + 1} MASTER switch: ${S.eng[i].master ? 'ON' : 'OFF'} · click to switch ${S.eng[i].master ? 'OFF' : 'ON'} (Ctrl+${i + 1})`,
      get: () => [S.eng[i].master],
      click: () => { S.eng[i].master = !S.eng[i].master; Audio2.toggle(); Tut.event('eng' + (i + 1)); },
      draw: (g, h) => {
        g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x - 22, yTop + 4, 48, slotH); g.fillStyle = '#0e1012'; g.fillRect(x - 24, yTop, 48, slotH);
        g.strokeStyle = '#596269'; g.lineWidth = 2; g.strokeRect(x - 24, yTop, 48, slotH);
        legend(g, 'ON', x - side * 62, yTop + 22, 20); legend(g, 'OFF', x - side * 62, yBot - 22, 20);
        g.strokeStyle = LEGEND; g.lineWidth = 2; g.beginPath(); g.moveTo(x - side * 30, yTop + 22); g.lineTo(x - side * 40, yTop + 22); g.moveTo(x - side * 30, yBot - 22); g.lineTo(x - side * 40, yBot - 22); g.stroke();
      },
      init3d: () => {
        const M = m3(), [sx] = sxy(p); const g3 = new THREE.Group();
        const neck = new THREE.Mesh(new THREE.BoxGeometry(18 * sx, 18 * sx, 40 * sx), M.knob); neck.position.z = 20 * sx; g3.add(neck);
        const hdl = new THREE.Mesh(new THREE.BoxGeometry(84 * sx, 54 * sx, 30 * sx), M.metal); hdl.position.z = 50 * sx; g3.add(hdl);
        const grip = new THREE.Mesh(new THREE.BoxGeometry(88 * sx, 12 * sx, 34 * sx), M.nut); grip.position.set(0, 22 * sx, 52 * sx); g3.add(grip);
        const idx = new THREE.Mesh(new THREE.BoxGeometry(60 * sx, 5 * sx, 2 * sx), M.white); idx.position.set(0, 0, 65.5 * sx); g3.add(idx);
        mount(p, x, yTop, g3); const yOn = p.local(0, yTop + 34).y, yOff = p.local(0, yBot - 34).y; let yy = S.eng[i].master ? yOn : yOff;
        CK.anim3d.push(() => { yy = lerp(yy, S.eng[i].master ? yOn : yOff, 0.35); g3.position.y = yy; });
      } });
    p.hot({ id: 'eng' + (i + 1) + '_lt', x: lx - 50, y: yTop + 10, w: 100, h: 104, label: `ENG ${i + 1} FIRE and FAULT lights (FAULT = start problem)`, cap: () => false, get: () => [fireLit('eng' + (i + 1)), !!S.eng[i].startFail],
      draw: (g, h) => { drawLight(g, h.x, h.y, h.w, 48, 'FIRE', ANN.red, fireLit('eng' + (i + 1)), 18); drawLight(g, h.x, h.y + 56, h.w, 48, 'FAULT', ANN.amber, !!S.eng[i].startFail, 18); } });
  }
  selHot(p, 'engmode', 512, Y(0.725), 40, ['CRANK', 'NORM', 'IGN START'], [-60, 0, 60], () => S.engMode, v => { S.engMode = v; Tut.event('engmode'); }, 'ENG MODE', { fs: 15, titleDy: 44, tip: () => `ENG MODE selector: ${['CRANK', 'NORM', 'IGN START'][S.engMode]} · click = clockwise, right-click = back` });
  // ---- aft: park brake, rudder trim, door ----
  p.hot({ id: 'parkbrk', x: 700, y: Y(0.87), w: 120, h: Y(0.1), label: () => `PARKING BRAKE: ${S.parkBrake ? 'ON' : 'OFF'} (Shift+B)`, get: () => [S.parkBrake], click: () => { S.parkBrake = !S.parkBrake; Audio2.toggle(); Tut.event('parkbrk'); },
    draw: (g, h) => { legend(g, 'OFF', h.x + 6, h.y + 18, 12); legend(g, 'ON', h.x + 114, h.y + 18, 12); drawRecess(g, h.x + 60, h.y + h.h / 2 + 10, 22); },
    init3d: () => { const M = m3(), [sx] = sxy(p); const g3 = new THREE.Group(); const hub = new THREE.Mesh(new THREE.CylinderGeometry(20 * sx, 22 * sx, 14 * sx, 24), M.knob); hub.rotation.x = Math.PI / 2; hub.position.z = 7 * sx; g3.add(hub);
      const hdl = new THREE.Mesh(new THREE.BoxGeometry(24 * sx, 62 * sx, 22 * sx), M.red); hdl.position.set(0, 26 * sx, 16 * sx); g3.add(hdl);
      mount(p, 760, Y(0.87) + Y(0.1) / 2 + 10, g3); let a = S.parkBrake ? -0.9 : 0.9; CK.anim3d.push(() => { a = lerp(a, S.parkBrake ? -0.9 : 0.9, 0.3); g3.rotation.z = a; }); } });
  addScreen(p, 200, Y(0.86), 120, 50, 2.4, (g, W, H) => { lcdBg(g, W, H); if (S.elec.ac) { const v = S.rudTrim; seg7(g, (v < -0.05 ? 'L' : v > 0.05 ? 'R' : ' ') + Math.abs(v).toFixed(1), W * 0.92, H * 0.18, H * 0.64); } lcdGlass(g, W, H); }, () => `${S.elec.ac}|${S.rudTrim.toFixed(1)}`);
  knobHot(p, 'rudtrim', 200, Y(0.94), 30, 'RUDDER TRIM', () => (S.rudTrim < 0 ? 'L ' : 'R ') + Math.abs(S.rudTrim).toFixed(1) + '°', d => { S.rudTrim = clamp(+(S.rudTrim + Math.sign(d) * 0.1).toFixed(1), -20, 20); });
  p.hot({ id: 'rudreset', cap: true, x: 290, y: Y(0.925), w: 60, h: 40, label: 'RUDDER TRIM RESET', get: () => [0], click: () => { S.rudTrim = 0; Audio2.click(); }, draw: (g, h) => drawPB(g, h.x, h.y, h.w, h.h, null, { t: 'RESET', c: ANN.white, on: false }) });
  togHot(p, 'door', 500, Y(0.92), ['UNLOCK', 'NORM', 'LOCK'], () => S.sw.door ?? 1, v => { S.sw.door = v; }, '', { tip: () => `COCKPIT DOOR: ${['UNLOCK', 'NORM', 'LOCK'][S.sw.door ?? 1]}` });
}
function scrFreq(g, W, H, khz) { lcdBg(g, W, H); if (S.elec.dc) seg7(g, (khz / 1000).toFixed(3), W * 0.94, H * 0.18, H * 0.64); lcdGlass(g, W, H); }
function buildLevers(ped) {
  const scene = CK.scene; const pedM = ped.mesh;
  const handleM = new THREE.MeshStandardMaterial({ color: 0x1d2124, roughness: 0.45, metalness: 0.2 });
  const armM = new THREE.MeshStandardMaterial({ color: 0x9aa2a8, roughness: 0.35, metalness: 0.7 });
  const onPed = (px, ym) => pedM.localToWorld(new THREE.Vector3((px / 1024 - 0.5) * 0.44, (0.5 - ym / 0.99) * 0.99, 0));
  CK.tl3d = [];
  for (let i = 0; i < 2; i++) {
    const g = new THREE.Group(); g.position.copy(onPed(i ? 614 : 410, 0.50)).add(new THREE.Vector3(0, -0.02, 0));
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.16, 0.014), armM); arm.position.y = 0.08; g.add(arm);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.085, 16), handleM); h.rotation.z = Math.PI / 2; h.position.set(i ? 0.022 : -0.022, 0.168, -0.004); g.add(h);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 12), new THREE.MeshStandardMaterial({ color: 0xc41a1a, roughness: .5 })); disc.rotation.z = Math.PI / 2; disc.position.set(i ? 0.071 : -0.071, 0.168, -0.004); g.add(disc);
    const trig = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.02), new THREE.MeshStandardMaterial({ color: 0xc8c8c8 })); trig.position.set(i ? 0.022 : -0.022, 0.138, -0.028); g.add(trig);
    [arm, h, disc, trig].forEach(m => { m.userData.lever = 'tl'; m.castShadow = true; });
    scene.add(g); CK.tl3d.push(g);
  }
  const fl = new THREE.Group(); fl.position.copy(onPed(875, 0.47));
  const fa = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.11, 0.012), armM); fa.position.y = 0.055; fl.add(fa);
  const fh = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.03, 0.045), new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: .5 })); fh.position.y = 0.118; fl.add(fh);
  const fh2 = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.012, 0.05), new THREE.MeshStandardMaterial({ color: 0xbfbfbf, roughness: .5 })); fh2.position.y = 0.137; fl.add(fh2);
  [fa, fh, fh2].forEach(m => m.userData.lever = 'flaps'); scene.add(fl); CK.flapLever3d = fl;
  const sb = new THREE.Group(); sb.position.copy(onPed(125, 0.47));
  const sa = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.1, 0.012), armM); sa.position.y = 0.05; sb.add(sa);
  const shh = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.022, 0.035), handleM); shh.position.y = 0.105; sb.add(shh);
  [sa, shh].forEach(m => m.userData.lever = 'sb'); scene.add(sb); CK.sb3d = sb; CK.sb3d.userData.y0 = sb.position.y;
}
function leverAngle(v) {
  if (v <= DET.REVIDLE) return lerp(-24, -15, (v - DET.REVMAX) / (DET.REVIDLE - DET.REVMAX));
  if (v <= 0) return lerp(-15, -10, (v - DET.REVIDLE) / (0 - DET.REVIDLE));
  if (v <= DET.CL) return lerp(-10, 8, v / DET.CL);
  if (v <= DET.FLX) return lerp(8, 18, (v - DET.CL) / (DET.FLX - DET.CL));
  return lerp(18, 28, (v - DET.FLX) / (DET.TOGA - DET.FLX));
}
function updateLevers3d() {
  CK.tl3d.forEach((g, i) => { g.rotation.x = -leverAngle(S.tl[i]) * D2R; });
  if (CK.flapLever3d) CK.flapLever3d.rotation.x = -lerp(-20, 22, S.flapLever / 4) * D2R;
  if (CK.sb3d) { CK.sb3d.rotation.x = lerp(20, -18, S.sbLever) * D2R; CK.sb3d.position.y = CK.sb3d.userData.y0 + (S.sbArmed ? 0.015 : 0); }
  for (const st of [CK.stick, CK.stick2]) if (st) { st.rotation.x = -S.stickP * 0.28; st.rotation.z = -S.stickR * 0.28; }
  const hl = CK.highlightId; const glow = (id) => hl === id && Math.sin(performance.now() / 160) > 0;
  CK.tl3d.forEach(g => g.children[1].material.emissive.setHex(glow('thrust') ? 0x806000 : 0));
  if (CK.flapLever3d) CK.flapLever3d.children[1].material.emissive.setHex(glow('flaps') ? 0x806000 : 0);
  if (CK.sb3d) CK.sb3d.children[1].material.emissive.setHex(glow('spoilers') ? 0x806000 : 0);
}

// ================= MCDU keyboard =================
function buildMCDU(p) {
  const keys = [];
  buildStatic(p, g => { g.fillStyle = '#4a565f'; g.fillRect(0, 0, p.W, p.H); g.fillStyle = grainPattern(g); g.fillRect(0, 0, p.W, p.H); g.strokeStyle = '#222'; g.lineWidth = 6; g.strokeRect(3, 3, p.W - 6, p.H - 6); g.fillStyle = '#050505'; g.fillRect(56, 18, 400, 230); legend(g, 'BRT', 480, 300, 10); legend(g, 'FAIL  FMGC  MCDU MENU', 256, 258, 9, '#9aa'); });
  for (let i = 0; i < 6; i++) { keys.push(['L' + (i + 1), 10, 38 + i * 34, 38, 22, '—']); keys.push(['R' + (i + 1), 464, 38 + i * 34, 38, 22, '—']); }
  const pages = [['DIR', 'PROG', 'PERF', 'INIT', 'DATA', ''], ['F-PLN', 'RAD NAV', 'FUEL PRED', 'SEC F-PLN', 'ATC COMM', 'MENU']];
  pages.forEach((row, r) => row.forEach((t, c) => { if (t) keys.push([t, 30 + c * 78, 270 + r * 46, 70, 36, t]); }));
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; for (let i = 0; i < 26; i++) keys.push([alpha[i], 200 + (i % 5) * 58, 380 + Math.floor(i / 5) * 54, 50, 42, alpha[i]]);
  for (let i = 0; i < 9; i++) keys.push([String(i + 1), 24 + (i % 3) * 56, 420 + Math.floor(i / 3) * 54, 48, 42, String(i + 1)]);
  keys.push(['.', 24, 582, 48, 42, '.']); keys.push(['0', 80, 582, 48, 42, '0']); keys.push(['/', 430, 650, 60, 42, '/']); keys.push(['CLR', 430, 704, 60, 42, 'CLR']);
  keys.forEach(([id, x, y, w, h, l]) => p.hot({ id: 'mcdu_' + id, x, y, w, h, cap: true, capDepth: 0.004, label: 'MCDU ' + id, click: () => mcduKey(id),
    draw: (g, hh) => { g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(hh.x + 2, hh.y + 3, hh.w, hh.h); const gr = g.createLinearGradient(0, hh.y, 0, hh.y + hh.h); gr.addColorStop(0, '#2e3438'); gr.addColorStop(1, '#16191b'); g.fillStyle = gr; g.fillRect(hh.x, hh.y, hh.w, hh.h); g.strokeStyle = '#000'; g.strokeRect(hh.x + .5, hh.y + .5, hh.w - 1, hh.h - 1); legend(g, l, hh.x + hh.w / 2, hh.y + hh.h / 2 + 1, l.length > 4 ? 10 : 15, '#f0f0f0'); } }));
}

// ================= interaction & per-frame update =================
const _ray = new THREE.Raycaster(); const _mv = new THREE.Vector2();
function pickCockpit(ndcX, ndcY) {
  _mv.set(ndcX, ndcY); _ray.setFromCamera(_mv, CK.cam);
  const objs = CK.panels.map(p => p.mesh).concat(CK.tl3d.flatMap(g => g.children), CK.flapLever3d ? CK.flapLever3d.children : [], CK.sb3d ? CK.sb3d.children : []);
  const hits = _ray.intersectObjects(objs, false);
  for (const h of hits) {
    if (h.object.userData.lever) { const l = h.object.userData.lever; return { lever: l === 'tl' ? 'thrust' : l, point: h.point }; }
    const p = h.object.userData.panel; if (!p || !h.uv) continue;
    const px = h.uv.x * p.W, py = (1 - h.uv.y) * p.H;
    for (const hs of p.hots) if ((hs.click || hs.wheel) && px >= hs.x && px <= hs.x + hs.w && py >= hs.y && py <= hs.y + hs.h) return { hot: hs, u: (px - hs.x) / hs.w, v: (py - hs.y) / hs.h };
    for (const hs of p.hots) if (px >= hs.x && px <= hs.x + hs.w && py >= hs.y && py <= hs.y + hs.h) return { hot: hs, u: 0, v: 0, info: true };
    return { panel: p };
  }
  return null;
}
function hotById(id) { return CK.hots.find(h => h.id === id); }
function hotWorldPos(id) {
  if (id === 'thrust') return CK.tl3d[0].localToWorld(new THREE.Vector3(0.05, 0.15, 0));
  if (id === 'flaps') return CK.flapLever3d.localToWorld(new THREE.Vector3(0, 0.1, 0));
  if (id === 'spoilers') return CK.sb3d.localToWorld(new THREE.Vector3(0, 0.1, 0));
  if (id === 'sidestick') return CK.stick.localToWorld(new THREE.Vector3(0, 0.1, 0));
  const h = hotById(id); return h ? h.panel.worldPos(h) : null;
}
function updateCockpitLighting(sunWorld, aircraftQ) {
  const s = sunWorld.clone().applyQuaternion(aircraftQ.clone().invert());
  CK.sunLight.position.copy(s.clone().multiplyScalar(4).add(new THREE.Vector3(0.5, -0.3, -0.3)));
  CK.sunLight.intensity = 1.5 * smooth(-0.1, 0.15, sunWorld.y);
  CK.dome.intensity = [0.1, 0.4, 0.8][S.sw.dome || 0];
  CK.floorLt.intensity = [0, 0.25, 0.6][S.sw.floor || 0];
}
function updateCockpit(dt) {
  for (const f of CK.anim3d) f();
  // wipers: slow ~40 strokes/min, fast ~70
  const wl = [S.sw.wiper_l || 0, S.sw.wiper_r || 0];
  CK.wipers.forEach((w, i) => {
    const sp = [0, 0.7, 1.2][wl[i]] * Math.PI * 2 / 2;
    if (wl[i]) w.ph += dt * sp; else if (w.ph % (Math.PI * 2) > 0.02) w.ph += dt * Math.PI; // park
    const prev = w._a || 0; const a = (1 - Math.cos(w.ph)) / 2; w._a = a;
    if (wl[i] && ((prev < 0.98 && a >= 0.98) || (prev > 0.02 && a <= 0.02))) Audio2.wiper();
    w.piv.rotation.z = w.dir * a * 1.45;
  });
  const em = S.sw.annDim ? 0.5 : 1; for (const p of CK.panels) p.mat.emissiveIntensity = em;
  const b = S.duBrt; const set = (n, v) => { const m = CK.du[n]; if (m) m.material.color.setScalar(clamp(v, 0, 1)); };
  set('pfd', b.pfd); set('pfd2', b.pfd); set('nd', b.nd); set('nd2', b.nd); set('ewd', b.ewd); set('sd', b.sd);
  if (S.chrono.run) S.chrono.t += dt; if (S.et.run) S.et.t += dt;
}
