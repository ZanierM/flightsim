// ---------- A320-family exterior model (procedural) ----------
// Local frame: forward = -z, up = +y, right = +x. Origin = main gear ground contact.
const NOSE_Z = -17.4, TAIL_Z = 20.2, FUS_Y = 3.45, FUS_R = 1.98;
function fusR(t) { // t = distance from nose (m)
  if (t < 0.01) return 0.05;
  if (t < 6.5) { const k = t / 6.5; return FUS_R * Math.pow(Math.sin(k * Math.PI / 2), 0.62); }
  if (t < 26.5) return FUS_R;
  const k = (t - 26.5) / (37.6 - 26.5); return FUS_R * (1 - 0.86 * Math.pow(k, 1.35));
}
function fusOff(t) { // vertical offset of section centre
  if (t < 6) return -Math.pow((6 - t) / 6, 2) * 0.55;
  if (t > 26.5) return Math.pow((t - 26.5) / 11.1, 1.5) * 1.15;
  return 0;
}
function liveryTexture(name) {
  const Wd = 2048, Hh = 512; const c = document.createElement('canvas'); c.width = Wd; c.height = Hh; const g = c.getContext('2d');
  // x: along length nose(0)->tail(Wd); y: around (0 = belly ... 0.25 right ... 0.5 top ... 0.75 left)
  g.fillStyle = '#f2f3f4'; g.fillRect(0, 0, Wd, Hh);
  const yb = (u) => u * Hh;
  // belly grey
  g.fillStyle = '#b9c0c7'; g.fillRect(0, 0, Wd, yb(0.12)); g.fillRect(0, yb(0.88), Wd, yb(0.12));
  // navy lower stripe & red pinstripe
  g.fillStyle = '#1d2f5a'; g.fillRect(Wd * 0.03, yb(0.12), Wd * 0.97, yb(0.06)); g.fillRect(Wd * 0.03, yb(0.82), Wd * 0.97, yb(0.06));
  g.fillStyle = '#b3242c'; g.fillRect(Wd * 0.03, yb(0.18), Wd * 0.97, yb(0.008)); g.fillRect(Wd * 0.03, yb(0.812), Wd * 0.97, yb(0.008));
  const L = 37.6, px = (t) => t / L * Wd;
  g.strokeStyle = 'rgba(70,80,90,.11)'; g.lineWidth = 1;
  for (const t of [4.8, 7.1, 10.5, 14.1, 18.5, 22.8, 27.1, 31.5, 35.3]) { g.beginPath(); g.moveTo(px(t), 0); g.lineTo(px(t), Hh); g.stroke(); }
  // cabin windows (both sides)
  for (const side of [0.29, 0.71]) {
    for (let t = 7.2; t < 30.5; t += 0.535) {
      if (Math.abs(t - 15.5) < 0.6 || Math.abs(t - 16.4) < 0.45) continue; // overwing exits gap
      g.fillStyle = '#20262c'; g.beginPath(); g.ellipse(px(t), yb(side), 3.4, 6.2, 0, 0, 7); g.fill();
    }
    // doors
    g.strokeStyle = 'rgba(80,90,100,.8)'; g.lineWidth = 2;
    for (const t of [5.6, 31.6]) { g.strokeRect(px(t) - 13, yb(side) - 34, 26, 62); }
    for (const t of [15.3, 16.5]) g.strokeRect(px(t) - 8, yb(side) - 14, 16, 28);
  }
  // cockpit windows (dark band around nose, top-front)
  g.fillStyle = '#121619';
  const cw = (u0, u1, t0, t1) => { g.beginPath(); g.moveTo(px(t0), yb(u0)); g.lineTo(px(t1), yb(u0)); g.lineTo(px(t1) - 3, yb(u1)); g.lineTo(px(t0) + 6, yb(u1)); g.closePath(); g.fill(); };
  cw(0.40, 0.47, 2.45, 3.25); cw(0.53, 0.60, 2.45, 3.25); cw(0.35, 0.40, 3.3, 3.9); cw(0.60, 0.65, 3.3, 3.9); cw(0.33, 0.36, 4.0, 4.4); cw(0.64, 0.67, 4.0, 4.4);
  // radome slightly greyer
  g.fillStyle = 'rgba(160,165,170,.35)'; g.fillRect(0, 0, px(1.6), Hh);
  // titles
  g.fillStyle = '#1d2f5a'; g.font = 'bold 54px "Trebuchet MS", Arial, sans-serif'; g.textBaseline = 'middle';
  // right side (u ~ 0.36): viewer sees nose on right -> mirror horizontally
  g.save(); g.translate(px(10.0), yb(0.365)); g.scale(-1, -1); g.textAlign = 'right'; g.fillText(name, 0, 0); g.restore();
  g.save(); g.translate(px(10.0), yb(0.635)); g.scale(1, 1); g.textAlign = 'left'; g.fillText(name, 0, 0); g.restore();
  // registration near tail
  g.font = 'bold 22px Arial'; g.fillStyle = '#333';
  g.save(); g.translate(px(31.2), yb(0.33)); g.scale(-1, -1); g.textAlign = 'right'; g.fillText('G-ALBN', 0, 0); g.restore();
  g.save(); g.translate(px(31.2), yb(0.67)); g.textAlign = 'left'; g.fillText('G-ALBN', 0, 0); g.restore();
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
}
function loft(sections) { // sections: arrays of [x,y,z] rings with equal count; returns geometry with side walls + end caps
  const n = sections[0].length; const P = []; const I = [];
  sections.forEach(s => s.forEach(p => P.push(p[0], p[1], p[2])));
  for (let j = 0; j < sections.length - 1; j++) for (let i = 0; i < n; i++) { const a = j * n + i, b = j * n + (i + 1) % n, c = (j + 1) * n + i, d = (j + 1) * n + (i + 1) % n; I.push(a, c, b, b, c, d); }
  // caps
  const cap = (j, flip) => { const base = j * n; for (let i = 1; i < n - 1; i++) flip ? I.push(base, base + i + 1, base + i) : I.push(base, base + i, base + i + 1); };
  cap(0, false); cap(sections.length - 1, true);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals(); return g;
}
function airfoil(chord, thick, n = 14) { // returns [x along chord (0 LE ->1 TE), y]
  const up = [], lo = [];
  for (let i = 0; i <= n; i++) { const x = 1 - Math.cos(i / n * Math.PI / 2 * 2) ; const xx = (1 - Math.cos(i / n * Math.PI)) / 2; const yt = 5 * thick * (0.2969 * Math.sqrt(xx) - 0.126 * xx - 0.3516 * xx * xx + 0.2843 * xx ** 3 - 0.1036 * xx ** 4); const cam = 0.02 * Math.sin(xx * Math.PI); up.push([xx * chord, (yt + cam) * chord]); lo.push([xx * chord, (-yt + cam * 0.5) * chord]); }
  return up.concat(lo.reverse().slice(1, -1));
}
function wingGeom(side, rootLE, rootChord, tipLE, tipChord, rootY, tipY, span, thick, x0 = 1.6) {
  // side: +1 right, -1 left. Chord direction = +z (LE at smaller z)
  const af = airfoil(1, thick, 12);
  const mk = (le, ch, y, x, t) => af.map(p => [side * x, y + p[1] * ch * t, le + p[0] * ch]);
  const secs = [];
  const N = 6; for (let i = 0; i <= N; i++) { const k = i / N; secs.push(mk(lerp(rootLE, tipLE, k), lerp(rootChord, tipChord, k), lerp(rootY, tipY, k), lerp(x0, x0 + span, k), lerp(1, 0.75, k))); }
  if (side < 0) secs.forEach(s => s.reverse());
  return loft(secs);
}
function buildA320(opts = {}) {
  const grp = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xe4e8eb, roughness: 0.58, metalness: 0.06 });
  const grey = new THREE.MeshStandardMaterial({ color: 0xaeb6bc, roughness: 0.62, metalness: 0.18 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.6 });
  const navy = new THREE.MeshStandardMaterial({ color: 0x1d2f5a, roughness: 0.4, metalness: 0.1 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.3, metalness: 0.8 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
  // fuselage: lathe with uniform v
  const prof = []; const NS = 90; for (let i = 0; i <= NS; i++) { const t = i / NS * 37.6; prof.push(new THREE.Vector2(Math.max(fusR(t), 0.02), t)); }
  const fg = new THREE.LatheGeometry(prof, 48); fg.rotateX(Math.PI / 2);
  // after rotateX(+90): (x, y=t, z) -> (x, -z, t). shift & apply vertical offsets
  const pa = fg.attributes.position;
  for (let i = 0; i < pa.count; i++) { const t = pa.getZ(i); pa.setZ(i, NOSE_Z + t); pa.setY(i, pa.getY(i) + FUS_Y + fusOff(t)); }
  // swap uv so u = along length (x on canvas), v = around
  const uv = fg.attributes.uv; for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, v, 1 - u); }
  fg.computeVertexNormals();
  const liv = new THREE.MeshStandardMaterial({ map: liveryTexture(opts.name || 'ALBION'), roughness: 0.56, metalness: 0.08 });
  const fus = new THREE.Mesh(fg, liv); grp.add(fus);
  // wings
  const wm = grey;
  for (const s of [1, -1]) {
    const w = new THREE.Mesh(wingGeom(s, -3.6, 6.4, 4.0, 1.55, 1.85, 3.25, 15.4, 0.14), wm); grp.add(w);
    // sharklet
    const sk = new THREE.Mesh(wingGeom(1, 4.05, 1.5, 5.5, 0.6, 0, 0, 2.4, 0.09, 0), wm);
    sk.rotation.z = Math.PI / 2 - s * 0.12; sk.position.set(s * 17.0, 3.25, 0); grp.add(sk);
    // flaps (trailing edge, inboard + outboard), hinge at TE
    const flap = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.12, 1.4), grey); const fp = new THREE.Group();
    fp.position.set(s * 6.6, 2.2, 2.35); fp.rotation.y = s * 0.2; flap.position.set(0, 0, 0.7); fp.add(flap); grp.add(fp);
    (grp.userData.flaps = grp.userData.flaps || []).push(fp);
    // engine
    const eng = new THREE.Group(); eng.position.set(s * 5.75, 1.85, -6.6);
    const nac = []; const NL = 22; for (let i = 0; i <= NL; i++) { const t = i / NL * 4.4; let r = 1.08; if (t < 0.3) r = 0.98 + 0.1 * Math.sin(t / 0.3 * Math.PI / 2); if (t > 3.0) r = 1.08 - (t - 3.0) / 1.4 * 0.38; nac.push(new THREE.Vector2(r, t)); }
    const ng = new THREE.LatheGeometry(nac, 36); ng.rotateX(Math.PI / 2); const nm = new THREE.Mesh(ng, white); eng.add(nm);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.93, 0.93, 0.6, 30, 1, true), dark); inner.rotation.x = Math.PI / 2; inner.position.z = 0.35; eng.add(inner);
    const fan = new THREE.Mesh(new THREE.CircleGeometry(0.92, 30), new THREE.MeshStandardMaterial({ color: 0x3a3f45, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide })); fan.position.z = 0.55; eng.add(fan);
    const spin = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 18), metal); spin.rotation.x = -Math.PI / 2; spin.position.z = 0.35; eng.add(spin);
    const ex = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 18), metal); ex.rotation.x = Math.PI / 2; ex.position.z = 4.85; eng.add(ex);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.07, 8, 36), metal); ring.position.z = 0.02; eng.add(ring);
    const py = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 3.6), white); py.position.set(0, 1.1, 2.6); eng.add(py);
    grp.add(eng);
    (grp.userData.fans = grp.userData.fans || []).push(fan);
  }
  // wing-body fairing
  const fair = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), grey); fair.scale.set(2.25, 1.1, 7.5); fair.position.set(0, 2.0, -0.6); grp.add(fair);
  // horizontal stabiliser
  for (const s of [1, -1]) grp.add(new THREE.Mesh(wingGeom(s, 15.6, 4.0, 19.0, 1.5, 4.35, 4.95, 5.9, 0.1, 0.6), grey));
  // vertical fin (built as wing on its side)
  const fin = new THREE.Mesh(wingGeom(1, 13.2, 6.6, 18.4, 2.6, 0, 0, 6.4, 0.1, 0), navy);
  fin.rotation.z = Math.PI / 2; fin.position.set(0, 5.1, 0); grp.add(fin);
  // fin logo (simple stylised lion-stripe: a white chevron) as a decal plane each side
  const logoC = document.createElement('canvas'); logoC.width = logoC.height = 128; const lg = logoC.getContext('2d'); lg.fillStyle = '#fff'; lg.beginPath(); lg.moveTo(20, 110); lg.lineTo(64, 18); lg.lineTo(108, 110); lg.lineTo(86, 110); lg.lineTo(64, 62); lg.lineTo(42, 110); lg.fill(); lg.fillStyle = '#b3242c'; lg.fillRect(40, 92, 48, 8);
  const logoT = new THREE.CanvasTexture(logoC);
  for (const s of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: logoT, transparent: true })); p.position.set(s * 0.27, 8.7, 16.6); p.rotation.y = s * Math.PI / 2; grp.add(p); }
  // APU exhaust
  // gear
  const gearG = new THREE.Group(); grp.add(gearG); grp.userData.gear = gearG;
  const strut = (x, z, h, r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), metal); m.position.set(x, h / 2 + 0.5, z); return m; };
  const wheel = (x, z, r, w) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 20), tyre); m.rotation.z = Math.PI / 2; m.position.set(x, r, z); const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 14), metal); hub.rotation.z = Math.PI / 2; hub.position.copy(m.position); return [m, hub]; };
  for (const s of [1, -1]) { const g = new THREE.Group(); g.add(strut(s * 3.8, 0, 2.0, 0.14)); wheel(s * 3.45, 0, 0.58, 0.38).forEach(o => g.add(o)); wheel(s * 4.15, 0, 0.58, 0.38).forEach(o => g.add(o)); gearG.add(g); (grp.userData.mains = grp.userData.mains || []).push(g); }
  const ngr = new THREE.Group(); ngr.add(strut(0, -12.6, 1.8, 0.1)); wheel(-0.22, -12.6, 0.38, 0.26).forEach(o => ngr.add(o)); wheel(0.22, -12.6, 0.38, 0.26).forEach(o => ngr.add(o)); gearG.add(ngr); grp.userData.noseGear = ngr;
  // lights
  const lightMat = (c) => new THREE.SpriteMaterial({ map: W.lightTex, color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const L = {};
  const addL = (key, c, x, y, z, s) => { const sp = new THREE.Sprite(lightMat(c)); sp.position.set(x, y, z); sp.scale.set(s, s, s); grp.add(sp); (L[key] = L[key] || []).push(sp); sp.visible = false; };
  addL('nav', 0xff2020, -17.0, 3.3, 0.6, 0.9); addL('nav', 0x20ff40, 17.0, 3.3, 0.6, 0.9); addL('nav', 0xffffff, 0, 4.9, 20.3, 0.8);
  addL('strobe', 0xffffff, -17.1, 3.3, 0.9, 2.6); addL('strobe', 0xffffff, 17.1, 3.3, 0.9, 2.6); addL('strobe', 0xffffff, 0, 4.9, 20.4, 2.2);
  addL('beacon', 0xff1010, 0, FUS_Y + FUS_R + 0.15, 0, 1.6); addL('beacon', 0xff1010, 0, FUS_Y - FUS_R - 0.05, 2, 1.6);
  addL('land', 0xfff8e0, -5.0, 2.0, -2.5, 2.2); addL('land', 0xfff8e0, 5.0, 2.0, -2.5, 2.2); addL('taxi', 0xfff8e0, 0, 1.6, -12.6, 1.5);
  grp.userData.lights = L;
  grp.traverse(o => { if (o.isMesh) { o.castShadow = false; } });
  return grp;
}
function setModelState(m, st, t) {
  // gear: 0 up, 1 down
  const gd = st.gearPos;
  const ud = m.userData;
  ud.gear.visible = gd > 0.02;
  ud.mains.forEach((g, i) => { const s = i === 0 ? 1 : -1; g.rotation.z = s * (1 - gd) * 1.5; g.position.y = (1 - gd) * 1.2; });
  ud.noseGear.rotation.x = -(1 - gd) * 1.5; ud.noseGear.position.y = (1 - gd) * 0.8;
  ud.flaps.forEach(f => f.rotation.x = st.flapAngle * D2R * 0.8);
  ud.fans.forEach(f => f.rotation.z += (st.eng ? 0 : 0));
  const L = ud.lights; if (!L) return;
  L.nav.forEach(s => s.visible = st.lt.nav);
  const strobeOn = st.lt.strobe === 2 || (st.lt.strobe === 1 && !st.onGround); const sf = (t % 1.1) < 0.06 || ((t % 1.1) > 0.16 && (t % 1.1) < 0.2);
  L.strobe.forEach(s => s.visible = strobeOn && sf);
  L.beacon.forEach(s => s.visible = st.lt.beacon && (t % 1.0) < 0.12);
  L.land.forEach(s => s.visible = st.lt.land && gd > 0.5);
  L.taxi.forEach(s => s.visible = st.lt.nose > 0 && gd > 0.5);
}
