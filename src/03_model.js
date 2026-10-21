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
  // Five joined, swept A320-style panes. Their frames share edges, rather than
  // looking like separate black rectangles stuck onto the radome.
  const pane = (points) => {
    g.beginPath(); points.forEach(([t, u], i) => i ? g.lineTo(px(t), yb(u)) : g.moveTo(px(t), yb(u)));
    g.closePath();
    const glass = g.createLinearGradient(0, yb(.26), 0, yb(.74));
    glass.addColorStop(0, '#294453'); glass.addColorStop(.5, '#17252e'); glass.addColorStop(1, '#294453');
    g.fillStyle = glass; g.fill();
    g.lineWidth = 3; g.strokeStyle = '#d0d6d8'; g.stroke();
  };
  pane([[2.65,.485],[3.15,.405],[4.15,.420],[3.65,.485]]);
  pane([[2.65,.515],[3.65,.515],[4.15,.580],[3.15,.595]]);
  pane([[3.15,.405],[3.95,.325],[4.90,.345],[4.15,.420]]);
  pane([[3.15,.595],[4.15,.580],[4.90,.655],[3.95,.675]]);
  pane([[3.95,.325],[4.55,.282],[5.25,.295],[4.90,.345]]);
  pane([[3.95,.675],[4.90,.655],[5.25,.705],[4.55,.718]]);
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
function fanBladeGeom() {
  const p = [], ix = [], count = 20;
  for (let i = 0; i < count; i++) {
    const a = i * 2 * Math.PI / count, k = p.length / 3;
    for (const [r, sweep, z] of [[0.25, 0, 0.015], [0.84, 0.14, -0.025], [0.85, 0.29, 0.02], [0.27, 0.17, 0.04]]) {
      p.push(Math.cos(a + sweep) * r, Math.sin(a + sweep) * r, z);
    }
    ix.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(ix); g.computeVertexNormals(); return g;
}
function wingSkinLines(side) {
  const p = [];
  const at = (span, chord) => {
    const ch = lerp(6.4, 1.55, span), le = lerp(-3.6, 4.0, span);
    const yt = 5 * .14 * (.2969 * Math.sqrt(chord) - .126 * chord - .3516 * chord ** 2 + .2843 * chord ** 3 - .1036 * chord ** 4);
    return [side * (1.6 + 15.4 * span), lerp(1.85, 3.25, span) + (yt + .02 * Math.sin(chord * Math.PI)) * ch * lerp(1, .75, span) + .018, le + chord * ch];
  };
  const line = (a, b) => p.push(...at(...a), ...at(...b));
  for (const chord of [.12, .76]) for (let i = 1; i < 15; i++) line([i / 16, chord], [(i + 1) / 16, chord]);
  for (const span of [.28, .54, .79]) for (let i = 1; i < 7; i++) line([span, .12 + i * .08], [span, .12 + (i + 1) * .08]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x59636b, transparent: true, opacity: .58, depthWrite: false }));
}
function buildA320(opts = {}) {
  const grp = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xe4e8eb, roughness: 0.58, metalness: 0.06 });
  const grey = new THREE.MeshStandardMaterial({ color: 0xaeb6bc, roughness: 0.62, metalness: 0.18 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.6 });
  const navy = new THREE.MeshStandardMaterial({ color: 0x1d2f5a, roughness: 0.4, metalness: 0.1 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.3, metalness: 0.8 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
  const intakeMat = new THREE.MeshStandardMaterial({ color: 0x4c555c, roughness: 0.46, metalness: 0.52, side: THREE.DoubleSide });
  const inletLipMat = new THREE.MeshStandardMaterial({ color: 0xb7bec2, roughness: 0.28, metalness: 0.7 });
  const fanBlades = fanBladeGeom();
  const fanMat = new THREE.MeshStandardMaterial({ color: 0x929da5, metalness: 0.42, roughness: 0.46, side: THREE.DoubleSide });
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
    grp.add(wingSkinLines(s));
    // sharklet
    const sk = new THREE.Mesh(wingGeom(1, 4.05, 1.5, 5.5, 0.6, 0, 0, 2.4, 0.09, 0), navy);
    sk.rotation.z = Math.PI / 2 - s * 0.12; sk.position.set(s * 17.0, 3.25, 0); grp.add(sk);
    // flaps (trailing edge, inboard + outboard), hinge at TE
    const flap = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.12, 1.4), grey); const fp = new THREE.Group();
    fp.position.set(s * 6.6, 2.2, 2.35); fp.rotation.y = s * 0.2; flap.position.set(0, 0, 0.7); fp.add(flap); grp.add(fp);
    (grp.userData.flaps = grp.userData.flaps || []).push(fp);
    // engine
    const eng = new THREE.Group(); eng.position.set(s * 5.75, 1.50, -6.6);
    // CFM-style underwing nacelle: rounded intake, deep fan well, tapered core
    // and an open exhaust. The fan sits behind the lip instead of filling it.
    const nac = []; const NL = 32;
    for (let i = 0; i <= NL; i++) {
      const t = i / NL * 4.55;
      let r = t < .22 ? 1.04 + .09 * Math.sin(t / .22 * Math.PI / 2) : 1.13;
      if (t > 1.15) r = 1.13 - .1 * (t - 1.15) / 1.95;
      if (t > 3.1) r = 1.03 - .29 * (t - 3.1) / 1.45;
      nac.push(new THREE.Vector2(r, t));
    }
    const ng = new THREE.LatheGeometry(nac, 48); ng.rotateX(Math.PI / 2); eng.add(new THREE.Mesh(ng, white));
    const inlet = new THREE.Mesh(new THREE.CylinderGeometry(.98, .92, .9, 48, 1, true), intakeMat);
    inlet.rotation.x = Math.PI / 2; inlet.position.z = .47; eng.add(inlet);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(1.035, .085, 10, 48), inletLipMat);
    lip.position.z = .015; eng.add(lip);
    const fan = new THREE.Group(); fan.position.z = .92;
    fan.add(new THREE.Mesh(new THREE.CircleGeometry(.91, 48), new THREE.MeshStandardMaterial({ color: 0x151b20, roughness: 0.9, side: THREE.DoubleSide })));
    fan.add(new THREE.Mesh(fanBlades, fanMat)); eng.add(fan);
    const spin = new THREE.Mesh(new THREE.ConeGeometry(.22, .52, 24), metal);
    spin.rotation.x = -Math.PI / 2; spin.position.z = .72; eng.add(spin);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(.55, .6, .55, 36, 1, true), intakeMat);
    nozzle.rotation.x = Math.PI / 2; nozzle.position.z = 4.72; eng.add(nozzle);
    const exhaustDark = new THREE.Mesh(new THREE.CircleGeometry(.53, 36), dark);
    exhaustDark.position.z = 4.99; eng.add(exhaustDark);
    const exhaustLip = new THREE.Mesh(new THREE.TorusGeometry(.59, .035, 8, 36), metal);
    exhaustLip.position.z = 4.99; eng.add(exhaustLip);
    const seam = new THREE.Mesh(new THREE.TorusGeometry(1.08, .01, 5, 48), grey);
    seam.position.z = 2.75; eng.add(seam);
    // Sloped pylon, narrow at the engine and blended into the wing above.
    const pylon = loft([
      [[-.15,.8,.85],[.15,.8,.85],[.15,.8,3.65],[-.15,.8,3.65]],
      [[-.23,1.28,.25],[.23,1.28,.25],[.23,1.28,3.95],[-.23,1.28,3.95]],
    ]);
    eng.add(new THREE.Mesh(pylon, white));
    grp.add(eng);
    (grp.userData.fans = grp.userData.fans || []).push({ rotor: fan, engine: s === -1 ? 0 : 1 });
  }
  // wing-body fairing
  const fair = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), grey); fair.scale.set(2.25, 1.1, 7.5); fair.position.set(0, 2.0, -0.6); grp.add(fair);
  // horizontal stabiliser
  for (const s of [1, -1]) grp.add(new THREE.Mesh(wingGeom(s, 15.6, 4.0, 19.0, 1.5, 4.35, 4.95, 5.9, 0.1, 0.6), grey));
  // vertical fin (built as wing on its side)
  const fin = new THREE.Mesh(wingGeom(1, 13.2, 6.6, 18.4, 2.6, 0, 0, 6.4, 0.1, 0), navy);
  fin.rotation.z = Math.PI / 2; fin.position.set(0, 5.1, 0); grp.add(fin);
  // The tail mark fits entirely inside the fin and follows its tapered outline.
  const logoC = document.createElement('canvas'); logoC.width = logoC.height = 256;
  const lg = logoC.getContext('2d'); lg.fillStyle = '#fff';
  lg.beginPath(); lg.moveTo(40, 215); lg.lineTo(128, 34); lg.lineTo(216, 215);
  lg.lineTo(176, 215); lg.lineTo(128, 112); lg.lineTo(80, 215); lg.fill();
  lg.fillStyle = '#b3242c'; lg.fillRect(78, 184, 100, 14);
  const logoT = new THREE.CanvasTexture(logoC);
  for (const s of [1, -1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 2.35), new THREE.MeshBasicMaterial({ map: logoT, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    p.position.set(s * .29, 8.35, 18.25); p.rotation.y = s * Math.PI / 2; grp.add(p);
  }
  // APU exhaust
  // gear
  const gearG = new THREE.Group(); grp.add(gearG); grp.userData.gear = gearG;
  const strut = (x, z, h, r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), metal); m.position.set(x, h / 2 + 0.5, z); return m; };
  const wheel = (x, z, r, w) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 20), tyre); m.rotation.z = Math.PI / 2; m.position.set(x, r, z); const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 14), metal); hub.rotation.z = Math.PI / 2; hub.position.copy(m.position); return [m, hub]; };
  for (const s of [1, -1]) { const g = new THREE.Group(); g.add(strut(s * 3.8, 0, 2.0, 0.14)); wheel(s * 3.45, 0, 0.58, 0.38).forEach(o => g.add(o)); wheel(s * 4.15, 0, 0.58, 0.38).forEach(o => g.add(o)); gearG.add(g); (grp.userData.mains = grp.userData.mains || []).push(g); }
  const ngr = new THREE.Group(); ngr.add(strut(0, -12.6, 1.8, 0.1)); wheel(-0.22, -12.6, 0.38, 0.26).forEach(o => ngr.add(o)); wheel(0.22, -12.6, 0.38, 0.26).forEach(o => ngr.add(o)); gearG.add(ngr); grp.userData.noseGear = ngr;
  // lights
  const lightMat = (c) => new THREE.SpriteMaterial({ map: W.lightTex, color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const lensMat = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .22, roughness: .3, metalness: .1 });
  const lens = (parent, c, x, y, z, r) => {
    const mount = new THREE.Mesh(new THREE.SphereGeometry(r * 1.35, 12, 8), dark);
    mount.position.set(x, y, z); parent.add(mount);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), lensMat(c));
    bulb.position.set(x, y + r * .18, z - r * .3); parent.add(bulb);
  };
  const L = {};
  const addL = (key, c, x, y, z, s) => { const sp = new THREE.Sprite(lightMat(c)); sp.position.set(x, y, z); sp.scale.set(s, s, s); grp.add(sp); (L[key] = L[key] || []).push(sp); sp.visible = false; };
  for (const s of [-1, 1]) {
    const color = s < 0 ? 0xff3030 : 0x35ed65;
    lens(grp, color, s * 17.03, 3.29, 4.25, .12);
    addL('nav', color, s * 17.05, 3.32, 4.22, .72);
    addL('strobe', 0xffffff, s * 17.06, 3.35, 4.42, 1.55);
    // Flush landing-light glass at the wing leading edge, not ahead of it.
    const landing = new THREE.Mesh(new THREE.SphereGeometry(.18, 12, 8), lensMat(0xfff5d7));
    landing.scale.set(1.4, .38, .45); landing.position.set(s * 5.0, 2.15, -1.92); grp.add(landing);
    addL('land', 0xfff8e0, s * 5.0, 2.15, -1.97, 1.35);
  }
  lens(grp, 0xffffff, 0, 4.72, 20.25, .1);
  addL('nav', 0xffffff, 0, 4.75, 20.32, .65);
  addL('strobe', 0xffffff, 0, 4.75, 20.34, 1.3);
  lens(grp, 0xdd2525, 0, FUS_Y + FUS_R + .045, 0, .13);
  lens(grp, 0xdd2525, 0, FUS_Y - FUS_R - .04, 2, .13);
  addL('beacon', 0xff1010, 0, FUS_Y + FUS_R + 0.15, 0, 1.6); addL('beacon', 0xff1010, 0, FUS_Y - FUS_R - 0.05, 2, 1.6);
  lens(ngr, 0xfff5d7, 0, 1.55, -12.65, .14);
  addL('taxi', 0xfff8e0, 0, 1.58, -12.7, 1.15);
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
  const fanDt = Math.max(0, Math.min(0.1, t - (ud.lastFanT ?? t))); ud.lastFanT = t;
  ud.fans.forEach(f => { f.rotor.rotation.z += fanDt * (st.eng?.[f.engine]?.N1 || 0) * 0.22; });
  const L = ud.lights; if (!L) return;
  L.nav.forEach(s => s.visible = st.lt.nav);
  const strobeOn = st.lt.strobe === 2 || (st.lt.strobe === 1 && !st.onGround); const sf = (t % 1.1) < 0.06 || ((t % 1.1) > 0.16 && (t % 1.1) < 0.2);
  L.strobe.forEach(s => s.visible = strobeOn && sf);
  L.beacon.forEach(s => s.visible = st.lt.beacon && (t % 1.0) < 0.12);
  L.land.forEach(s => s.visible = st.lt.land && gd > 0.5);
  L.taxi.forEach(s => s.visible = st.lt.nose > 0 && gd > 0.5);
}
