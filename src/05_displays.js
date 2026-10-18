// ---------- Glass cockpit displays (canvas) ----------
const DU = {};
const C = { green: '#3df23d', cyan: '#2fd6ff', mag: '#ff4dff', amber: '#ffa21a', red: '#ff2b2b', white: '#f4f4f4', yellow: '#ffef2a', grey: '#9a9a9a', sky: '#1f8fd6', earth: '#8b4c1f' };
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function du(name, w, h) { const c = mkCanvas(w, h); const t = new THREE.CanvasTexture(c); t.anisotropy = 8; t.minFilter = THREE.LinearMipmapLinearFilter; DU[name] = { c, g: c.getContext('2d'), tex: t, boot: 0 }; return DU[name]; }
const FONT = '"B612 Mono", "Consolas", "Menlo", monospace';
function txt(g, s, x, y, col, size, align = 'center', base = 'middle') { g.fillStyle = col; g.font = `${size}px ${FONT}`; g.textAlign = align; g.textBaseline = base; g.fillText(s, x, y); }
function line(g, x0, y0, x1, y1, col, w = 2) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
function boxt(g, s, x, y, col, size) { g.font = `${size}px ${FONT}`; const w = g.measureText(s).width + 8; g.strokeStyle = col; g.lineWidth = 2; g.strokeRect(x - w / 2, y - size / 2 - 3, w, size + 6); txt(g, s, x, y, col, size); }

function bootScreen(d, label) {
  const g = d.g, W = d.c.width, H = d.c.height; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  if (d.boot < 1.2) { // self-test pattern
    const k = Math.floor(d.boot * 6) % 3; const cols = ['#202060', '#205020', '#502020'];
    g.fillStyle = cols[k]; g.fillRect(0, 0, W, H); txt(g, 'SELF TEST IN PROGRESS', W / 2, H / 2, C.green, 18); txt(g, '(MAX 40 SECONDS)', W / 2, H / 2 + 26, C.green, 14);
    return true;
  }
  return false;
}
function displayPowered(d, dt) {
  if (!S.elec.ac) { d.boot = 0; const g = d.g; g.fillStyle = '#000'; g.fillRect(0, 0, d.c.width, d.c.height); return false; }
  d.boot += dt; if (bootScreen(d)) return false; return true;
}

// ================= PFD =================
function drawPFD(d, dt) {
  const g = d.g, W = 512, H = 512;
  if (!displayPowered(d, dt)) { d.tex.needsUpdate = true; return; }
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const cx = 236, cy = 238; const ppd = 6.2; // px per deg pitch
  const aligned = S.aligned;
  // ----- attitude -----
  g.save(); g.beginPath(); g.rect(130, 72, 212, 300); g.clip();
  if (aligned) {
    g.translate(cx, cy); g.rotate(S.phi); const pt = S.theta * R2D * ppd; g.translate(0, pt);
    g.fillStyle = '#2b8fd8'; g.fillRect(-400, -800, 800, 800); g.fillStyle = '#7d4519'; g.fillRect(-400, 0, 800, 800);
    line(g, -400, 0, 400, 0, C.white, 2);
    // pitch ladder
    for (let p = -30; p <= 30; p += 2.5) {
      if (p === 0) continue; const y = -p * ppd; const major = p % 10 === 0, mid = p % 5 === 0;
      const w = major ? 46 : mid ? 26 : 10; line(g, -w, y, w, y, C.white, 2);
      if (major) { txt(g, Math.abs(p).toString(), -w - 16, y, C.white, 15); txt(g, Math.abs(p).toString(), w + 16, y, C.white, 15); }
    }
    // heading marks on horizon
    g.restore(); g.save(); g.beginPath(); g.rect(130, 72, 212, 300); g.clip();
  } else { g.fillStyle = '#000'; g.fillRect(130, 72, 212, 300); }
  g.restore();
  if (!aligned) { boxt(g, 'ATT', cx, cy, C.red, 26); }
  else {
    // roll scale
    g.save(); g.translate(cx, cy); g.strokeStyle = C.white; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 128, (-90 - 45) * D2R, (-90 + 45) * D2R); g.stroke();
    for (const a of [-45, -30, -20, -10, 0, 10, 20, 30, 45]) { g.save(); g.rotate(a * D2R); line(g, 0, -128, 0, a % 30 === 0 || a === 0 ? -142 : -136, C.white, 2); g.restore(); }
    for (const a of [-67, 67]) { g.save(); g.rotate(a * D2R); if (S.altLaw) { txt(g, 'x', 0, -134, C.amber, 18); } else { line(g, -4, -136, 4, -136, C.green, 2); line(g, -4, -132, 4, -132, C.green, 2); } g.restore(); }
    // bank pointer
    g.save(); g.rotate(S.phi); g.fillStyle = C.yellow; g.beginPath(); g.moveTo(0, -127); g.lineTo(-9, -113); g.lineTo(9, -113); g.closePath(); g.fill();
    // sideslip trapezoid
    g.fillRect(-9, -110, 18, 4); g.restore();
    // fixed aircraft symbol
    g.fillStyle = '#000'; g.strokeStyle = C.yellow; g.lineWidth = 3;
    const wing = (s) => { g.beginPath(); g.moveTo(s * 95, -3); g.lineTo(s * 45, -3); g.lineTo(s * 45, 14); g.lineTo(s * 37, 14); g.lineTo(s * 37, 4); g.lineTo(s * 95, 4); g.closePath(); g.fill(); g.stroke(); };
    wing(1); wing(-1); g.fillRect(-4, -4, 8, 8); g.strokeRect(-4, -4, 8, 8);
    // flight director bars
    if (S.fcu.fd && (S.ap.vert || S.ap.lat) && S.elec.ac) {
      const fx = clamp(S.fd.roll * 9, -70, 70), fy = clamp(-S.fd.pitch * ppd, -70, 70);
      line(g, fx, -70, fx, 70, C.green, 3); line(g, -70, fy, 70, fy, C.green, 3);
    }
    g.restore();
    // radio altitude
    if (S.ra < 2500) { const ra = S.ra < 10 ? Math.round(S.ra) : S.ra < 50 ? Math.round(S.ra / 5) * 5 : Math.round(S.ra / 10) * 10; txt(g, String(Math.max(0, ra)), cx, 355, S.ra < 200 && !S.onGround ? C.amber : C.green, 24); }
    // ILS deviation
    const ilsShow = S.loc.valid && (S.fms.phase === 'APPROACH' || S.efisLS);
    if (ilsShow) {
      const lx = clamp(S.loc.dev / 0.8 * 30, -64, 64); const gy = clamp(S.gs_.dev / 0.35 * 30, -64, 64);
      for (let k = -2; k <= 2; k++) { if (k) { g.strokeStyle = C.white; g.lineWidth = 2; g.beginPath(); g.arc(cx + k * 30, 392, 4, 0, 7); g.stroke(); g.beginPath(); g.arc(358, cy + k * 30, 4, 0, 7); g.stroke(); } }
      line(g, cx, 384, cx, 400, C.yellow, 3); line(g, 350, cy, 366, cy, C.yellow, 3);
      const dia = (x, y) => { g.strokeStyle = C.mag; g.fillStyle = C.mag; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x, y - 7); g.lineTo(x + 10, y); g.lineTo(x, y + 7); g.closePath(); g.fill(); };
      dia(cx + lx, 392); if (S.gs_.valid) { g.save(); g.translate(358, cy + gy); g.rotate(Math.PI / 2); dia(0, 0); g.restore(); }
      txt(g, 'GLE', 132, 410, C.mag, 14, 'left'); txt(g, '110.10', 132, 426, C.mag, 14, 'left'); txt(g, (S.loc.dist / NM).toFixed(1) + 'NM', 132, 442, C.mag, 14, 'left');
    }
  }
  // ----- speed tape -----
  const sx0 = 40, sx1 = 108, sy0 = 72, sy1 = 404, spy = 4.2; // px per kt
  g.fillStyle = '#3c3c3c'; g.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
  const ias = Math.max(30, S.ias); const sp = speeds();
  g.save(); g.beginPath(); g.rect(sx0, sy0, sx1 - sx0 + 30, sy1 - sy0); g.clip();
  for (let v = Math.floor((ias - 45) / 10) * 10; v < ias + 45; v += 10) { if (v < 30) continue; const y = cy - (v - ias) * spy; line(g, sx1 - 12, y, sx1, y, C.white, 2); if (v % 20 === 0) txt(g, String(v).padStart(3, '0'), sx1 - 16, y, C.white, 18, 'right'); }
  // VLS (amber strip) & alpha prot
  if (!S.onGround) {
    const yV = cy - (sp.vls - ias) * spy; g.fillStyle = C.amber; g.fillRect(sx1 - 2, yV, 4, Math.max(0, sy1 - yV));
    const yS = cy - (sp.vsw - ias) * spy; for (let y = yS; y < sy1; y += 10) { g.fillStyle = C.red; g.fillRect(sx1, y, 8, 5); g.fillStyle = '#000'; g.fillRect(sx1, y + 5, 8, 5); }
  }
  // VMAX barber pole
  const yM = cy - (sp.vmax - ias) * spy; for (let y = yM; y > sy0 - 10; y -= 10) { g.fillStyle = C.red; g.fillRect(sx1, y - 5, 8, 5); g.fillStyle = '#000'; g.fillRect(sx1, y - 10, 8, 5); }
  // characteristic speeds
  if (S.onGround || S.fms.phase === 'TAKEOFF') {
    const yv1 = cy - (S.fms.v1 - ias) * spy; if (S.fms.perf) { txt(g, '1', sx1 + 10, yv1, C.cyan, 16, 'left'); }
  }
  if (!S.onGround) {
    const c = confIndex();
    if (c === 0) { const y = cy - (sp.gd - ias) * spy; g.strokeStyle = C.green; g.lineWidth = 2; g.beginPath(); g.arc(sx1 + 8, y, 5, 0, 7); g.stroke(); }
    if (c === 1) { const y = cy - (sp.S - ias) * spy; txt(g, 'S', sx1 + 10, y, C.green, 16, 'left'); line(g, sx1, y, sx1 + 6, y, C.green, 2); }
    if (c >= 2 && c <= 3) { const y = cy - (sp.F - ias) * spy; txt(g, 'F', sx1 + 10, y, C.green, 16, 'left'); line(g, sx1, y, sx1 + 6, y, C.green, 2); }
  }
  // target speed
  if (S.elec.ac) {
    const ts = targetSpeed(); const yT = cy - (ts - ias) * spy; const col = S.fcu.spdMan ? C.cyan : C.mag;
    if (yT > sy0 && yT < sy1) { g.fillStyle = col; g.beginPath(); g.moveTo(sx1 + 2, yT); g.lineTo(sx1 + 14, yT - 8); g.lineTo(sx1 + 14, yT + 8); g.closePath(); g.fill(); }
    else txt(g, String(Math.round(ts)), sx0 + 34, yT <= sy0 ? sy0 - 12 : sy1 + 12, col, 16);
  }
  g.restore();
  // speed trend arrow
  const trend = S.iasTrend * 10;
  if (Math.abs(trend) > 2 && !S.onGround) { const y2 = cy - trend * spy; line(g, sx1 + 2, cy, sx1 + 2, y2, C.yellow, 2); g.fillStyle = C.yellow; g.beginPath(); g.moveTo(sx1 + 2, y2); g.lineTo(sx1 - 4, y2 + Math.sign(trend) * 8); g.lineTo(sx1 + 8, y2 + Math.sign(trend) * 8); g.fill(); }
  // reference line
  g.fillStyle = C.yellow; g.fillRect(sx0 - 6, cy - 2, sx1 - sx0 + 22, 4); g.beginPath(); g.moveTo(sx1 + 6, cy); g.lineTo(sx1 + 18, cy - 7); g.lineTo(sx1 + 18, cy + 7); g.fill();
  if (S.mach > 0.5) txt(g, '.' + Math.round(S.mach * 1000).toString().padStart(3, '0').slice(0, 2), 74, 432, C.green, 20);
  // ----- altitude tape -----
  const ax0 = 400, ax1 = 462, apy = 0.4; // px per ft
  const ialt = indicatedAlt();
  g.fillStyle = '#3c3c3c'; g.fillRect(ax0, sy0, ax1 - ax0, sy1 - sy0);
  g.save(); g.beginPath(); g.rect(ax0, sy0, ax1 - ax0, sy1 - sy0); g.clip();
  for (let a = Math.floor((ialt - 500) / 100) * 100; a < ialt + 500; a += 100) { const y = cy - (a - ialt) * apy; line(g, ax0, y, ax0 + (a % 500 === 0 ? 14 : 8), y, C.white, 2); if (a % 500 === 0) txt(g, String(Math.round(a / 100)).padStart(3, '0'), ax0 + 18, y, C.white, 18, 'left'); }
  // ground reference
  const gy = cy - ((S.pos.y - S.ra * FT) / FT - (S.pos.y / FT - ialt) - ialt) * apy; if (gy < sy1) { g.fillStyle = C.red; g.fillRect(ax0, gy, 8, sy1 - gy); }
  g.restore();
  // target altitude
  const tA = S.fcu.alt; const yA = cy - (tA - ialt) * apy;
  if (yA > sy0 && yA < sy1) { g.strokeStyle = C.cyan; g.lineWidth = 2; g.strokeRect(ax0 - 2, yA - 10, 24, 20); }
  else txt(g, String(tA), ax0 + 30, yA < sy0 ? sy0 - 12 : sy1 + 12, C.cyan, 17);
  // altitude readout window
  g.fillStyle = '#000'; g.fillRect(ax0 - 4, cy - 20, 76, 40); g.strokeStyle = C.yellow; g.lineWidth = 2; g.strokeRect(ax0 - 4, cy - 20, 76, 40);
  const hund = Math.floor(ialt / 100); const tens = ialt - hund * 100;
  txt(g, String(Math.max(hund, 0)).padStart(3, ' '), ax0 + 36, cy, C.green, 24, 'right');
  g.save(); g.beginPath(); g.rect(ax0 + 38, cy - 19, 30, 38); g.clip();
  const roll = tens / 20; for (let k = -2; k <= 2; k++) { const v = (Math.floor(roll) + k) * 20; const y = cy - (v - tens) * 1.0; txt(g, String(((v % 100) + 100) % 100).padStart(2, '0'), ax0 + 54, y, C.green, 18); }
  g.restore();
  // baro
  if (S.baro.std) boxt(g, 'STD', 436, 432, C.cyan, 18); else { txt(g, 'QNH', 410, 432, C.cyan, 15, 'left'); txt(g, String(S.baro.qnh), 448, 432, C.cyan, 18, 'left'); }
  // V/S
  const vx = 480; g.fillStyle = '#3c3c3c'; g.beginPath(); g.moveTo(vx, 120); g.lineTo(vx + 22, 140); g.lineTo(vx + 22, 336); g.lineTo(vx, 356); g.closePath(); g.fill();
  const vsv = clamp(S.vs, -6000, 6000); const vsy = (v) => cy - Math.sign(v) * (Math.abs(v) < 1000 ? Math.abs(v) / 1000 * 50 : Math.abs(v) < 2000 ? 50 + (Math.abs(v) - 1000) / 1000 * 30 : 80 + (Math.abs(v) - 2000) / 4000 * 30);
  for (const v of [-6000, -2000, -1000, 0, 1000, 2000, 6000]) line(g, vx, vsy(v), vx + 6, vsy(v), C.white, 2);
  line(g, vx + 26, cy, vx + 4, vsy(vsv), Math.abs(S.vs) > 6000 ? C.amber : C.green, 3);
  if (Math.abs(S.vs) > 200) txt(g, String(Math.round(Math.abs(S.vs) / 100)).padStart(2, '0'), vx + 12, S.vs > 0 ? 112 : 366, C.green, 16);
  // ----- heading tape -----
  const hy = 452; g.fillStyle = '#3c3c3c'; g.fillRect(150, hy - 14, 172, 40);
  if (aligned) {
    const hdg = S.psi * R2D; g.save(); g.beginPath(); g.rect(150, hy - 14, 172, 40); g.clip();
    for (let h = Math.floor(hdg - 20); h < hdg + 20; h++) { if (h % 5) continue; const x = cx - (hdg - h) * 8.2; line(g, x, hy - 14, x, hy - 14 + (h % 10 === 0 ? 10 : 6), C.white, 2); if (h % 10 === 0) txt(g, String(wrap360(h) / 10 | 0), x, hy + 8, C.white, h % 30 === 0 ? 18 : 14); }
    const trk = S.trk; const tx = cx - wrap180(hdg - trk) * 8.2; g.strokeStyle = C.green; g.lineWidth = 2; g.beginPath(); g.moveTo(tx, hy - 14); g.lineTo(tx - 5, hy - 7); g.lineTo(tx, hy); g.lineTo(tx + 5, hy - 7); g.closePath(); g.stroke();
    if (S.fcu.hdgMan || S.ap.lat === 'HDG') { const sx = cx - wrap180(hdg - S.fcu.hdg) * 8.2; if (Math.abs(sx - cx) < 86) { g.fillStyle = C.cyan; g.beginPath(); g.moveTo(sx, hy - 14); g.lineTo(sx - 6, hy - 24); g.lineTo(sx + 6, hy - 24); g.fill(); } }
    g.restore(); line(g, cx, hy - 26, cx, hy - 6, C.yellow, 3);
  } else boxt(g, 'HDG', cx, hy + 5, C.red, 20);
  // ----- FMA -----
  g.fillStyle = '#000'; g.fillRect(0, 0, W, 62);
  for (const x of [104, 206, 308, 392]) line(g, x, 4, x, 58, C.grey, 2);
  const ap = S.ap;
  const thrTxt = ap.athrMode || (S.tl.some(t => t >= DET.TOGA - 0.02) ? 'MAN TOGA' : S.tl.some(t => t >= DET.FLX - 0.02) ? 'MAN FLX 55' : '');
  if (thrTxt) txt(g, thrTxt, 52, 18, thrTxt.startsWith('MAN') ? C.white : C.green, 15);
  if (S.ap.athrArmed && S.fcu.athr && !S.onGround && S.tl.some(t => t > DET.CL + 0.02)) { if ((S.time % 1) < 0.6) boxt(g, 'LVR CLB', 52, 40, C.white, 14); }
  if (ap.vert) txt(g, ap.vert, 155, 18, C.green, 17); if (ap.vertArm) txt(g, ap.vertArm, 155, 40, ap.vertArm === 'G/S' ? C.cyan : C.cyan, 15);
  if (ap.lat) txt(g, ap.lat, 257, 18, C.green, 17); if (ap.latArm) txt(g, ap.latArm, 257, 40, C.cyan, 15);
  if (ap.vert === 'G/S' || ap.vert === 'LAND' || ap.vertArm === 'G/S') { txt(g, 'CAT3', 350, 18, C.white, 15); txt(g, 'DUAL', 350, 38, C.white, 15); }
  const apStr = S.fcu.ap1 && S.fcu.ap2 ? 'AP1+2' : S.fcu.ap1 ? 'AP1' : S.fcu.ap2 ? 'AP2' : '';
  if (apStr) txt(g, apStr, 452, 14, C.white, 16); if (S.fcu.fd) txt(g, '1 FD 2', 452, 32, C.white, 15);
  if (S.fcu.athr) txt(g, 'A/THR', 452, 50, ap.athrMode ? C.white : C.cyan, 15);
  if (S.ra < 400 && !S.onGround && S.fms.phase === 'APPROACH') txt(g, 'DH 200', 350, 54, C.cyan, 13);
  // master warning text
  d.tex.needsUpdate = true;
}

// ================= ND =================
const NAVAIDS = [ // [ident, lat, lon, type]
  ['BIG', 51.3308, 0.0347, 'vor'], ['OCK', 51.3050, -0.4472, 'vor'], ['LAM', 51.6461, 0.1517, 'vor'], ['DET', 51.3040, 0.5972, 'vor'], ['DVR', 51.1625, 1.3597, 'vor'], ['EPM', 51.3186, -0.3711, 'vor'],
  ['BNE', 50.6247, 1.9067, 'vor'], ['ABB', 50.1356, 1.8547, 'vor'], ['BVS', 49.4325, 2.1556, 'vor'], ['PON', 49.0964, 2.0350, 'vor'], ['CTL', 49.2650, 2.5181, 'vor'], ['RSY', 49.0133, 2.7700, 'vor'],
  ['LCY', 51.5047, 0.0553, 'ndb'], ['MAY', 51.0172, 0.1164, 'ndb'], ['LYD', 50.9997, 0.8783, 'ndb'], ['ING', 50.6400, 1.6317, 'ndb'], ['CGZ', 49.0050, 2.6700, 'ndb'],
  ['TIGER', 51.1656, 0.4239, 'wpt'], ['KONAN', 51.1017, 1.6681, 'wpt'], ['RINTI', 50.6050, 1.7583, 'wpt'], ['VEBEK', 49.8867, 2.0583, 'wpt'], ['LORNI', 49.5600, 2.6750, 'wpt'], ['OKIPA', 49.2500, 2.2800, 'wpt']
].map(([id, la, lo, t]) => ({ id, t, ...ll(la, lo) }));
const ARPTS = [['EGLL', 51.4700, -0.4543], ['EGKK', 51.1481, -0.1903], ['EGLC', 51.5053, 0.0553], ['EGSS', 51.8850, 0.2350], ['EGMH', 51.3422, 1.3461], ['EGKB', 51.3308, 0.0325],
  ['LFAT', 50.5150, 1.6275], ['LFAY', 49.8717, 2.6975], ['LFOB', 49.4544, 2.1128], ['LFPG', 49.0097, 2.5478], ['LFPB', 48.9694, 2.4414], ['LFPO', 48.7233, 2.3794], ['LFQQ', 50.5617, 3.0894]].map(([id, la, lo]) => ({ id, ...ll(la, lo) }));
function drawND(d, dt, range) {
  const g = d.g, W = 512, H = 512;
  if (!displayPowered(d, dt)) { d.tex.needsUpdate = true; return; }
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const mode = ND_MODES[S.efis.mode]; const rose = mode !== 'ARC'; const plan = mode === 'PLAN';
  const cx = 256, cy = rose ? 268 : 400, R = rose ? 190 : 330; const hdg = S.psi * R2D; const up = plan ? 0 : hdg;
  txt(g, 'GS', 10, 16, C.white, 14, 'left'); txt(g, String(Math.round(S.gs)), 38, 16, C.green, 18, 'left');
  txt(g, 'TAS', 90, 16, C.white, 14, 'left'); txt(g, S.tas > 50 * KT ? String(Math.round(S.tas / KT)) : '---', 124, 16, C.green, 18, 'left');
  if (S.tas > 100 * KT) { txt(g, `${Math.round(S.windDir)}°/${Math.round(S.windKt)}`, 10, 40, C.green, 16, 'left'); g.save(); g.translate(26, 66); g.rotate((S.windDir + 180 - up) * D2R); line(g, 0, -12, 0, 12, C.green, 2); g.beginPath(); g.moveTo(0, 12); g.lineTo(-4, 4); g.moveTo(0, 12); g.lineTo(4, 4); g.stroke(); g.restore(); }
  if (!S.aligned) { boxt(g, 'HDG', cx, 230, C.red, 22); boxt(g, 'MAP NOT AVAIL', cx, 280, C.red, 18); d.tex.needsUpdate = true; return; }
  const scale = (rose ? R / (range / 2) : R / range);
  const toScr = (x, z) => { const e = (x - S.pos.x) / NM, n = -(z - S.pos.z) / NM; const a = up * D2R; const rx = e * Math.cos(a) - n * Math.sin(a), ry = e * Math.sin(a) + n * Math.cos(a); return [cx + rx * scale, cy - ry * scale]; };
  g.save(); g.beginPath(); g.rect(0, 46, W, H - 70); g.clip();
  // range rings
  g.strokeStyle = C.white; g.lineWidth = 2;
  if (rose) { g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke(); g.setLineDash([6, 8]); g.beginPath(); g.arc(cx, cy, R / 2, 0, 7); g.stroke(); g.setLineDash([]); txt(g, String(range / 4), cx - R / 2 * 0.72 - 12, cy - R / 2 * 0.72, C.cyan, 14); }
  else { g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9); g.stroke(); g.setLineDash([6, 8]); g.beginPath(); g.arc(cx, cy, R / 2, -Math.PI / 2 - 1.1, -Math.PI / 2 + 1.1); g.stroke(); g.setLineDash([]); txt(g, String(range / 2), cx - R / 2 * Math.sin(0.95) - 10, cy - R / 2 * Math.cos(0.95), C.cyan, 14); }
  // compass rose / plan cardinal marks
  if (plan) { for (const [t, a] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) { const ax = a * D2R; txt(g, t, cx + Math.sin(ax) * (R + 16), cy - Math.cos(ax) * (R + 16), C.cyan, 18); } }
  else {
    const span = rose ? 180 : 60;
    for (let h = Math.floor(hdg - span); h < hdg + span; h++) { if (h % 5) continue; const a = (h - hdg) * D2R; const r1 = R, r2 = R + (h % 10 === 0 ? 12 : 6); line(g, cx + Math.sin(a) * r1, cy - Math.cos(a) * r1, cx + Math.sin(a) * r2, cy - Math.cos(a) * r2, C.white, 2);
      if (h % 30 === 0) { const r3 = R + 26; txt(g, String(wrap360(h) / 10 | 0), cx + Math.sin(a) * r3, cy - Math.cos(a) * r3, C.white, 20); } else if (h % 10 === 0 && !rose) { const r3 = R + 24; txt(g, String(wrap360(h) / 10 | 0), cx + Math.sin(a) * r3, cy - Math.cos(a) * r3, C.white, 14); } }
  }
  // airports, navaids, waypoints
  const inView = (p) => p[0] > -20 && p[0] < W + 20 && p[1] > 30 && p[1] < H;
  for (const ap of AIRPORTS) for (const r of ap.rwys.slice(0, mode === 'ARC' && range > 40 ? 1 : 4)) { const [x0, y0] = toScr(r.tx, r.tz), [x1, y1] = toScr(r.ex, r.ez); line(g, x0, y0, x1, y1, C.white, 3); }
  if (S.efis.arpt) for (const a of ARPTS) { const p = toScr(a.x, a.z); if (!inView(p)) continue; g.strokeStyle = C.mag; g.lineWidth = 2; g.beginPath(); g.moveTo(p[0], p[1] - 7); g.lineTo(p[0], p[1] + 7); g.moveTo(p[0] - 7, p[1]); g.lineTo(p[0] + 7, p[1]); g.stroke(); txt(g, a.id, p[0] + 9, p[1] + 12, C.mag, 13, 'left'); }
  else { const lhr = toScr(LHR.cx, LHR.cz), cdg = toScr(CDG.cx, CDG.cz); txt(g, 'EGLL', lhr[0] + 10, lhr[1] + 14, C.white, 14, 'left'); txt(g, 'LFPG', cdg[0] + 10, cdg[1] + 14, C.white, 14, 'left'); }
  for (const n of NAVAIDS) {
    if ((n.t === 'vor' && !S.efis.vord) || (n.t === 'ndb' && !S.efis.ndb) || (n.t === 'wpt' && !S.efis.wpt)) continue;
    const p = toScr(n.x, n.z); if (!inView(p)) continue; g.strokeStyle = C.mag; g.lineWidth = 2;
    if (n.t === 'vor') { g.beginPath(); g.moveTo(p[0], p[1] - 8); g.lineTo(p[0], p[1] + 8); g.moveTo(p[0] - 8, p[1]); g.lineTo(p[0] + 8, p[1]); g.stroke(); g.beginPath(); g.arc(p[0], p[1], 5, 0, 7); g.stroke(); }
    else if (n.t === 'ndb') { g.beginPath(); g.moveTo(p[0], p[1] - 8); g.lineTo(p[0] + 7, p[1] + 5); g.lineTo(p[0] - 7, p[1] + 5); g.closePath(); g.stroke(); }
    else { g.beginPath(); g.moveTo(p[0], p[1] - 6); g.lineTo(p[0] + 6, p[1]); g.lineTo(p[0], p[1] + 6); g.lineTo(p[0] - 6, p[1]); g.closePath(); g.stroke(); }
    txt(g, n.id, p[0] + 10, p[1] - 10, C.mag, 13, 'left');
  }
  // ILS course
  if ((S.loc.dist < 40 * NM && S.fms.phase === 'APPROACH') || S.efisLS || mode === 'LS') { const r = ILS26R.rwy; const [a0, b0] = toScr(r.tx, r.tz), [a1, b1] = toScr(r.tx - r.dx * 25 * NM, r.tz - r.dz * 25 * NM); g.setLineDash([10, 6]); line(g, a0, b0, a1, b1, C.mag, 2); g.setLineDash([]); }
  // flight plan
  if (S.fms.coRte) {
    const fp = FPLAN; let px = null, py = null; const pts = []; fp.forEach((w, i) => { if (w.type !== 'ALT') pts.push([w, i]); });
    for (const [w, i] of pts) {
      const [x, y] = toScr(w.x, w.z);
      if (px != null && i >= S.fms.wp - (fp[S.fms.wp - 1] && fp[S.fms.wp - 1].type === 'ALT' ? 2 : 1)) line(g, px, py, x, y, i === S.fms.wp ? C.white : C.green, 2);
      px = x; py = y;
      if (i >= S.fms.wp - 1 && !w.rwy) { const col = i === S.fms.wp ? C.white : C.green; g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 2, y - 2); g.lineTo(x + 7, y); g.lineTo(x + 2, y + 2); g.lineTo(x, y + 7); g.lineTo(x - 2, y + 2); g.lineTo(x - 7, y); g.lineTo(x - 2, y - 2); g.closePath(); g.stroke(); txt(g, w.name, x + 10, y - 10, col, 15, 'left');
        if (S.efis.cstr && w.alt) txt(g, (w.alt >= 6000 && !S.baro.std || w.alt < 6000 ? String(w.alt) : 'FL' + Math.round(w.alt / 100)), x + 10, y + 8, C.mag, 13, 'left'); }
    }
  }
  g.restore();
  // lubber, track, heading bug, aircraft
  if (plan) {
    const [ax, ay] = [cx, cy]; g.save(); g.translate(ax, ay); g.rotate(hdg * D2R); g.strokeStyle = C.yellow; g.lineWidth = 4; line(g, 0, -18, 0, 22, C.yellow, 4); line(g, -24, -2, 24, -2, C.yellow, 4); line(g, -9, 18, 9, 18, C.yellow, 4); g.restore();
  } else {
    line(g, cx, cy - R - 16, cx, cy - R + 4, C.yellow, 4);
    const trkA = (S.trk - hdg) * D2R; g.strokeStyle = C.green; g.lineWidth = 2; const tx = cx + Math.sin(trkA) * (R - 6), ty = cy - Math.cos(trkA) * (R - 6); g.beginPath(); g.moveTo(tx, ty - 8); g.lineTo(tx - 5, ty); g.lineTo(tx, ty + 8); g.lineTo(tx + 5, ty); g.closePath(); g.stroke();
    if (S.fcu.hdgMan || S.ap.lat === 'HDG') { const a = wrap180(S.fcu.hdg - hdg) * D2R; if (rose || Math.abs(a) < 0.9) { g.save(); g.translate(cx + Math.sin(a) * R, cy - Math.cos(a) * R); g.rotate(a); g.fillStyle = C.cyan; g.beginPath(); g.moveTo(0, 0); g.lineTo(-7, -14); g.lineTo(7, -14); g.fill(); g.restore(); } }
    if (mode === 'LS') { const a = wrap180(ILS26R.crs - hdg) * D2R; g.save(); g.translate(cx, cy); g.rotate(a); line(g, 0, -R + 10, 0, -R / 2, C.mag, 4); line(g, 0, R - 10, 0, R / 2, C.mag, 4); const dev = clamp(S.loc.dev / 0.8, -2.2, 2.2) * 34; line(g, dev, -R / 2 + 10, dev, R / 2 - 10, C.mag, 4); for (const k of [-2, -1, 1, 2]) { g.strokeStyle = C.white; g.beginPath(); g.arc(k * 34, 0, 4, 0, 7); g.stroke(); } g.restore(); }
    line(g, cx, cy - 18, cx, cy + 22, C.yellow, 4); line(g, cx - 24, cy - 2, cx + 24, cy - 2, C.yellow, 4); line(g, cx - 9, cy + 18, cx + 9, cy + 18, C.yellow, 4);
  }
  if (S.fms.coRte) {
    const w = FPLAN[Math.min(S.fms.wp, FPLAN.length - 1)];
    if (w.type === 'ALT') txt(g, w.name, W - 10, 16, C.white, 16, 'right');
    else { const b = brg(S.pos.x, S.pos.z, w.x, w.z); const dnm = dist2(S.pos.x, S.pos.z, w.x, w.z) / NM; txt(g, w.name, W - 110, 16, C.white, 16, 'left'); txt(g, String(Math.round(b)).padStart(3, '0') + '°', W - 10, 16, C.green, 16, 'right'); txt(g, dnm.toFixed(dnm < 20 ? 1 : 0) + ' NM', W - 10, 38, C.green, 16, 'right'); const eta = S.gs > 30 ? dnm / S.gs * 3600 : 0; const tt = new Date(Date.UTC(2026, 9, 17, 13, 5) + (S.time + eta) * 1000); txt(g, `${String(tt.getUTCHours()).padStart(2, '0')}${String(tt.getUTCMinutes()).padStart(2, '0')}`, W - 10, 60, C.green, 16, 'right'); }
  }
  if (mode === 'LS' || S.loc.dist < 30 * NM) { txt(g, 'ILS1 110.10', W - 10, H - 36, C.mag, 15, 'right'); txt(g, 'CRS 266°', W - 10, H - 16, C.mag, 15, 'right'); }
  if (mode === 'VOR') { txt(g, 'VOR1 BIG', 10, H - 36, C.white, 15, 'left'); }
  txt(g, mode, 10, H - 16, C.green, 14, 'left');
  if (S.chrono.run || S.chrono.t > 0) { const c = Math.floor(S.chrono.t); txt(g, `${String(Math.floor(c / 60)).padStart(2, '0')}'${String(c % 60).padStart(2, '0')}"`, 70, H - 16, C.white, 15, 'left'); }
  if (swGet('terronnd') && S.elec.dc) txt(g, 'TERR', W - 10, H - 56, C.cyan, 14, 'right');
  d.tex.needsUpdate = true;
}

// ================= Engine/Warning Display =================
function gaugeN1(g, x, y, e, i) {
  const r = 52; const v = e.N1; const a0 = 200 * D2R, a1 = -20 * D2R; const ang = (val) => a0 + (a1 - a0) * clamp(val / 110, 0, 1);
  g.strokeStyle = C.white; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r, -a0, -ang(100), false); g.stroke();
  g.strokeStyle = C.red; g.beginPath(); g.arc(x, y, r, -ang(100), -ang(110), false); g.stroke();
  for (const t of [50, 60, 70, 80, 90, 100]) { const a = ang(t); line(g, x + Math.cos(a) * (r - 8), y - Math.sin(a) * (r - 8), x + Math.cos(a) * r, y - Math.sin(a) * r, C.white, 2); }
  txt(g, '5', x + Math.cos(ang(50)) * (r - 18), y - Math.sin(ang(50)) * (r - 18), C.white, 12); txt(g, '10', x + Math.cos(ang(100)) * (r - 18), y - Math.sin(ang(100)) * (r - 18), C.white, 12);
  if (e.N1 > 0.5 || e.run || e.starting) { const a = ang(v); line(g, x, y, x + Math.cos(a) * (r + 6), y - Math.sin(a) * (r + 6), C.green, 3); }
  // thrust lever position (blue circle)
  const lv = n1ForLever(i); const al = ang(lv); g.strokeStyle = C.cyan; g.lineWidth = 2; g.beginPath(); g.arc(x + Math.cos(al) * (r + 9), y - Math.sin(al) * (r + 9), 4, 0, 7); g.stroke();
  g.strokeStyle = C.grey; g.strokeRect(x - 2, y + 4, 60, 26);
  txt(g, e.N1 > 0.3 ? v.toFixed(1) : 'XX', x + 54, y + 18, e.N1 > 0.3 ? C.green : C.amber, 22, 'right');
}
function n1ForLever(i) { const lv = S.tl[i]; if (lv < 0) return n1Idle(); if (lv <= DET.CL) return lerp(n1Idle(), n1Climb(), lv / DET.CL); if (lv <= DET.FLX) return lerp(n1Climb(), 91, (lv - DET.CL) / (DET.FLX - DET.CL)); return lerp(91, 100, (lv - DET.FLX) / (DET.TOGA - DET.FLX)); }
function gaugeEGT(g, x, y, e) {
  const r = 34; const a0 = 200 * D2R, a1 = -20 * D2R; const ang = (val) => a0 + (a1 - a0) * clamp(val / 1100, 0, 1);
  g.strokeStyle = C.white; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r, -a0, -ang(950), false); g.stroke(); g.strokeStyle = C.red; g.beginPath(); g.arc(x, y, r, -ang(950), -ang(1100), false); g.stroke();
  const a = ang(e.EGT); if (e.EGT > 40) line(g, x, y, x + Math.cos(a) * (r + 4), y - Math.sin(a) * (r + 4), C.green, 3);
  txt(g, e.EGT > 40 ? String(Math.round(e.EGT)) : 'XX', x, y + 14, e.EGT > 40 ? C.green : C.amber, 18);
}
function drawEWD(d, dt) {
  const g = d.g, W = 512, H = 512;
  if (!displayPowered(d, dt)) { d.tex.needsUpdate = true; return; }
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const xs = [118, 312];
  S.eng.forEach((e, i) => { gaugeN1(g, xs[i], 74, e, i); gaugeEGT(g, xs[i], 170, e); txt(g, e.N2 > 0.5 ? e.N2.toFixed(1) : 'XX', xs[i] + 30, 232, e.N2 > 0.5 ? C.green : C.amber, 20, 'right'); if (e.starting) { g.fillStyle = '#555'; g.fillRect(xs[i] - 28, 220, 64, 24); txt(g, e.N2.toFixed(1), xs[i] + 30, 232, C.green, 20, 'right'); } txt(g, e.FF > 1 ? String(Math.round(e.FF / 10) * 10) : 'XX', xs[i] + 30, 262, e.FF > 1 ? C.green : C.amber, 20, 'right'); if (S.rev[i] > 0.05) boxt(g, 'REV', xs[i], 40, S.rev[i] > 0.95 ? C.green : C.amber, 16); });
  txt(g, 'N1', 215, 60, C.white, 16); txt(g, '%', 215, 80, C.cyan, 14); txt(g, 'EGT', 215, 160, C.white, 16); txt(g, '°C', 215, 180, C.cyan, 14); txt(g, 'N2', 215, 226, C.white, 16); txt(g, '%', 215, 244, C.cyan, 14); txt(g, 'FF', 215, 262, C.white, 16); txt(g, 'KG/H', 215, 280, C.cyan, 12);
  // thrust limit
  const lim = S.onGround || S.fms.phase === 'TAKEOFF' ? (S.fms.perf ? 'FLX' : 'TOGA') : 'CLB';
  txt(g, lim, 420, 26, C.cyan, 18, 'left'); txt(g, (lim === 'CLB' ? n1Climb() : lim === 'FLX' ? 91 : 100).toFixed(1), 500, 26, C.green, 18, 'right'); if (lim === 'FLX') { txt(g, '55°C', 500, 48, C.cyan, 16, 'right'); }
  txt(g, 'FOB :', 418, 90, C.white, 15, 'left'); txt(g, String(Math.round(S.fuel / 10) * 10), 500, 112, C.green, 20, 'right'); txt(g, 'KG', 500, 132, C.cyan, 13, 'right');
  // flaps / slats indicator
  const fx = 430, fy = 205; txt(g, 'S', fx - 50, fy - 18, C.white, 14); txt(g, 'F', fx + 50, fy - 18, C.white, 14);
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(fx - 10, fy - 10); g.lineTo(fx + 12, fy - 10); g.lineTo(fx + 14, fy - 6); g.lineTo(fx - 12, fy - 6); g.fill();
  const fp = S.flapPos; const slatK = clamp(fp, 0, 1) * 0.4 + clamp(fp - 1, 0, 3) / 3 * 0.6; const flapK = fp <= 1 ? fp * 0.25 : 0.25 + (fp - 1) / 3 * 0.75;
  g.fillStyle = C.green; g.beginPath(); g.moveTo(fx - 12, fy - 8); g.lineTo(fx - 12 - slatK * 40, fy - 8 + slatK * 18); g.lineTo(fx - 18 - slatK * 40, fy - 4 + slatK * 18); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(fx + 14, fy - 8); g.lineTo(fx + 14 + flapK * 44, fy - 8 + flapK * 22); g.lineTo(fx + 20 + flapK * 44, fy - 3 + flapK * 22); g.closePath(); g.fill();
  if (fp > 0.02 || S.flapLever) { const lbl = ['0', '1+F', '2', '3', 'FULL'][S.flapLever]; txt(g, Math.abs(fp - S.flapLever) < 0.02 ? lbl : lbl, fx, fy + 30, Math.abs(fp - S.flapLever) < 0.02 ? C.green : C.cyan, 18); }
  line(g, 10, 300, 330, 300, C.white, 2); line(g, 345, 300, 502, 300, C.white, 2); line(g, 337, 304, 337, 500, C.white, 2);
  // memo / warnings / cautions
  const left = []; const right = [];
  S.warn.msgs.forEach(m => left.push([m.t, m.c === 'red' ? C.red : C.amber]));
  (S.warn.cautions || []).filter(m => !(S.warn.ack || []).includes(m)).forEach(m => { const [sys, ...rest] = m.split(' '); left.push([m, C.amber, sys]); });
  const e2run = S.eng[0].run && S.eng[1].run;
  if (!left.length) {
    if (S.onGround && e2run && !S.tl.some(t => t > DET.CL) && (!S.touchdown)) {
      left.push(['T.O', C.white]);
      const it = (ok, a, b) => left.push([(ok ? a : a + ' ' + '.'.repeat(Math.max(1, 15 - a.length - b.length)) + b), ok ? C.green : C.cyan]);
      it(S.autobrake === 3, 'AUTO BRK MAX', 'MAX'); it(S.lt.belts, 'SIGNS ON', 'ON'); it(S.cabinReady, 'CABIN READY', 'CHECK'); it(S.sbArmed, 'SPLRS ARM', 'ARM'); it(S.flapLever >= 1 && S.flapLever <= 3, 'FLAPS T.O', 'T.O'); it(S.toConfigOK, 'T.O CONFIG NORMAL', 'TEST');
    } else if (!S.onGround && S.ra < 2000 && S.fms.phase === 'APPROACH') {
      left.push(['LDG', C.white]);
      const it = (ok, a, b) => left.push([(ok ? a : a + ' ' + '.'.repeat(Math.max(1, 15 - a.length - b.length)) + b), ok ? C.green : C.cyan]);
      it(S.gearPos > 0.98, 'LDG GEAR DN', 'DN'); it(S.lt.belts, 'SIGNS ON', 'ON'); it(S.cabinReady, 'CABIN READY', 'CHECK'); it(S.sbArmed, 'SPLRS ARM', 'ARM'); it(S.flapLever === 4, 'FLAPS FULL', 'FULL');
    } else {
      if (S.adirs.some((a, i) => a && S.adirsT[i] < 1)) left.push([`IRS IN ALIGN ${Math.max(1, Math.ceil((1 - Math.max(...S.adirsT)) * 2))} MN`, C.green]);
      if (S._athrDiscT && S.time - S._athrDiscT < 5) left.push(['AUTO FLT A/THR OFF', C.amber]);
    }
  }
  if (S.apu.avail) right.push(['APU AVAIL', C.green]); else if (S.apu.start || (S.apu.master && S.apu.N > 1)) right.push(['APU START', C.green]);
  if (S.apu.bleed && S.apu.avail) right.push(['APU BLEED', C.green]);
  if (S.lt.belts) right.push(['SEAT BELTS', C.green]); if (S.lt.nosmoke) right.push(['NO SMOKING', C.green]);
  if (S.parkBrake) right.push(['PARK BRK', C.green]); if (S.sbArmed && !S.onGround) right.push(['GND SPLRS ARMED', C.green]);
  if (S.lt.land && !S.onGround) right.push(['LDG LT', C.green]); if (!S.onGround && S.lt.strobe === 0) right.push(['STROBE LT OFF', C.green]);
  if (S.engMode === 2) right.push(['IGNITION', C.green]); if (S.spoiler > 0.05 && !S.onGround) right.push(['SPEED BRK', S.ias < 200 ? C.amber : C.green]);
  if (S.hyd && S.hyd.ptuRun) right.push(['HYD PTU', C.green]);
  if (typeof swMemos === 'function') swMemos().forEach(m => right.push([m, C.green]));
  if (S.xpdr.mode === 0 && !S.onGround) right.push(['XPDR STBY', C.amber]);
  left.slice(0, 7).forEach((m, k) => { if (m[2]) { txt(g, m[2], 18, 324 + k * 24, m[1], 17, 'left'); g.font = `17px ${FONT}`; const w2 = g.measureText(m[2] + ' ').width; txt(g, m[0].slice(m[2].length + 1), 18 + w2, 324 + k * 24, m[1], 17, 'left'); g.strokeStyle = m[1]; g.lineWidth = 1.5; g.beginPath(); g.moveTo(18, 334 + k * 24); g.lineTo(18 + w2 - 9, 334 + k * 24); g.stroke(); } else txt(g, m[0], 18, 324 + k * 24, m[1], 17, 'left'); });
  right.slice(0, 7).forEach((m, k) => txt(g, m[0], 352, 324 + k * 24, m[1], 15, 'left'));
  d.tex.needsUpdate = true;
}

// ================= System Display =================
function sdAutoPage() {
  if (S.apu.master && !(S.eng[0].run && S.eng[1].run)) return 'APU';
  if (S.engMode === 2 || S.eng.some(e => e.starting)) return 'ENG';
  if (!S.onGround && S.flapLever > 0) return 'WHEEL';
  if (S.onGround && !S.eng.some(e => e.run)) return 'DOOR';
  if (S.onGround && S.ias < 70 && S.eng.every(e => e.run) && !S.touchdown) return 'F/CTL';
  if (S.onGround) return 'WHEEL';
  return 'CRUISE';
}
function sdBox(g, x, y, w, h, title, ok, lines) {
  g.strokeStyle = ok ? C.white : C.amber; g.lineWidth = 2; g.strokeRect(x, y, w, h);
  txt(g, title, x + w / 2, y + 14, ok ? C.white : C.amber, 15); (lines || []).forEach((l, i) => txt(g, l[0], x + w / 2, y + 34 + i * 18, l[1] || C.green, 15));
}
function drawSD(d, dt) {
  const g = d.g, W = 512, H = 512;
  if (!displayPowered(d, dt)) { d.tex.needsUpdate = true; return; }
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const page = S.sdPage || sdAutoPage();
  txt(g, page, W / 2, 22, C.white, 20); line(g, W / 2 - 36, 36, W / 2 + 36, 36, C.white, 2);
  const hs = S.hyd || { g: 0, y: 0, b: 0 }; const ac = S.elec.ac;
  if (page === 'APU') {
    txt(g, 'AVAIL', W / 2, 70, S.apu.avail ? C.green : '#000', 18);
    txt(g, 'N', 140, 150, C.white, 18); txt(g, '%', 140, 172, C.cyan, 14); txt(g, 'EGT', 360, 150, C.white, 18); txt(g, '°C', 360, 172, C.cyan, 14);
    const gauge = (x, y, v, max, red) => { const r = 54, a0 = 200 * D2R, a1 = -20 * D2R; const ang = (q) => a0 + (a1 - a0) * clamp(q / max, 0, 1); g.strokeStyle = C.white; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r, -a0, -ang(red), false); g.stroke(); g.strokeStyle = C.red; g.beginPath(); g.arc(x, y, r, -ang(red), -a1, false); g.stroke(); const a = ang(v); line(g, x, y, x + Math.cos(a) * (r + 6), y - Math.sin(a) * (r + 6), C.green, 3); txt(g, String(Math.round(v)), x + 10, y + 24, C.green, 22); };
    gauge(150, 250, S.apu.N, 110, 102); gauge(360, 250, S.apu.egt, 1100, 900);
    txt(g, 'FLAP OPEN', W / 2, 360, S.apu.flap >= 1 ? C.green : '#000', 17);
    sdBox(g, 40, 390, 160, 70, 'APU GEN', S.apu.avail, S.apu.avail ? [['100 %  115 V'], ['400 HZ']] : [['XX', C.amber]]);
    txt(g, 'APU BLEED', 380, 410, C.white, 16); txt(g, S.apu.avail && S.apu.bleed ? '38 PSI' : 'XX', 380, 436, S.apu.avail && S.apu.bleed ? C.green : C.amber, 16);
  } else if (page === 'ENG') {
    S.eng.forEach((e, i) => { const x = i ? 370 : 140; txt(g, 'F.USED', x, 70, C.white, 14); txt(g, String(Math.round((7800 - S.fuel) / 2)), x, 92, C.green, 18); txt(g, 'OIL', x, 130, C.white, 14); txt(g, (e.N2 > 20 ? 14 + e.N2 * 0.1 : 0).toFixed(1), x, 152, C.green, 18); txt(g, 'VIB N1', x, 190, C.white, 14); txt(g, (e.N1 * 0.008).toFixed(1), x, 212, C.green, 18); txt(g, 'VIB N2', x, 240, C.white, 14); txt(g, (e.N2 * 0.01).toFixed(1), x, 262, C.green, 18);
      txt(g, 'IGN', x, 300, C.white, 14); txt(g, e.ign ? 'A' : '', x, 322, C.green, 18); txt(g, 'START VALVE', x, 360, C.white, 14); txt(g, e.starting ? 'OPEN' : 'SHUT', x, 382, e.starting ? C.green : C.white, 16); txt(g, 'BLEED PSI', x, 420, C.white, 14); txt(g, String(Math.round(S.bleedPress || 0)), x, 442, (S.bleedPress || 0) > 20 ? C.green : C.amber, 18); if (e.startFail) txt(g, e.startFail, x, 466, C.amber, 16); });
  } else if (page === 'DOOR') {
    g.strokeStyle = C.white; g.lineWidth = 2; g.beginPath(); g.moveTo(256, 70); g.quadraticCurveTo(300, 80, 300, 150); g.lineTo(300, 420); g.quadraticCurveTo(280, 470, 256, 480); g.quadraticCurveTo(232, 470, 212, 420); g.lineTo(212, 150); g.quadraticCurveTo(212, 80, 256, 70); g.stroke();
    const door = (x, y, open) => { g.fillStyle = open ? C.amber : C.green; g.fillRect(x, y, 10, 22); };
    const dc = S.doorsClosed; door(200, 140, !dc); door(302, 140, false); door(200, 400, false); door(302, 400, !dc); door(302, 280, !dc);
    txt(g, dc ? '' : 'CABIN', 150, 152, C.amber, 14); txt(g, dc ? '' : 'CARGO', 360, 292, C.amber, 14); txt(g, 'SLIDE', 160, 410, C.white, 12); txt(g, 'SLIDE', 350, 152, C.white, 12);
    txt(g, 'OXY', 420, 90, C.white, 14); txt(g, '1850 PSI', 420, 110, C.green, 15);
  } else if (page === 'WHEEL') {
    txt(g, 'L/G', W / 2, 80, C.white, 16);
    for (const [x, y] of [[256, 130], [150, 260], [360, 260]]) { const dn = S.gearPos > 0.98, upp = S.gearPos < 0.02; g.fillStyle = dn ? C.green : upp ? '#333' : C.red; g.beginPath(); g.moveTo(x - 20, y); g.lineTo(x, y + 26); g.lineTo(x + 20, y); g.closePath(); g.fill(); }
    const bt = Math.round(60 + Math.min(260, (S.stats.brakeHeat || 0))); txt(g, 'BRAKE TEMP °C', W / 2, 330, C.white, 14); txt(g, `${bt}   ${bt + 5}`, 150, 355, C.green, 16); txt(g, `${bt + 3}   ${bt}`, 360, 355, C.green, 16);
    txt(g, 'AUTO BRK', W / 2, 400, C.white, 16); txt(g, ['', 'LO', 'MED', 'MAX'][S.autobrake], W / 2, 424, C.green, 18);
    txt(g, 'N/W STEERING', W / 2, 452, swGet('askid') ? C.white : C.amber, 14); txt(g, swGet('askid') ? '' : 'DISC', W / 2, 470, C.amber, 14);
  } else if (page === 'ELEC') {
    sdBox(g, 20, 52, 110, 64, 'BAT 1', S.elec.bat1, S.elec.bat1 ? [['26 V'], ['-2 A']] : [['XX', C.amber]]);
    sdBox(g, 382, 52, 110, 64, 'BAT 2', S.elec.bat2, S.elec.bat2 ? [['26 V'], ['-2 A']] : [['XX', C.amber]]);
    txt(g, 'DC BAT', W / 2, 70, S.elec.dc ? C.green : C.amber, 16);
    txt(g, 'DC 1', 110, 160, ac ? C.green : C.amber, 16); txt(g, 'DC ESS', W / 2, 160, S.elec.dc ? C.green : C.amber, 16); txt(g, 'DC 2', 400, 160, ac ? C.green : C.amber, 16);
    txt(g, 'AC 1', 110, 240, ac ? C.green : C.amber, 16); txt(g, 'AC ESS', W / 2, 240, ac ? C.green : C.amber, 16); txt(g, 'AC 2', 400, 240, ac ? C.green : C.amber, 16);
    const gen = (x, t, on, sw) => sdBox(g, x, 330, 112, 100, t, on || !sw, on ? [['38 %'], ['115 V'], ['400 HZ']] : sw ? [['OFF', C.white]] : [['XX', C.amber]]);
    gen(14, 'GEN 1', S.eng[0].run && swGet('gen1'), !swGet('gen1')); gen(134, 'APU GEN', S.apu.avail && swGet('apu_gen'), !swGet('apu_gen')); gen(266, 'EXT PWR', false, true); gen(386, 'GEN 2', S.eng[1].run && swGet('gen2'), !swGet('gen2'));
    for (const x of [110, 400]) line(g, x, 255, x, 325, ac ? C.green : '#444', 2);
  } else if (page === 'HYD') {
    const cols = [['GREEN', hs.g, 110, 'ENG 1'], ['BLUE', hs.b, 256, 'ELEC'], ['YELLOW', hs.y, 400, 'ENG 2']];
    for (const [n, p, x, src] of cols) { const ok = p > 1500; txt(g, n, x, 66, ok ? C.white : C.amber, 17); txt(g, String(p), x, 92, ok ? C.green : C.amber, 20); line(g, x, 104, x, 300, ok ? C.green : C.amber, 3);
      g.strokeStyle = ok ? C.green : C.amber; g.lineWidth = 2; g.strokeRect(x - 18, 300, 36, 36); line(g, x, 304, x, 332, ok ? C.green : C.amber, 2); txt(g, src, x, 352, C.white, 14);
      txt(g, 'QTY', x, 400, C.white, 13); g.strokeStyle = C.white; g.strokeRect(x - 6, 412, 12, 60); g.fillStyle = C.green; g.fillRect(x - 5, 420, 10, 51); }
    txt(g, 'PTU', 183, 190, swGet('ptu') ? C.green : C.amber, 15); line(g, 125, 200, 240, 200, swGet('ptu') ? C.green : C.amber, 2); line(g, 272, 200, 385, 200, swGet('ptu') ? C.green : C.amber, 2);
    txt(g, 'PSI', W / 2, 120, C.cyan, 13);
  } else if (page === 'FUEL') {
    const fob = S.fuel; const wing = fob / 2;
    txt(g, 'F.USED', W / 2, 60, C.white, 14); txt(g, String(Math.round(7800 - fob)), W / 2, 82, C.green, 18); txt(g, 'KG', W / 2 + 46, 82, C.cyan, 13);
    g.strokeStyle = C.white; g.lineWidth = 2; g.beginPath(); g.moveTo(20, 250); g.lineTo(60, 160); g.lineTo(200, 160); g.lineTo(200, 250); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(492, 250); g.lineTo(452, 160); g.lineTo(312, 160); g.lineTo(312, 250); g.closePath(); g.stroke(); g.strokeRect(200, 160, 112, 90);
    txt(g, String(Math.round(wing * 0.12 / 10) * 10), 55, 225, C.green, 18); txt(g, String(Math.round(wing * 0.88 / 10) * 10), 140, 225, C.green, 18); txt(g, '0', W / 2, 225, C.green, 18); txt(g, String(Math.round(wing * 0.88 / 10) * 10), 372, 225, C.green, 18); txt(g, String(Math.round(wing * 0.12 / 10) * 10), 457, 225, C.green, 18);
    const pump = (x, id) => { const on = swGet(id); g.strokeStyle = on ? C.green : C.amber; g.lineWidth = 2; g.strokeRect(x - 13, 270, 26, 26); if (on) line(g, x, 273, x, 293, C.green, 2); else line(g, x - 9, 283, x + 9, 283, C.amber, 2); };
    pump(120, 'fuel_l1'); pump(165, 'fuel_l2'); pump(232, 'fuel_c1'); pump(280, 'fuel_c2'); pump(347, 'fuel_r1'); pump(392, 'fuel_r2');
    txt(g, 'X FEED', W / 2, 330, C.white, 14); g.strokeStyle = swGet('xfeed') ? C.green : C.green; g.beginPath(); g.arc(W / 2, 356, 14, 0, 7); g.stroke(); if (swGet('xfeed')) line(g, W / 2 - 14, 356, W / 2 + 14, 356, C.green, 2); else line(g, W / 2, 342, W / 2, 370, C.green, 2);
    txt(g, 'FOB :', 150, 430, C.white, 18); txt(g, String(Math.round(fob / 10) * 10), 320, 430, C.green, 22); txt(g, 'KG', 390, 430, C.cyan, 14);
  } else if (page === 'BLEED') {
    const b1 = S.eng[0].run && swGet('bleed1'), b2 = S.eng[1].run && swGet('bleed2'), ab = S.apu.avail && S.apu.bleed;
    txt(g, 'RAM AIR', W / 2, 70, C.white, 14);
    sdBox(g, 40, 90, 130, 80, 'PACK 1', swGet('pack1'), [[swGet('pack1') ? '18 °C' : 'OFF', swGet('pack1') ? C.green : C.amber], [swGet('pack1') ? 'FLOW NORM' : '']]);
    sdBox(g, 342, 90, 130, 80, 'PACK 2', swGet('pack2'), [[swGet('pack2') ? '19 °C' : 'OFF', swGet('pack2') ? C.green : C.amber], [swGet('pack2') ? 'FLOW NORM' : '']]);
    line(g, 105, 170, 105, 300, b1 || ab ? C.green : C.amber, 2); line(g, 407, 170, 407, 300, b2 || ab ? C.green : C.amber, 2); line(g, 105, 240, 407, 240, (S.sw.xbleed ?? 1) === 2 || ab ? C.green : '#555', 2);
    txt(g, 'X BLEED', W / 2, 228, C.white, 13);
    sdBox(g, 40, 300, 130, 80, 'ENG 1', b1, [[b1 ? '44 PSI' : 'XX', b1 ? C.green : C.amber], [b1 ? '180 °C' : '']]);
    sdBox(g, 342, 300, 130, 80, 'ENG 2', b2, [[b2 ? '44 PSI' : 'XX', b2 ? C.green : C.amber], [b2 ? '180 °C' : '']]);
    txt(g, 'APU', W / 2, 330, C.white, 15); txt(g, ab ? 'OPEN' : 'SHUT', W / 2, 352, ab ? C.green : C.white, 15);
  } else if (page === 'PRESS') {
    const cabAlt = Math.round(Math.min(8000, Math.max(0, (S.alt - 3000) * 0.25)) / 50) * 50, dp = Math.max(0, (isa(cabAlt * FT).p - isa(S.pos.y).p) / 6895);
    const gauge = (x, y, v, max, lab, unit, fmt) => { const r = 56, a0 = 225 * D2R, a1 = -45 * D2R; const ang = (q) => a0 + (a1 - a0) * clamp(q / max, 0, 1); g.strokeStyle = C.white; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r, -a0, -a1, false); g.stroke(); const a = ang(v); line(g, x, y, x + Math.cos(a) * (r + 4), y - Math.sin(a) * (r + 4), C.green, 3); txt(g, lab, x, y - 78, C.white, 15); txt(g, fmt, x + 6, y + 30, C.green, 20); txt(g, unit, x, y + 54, C.cyan, 13); };
    gauge(130, 170, dp, 9, 'ΔP', 'PSI', dp.toFixed(1)); gauge(380, 170, clamp(S.vs / 6, -2000, 2000) + 2000, 4000, 'V/S', 'FT/MIN', String(Math.round(clamp(S.vs / 6, -2000, 2000) / 50) * 50));
    txt(g, 'CAB ALT', W / 2, 300, C.white, 15); txt(g, String(cabAlt), W / 2, 326, C.green, 22); txt(g, 'FT', W / 2 + 60, 326, C.cyan, 13);
    txt(g, 'LDG ELEV', 120, 380, C.white, 14); txt(g, S.sw.ldgElev ? 'MAN ' + (S.sw.ldgElev * 500) : 'AUTO', 120, 402, S.sw.ldgElev ? C.amber : C.green, 15); txt(g, 'SYS 1', 380, 380, C.green, 16); txt(g, 'SAFETY', 380, 410, C.white, 14);
  } else if (page === 'COND') {
    txt(g, 'TEMP :', 80, 70, C.white, 15); txt(g, '°C', 140, 70, C.cyan, 13);
    g.strokeStyle = C.white; g.lineWidth = 2; g.beginPath(); g.moveTo(60, 200); g.lineTo(100, 110); g.lineTo(470, 110); g.lineTo(470, 200); g.closePath(); g.stroke();
    for (const [n, x, t] of [['CKPT', 140, 22], ['FWD', 270, 23], ['AFT', 400, 22]]) { txt(g, n, x, 135, C.white, 15); txt(g, String(t), x, 165, C.green, 20); txt(g, String(t - 6), x, 230, C.green, 16); }
    txt(g, 'HOT AIR', W / 2, 300, C.white, 15); txt(g, swGet('pack1') && swGet('pack2') ? 'PACKS NORM' : 'PACK OFF', W / 2, 326, swGet('pack1') && swGet('pack2') ? C.green : C.amber, 15);
  } else if (page === 'F/CTL') {
    const sp = S.spoiler; const ail = S.stickR * 20, elev = -S.stickP * 25;
    txt(g, 'SPD BRK', W / 2, 62, C.white, 14);
    for (let i = 0; i < 5; i++) { for (const s of [-1, 1]) { const x = W / 2 + s * (46 + i * 34), y = 96; g.strokeStyle = C.green; g.lineWidth = 2; line(g, x - 10, y, x + 10, y, C.green, 2); if (sp > 0.1 && (S.onGround || i > 0)) { g.fillStyle = C.green; g.beginPath(); g.moveTo(x - 7, y - 4); g.lineTo(x + 7, y - 4); g.lineTo(x, y - 4 - sp * 26); g.closePath(); g.fill(); } txt(g, String(s < 0 ? 5 - i : i + 1), x, y + 16, C.white, 12); } }
    const surf = (x, y, v, lab) => { txt(g, lab, x, y - 80, C.white, 14); g.strokeStyle = C.white; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 6, y - 60); g.lineTo(x - 6, y + 60); g.stroke(); const yy = y - clamp(v, -30, 30) * 2; g.fillStyle = C.green; g.beginPath(); g.moveTo(x - 6, yy); g.lineTo(x + 8, yy - 6); g.lineTo(x + 8, yy + 6); g.closePath(); g.fill(); };
    surf(60, 230, -ail, 'L AIL'); surf(452, 230, ail, 'R AIL'); surf(170, 340, elev, 'L ELEV'); surf(342, 340, elev, 'R ELEV');
    txt(g, 'PITCH TRIM', W / 2, 200, C.white, 14); txt(g, (S.theta * R2D * 0.3).toFixed(1) + '° UP', W / 2, 224, C.green, 16);
    txt(g, 'RUD', W / 2, 330, C.white, 14); g.strokeStyle = C.white; g.beginPath(); g.arc(W / 2, 330, 70, 0.3 * Math.PI, 0.7 * Math.PI); g.stroke(); const ra = (0.5 + (S.rudder + S.rudTrim / 25) * 0.18) * Math.PI; line(g, W / 2, 330, W / 2 + Math.cos(ra) * 70, 330 + Math.sin(ra) * 70, C.green, 3);
    txt(g, 'ELAC', 120, 150, swGet('elac1') && swGet('elac2') ? C.white : C.amber, 14); txt(g, 'SEC', 390, 150, C.white, 14);
  } else if (page === 'STS') {
    txt(g, 'NORMAL', W / 2, 200, C.green, 22);
    const c = (S.warn.cautions || []); c.slice(0, 8).forEach((m, i) => txt(g, m, W / 2, 250 + i * 22, C.amber, 15));
  } else {
    txt(g, 'ENG', 70, 70, C.white, 16); txt(g, 'F.USED', 256, 90, C.white, 14); txt(g, String(Math.round(7800 - S.fuel)), 256, 112, C.green, 20); txt(g, 'KG', 256, 132, C.cyan, 13);
    txt(g, 'OIL', 150, 170, C.white, 14); txt(g, '15.5', 100, 192, C.green, 16); txt(g, '15.5', 200, 192, C.green, 16); txt(g, 'VIB', 360, 170, C.white, 14); txt(g, '0.6  0.7', 360, 192, C.green, 16);
    txt(g, 'AIR', 70, 240, C.white, 16); txt(g, 'LDG ELEV AUTO', 300, 240, C.white, 15); txt(g, '390', 300, 262, C.green, 18); txt(g, 'FT', 350, 262, C.cyan, 13);
    txt(g, 'CKPT  22    FWD  23    AFT  22', 256, 330, C.green, 16); txt(g, '°C', 470, 330, C.cyan, 13);
    txt(g, 'CAB V/S', 120, 400, C.white, 14); txt(g, String(Math.round(clamp(S.vs / 6, -750, 750) / 50) * 50), 120, 424, C.green, 18); txt(g, 'CAB ALT', 360, 400, C.white, 14); txt(g, String(Math.round(Math.min(8000, Math.max(0, (S.alt - 3000) * 0.25)) / 50) * 50), 360, 424, C.green, 18);
  }
  line(g, 0, 470, W, 470, C.white, 2);
  const a = isa(S.pos.y); const sat = a.T - 273.15; const tat = sat + Math.pow(S.tas, 2) / 2010;
  txt(g, 'TAT', 10, 486, C.white, 13, 'left'); txt(g, (tat >= 0 ? '+' : '') + Math.round(tat), 60, 486, C.green, 16, 'left'); txt(g, '°C', 92, 486, C.cyan, 12, 'left');
  txt(g, 'SAT', 10, 504, C.white, 13, 'left'); txt(g, (sat >= 0 ? '+' : '') + Math.round(sat), 60, 504, C.green, 16, 'left'); txt(g, '°C', 92, 504, C.cyan, 12, 'left');
  const tt = new Date(Date.UTC(2026, 9, 17, 13, 5) + S.time * 1000); txt(g, `${String(tt.getUTCHours()).padStart(2, '0')} H ${String(tt.getUTCMinutes()).padStart(2, '0')}`, 256, 495, C.green, 18);
  txt(g, 'GW', 360, 495, C.white, 14, 'left'); txt(g, String(Math.round(S.mass / 100) * 100), 500, 495, C.green, 18, 'right');
  d.tex.needsUpdate = true;
}

// ================= MCDU =================
const MCDU = { page: 'MENU', scratch: '', msg: '' };
function mcduMsg(m) { MCDU.msg = m; }
function mcduClr() { MCDU.scratch = ''; MCDU.msg = ''; }
function fmsCheck() { const f = S.fms, e = f.ent; f.init = !!(f.coRte && f.fltNbr && f.ci != null && f.crz); f.perf = !!(e.v1 && e.vr && e.v2 && e.flaps && e.flex); }
function fmsComplete() { const f = S.fms; Object.assign(f, { coRte: true, fromTo: true, fltNbr: 'ALB324', ci: 30, crz: CRZ_FL, v1: 142, vr: 145, v2: 149, flex: 55 }); f.ent = { v1: true, vr: true, v2: true, flaps: true, flex: true }; fmsCheck(); }
function mcduLines() { // returns 14 lines [{t,c,a}] and LSK actions
  const L = Array.from({ length: 14 }, () => []); const act = { L: [], R: [] };
  const put = (row, t, c = C.white, a = 'left', sz = 'L') => L[row].push({ t, c, a, sz });
  const p = MCDU.page;
  if (!S.elec.ac) return { L, act, off: true };
  if (p === 'MENU') { put(0, 'MCDU MENU', C.white, 'center'); put(2, '<FMGC', C.green); put(4, '<ATSU'); put(6, '<AIDS'); put(8, '<CFDS'); act.L[0] = () => MCDU.page = 'INIT'; }
  else if (p === 'INIT') {
    const f = S.fms;
    put(0, 'INIT', C.white, 'center');
    put(1, ' CO RTE', C.white, 'left', 's'); put(1, 'FROM/TO  ', C.white, 'right', 's');
    put(2, f.coRte ? 'EGLLLFPG1' : '[        ]', f.coRte ? C.cyan : C.amber); put(2, f.fromTo ? 'EGLL/LFPG' : '____/____', f.fromTo ? C.cyan : C.amber, 'right');
    put(3, 'ALTN/CO RTE', C.white, 'left', 's'); put(3, 'INIT ', C.white, 'right', 's');
    put(4, '----/---------', C.white); put(4, 'REQUEST*', C.amber, 'right');
    put(5, 'FLT NBR', C.white, 'left', 's'); put(6, f.fltNbr || '________', f.fltNbr ? C.cyan : C.amber);
    put(6, 'IRS INIT>', C.white, 'right');
    put(7, 'LAT', C.white, 'left', 's'); put(8, '5128.2N', C.cyan); put(7, 'LONG ', C.white, 'right', 's'); put(8, '00027.3W', C.cyan, 'right');
    put(9, 'COST INDEX', C.white, 'left', 's'); put(10, f.ci != null ? String(f.ci) : f.fromTo ? '___' : '---', f.ci != null ? C.cyan : f.fromTo ? C.amber : C.white);
    put(11, 'CRZ FL/TEMP', C.white, 'left', 's'); put(11, 'TROPO ', C.white, 'right', 's'); put(12, f.crz ? 'FL' + f.crz + '/-35°' : f.fromTo ? '_____/___°' : '-----/---°', f.crz ? C.cyan : f.fromTo ? C.amber : C.white); put(12, '36090', C.cyan, 'right');
    const sc = MCDU.scratch;
    act.L[0] = () => { if (!sc) return mcduMsg('FORMAT ERROR'); if (sc === 'EGLLLFPG1') { f.coRte = true; f.fromTo = true; mcduClr(); fmsCheck(); Tut.event('mcdu_init'); } else mcduMsg('NOT IN DATABASE'); };
    act.R[0] = () => { if (!sc) return mcduMsg('FORMAT ERROR'); if (sc === 'EGLL/LFPG') { f.fromTo = true; f.coRte = true; mcduClr(); fmsCheck(); mcduMsg('CO RTE EGLLLFPG1 LOADED'); } else if (/^[A-Z]{4}\/[A-Z]{4}$/.test(sc)) mcduMsg('NOT IN DATABASE'); else mcduMsg('FORMAT ERROR'); };
    act.L[2] = () => { if (/^[A-Z0-9]{1,8}$/.test(sc)) { f.fltNbr = sc; mcduClr(); fmsCheck(); } else mcduMsg('FORMAT ERROR'); };
    act.L[4] = () => { if (!f.fromTo) return mcduMsg('NOT ALLOWED'); if (/^\d{1,3}$/.test(sc) && +sc <= 999) { f.ci = +sc; mcduClr(); fmsCheck(); } else mcduMsg('FORMAT ERROR'); };
    act.L[5] = () => { if (!f.fromTo) return mcduMsg('NOT ALLOWED'); const m = sc.match(/^(?:FL)?(\d{2,3})(?:\/.*)?$/); if (m && +m[1] >= 100 && +m[1] <= 390) { f.crz = +m[1]; mcduClr(); fmsCheck(); } else mcduMsg('ENTRY OUT OF RANGE'); };
  }
  else if (p === 'F-PLN') {
    put(0, 'FROM', C.white, 'left', 's'); put(0, 'ALB324 ', C.white, 'right', 's');
    if (!S.fms.coRte) { put(2, 'NO F-PLN', C.white, 'center'); }
    else {
      let row = 1; const start = Math.max(0, S.fms.wp - 1);
      for (let i = start; i < FPLAN.length && row < 12; i++) {
        const w = FPLAN[i]; const nm = w.name === '27R' ? 'EGLL27R' : w.name === 'RW26R' ? 'LFPG26R' : w.name;
        put(row, i === S.fms.wp ? nm : nm, i === S.fms.wp ? C.white : C.green); put(row, w.alt ? (w.alt >= 6000 && w.alt < 10000 ? String(w.alt) : w.alt >= 10000 ? 'FL' + Math.round(w.alt / 100) : String(w.alt)) : (i > 2 && i < 6 ? 'FL' + CRZ_FL : '-----'), w.alt ? C.mag : C.green, 'right');
        if (i > start) { const pw = FPLAN[i - 1]; if (pw.x != null && w.x != null) put(row - 0, '', C.green); }
        row += 2;
      }
      put(12, 'DEST    TIME  DIST  EFOB', C.white, 'left', 's'); put(13, 'LFPG26R  ' + '----  ' + Math.round(distToGo()) + '  ' + (S.fuel / 1000 - 1.6).toFixed(1), C.green);
    }
  }
  else if (p === 'PERF') {
    const f = S.fms, e = f.ent;
    put(0, 'TAKE OFF', S.fms.phase === 'TAKEOFF' ? C.green : C.white, 'center');
    put(1, ' V1   FLP RETR', C.white, 'left', 's'); put(1, 'RWY ', C.white, 'right', 's');
    put(2, e.v1 ? String(f.v1) : '___', e.v1 ? C.cyan : C.amber); put(2, 'F=' + Math.round(speeds().F) , C.green, 'center'); put(2, '27R', C.green, 'right');
    put(3, ' VR    SLT RETR', C.white, 'left', 's'); put(3, 'TO SHIFT ', C.white, 'right', 's');
    put(4, e.vr ? String(f.vr) : '___', e.vr ? C.cyan : C.amber); put(4, 'S=' + Math.round(speeds().S), C.green, 'center'); put(4, '[M]  [  ]*', C.cyan, 'right');
    put(5, ' V2     CLEAN', C.white, 'left', 's'); put(5, 'FLAPS/THS ', C.white, 'right', 's');
    put(6, e.v2 ? String(f.v2) : '___', e.v2 ? C.cyan : C.amber); put(6, 'O=' + Math.round(speeds().gd), C.green, 'center'); put(6, e.flaps ? '1/UP0.8' : '[ ]/[   ]', e.flaps ? C.cyan : C.amber, 'right');
    put(7, 'TRANS ALT', C.white, 'left', 's'); put(7, 'FLEX TO TEMP ', C.white, 'right', 's');
    put(8, '6000', C.cyan); put(8, e.flex ? f.flex + '°' : '[ ]°', e.flex ? C.cyan : C.amber, 'right');
    put(9, 'THR RED/ACC', C.white, 'left', 's'); put(9, 'ENG OUT ACC ', C.white, 'right', 's'); put(10, '1500/1500', C.cyan); put(10, '1500', C.cyan, 'right');
    put(12, '<PHASE', C.white); put(12, 'NEXT PHASE>', C.white, 'right');
    const sc = MCDU.scratch, n = /^\d{2,3}$/.test(sc) ? +sc : null;
    const spd = (k) => () => { if (n == null || n < 90 || n > 180) return mcduMsg('ENTRY OUT OF RANGE'); f[k] = n; e[k] = true; mcduClr(); if (e.v1 && e.vr && f.v1 > f.vr || e.vr && e.v2 && f.vr > f.v2) mcduMsg('V1/VR/V2 DISAGREE'); fmsCheck(); Tut.event('mcdu_perf'); };
    act.L[0] = spd('v1'); act.L[1] = spd('vr'); act.L[2] = spd('v2');
    act.R[2] = () => { const m = sc.match(/^([1-3])(?:\/.*)?$/); if (m) { e.flaps = true; mcduClr(); fmsCheck(); Tut.event('mcdu_perf'); } else mcduMsg('FORMAT ERROR'); };
    act.R[3] = () => { if (/^\d{1,2}$/.test(sc) && +sc >= 20 && +sc <= 70) { f.flex = +sc; e.flex = true; mcduClr(); fmsCheck(); Tut.event('mcdu_perf'); } else mcduMsg('ENTRY OUT OF RANGE'); };
  }
  else if (p === 'PROG') {
    put(0, S.fms.phase === 'PREFLIGHT' ? 'PREFLIGHT' : S.fms.phase, C.green, 'center');
    put(1, ' CRZ      OPT     REC MAX', C.white, 'left', 's'); put(2, 'FL' + CRZ_FL + '    FL350   FL390', C.mag);
    put(5, ' REPORT', C.white, 'left', 's'); put(7, ' POSITION UPDATE AT', C.white, 'left', 's');
    put(9, '  BRG / DIST     TO', C.white, 'left', 's'); const w = FPLAN[Math.min(S.fms.wp, FPLAN.length - 1)]; if (w.x != null) put(10, String(Math.round(brg(S.pos.x, S.pos.z, w.x, w.z))).padStart(3, '0') + '° /' + (dist2(S.pos.x, S.pos.z, w.x, w.z) / NM).toFixed(1) + '   ' + w.name, C.green);
    put(11, ' REQUIRED ACCUR ESTIMATED', C.white, 'left', 's'); put(12, ' 1.0NM    HIGH  0.07NM', C.green);
  }
  else if (p === 'RAD NAV') {
    put(0, 'RADIO NAV', C.white, 'center'); put(1, 'VOR1/FREQ', C.white, 'left', 's'); put(2, 'BIG/115.10', C.cyan); put(1, 'FREQ/VOR2', C.white, 'right', 's'); put(2, '117.00/OCK', C.cyan, 'right');
    put(5, 'LS /FREQ', C.white, 'left', 's'); put(6, S.fms.phase === 'APPROACH' || S.fms.phase === 'DESCENT' ? 'GLE/110.10' : '[  ]/[   ]', C.mag); put(7, 'CRS', C.white, 'left', 's'); put(8, 'F266', C.mag);
  }
  return { L, act };
}
function drawMCDU(d) {
  const g = d.g, W = d.c.width, H = d.c.height;
  g.fillStyle = '#020403'; g.fillRect(0, 0, W, H);
  const res = mcduLines(); MCDU.act = res.act;
  if (res.off) { d.tex.needsUpdate = true; return; }
  const lh = H / 14.6, cw = W / 24;
  res.L.forEach((items, row) => items.forEach(it => {
    const size = it.sz === 's' ? lh * 0.62 : lh * 0.86; const y = 8 + row * lh + lh * 0.5;
    const x = it.a === 'left' ? 6 : it.a === 'right' ? W - 6 : W / 2; txt(g, it.t, x, y, it.c, size, it.a);
  }));
  const sc = MCDU.msg || MCDU.scratch; txt(g, sc, 6, H - lh * 0.5, MCDU.msg ? C.white : C.white, lh * 0.86, 'left');
  d.tex.needsUpdate = true;
}
function mcduKey(k) {
  Audio2.click();
  if (['INIT', 'F-PLN', 'PERF', 'PROG', 'RAD NAV', 'MENU', 'DIR', 'FUEL PRED', 'SEC F-PLN', 'DATA'].includes(k)) { MCDU.page = k === 'DIR' ? 'F-PLN' : k; MCDU.msg = ''; Tut.event('mcdu_page_' + k); return; }
  if (k === 'CLR') { if (MCDU.msg) MCDU.msg = ''; else MCDU.scratch = MCDU.scratch.slice(0, -1); return; }
  if (/^[LR][1-6]$/.test(k)) { MCDU.act = mcduLines().act; const side = k[0], i = +k[1] - 1; const f = MCDU.act && MCDU.act[side][i]; if (f) f(); return; }
  if (k.length === 1 && MCDU.scratch.length < 22) { MCDU.msg = ''; MCDU.scratch += k; }
}
