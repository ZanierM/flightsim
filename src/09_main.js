// ---------- Main: renderer, views, input, UI, scenarios ----------
let renderer, wScene, wCam, sky, clouds, cities, vegetation, ground, model, shadowBlob, taxiLights, sunLight, hemiW;
const GRAPHICS_PRESETS = {
  performance: { pixelRatio: 1, cities: 14000, clouds: 0.45, shadows: false, description: 'Fewer buildings, trees and clouds, with cockpit shadows off. Best for slower devices.' },
  balanced: { pixelRatio: 1.5, cities: 46000, clouds: 1, shadows: true, description: 'Full scenery and cockpit shadows at a moderate render resolution.' },
  high: { pixelRatio: 2, cities: 46000, clouds: 1, shadows: true, description: 'Full scenery and cockpit shadows, with a sharper image on high-density displays.' }
};
const GRAPHICS_KEY = 'flightsim.graphicsQuality';
function savedGraphicsQuality() {
  try { const value = localStorage.getItem(GRAPHICS_KEY); if (Object.hasOwn(GRAPHICS_PRESETS, value)) return value; } catch (e) { }
  return 'balanced';
}
let graphicsQuality = savedGraphicsQuality(), graphicsFrames = 0, graphicsTime = 0, graphicsFps = 0;
function updateGraphicsPanel() {
  if (!$('graphics')) return;
  const preset = GRAPHICS_PRESETS[graphicsQuality];
  $('graphicsPreset').value = graphicsQuality;
  $('graphicsDescription').textContent = preset.description;
  const ratio = Math.min(window.devicePixelRatio || 1, preset.pixelRatio);
  $('graphicsStats').textContent = `${graphicsFps || '—'} FPS · ${Math.round(window.innerWidth * ratio)} × ${Math.round(window.innerHeight * ratio)} render pixels · ${cities ? cities.count.toLocaleString() : '—'} buildings · ${vegetation ? vegetation.trunks.count.toLocaleString() : '—'} trees · ${clouds ? clouds.geometry.instanceCount.toLocaleString() : '—'} cloud puffs`;
}
function applyGraphicsQuality(value) {
  if (!Object.hasOwn(GRAPHICS_PRESETS, value)) return;
  graphicsQuality = value;
  try { localStorage.setItem(GRAPHICS_KEY, value); } catch (e) { }
  const preset = GRAPHICS_PRESETS[value];
  if (renderer) { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset.pixelRatio)); onResize(); }
  if (cities) cities.count = Math.min(cities.userData.fullCount, preset.cities);
  if (vegetation) {
    const fraction = value === 'performance' ? .4 : 1;
    vegetation.trunks.count = Math.round(vegetation.trunks.userData.fullCount * fraction);
    vegetation.crowns.count = vegetation.trunks.count * 2;
  }
  if (clouds) { clouds.userData.density = preset.clouds; clouds.userData.sort(wCam.position); }
  if (CK.sunLight && CK.sunLight.castShadow !== preset.shadows) {
    CK.sunLight.castShadow = preset.shadows;
    CK.scene.traverse(o => { if (o.isMesh) { const mats = Array.isArray(o.material) ? o.material : [o.material]; mats.forEach(m => { if (m) m.needsUpdate = true; }); } });
    renderer.shadowMap.needsUpdate = true;
  }
  updateGraphicsPanel();
}
const VIEW = { mode: 'cockpit', overview: false, yaw: 0, pitch: -10, tyaw: 0, tpitch: -10, fov: 62, oyaw: 200, opitch: 12, odist: 70, lookTo: null };
function fullPanelFov() { return clamp(2 * Math.atan(1.45 / (1.43 * window.innerWidth / window.innerHeight)) * R2D, 50, 94); }
const KEYS = {}; let paused = false, timeComp = 1, started = false, lastT = 0, accum = 0, frameN = 0;
const $ = (id) => document.getElementById(id);
let menuWasPaused = false, briefingWasPaused = false, controlSelectedId = null, controlPreviousFocus = null, controlPreviousFov = null, controlCaptainWasMin = false, dialogPreviousFocus = null;
function menuBackgroundInert(value) { ['gl', 'looks', 'top', 'captain', 'radio', 'xhud', 'controlDrawer'].forEach(id => $(id).inert = value); }
function routePreview() { return ROUTES[$('routeSelect').value] || activeRoute; }
function routeText(route) { return route.plan.map((p, i) => i === 0 ? `${route.from.icao} ${route.depRwy.name}` : i === route.plan.length - 1 ? `${route.to.icao} ${route.arrRwy.name}` : p.name); }
function renderBriefing(route) {
  $('briefingHeading').textContent = `${route.from.icao} → ${route.to.icao} flight briefing`;
  $('briefingIntro').textContent = `Albion ${route.flightNumber.slice(3)} · Airbus A320 · ${route.from.name} to ${route.to.name}. The captain guides the checklists and callouts.`;
  const section = (title, entries) => `<section><h3>${title}</h3><dl>${entries.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl></section>`;
  const channel = route.id === 'return' ? 'ABB → DVR' : 'DVR → ABB';
  $('briefingGrid').innerHTML = section(`DEPARTURE · ${route.from.icao}`, [['Runway', `${route.depRwy.name} · ${route.depRwy.hdg}°`], ['QNH', `${route.from.qnh} hPa`], ['Initial climb', '1500 ft, then 6000 ft'], ['V1 / VR / V2', '142 / 145 / 149 kt']])
    + section('EN ROUTE', [['Company route', route.company], ['Cruise', 'FL250'], ['Fuel loaded', '7800 kg'], ['Channel crossing', channel]])
    + section(`ARRIVAL · ${route.to.icao}`, [['Runway', `${route.arrRwy.name} · ${route.arrRwy.hdg}°`], ['ILS', `${route.ils.ident} · ${route.ils.freq} MHz`], ['Final course', `${route.ils.crs}° / ${route.ils.gs.toFixed(1)}°`], ['QNH', `${route.to.qnh} hPa`]]);
  $('briefingRoute').textContent = routeText(route).join(' → ');
}
function renderRouteMenu() {
  const route = routePreview();
  $('menuFlight').textContent = `ALBION ${route.flightNumber.slice(3)} · AIRBUS A320 · G-ALBN`;
  $('menuHeading').innerHTML = `${route.from.name} <span class="arrow">→</span> ${route.to.name}`;
  $('menuSub').textContent = `A full line flight with a training captain beside you. Start cold and dark, run the checks, push back, taxi, take off from ${route.depRwy.name}, cross the Channel on autopilot and fly the ILS into ${route.arrRwy.name}.`;
  $('menuRoute').replaceChildren(...routeText(route).map((name, i) => { const span = document.createElement('span'); span.textContent = name; if (i === 0 || i === route.plan.length - 1) span.className = 'ap'; return span; }));
  const labels = { cold: [`Cold and dark at ${route.from.icao}`, `Every check from batteries on to engines off at ${route.to.name}. The captain explains each switch.`], runway: [`Lined up on ${route.depRwy.name}`, 'Engines running, checks done, cleared for take-off.'], cruise: ['Over the Channel', 'FL250, autopilot on.'], approach: [`17 miles from ${route.arrRwy.name}`, `4000 ft, ready for the ILS into ${route.to.name}.`], free: ['Free flight', `Lined up on ${route.depRwy.name}. You're on your own.`] };
  document.querySelectorAll('[data-scn]').forEach(button => { const [title, detail] = labels[button.dataset.scn]; button.querySelector('b').textContent = title; button.querySelector('small').textContent = detail; });
  renderBriefing(route);
}
function openMenu() {
  if (!$('menu').hidden) return;
  closeControlDrawer(); menuWasPaused = paused; if (started) paused = true;
  $('routeSelect').value = activeRoute.id; renderRouteMenu();
  $('menuResumeRow').hidden = !started; $('menu').hidden = false; menuBackgroundInert(true);
  (started ? $('btnResume') : $('menu').querySelector('[data-scn]')).focus();
}
function resumeMenu() { if (!started) return; $('menu').hidden = true; menuBackgroundInert(false); paused = menuWasPaused; $('btnMenu').focus(); }
function retryApproach() {
  if (!$('debrief').hidden) closeDialog('debrief');
  if (!$('menu').hidden) { $('menu').hidden = true; menuBackgroundInert(false); }
  if (window.speechSynthesis) speechSynthesis.cancel();
  Audio2.init(); Tut.setRoute(activeRoute.id); scenario('approach');
  started = true; paused = false; timeComp = 1; accum = 0; VIEW.mode = 'cockpit';
  $('captain').classList.remove('min');
}
function openDialog(id) {
  if (id === 'briefing') { renderBriefing($('menu').hidden ? activeRoute : routePreview()); if (started) { briefingWasPaused = paused; paused = true; } }
  closeControlDrawer(); dialogPreviousFocus = document.activeElement; $(id).hidden = false;
  for (const child of document.body.children) if (child !== $(id)) child.inert = true;
  $(id).querySelector('button').focus();
}
function closeDialog(id) {
  $(id).hidden = true; for (const child of document.body.children) child.inert = false;
  if (!$('menu').hidden) menuBackgroundInert(true);
  if (id === 'briefing' && started) paused = briefingWasPaused;
  if (dialogPreviousFocus && dialogPreviousFocus.isConnected) dialogPreviousFocus.focus(); dialogPreviousFocus = null;
}
function activeDialog() { return ['briefing', 'help', 'voices', 'graphics', 'debrief'].find(id => !$(id).hidden); }

function toast(msg, ms = 2600) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, ms); }
function showATC(who, msg, freq) { const a = $('radio'); a.querySelector('.who').textContent = who + (freq ? ' · ' + (freq / 1000).toFixed(3) : ''); a.querySelector('.msg').textContent = msg; a.hidden = false; a.classList.remove('flash'); void a.offsetWidth; a.classList.add('flash'); clearTimeout(a._h); a._h = setTimeout(() => a.hidden = true, Math.max(6000, msg.length * 90)); }

async function nextFrame() { return new Promise(r => requestAnimationFrame(() => r())); }
async function boot() {
  const prog = (t, f) => { $('loadmsg').textContent = t; $('loadbar').style.width = (f * 100) + '%'; };
  prog('Loading cockpit fonts', 0.03); await nextFrame();
  try { await Promise.race([Promise.all([document.fonts.load('16px "B612 Mono"'), document.fonts.load('bold 16px "B612"')]), new Promise(r => setTimeout(r, 2500))]); } catch (e) { }
  renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  renderer.autoClear = false; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  wScene = new THREE.Scene(); wCam = new THREE.PerspectiveCamera(62, 1, 0.3, 2.5e6);
  const el = 26 * D2R, az = 218 * D2R; W.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
  W.hazeCol.setRGB(0.70, 0.765, 0.84); W.skyCol.setRGB(0.42, 0.58, 0.86);
  wScene.fog = new THREE.Fog(W.hazeCol.getHex(), 2000, 40000);
  hemiW = new THREE.HemisphereLight(0xbfd4f0, 0x4a5236, 0.65); wScene.add(hemiW);
  sunLight = new THREE.DirectionalLight(0xfff2de, 1.05); sunLight.position.copy(W.sunDir).multiplyScalar(1000); wScene.add(sunLight); wScene.add(sunLight.target);
  prog('Drawing the coastline, rivers and towns', 0.08); await nextFrame();
  const mask = buildMask();
  prog('Raising the North Downs and the Channel', 0.30); await nextFrame();
  ground = buildTerrain(wScene, mask);
  prog('Building Heathrow and Charles de Gaulle', 0.50); await nextFrame();
  sky = buildSky(wScene); buildAirports(wScene);
  prog('Building London and Paris', 0.62); await nextFrame();
  cities = buildCities(wScene);
  vegetation = buildVegetation(wScene);
  prog('Forming cumulus clouds', 0.72); await nextFrame();
  clouds = buildClouds(wScene);
  prog('Rolling the A320 out of the hangar', 0.80); await nextFrame();
  model = buildA320({ name: 'ALBION' }); wScene.add(model);
  // parked aircraft
  const parked = [[700, -300, 180], [1100, -300, 180], [1300, -300, 180], [-1500, 80, 0], [-1700, 80, 0], [-200, -60, 0], [100, -60, 0]];
  const pm = buildA320({ name: 'ALBION' }); setModelState(pm, { gearPos: 1, flapAngle: 0, lt: { nav: false, strobe: 0, beacon: false, land: false, nose: 0 }, onGround: true }, 0);
  parked.forEach(([x, z, h]) => { const c = pm.clone(); c.position.set(x, groundH(x, z), z); c.rotation.y = -h * D2R; wScene.add(c); });
  const r0 = CDG.rwys[0]; const nn = { x: r0.dz, z: -r0.dx };
  [1200, 1350, 1500, 2600].forEach(a => { const x = r0.tx + r0.dx * a + nn.x * 1420, z = r0.tz + r0.dz * a + nn.z * 1420; const c = pm.clone(); c.position.set(x, groundH(x, z), z); c.rotation.y = -(266 - 90) * D2R; wScene.add(c); });
  // blob shadow
  const sc = mkCanvas(128, 128); const sg = sc.getContext('2d'); const gr = sg.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sg.fillStyle = gr; sg.fillRect(0, 0, 128, 128);
  shadowBlob = new THREE.Mesh(new THREE.PlaneGeometry(36, 40), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })); shadowBlob.rotation.x = -Math.PI / 2; wScene.add(shadowBlob);
  // taxiway centreline green lights
  const tl = []; for (const [path, elev] of [[TAXI_LHR, LHR.elev], [TAXI_CDG, CDG.elev]]) for (let i = 0; i < path.length - 1; i++) { const [a, b] = [path[i], path[i + 1]]; const L = dist2(a[0], a[1], b[0], b[1]); for (let d = 0; d < L; d += 12) { const x = lerp(a[0], b[0], d / L), z = lerp(a[1], b[1], d / L); tl.push(x, elev + PAVE + 0.3, z); } }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tl, 3));
  taxiLights = new THREE.Points(tg, new THREE.PointsMaterial({ map: W.lightTex, color: 0x30ff60, size: 2.4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); wScene.add(taxiLights);
  prog('Wiring the flight deck', 0.88); await nextFrame();
  ['pfd', 'nd', 'ewd', 'sd'].forEach(n => du(n, 512, 512)); DU.pfd2 = DU.pfd; DU.nd2 = DU.nd;
  buildCockpit(); CK.panels.forEach(p => p.redraw(true));
  applyGraphicsQuality(graphicsQuality);
  prog('Ready', 1); await nextFrame();
  onResize(); window.addEventListener('resize', onResize);
  setupInput(); setupUI();
  $('loading').hidden = true;
  scenario('cold'); openMenu(); requestAnimationFrame(loop);
}
function onResize() {
  const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false);
  if (VIEW.overview) VIEW.fov = fullPanelFov();
  wCam.aspect = w / h; wCam.updateProjectionMatrix(); if (CK.cam) { CK.cam.aspect = w / h; CK.cam.updateProjectionMatrix(); }
  updateGraphicsPanel();
}

// ---------------- scenarios ----------------
function engRun(e) { e.master = true; e.run = true; e.starting = false; e.N1 = 19.5; e.N2 = 58.5; e.EGT = 420; e.FF = 290; }
function scenario(name, tutorialFrom, quiet) {
  S = newState(); MCDU.page = 'MENU'; MCDU.scratch = ''; S.ndRange = 2; S.efisLS = false; S.fcu.alt = 100; S.doorsClosed = false; _autoTaxi = false;
  S.baroActual = activeRoute.from.qnh;
  Tut.resetCalls();
  if (name === 'cold') { const s = activeRoute.stand; placeAt(s.x, s.z, s.hdg); S.parkBrake = true; S.cabinReady = false; }
  else {
    // a prepared aircraft
    S.elec.bat1 = S.elec.bat2 = true; S.adirs = [1, 1, 1]; S.adirsT = [1, 1, 1]; S.aligned = true; engRun(S.eng[0]); engRun(S.eng[1]); S.elec.ac = true;
    S.lt.nav = true; S.lt.beacon = true; S.lt.belts = true; fmsComplete(); S.cabinReady = true; S.toConfigTested = true; S.doorsClosed = true;
    S.dcOnT = -999; S.xpdr.code = '4521'; S.xpdr.mode = 1; S.xpdr.tcas = 2; S.rmp.act = activeRoute.towerFreq; S.rmp.stby = activeRoute.groundFreq;
    S.baro.qnh = activeRoute.from.qnh; S.fcu.alt = 6000;
    Object.values(DU).forEach(d => d.boot = 5);
  }
  if (name === 'runway' || name === 'free') {
    const r = activeRoute.depRwy; placeAt(r.tx + r.dx * 40, r.tz + r.dz * 40, r.hdg); S.parkBrake = false; S.flapLever = 1; S.flapPos = 1; S.sbArmed = true; S.autobrake = 3; S.lt.strobe = 2; setLandingLights(0); S.lt.nose = 2; S.fcu.athr = false;
  }
  if (name === 'cruise') {
    const k = activeRoute.cruiseLeg, a = FPLAN[k - 1], b = FPLAN[k]; const x = lerp(a.x, b.x, 0.35), z = lerp(a.z, b.z, 0.35); const h = brg(a.x, a.z, b.x, b.z);
    airborne(x, z, 25000 * FT, h, 290); S.baro.std = true; S.fcu.alt = 25000; S.fms.wp = k; S.fms.phase = 'CRUISE'; S.ap.vert = 'ALT'; S.ap.lat = 'NAV'; S.fms.altLegX = 0;
  }
  if (name === 'approach') {
    const r = activeRoute.arrRwy; const d = 17 * NM; const x = r.tx - r.dx * d, z = r.tz - r.dz * d;
    airborne(x, z, 4000 * FT, r.hdg, 210); S.baroActual = activeRoute.to.qnh; S.baro.qnh = activeRoute.to.qnh; S.fcu.alt = 4000; S.fms.wp = FPLAN.length - 1; S.fms.phase = 'APPROACH'; S.ap.vert = 'ALT'; S.ap.lat = 'HDG'; S.fcu.hdg = r.hdg; S.fcu.hdgMan = true; setLandingLights(0); S.lt.strobe = 1;
  }
  updQuat(); stepSystems(0.001); updNav(); stepFlight(0.0001);
  if (quiet) return;
  Tut.captainOn = name !== 'free';
  const startIdx = { cold: 0, runway: Tut.find('Cleared for take-off'), cruise: Tut.find('Cruise'), approach: Tut.find('Arm the approach') }[name];
  if (name === 'free') Tut.stop(); else Tut.start(tutorialFrom ?? startIdx ?? 0);
  VIEW.overview = false; VIEW.fov = 62; VIEW.yaw = VIEW.tyaw = 0; VIEW.pitch = VIEW.tpitch = -10;
  renderTutUI();
}
// ---------- put the aircraft where a tutorial step expects it (used when skipping) ----------
function prepAircraft() {
  S.elec.bat1 = S.elec.bat2 = true; S.adirs = [1, 1, 1]; S.adirsT = [1, 1, 1]; S.aligned = S.navAligned = true; S.dcOnT = -999;
  S.eng.forEach(e => { if (!e.run) engRun(e); }); S.elec.ac = true; S.engMode = 1;
  S.apu.master = false; S.apu.start = false; S.apu.avail = false; S.apu.N = 0; S.apu.bleed = false;
  fmsComplete(); S.doorsClosed = true; S.cabinReady = true; S.toConfigTested = true; S.pushback = null; _autoTaxi = false;
  S.lt.nav = S.lt.beacon = S.lt.belts = true; S.xpdr.code = '4521'; S.xpdr.entry = ''; S.baro.qnh = S.baro.qnh || activeRoute.from.qnh;
  Object.values(DU).forEach(d => d.boot = 5); timeComp = 1; accum = 0;
}
function trimPitch() { const a = isa(S.pos.y); const v = S.vel.clone().sub(S.wind || new THREE.Vector3()).length(); const c = CONF[Math.round(S.flapPos)]; const CL = S.mass * G / (0.5 * a.rho * v * v * AC.S); S.theta = (CL - c.CL0) / CLA + Math.asin(clamp(S.vel.y / Math.max(v, 1), -0.3, 0.3)); S.gammaT = Math.asin(clamp(S.vel.y / Math.max(v, 1), -0.3, 0.3)); S.ap.gammaC = S.gammaT * R2D; updQuat(); }
function fly(x, z, altFt, hdg, ias, o = {}) {
  prepAircraft(); airborne(x, z, altFt * FT, hdg, ias);
  Object.assign(S.ap, { lat: o.lat || 'NAV', vert: o.vert || 'ALT', latArm: o.latArm || '', vertArm: o.vertArm || '', exped: false });
  S.fcu.alt = o.fcuAlt ?? Math.round(altFt / 100) * 100; if (o.wp != null) S.fms.wp = o.wp; S.fms.phase = o.phase || 'CLIMB';
  S.baro.std = !!o.std; if (!o.std) S.baro.qnh = o.qnh || activeRoute.from.qnh;
  S.flapLever = S.flapPos = o.flaps || 0; S.flapAngle = CONF[S.flapLever].angle; if (o.gear) { S.gearLever = 1; S.gearPos = 1; }
  if (o.tl != null) S.tl = [o.tl, o.tl]; S.fcu.ap1 = o.ap !== false; S.fcu.ap2 = !!o.ap2; S.fcu.athr = true;
  if (o.tl > DET.CL) S.ap.athrMode = ''; S.fcu.spdMan = false; S.fcu.hdgMan = !!o.hdgMan; if (o.hdgMan) S.fcu.hdg = Math.round(hdg);
  if (o.vs) S.vel.y = o.vs * FT / 60;
  setLandingLights(altFt < 10000 ? 0 : 1); S.lt.strobe = 2; S.lt.nose = 0; S.xpdr.mode = 1; S.xpdr.tcas = 2; S.sbArmed = !!o.spl; S.autobrake = o.ab || 0;
  S.airborneT = 600; S.touchdown = null; S.efisLS = !!o.ls; S.flareMode = false;
  if (o.altLeg) { S.fms.altLegX = o.altLeg.x; S.fms.altLegZ = o.altLeg.z; }
  stepSystems(0.001); updNav(); trimPitch(); stepFlight(0.0001);
}
function routePoint(dtgNm) {
  const fp = FPLAN;
  for (let i = 3; i < fp.length; i++) { const a = fp[i - 1], b = fp[i];
    for (let t = 0; t <= 1.0001; t += 0.01) { const x = lerp(a.x, b.x, t), z = lerp(a.z, b.z, t); let d = dist2(x, z, b.x, b.z); for (let k = i + 1; k < fp.length; k++) d += dist2(fp[k - 1].x, fp[k - 1].z, fp[k].x, fp[k].z);
      if (d / NM <= dtgNm) return { x, z, hdg: brg(a.x, a.z, b.x, b.z), wp: i }; } }
  return { x: fp[fp.length - 2].x, z: fp[fp.length - 2].z, hdg: activeRoute.arrRwy.hdg, wp: fp.length - 1 };
}
function onGroundAt(x, z, hdg, kt) { prepAircraft(); placeAt(x, z, hdg); const v = hdgVec(hdg); S.vel.set(v.x * kt * KT, 0, v.z * kt * KT); S.airborneT = 0; S.flareMode = false; stepSystems(0.001); updNav(); stepFlight(0.0001); }
function setupAt(kind) {
  if (activeRoute.id === 'return') return setupReturnAt(kind);
  const r27 = LHR.rwys[0], c = CDG.rwys[0], elevL = LHR.elev / FT, elevC = CDG.elev / FT;
  const ils = (dNm) => { const x = ACTIVE_ILS.gsX - c.dx * dNm * NM, z = ACTIVE_ILS.gsZ - c.dz * dNm * NM; return { x, z, alt: elevC + dNm * NM / FT * Math.tan(3 * D2R) }; };
  const cdgRoll = (along, kt, done) => { onGroundAt(c.tx + c.dx * along, c.tz + c.dz * along, 266, kt); Object.assign(S, { flapLever: 4, flapPos: 4, gearLever: 1, gearPos: 1, sbArmed: !done, autobrake: 2, groundSpoilersOut: !done, spoiler: done ? 0 : 1 });
    S.touchdown = { fpm: -160, x: c.tx + c.dx * 420, z: c.tz + c.dz * 420, t: S.time - 5, ias: 132, pitch: 4.5 }; S.baro.qnh = 1015; S.fms.wp = FPLAN.length - 1; S.fms.phase = done ? 'DONE' : 'APPROACH';
    S.ap.lat = S.ap.vert = 'ROLL OUT'; S.fcu.ap1 = S.fcu.ap2 = false; S.fcu.athr = false; S.tl = [0, 0]; setLandingLights(done ? 1 : 0); S.lt.strobe = done ? 1 : 2; S.xpdr.tcas = 2; S.xpdr.mode = 1; S.rmp.act = 119250; };
  switch (kind) {
    case 'stand': if (dist2(S.pos.x, S.pos.z, LHR_STAND.x, LHR_STAND.z) > 20) { placeAt(LHR_STAND.x, LHR_STAND.z, LHR_STAND.hdg); S.parkBrake = true; } break;
    case 'pushed': onGroundAt(PUSH_END.x, PUSH_END.z, 90, 0); S.parkBrake = true; S.tl = [0, 0]; S.rmp.act = 121905; break;
    case 'hold': onGroundAt(HOLD_27R.x, HOLD_27R.z - 5, 0, 0); S.parkBrake = false; S.lt.nose = Math.max(S.lt.nose, 1); S.tl = [0, 0]; S.rmp.act = 118505; break;
    case 'runway': onGroundAt(1560, -850, 270, 0); Object.assign(S.lt, { strobe: 2, land: true, nose: 2 }); S.xpdr.tcas = 2; S.xpdr.mode = 1; S.parkBrake = false; S.tl = [0, 0]; S.rmp.act = 118505; break;
    case 'roll': onGroundAt(r27.tx - 1150, r27.tz, 270, 138); Object.assign(S.lt, { strobe: 2, land: true, nose: 2 }); S.parkBrake = false; S.tl = [DET.FLX, DET.FLX]; S.fms.phase = 'TAKEOFF'; Object.assign(S.ap, { vert: 'SRS', lat: 'RWY', vertArm: 'CLB', latArm: 'NAV' }); S.fcu.athr = true; S.fcu.alt = 6000; Tut.resetCalls(); break;
    case 'liftoff': fly(r27.tx - 2200, r27.tz, elevL + 60, 270, 158, { lat: 'RWY TRK', vert: 'SRS', vertArm: 'CLB', latArm: 'NAV', gear: true, flaps: 1, tl: DET.FLX, ap: false, phase: 'TAKEOFF', vs: 1500, fcuAlt: 6000, wp: 1 }); S.ap.trk = 270; break;
    case 'climb400': fly(r27.tx - 3300, r27.tz, elevL + 420, 270, 162, { lat: 'NAV', vert: 'SRS', vertArm: 'CLB', flaps: 1, tl: DET.FLX, ap: false, phase: 'TAKEOFF', vs: 1800, fcuAlt: 6000, wp: 1 }); break;
    case 'climb1500': fly(r27.tx - 6500, r27.tz, elevL + 1450, 270, 165, { lat: 'NAV', vert: 'SRS', vertArm: 'CLB', flaps: 1, tl: DET.FLX, phase: 'TAKEOFF', vs: 1800, fcuAlt: 6000, wp: 1 }); break;
    case 'climb2000': fly(r27.tx - 8000, r27.tz, elevL + 2000, 270, 195, { lat: 'NAV', vert: 'CLB', flaps: 1, tl: DET.CL, phase: 'CLIMB', vs: 1500, fcuAlt: 6000, wp: 1 }); break;
    case 'climb6000': { const a = { x: r27.tx - 9000, z: r27.tz }, b = FPLAN[2]; const x = lerp(a.x, b.x, 0.55), z = lerp(a.z, b.z, 0.55); fly(x, z, 6000, brg(a.x, a.z, b.x, b.z), 250, { vert: 'ALT', tl: DET.CL, phase: 'CLIMB', fcuAlt: 6000, wp: 2, altLeg: a }); S.rmp.act = 128405; break; }
    case 'climb10k': { const a = FPLAN[2], b = FPLAN[3]; fly(lerp(a.x, b.x, 0.5), lerp(a.z, b.z, 0.5), 10200, brg(a.x, a.z, b.x, b.z), 255, { vert: 'CLB', tl: DET.CL, phase: 'CLIMB', fcuAlt: 25000, std: true, wp: 3, vs: 2000 }); S.rmp.act = 128405; break; }
    case 'cruise': { const a = FPLAN[4], b = FPLAN[5]; fly(lerp(a.x, b.x, 0.3), lerp(a.z, b.z, 0.3), 25000, brg(a.x, a.z, b.x, b.z), 290, { vert: 'ALT', tl: DET.CL, phase: 'CRUISE', fcuAlt: 25000, std: true, wp: 5 }); S.rmp.act = 128405; break; }
    case 'tod': { const p = routePoint(89); fly(p.x, p.z, 25000, p.hdg, 290, { vert: 'ALT', tl: DET.CL, phase: 'CRUISE', fcuAlt: 25000, std: true, wp: p.wp }); S.rmp.act = 128280; break; }
    case 'desc12': { const p = routePoint(46); fly(p.x, p.z, 12300, p.hdg, 290, { vert: 'DES', tl: DET.CL, phase: 'DESCENT', fcuAlt: 11000, std: true, wp: p.wp, vs: -1800 }); S.rmp.act = 125825; break; }
    case 'appr': { const p = ils(17); fly(p.x, p.z, 4000, 266, 210, { lat: 'HDG', hdgMan: true, vert: 'ALT', tl: DET.CL, phase: 'APPROACH', fcuAlt: 4000, qnh: 1015, wp: FPLAN.length - 1 }); S.rmp.act = 125825; break; }
    case 'appr10': { const p = ils(10); fly(p.x, p.z, p.alt, 266, 185, { lat: 'LOC', vert: 'G/S', tl: DET.CL, phase: 'APPROACH', fcuAlt: 4000, qnh: 1015, flaps: 2, ap2: true, ls: true, vs: -950, wp: FPLAN.length - 1 }); S.rmp.act = 125825; break; }
    case 'final': { const p = ils(4.2); fly(p.x, p.z, p.alt, 266, 140, { lat: 'LOC', vert: 'G/S', tl: DET.CL, phase: 'APPROACH', fcuAlt: 5000, qnh: 1015, flaps: 4, gear: true, ap2: true, ls: true, spl: true, ab: 2, vs: -720, wp: FPLAN.length - 1 }); S.rmp.act = 119250; break; }
    case 'touchdown': cdgRoll(520, 122, false); break;
    case 'rollout': cdgRoll(1500, 64, false); break;
    case 'stopped': cdgRoll(2100, 0, true); S.parkBrake = false; break;
  }
  VIEW.mode = 'cockpit'; updQuat();
}
function setupReturnAt(kind) {
  const dep = activeRoute.depRwy, arr = activeRoute.arrRwy, elevD = activeRoute.from.elev / FT, elevA = activeRoute.to.elev / FT;
  const fromRwy = (r, along, side = 0) => ({ x: r.tx + r.dx * along + r.dz * side, z: r.tz + r.dz * along - r.dx * side });
  const ils = (dNm) => ({ ...fromRwy(arr, -dNm * NM), alt: elevA + dNm * NM / FT * Math.tan(3 * D2R) });
  const roll = (along, kt, done) => { const p = fromRwy(arr, along); onGroundAt(p.x, p.z, arr.hdg, kt);
    Object.assign(S, { flapLever: 4, flapPos: 4, gearLever: 1, gearPos: 1, sbArmed: !done, autobrake: 2, groundSpoilersOut: !done, spoiler: done ? 0 : 1 });
    const td = fromRwy(arr, 420); S.touchdown = { fpm: -180, x: td.x, z: td.z, t: S.time - 5, ias: 132, pitch: 4.5 };
    S.baroActual = S.baro.qnh = activeRoute.to.qnh; S.fms.wp = FPLAN.length - 1; S.fms.phase = done ? 'DONE' : 'APPROACH';
    S.ap.lat = S.ap.vert = 'ROLL OUT'; S.fcu.ap1 = S.fcu.ap2 = S.fcu.athr = false; S.tl = [0, 0]; setLandingLights(done ? 1 : 0); S.lt.strobe = done ? 1 : 2; S.rmp.act = activeRoute.arrivalTowerFreq; };
  switch (kind) {
    case 'stand': { const s = activeRoute.stand; if (dist2(S.pos.x, S.pos.z, s.x, s.z) > 20) { placeAt(s.x, s.z, s.hdg); S.parkBrake = true; } break; }
    case 'pushed': onGroundAt(CDG_PUSH_END.x, CDG_PUSH_END.z, CDG_PUSH_END.hdg, 0); S.parkBrake = true; S.rmp.act = activeRoute.groundFreq; break;
    case 'hold': onGroundAt(HOLD_26R.x, HOLD_26R.z, 86, 0); S.lt.nose = 1; S.rmp.act = activeRoute.towerFreq; break;
    case 'runway': { const p = fromRwy(dep, 40); onGroundAt(p.x, p.z, dep.hdg, 0); S.lt.strobe = 2; setLandingLights(0); S.lt.nose = 2; S.parkBrake = false; S.rmp.act = activeRoute.towerFreq; break; }
    case 'roll': { const p = fromRwy(dep, 1200); onGroundAt(p.x, p.z, dep.hdg, 138); S.lt.strobe = 2; setLandingLights(0); S.tl = [DET.FLX, DET.FLX]; S.fms.phase = 'TAKEOFF'; Object.assign(S.ap, { vert: 'SRS', lat: 'RWY', vertArm: 'CLB', latArm: 'NAV' }); S.fcu.athr = true; S.fcu.alt = 6000; break; }
    case 'liftoff': { const p = fromRwy(dep, 2300); fly(p.x, p.z, elevD + 60, dep.hdg, 158, { lat: 'RWY TRK', vert: 'SRS', vertArm: 'CLB', latArm: 'NAV', gear: true, flaps: 1, tl: DET.FLX, ap: false, phase: 'TAKEOFF', vs: 1500, fcuAlt: 6000, wp: 1 }); S.ap.trk = dep.hdg; break; }
    case 'climb400': { const p = fromRwy(dep, 3400); fly(p.x, p.z, elevD + 420, dep.hdg, 162, { lat: 'NAV', vert: 'SRS', vertArm: 'CLB', flaps: 1, tl: DET.FLX, ap: false, phase: 'TAKEOFF', vs: 1800, fcuAlt: 6000, wp: 1 }); break; }
    case 'climb1500': { const p = fromRwy(dep, 6500); fly(p.x, p.z, elevD + 1450, dep.hdg, 165, { lat: 'NAV', vert: 'SRS', vertArm: 'CLB', flaps: 1, tl: DET.FLX, phase: 'TAKEOFF', vs: 1800, fcuAlt: 6000, wp: 1 }); break; }
    case 'climb2000': { const p = fromRwy(dep, 8000); fly(p.x, p.z, elevD + 2000, dep.hdg, 195, { vert: 'CLB', flaps: 1, tl: DET.CL, phase: 'CLIMB', vs: 1500, fcuAlt: 6000, wp: 1 }); break; }
    case 'climb6000': { const a = fromRwy(dep, 9000), b = FPLAN[2]; fly(lerp(a.x, b.x, .55), lerp(a.z, b.z, .55), 6000, brg(a.x, a.z, b.x, b.z), 250, { vert: 'ALT', tl: DET.CL, phase: 'CLIMB', fcuAlt: 6000, wp: 2, altLeg: a }); break; }
    case 'climb10k': { const a = FPLAN[2], b = FPLAN[3]; fly(lerp(a.x, b.x, .5), lerp(a.z, b.z, .5), 10200, brg(a.x, a.z, b.x, b.z), 255, { vert: 'CLB', tl: DET.CL, phase: 'CLIMB', fcuAlt: 25000, std: true, wp: 3, vs: 2000 }); break; }
    case 'cruise': { const a = FPLAN[3], b = FPLAN[4]; fly(lerp(a.x, b.x, .3), lerp(a.z, b.z, .3), 25000, brg(a.x, a.z, b.x, b.z), 290, { vert: 'ALT', tl: DET.CL, phase: 'CRUISE', fcuAlt: 25000, std: true, wp: 4 }); break; }
    case 'tod': { const p = routePoint(89); fly(p.x, p.z, 25000, p.hdg, 290, { vert: 'ALT', tl: DET.CL, phase: 'CRUISE', fcuAlt: 25000, std: true, wp: p.wp }); break; }
    case 'desc12': { const p = routePoint(46); fly(p.x, p.z, 12300, p.hdg, 290, { vert: 'DES', tl: DET.CL, phase: 'DESCENT', fcuAlt: 11000, std: true, wp: p.wp, vs: -1800 }); break; }
    case 'appr': { const p = ils(17); fly(p.x, p.z, 4000, arr.hdg, 210, { lat: 'HDG', hdgMan: true, vert: 'ALT', tl: DET.CL, phase: 'APPROACH', fcuAlt: 4000, qnh: activeRoute.to.qnh, wp: FPLAN.length - 1 }); S.baroActual = activeRoute.to.qnh; break; }
    case 'appr10': { const p = ils(10); fly(p.x, p.z, p.alt, arr.hdg, 185, { lat: 'LOC', vert: 'G/S', tl: DET.CL, phase: 'APPROACH', fcuAlt: 4000, qnh: activeRoute.to.qnh, flaps: 2, ap2: true, ls: true, vs: -950, wp: FPLAN.length - 1 }); S.baroActual = activeRoute.to.qnh; break; }
    case 'final': { const p = ils(4.2); fly(p.x, p.z, p.alt, arr.hdg, 140, { lat: 'LOC', vert: 'G/S', tl: DET.CL, phase: 'APPROACH', fcuAlt: 5000, qnh: activeRoute.to.qnh, flaps: 4, gear: true, ap2: true, ls: true, spl: true, ab: 2, vs: -720, wp: FPLAN.length - 1 }); S.baroActual = activeRoute.to.qnh; break; }
    case 'touchdown': roll(520, 122, false); break;
    case 'rollout': roll(1500, 64, false); break;
    case 'stopped': roll(2100, 0, true); S.parkBrake = false; break;
  }
  VIEW.mode = 'cockpit'; updQuat();
}
function airborne(x, z, y, hdg, ias) {
  S.pos.set(x, y, z); S.psi = hdg * D2R; S.theta = 2.5 * D2R; S.phi = 0; S.onGround = false; S.airborneT = 600;
  const a = isa(y); const tas = ias * KT / Math.sqrt(a.sigma); const v = hdgVec(hdg); S.vel.set(v.x * tas, 0, v.z * tas);
  S.gearLever = 0; S.gearPos = 0; S.flapLever = 0; S.flapPos = 0; S.parkBrake = false; setLandingLights(1); S.lt.strobe = 1; S.lt.nose = 0; S.sbArmed = false; S.autobrake = 0;
  S.fcu.ap1 = true; S.fcu.athr = true; S.tl = [DET.CL, DET.CL]; S.fcu.spdMan = false; S.fcu.hdgMan = false; S.rmp.act = 128405; S.rmp.stby = 125825; S.et.run = true; S.et.t = 1500;
  const n1 = 72; S.eng.forEach(e => { e.N1 = n1; e.N2 = 58.5 + (n1 - 19.5) * 0.53; }); S.ap.n1C = n1; S.ap.athrMode = 'SPEED'; S.ap.gammaC = 0; S.gammaT = 0;
  // trim: set pitch for level flight
  const CLreq = S.mass * G / (0.5 * a.rho * tas * tas * AC.S); S.theta = (CLreq - CONF[0].CL0) / CLA;
}

// ---------------- input ----------------
let drag = null;
function setupInput() {
  const cv = $('gl');
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (activeDialog()) { closeDialog(activeDialog()); e.preventDefault(); return; }
      if (!$('menu').hidden && started) { resumeMenu(); e.preventDefault(); return; }
      if (!$('controlDrawer').hidden) { closeControlDrawer(); e.preventDefault(); return; }
    }
    if (!$('menu').hidden || activeDialog()) return;
    if (e.key === 'F2' && started) { $('controlDrawer').hidden ? openControlDrawer() : closeControlDrawer(); e.preventDefault(); return; }
    if (e.target.closest('#controlDrawer') || e.target.tagName === 'INPUT') return;
    const k = e.key; KEYS[k.toLowerCase()] = true; KEYS[e.code] = true;
    if (!started) return;
    if (CK.overPanel && CK.overPanel.name === 'mcdu' && VIEW.mode === 'cockpit' && !e.ctrlKey && !e.metaKey) {
      const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (/^[A-Z0-9./]$/.test(k)) { mcduKey(k); e.preventDefault(); return; }
      if (k === 'Backspace' || k === 'Delete') { mcduKey('CLR'); e.preventDefault(); return; }
    }
    const handled = keyAction(e); if (handled) e.preventDefault();
  });
  window.addEventListener('keyup', e => { KEYS[e.key.toLowerCase()] = false; KEYS[e.code] = false; if (e.key.toLowerCase() === 'b') { S.brakeL = S.brakeR = 0; } });
  window.addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    if (!started) return; cv.setPointerCapture(e.pointerId);
    const ndc = toNdc(e); let pick = VIEW.mode === 'cockpit' ? pickCockpit(ndc.x, ndc.y) : null;
    drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, btn: e.button, shift: e.shiftKey, pick, moved: false, acc: 0 };
    if (pick && pick.lever && e.button === 0) { drag.lever = pick.lever; drag.v0 = pick.lever === 'thrust' ? S.tl[0] : pick.lever === 'flaps' ? S.flapLever : S.sbLever; }
  });
  cv.addEventListener('pointermove', e => {
    if (!started) return;
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) drag.moved = true;
      if (drag.lever) { leverDrag(drag, e.clientY - drag.sy); return; }
      if (drag.pick && drag.pick.hot && drag.btn === 0 && !drag.moved) return;
      if (VIEW.mode === 'cockpit') { VIEW.tyaw = clamp(VIEW.tyaw - dx * 0.18, -150, 150); VIEW.tpitch = clamp(VIEW.tpitch - dy * 0.18, -70, 80); VIEW.lookTo = null; }
      else { VIEW.oyaw -= dx * 0.3; VIEW.opitch = clamp(VIEW.opitch + dy * 0.2, -10, 85); }
      return;
    }
    if (VIEW.mode === 'cockpit') { const ndc = toNdc(e); const p = pickCockpit(ndc.x, ndc.y); CK.overPanel = p ? (p.hot ? p.hot.panel : p.panel) : null; setHover(p, e); }
  });
  cv.addEventListener('pointerup', e => {
    if (!drag) return; const d = drag; drag = null;
    if (!d.moved && d.pick) {
      if (d.pick.hot && d.pick.hot.click) { d.pick.hot.click({ u: d.pick.u, v: d.pick.v, right: d.btn === 2, shift: d.shift }); d.pick.hot.panel.sig = ''; updateScreens(); }
      else if (d.pick.lever === 'sb') { S.sbArmed = !S.sbArmed; if (S.sbArmed) S.sbLever = 0; Audio2.toggle(); Tut.event('spoilers'); }
      else if (d.pick.lever === 'flaps') { const up = d.btn === 2; setFlaps(S.flapLever + (up ? -1 : 1) * 1); }
    }
  });
  cv.addEventListener('wheel', e => {
    if (!started) return; e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    if (VIEW.mode === 'cockpit') {
      const h = CK.hover; if (h && h.wheel) {
        // one step per mouse-wheel notch; trackpads accumulate their small deltas
        if (VIEW._wh !== h) { VIEW._wh = h; VIEW._wacc = 0; }
        VIEW._wacc += -e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 400 : 1);
        const now = performance.now(); if (Math.abs(VIEW._wacc) < 90 || now - (VIEW._wt || 0) < 70) return;
        const d = Math.sign(VIEW._wacc); VIEW._wacc = 0; VIEW._wt = now;
        h.wheel(d * (e.shiftKey ? 10 : 1)); Audio2.click(); h.panel.sig = ''; updateScreens(); showTip(h); return; }
      VIEW.fov = clamp(VIEW.fov - dir * 4, 22, 80);
    } else VIEW.odist = clamp(VIEW.odist * (dir > 0 ? 0.9 : 1.1), 22, 900);
  }, { passive: false });
  window.addEventListener('gamepadconnected', () => toast('Joystick connected'));
}
function toNdc(e) { const r = $('gl').getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }; }
function setHover(p, e) {
  const tip = $('tip'); const h = p && p.hot ? p.hot : null; const lv = p && p.lever;
  if (h !== CK.hover) { CK.hover = h; }
  if (h || lv) { tip.textContent = h ? (typeof h.label === 'function' ? h.label() : h.label) : lv === 'thrust' ? 'Thrust levers · drag, or PgUp/PgDn' : lv === 'flaps' ? 'Flap lever · click = extend, right-click = retract (F / V)' : 'Speed brake · click = arm ground spoilers (/), drag down = extend'; tip.hidden = false; const tw = tip.offsetWidth, th = tip.offsetHeight; tip.style.left = Math.max(8, Math.min(e.clientX + 16, innerWidth - tw - 8)) + 'px'; tip.style.top = (e.clientY + 14 + th > innerHeight - 8 ? e.clientY - th - 10 : e.clientY + 14) + 'px'; $('gl').style.cursor = 'pointer'; }
  else { tip.hidden = true; $('gl').style.cursor = 'grab'; }
}
function markDirty() { CK.panels.forEach(p => p.sig = ''); }
function showTip(h) { const tip = $('tip'); if (!tip.hidden && h) tip.textContent = typeof h.label === 'function' ? h.label() : h.label; }
function leverDrag(d, dy) {
  if (d.lever === 'thrust') { let v = clamp(d.v0 - dy / 220, -1, 1); for (const det of [DET.IDLE, DET.CL, DET.FLX, DET.TOGA]) if (Math.abs(v - det) < 0.035) v = det; if (v < 0 && v > DET.REVIDLE) v = d.v0 >= 0 ? 0 : v; S.tl = [v, v]; Tut.event('thrust'); }
  else if (d.lever === 'flaps') { const v = clamp(Math.round(d.v0 + dy / 40), 0, 4); if (v !== S.flapLever) setFlaps(v); }
  else if (d.lever === 'sb') { const v = clamp(d.v0 + dy / 150, 0, 1); S.sbLever = v; if (v > 0.05) S.sbArmed = false; }
}
function setFlaps(v) { v = clamp(v, 0, 4); if (v === S.flapLever) return; S.flapLever = v; Audio2.toggle(); Tut.event('flaps'); toast('FLAPS ' + ['0', '1', '2', '3', 'FULL'][v], 1200); }
function setThrust(v) { S.tl = [v, v]; }
function keyAction(e) {
  const k = e.key; const lk = k.toLowerCase();
  if (e.ctrlKey && (k === '1' || k === '2')) { const i = +k - 1; S.eng[i].master = !S.eng[i].master; Audio2.toggle(); return true; }
  if (e.ctrlKey || e.metaKey) return false;
  switch (true) {
    case k === 'g' || k === 'G': setGear(S.gearLever ? 0 : 1); return true;
    case k === 'f': setFlaps(S.flapLever + 1); return true;
    case k === 'v': setFlaps(S.flapLever - 1); return true;
    case k === 'F' && e.shiftKey: setThrust(DET.FLX); toast('Thrust levers FLX/MCT', 1200); return true;
    case k === 'T' && e.shiftKey: setThrust(DET.TOGA); toast('Thrust levers TOGA', 1200); return true;
    case k === 'C' && e.shiftKey: setThrust(DET.CL); toast('Thrust levers CL', 1200); return true;
    case lk === 'i': setThrust(DET.IDLE); return true;
    case lk === 'r' && !e.shiftKey: setThrust(S.onGround ? DET.REVMAX : DET.IDLE); return true;
    case k === 'R' && e.shiftKey: athr_toggle(); return true;
    case k === '/': S.sbArmed = !S.sbArmed; if (S.sbArmed) S.sbLever = 0; Audio2.toggle(); toast(S.sbArmed ? 'Ground spoilers ARMED' : 'Ground spoilers disarmed', 1200); return true;
    case k === '?': S.sbLever = S.sbLever > 0.6 ? 0 : S.sbLever + 0.5; S.sbArmed = false; return true;
    case k === 'B' && e.shiftKey: S.parkBrake = !S.parkBrake; Audio2.toggle(); toast(S.parkBrake ? 'Parking brake ON' : 'Parking brake OFF', 1200); return true;
    case lk === 'a' && !e.shiftKey: if (!ap_engage(1)) toast('AP not available on the ground or below 100 ft'); else Tut.event('ap1'); return true;
    case lk === 'q': ap_disconnect('pilot'); return true;
    case lk === 'c': cycleView(); return true;
    case lk === 'p': paused = !paused; toast(paused ? 'Paused' : 'Resumed', 1000); return true;
    case lk === 't': timeComp = S.onGround ? 1 : timeComp >= 8 ? 1 : timeComp * 2; toast('Time ×' + timeComp, 1200); return true;
    case lk === 'h': openDialog('help'); return true;
    case k === 'Enter': if (Tut.active) { Tut.cont(); } return true;
    case k === 'PageUp' || k === '=' || k === '+': S.tl = S.tl.map(t => clamp(t < 0 ? 0 : t + 0.05, -1, 1)); return true;
    case k === 'PageDown' || k === '-': S.tl = S.tl.map(t => t <= 0 ? (S.onGround ? clamp(t - 0.15, -1, 0) : 0) : clamp(t - 0.05, 0, 1)); return true;
    case k.startsWith('Arrow') || ['w', 's', 'z', 'x', ',', '.', 'b'].includes(lk): return true;
  }
  return false;
}
function cycleView() { const order = ['cockpit', 'chase', 'tower']; VIEW.mode = order[(order.indexOf(VIEW.mode) + 1) % order.length]; toast({ cockpit: 'Flight deck view', chase: 'Outside view · drag to orbit, scroll to zoom', tower: 'Tower view' }[VIEW.mode], 1500); $('tip').hidden = true; }
function readControls(dt) {
  const up = KEYS['arrowup'] || KEYS['w'], dn = KEYS['arrowdown'] || KEYS['s'];
  const lf = KEYS['arrowleft'], rt = KEYS['arrowright'];
  const tgtP = (dn ? 1 : 0) - (up ? 1 : 0), tgtR = (rt ? 1 : 0) - (lf ? 1 : 0);
  S.stickP = approach(S.stickP, tgtP * (KEYS['shift'] ? 1 : 0.6), dt * (tgtP ? 2.2 : 4));
  S.stickR = approach(S.stickR, tgtR * (KEYS['shift'] ? 1 : 0.6), dt * (tgtR ? 2.5 : 5));
  const rl = KEYS['z'], rr = KEYS['x']; S.rudder = approach(S.rudder, (rr ? 1 : 0) - (rl ? 1 : 0), dt * 2.5);
  if (S.onGround && !_autoTaxi) { const tl = KEYS[','] || (S.gs < 30 && KEYS['arrowleft']), tr = KEYS['.'] || (S.gs < 30 && KEYS['arrowright']); S.tiller = approach(S.tiller, (tr ? 1 : 0) - (tl ? 1 : 0), dt * 1.5); }
  if (!_autoTaxi) { const b = KEYS['b'] && !KEYS['shift']; S.brakeL = S.brakeR = approach(S.brakeL, b ? 1 : 0, dt * 3); }
  // AP override by sidestick
  if ((S.fcu.ap1 || S.fcu.ap2) && (Math.abs(S.stickP) > 0.5 || Math.abs(S.stickR) > 0.5)) ap_disconnect('override');
  // gamepad
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g) : null;
  if (gp) {
    const dz = (v) => Math.abs(v) < 0.08 ? 0 : v;
    if (Math.abs(gp.axes[1]) > 0.08 || Math.abs(gp.axes[0]) > 0.08) { S.stickP = dz(gp.axes[1]); S.stickR = dz(gp.axes[0]); }
    if (gp.axes.length > 2 && gp.mapping !== 'standard') { const th = (1 - gp.axes[2]) / 2; if (Math.abs(th - (VIEW._gpth ?? th)) > 0.01) { VIEW._gpth = th; S.tl = [th, th]; } }
    if (gp.axes.length > 3) { const rz = dz(gp.axes[gp.mapping === 'standard' ? 2 : 3] || 0); if (gp.mapping !== 'standard') S.rudder = rz; }
  }
}

// ---------------- main loop ----------------
const _q = new THREE.Quaternion(), _hq = new THREE.Quaternion(), _v = new THREE.Vector3(), _e2 = new THREE.Euler();
function loop(t) {
  requestAnimationFrame(loop);
  const elapsed = lastT ? (t - lastT) / 1000 : .016, dt = Math.min(0.05, elapsed); lastT = t; frameN++;
  graphicsFrames++; graphicsTime += elapsed;
  if (graphicsTime >= 1) { graphicsFps = Math.round(graphicsFrames / graphicsTime); graphicsFrames = 0; graphicsTime = 0; if (!$('graphics').hidden) updateGraphicsPanel(); }
  if (started && !paused) {
    readControls(dt);
    const H = 1 / 120; const tc = S.onGround ? 1 : timeComp; accum += dt * tc; let n = 0;
    while (accum >= H && n < 120 * 2) { stepAll(H); accum -= H; n++; }
    if (S.crashed && !S._crashShown) { S._crashShown = true; setTimeout(() => showDebrief(true), 1500); }
  }
  Tut.update(dt);
  render(dt);
  if (started) Audio2.update(dt, VIEW.mode);
  if (frameN % 6 === 0) updateHUD();
}
function stepAll(h) {
  const g0 = S.gs; stepSystems(h); stepPushback(h); stepAutoTaxi(h); stepAP(h); stepFlight(h); updNav(); fmsPhase(); stepWarnings(h); S.time += h; S._accLong = lerp(S._accLong || 0, (S.gs - g0) * KT / h, 0.02);
  if (S.ra > 200 && timeComp > 1 && (S.fms.phase === 'APPROACH' || S.fms.phase === 'DESCENT' && S.ra < 12000)) { timeComp = 1; toast('Time back to normal for the approach'); }
}
function render(dt) {
  updQuat();
  // ----- displays -----
  if (frameN % 2 === 0) { drawPFD(DU.pfd, dt * 2); drawND(DU.nd, dt * 2, ND_RANGES[S.ndRange ?? 2]); }
  if (frameN % 4 === 1) { drawEWD(DU.ewd, dt * 4); drawSD(DU.sd, dt * 4); drawMCDU(DU.mcdu); }
  if (frameN % 3 === 1) { updateScreens(); if (CK.hover) showTip(CK.hover); }
  updateCockpit(dt);
  if (frameN % 3 === 0) CK.panels.forEach(p => p.redraw());
  updateLevers3d();
  // ----- cameras -----
  VIEW.yaw = lerp(VIEW.yaw, VIEW.lookTo ? VIEW.lookTo.yaw : VIEW.tyaw, 1 - Math.exp(-dt * 8)); VIEW.pitch = lerp(VIEW.pitch, VIEW.lookTo ? VIEW.lookTo.pitch : VIEW.tpitch, 1 - Math.exp(-dt * 8));
  if (VIEW.lookTo) { VIEW.tyaw = VIEW.yaw; VIEW.tpitch = VIEW.pitch; if (Math.abs(VIEW.yaw - VIEW.lookTo.yaw) < 0.3 && Math.abs(VIEW.pitch - VIEW.lookTo.pitch) < 0.3) { VIEW.tyaw = VIEW.lookTo.yaw; VIEW.tpitch = VIEW.lookTo.pitch; VIEW.lookTo = null; } }
  // smooth vibration (runway joints, turbulence, engines) and a little head movement from acceleration
  const tt = S.time; const rough = S.onGround ? Math.min(1, S.gs / 110) * 0.0022 : (S.ra < 4000 ? 0.0007 : 0.00025) * Math.min(1, S.ias / 200);
  const engVib = (S.eng[0].N1 + S.eng[1].N1) / 200 * 0.00025;
  const sx = (fbm(tt * 7.0, 1.3, 2)) * rough + Math.sin(tt * 90) * engVib, sy = (fbm(tt * 9.0, 7.7, 2)) * rough * 1.4 + Math.sin(tt * 71) * engVib;
  const ax = S._accLong || 0; VIEW._hp = lerp(VIEW._hp || 0, clamp(-(S.nz - 1) * 0.012 + ax * 0.0012, -0.03, 0.03), 1 - Math.exp(-dt * 3));
  const td = S.touchdown && S.time - S.touchdown.t < 0.4 ? Math.sin((S.time - S.touchdown.t) * 40) * 0.01 * Math.min(1, -S.touchdown.fpm / 300) : 0;
  _e2.set((VIEW.pitch * D2R) + sy + VIEW._hp, VIEW.yaw * D2R + sx, sx * 0.5, 'YXZ'); _hq.setFromEuler(_e2);
  const inCockpit = VIEW.mode === 'cockpit';
  model.visible = !inCockpit; shadowBlob.visible = !inCockpit;
  if (inCockpit) {
    const offset = VIEW.overview ? new THREE.Vector3(.52, .02, .57) : new THREE.Vector3();
    const eye = new THREE.Vector3(AC.eyeSide + offset.x, AC.eyeUp + td + offset.y, AC.eyeFwd + offset.z).applyQuaternion(S.q).add(S.pos);
    wCam.position.copy(eye); wCam.quaternion.copy(S.q).multiply(_hq); wCam.fov = VIEW.fov; wCam.near = 0.5;
    CK.cam.position.set(offset.x, td + offset.y, offset.z); CK.cam.quaternion.copy(_hq); CK.cam.fov = VIEW.fov; CK.cam.updateProjectionMatrix();
  } else {
    model.position.copy(S.pos); model.quaternion.copy(S.q); setModelState(model, S, S.time);
    const tgt = S.pos.clone().add(new THREE.Vector3(0, 3.5, 0));
    if (VIEW.mode === 'chase') { const a = (VIEW.oyaw + S.psi * R2D) * D2R, p = VIEW.opitch * D2R; wCam.position.set(tgt.x + Math.sin(a) * Math.cos(p) * VIEW.odist, tgt.y + Math.sin(p) * VIEW.odist, tgt.z - Math.cos(a) * Math.cos(p) * VIEW.odist); }
    else { const ap = dist2(S.pos.x, S.pos.z, 0, 0) < dist2(S.pos.x, S.pos.z, CDG.cx, CDG.cz) ? { x: 250, z: -60, e: LHR.elev } : (() => { const r = CDG.rwys[0]; return { x: r.tx + r.dx * 2300 + r.dz * 1050, z: r.tz + r.dz * 2300 - r.dx * 1050, e: CDG.elev }; })(); wCam.position.set(ap.x, ap.e + 82, ap.z); }
    const gmin = groundH(wCam.position.x, wCam.position.z) + 2; if (wCam.position.y < gmin) wCam.position.y = gmin;
    wCam.lookAt(tgt); wCam.fov = VIEW.mode === 'tower' ? clamp(2 * Math.atan(60 / wCam.position.distanceTo(tgt)) * R2D, 2, 60) : 55; wCam.near = 0.5;
    shadowBlob.position.set(S.pos.x, groundH(S.pos.x, S.pos.z) + 0.15, S.pos.z); shadowBlob.rotation.z = -S.psi; shadowBlob.material.opacity = clamp(1 - S.ra / 600, 0, 1);
  }
  wCam.updateProjectionMatrix();
  // jet bridge retracts after the doors close; tug appears during pushback
  if (W.jetBridge) { const j = W.jetBridge; const tgt = S.doorsClosed || !S.onGround || dist2(S.pos.x, S.pos.z, LHR_STAND.x, LHR_STAND.z) > 20 ? 0 : 1; j.ext = approach(j.ext, tgt, dt / 25); const k = j.ext; const L = lerp(0.6, 1.08, k); j.t1.scale.z = L; j.t1.position.z = -13 * L; j.cab.position.z = -26 * L - 1.7; j.tun.rotation.y = lerp(1.0, 0.41, k); }
  if (W.tug) { W.tug.visible = !!S.pushback && !inCockpit; if (W.tug.visible) { const hv = hdgVec(S.psi * R2D); W.tug.position.set(S.pos.x + hv.x * 22, S.pos.y, S.pos.z + hv.z * 22); W.tug.rotation.y = -S.psi; } }
  // ----- world uniforms -----
  const cp = wCam.position; const camAlt = cp.y;
  ground.material.uniforms.uCam.value.copy(cp); ground.material.uniforms.uTime.value = S.time;
  clouds.material.uniforms.uCam.value.copy(cp);
  const vis = 32000 + camAlt * 6; ground.material.uniforms.uVis.value = vis; clouds.material.uniforms.uVis.value = vis;
  sky.position.copy(cp); sky.material.uniforms.uAlt.value = camAlt;
  wScene.fog.near = 1500 + camAlt * 0.6; wScene.fog.far = vis * 1.5 + camAlt * 2;
  sunLight.position.copy(cp).addScaledVector(W.sunDir, 1000); sunLight.target.position.copy(cp);
  if (frameN % 90 === 0) clouds.userData.sort(cp);
  taxiLights.visible = S.onGround && dist2(S.pos.x, S.pos.z, activeRoute.from.cx, activeRoute.from.cz) < 5500 && (!Tut.active || ['Taxi', 'Pushback and start', 'Before take-off'].includes((Tut.cur() || {}).ph));
  // PAPI colours
  for (const p of PAPIS) { const d = dist2(cp.x, cp.z, p.x, p.z); const ang = Math.atan2(cp.y - p.y, d) * R2D; p.lights.forEach(l => l.sp.material.color.setHex(ang > l.ang ? 0xffffff : 0xff2a1a)); }
  // ----- draw -----
  renderer.setClearColor(0x000000, 1); renderer.clear();
  renderer.render(wScene, wCam);
  if (inCockpit) { updateCockpitLighting(W.sunDir, S.q); if (window.DBG) window.DBG(); renderer.clearDepth(); renderer.render(CK.scene, CK.cam); }
}

// ---------------- UI ----------------
function controlLabel(h) { return typeof h.label === 'function' ? h.label() : h.label || h.id.replaceAll('_', ' '); }
function openControlDrawer(id) {
  if (!started || !$('menu').hidden || activeDialog()) return;
  if ($('controlDrawer').hidden) { controlPreviousFocus = document.activeElement; controlPreviousFov = VIEW.fov; controlCaptainWasMin = $('captain').classList.contains('min'); $('captain').classList.add('min'); $('controlDrawer').hidden = false; }
  if (id) { const h = hotById(id); if (h && (h.click || h.wheel)) { $('controlSearch').value = id; selectControl(h); } }
  renderControlList(); $('controlSearch').focus();
}
function closeControlDrawer() {
  if ($('controlDrawer').hidden) return;
  $('controlDrawer').hidden = true; controlSelectedId = null; VIEW.fov = controlPreviousFov ?? VIEW.fov;
  if (!controlCaptainWasMin) $('captain').classList.remove('min');
  controlPreviousFov = null;
  if (controlPreviousFocus && controlPreviousFocus.isConnected && !controlPreviousFocus.inert) controlPreviousFocus.focus();
  controlPreviousFocus = null;
}
function selectControl(h) {
  controlSelectedId = h.id; lookAtHot(h.id);
  $('controlName').textContent = h.id.replaceAll('_', ' ').toUpperCase();
  updateControlState(); renderControlList();
}
function updateControlState() {
  const h = controlSelectedId && hotById(controlSelectedId);
  let state = h ? controlLabel(h) : 'Search and select a cockpit control.';
  if (h && h.get) { const v = h.get(); if (Array.isArray(v) && typeof v[0] === 'boolean') state += ` · Current setting: ${v[0] ? 'ON' : 'OFF'}`; }
  $('controlState').textContent = state;
  document.querySelectorAll('[data-control-action]').forEach(b => { const a = b.dataset.controlAction; b.disabled = !h || (a === 'press' || a === 'pull' ? !h.click : !h.wheel); });
}
function renderControlList() {
  const q = $('controlSearch').value.trim().toLowerCase(); const list = $('controlList'); list.replaceChildren();
  const matches = CK.hots.filter(h => (h.click || h.wheel) && (!q || (h.id + ' ' + controlLabel(h)).toLowerCase().includes(q)));
  matches.slice(0, 40).forEach(h => { const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.textContent = h.id.replaceAll('_', ' ').toUpperCase(); b.setAttribute('aria-label', controlLabel(h)); if (h.id === controlSelectedId) b.setAttribute('aria-current', 'true'); b.onclick = () => selectControl(h); list.appendChild(b); });
  if (!matches.length) { const p = document.createElement('p'); p.textContent = 'No matching control. Try a shorter name.'; list.appendChild(p); }
  else if (matches.length > 40) { const p = document.createElement('p'); p.textContent = `${matches.length} matches. Refine the search to see more.`; list.appendChild(p); }
}
function operateControl(action) {
  const h = controlSelectedId && hotById(controlSelectedId); if (!h) return;
  if (action === 'increase' || action === 'decrease') { if (h.wheel) h.wheel(action === 'increase' ? 1 : -1); }
  else if (h.click) h.click(action === 'press' && h.kind === 'toggle' ? undefined : { u: 0.5, v: action === 'pull' ? 0.25 : 0.75, right: action === 'pull', shift: false });
  h.panel.sig = ''; updateScreens(); updateControlState();
}
function setupUI() {
  $('routeSelect').onchange = renderRouteMenu;
  document.querySelectorAll('[data-scn]').forEach(b => b.addEventListener('click', () => { Audio2.init(); selectRouteData($('routeSelect').value); Tut.setRoute(activeRoute.id); scenario(b.dataset.scn); started = true; paused = false; timeComp = 1; $('menu').hidden = true; menuBackgroundInert(false); VIEW.mode = 'cockpit'; }));
  $('btnMenu').onclick = openMenu; $('btnResume').onclick = resumeMenu;
  $('menuRetryApproach').onclick = $('debriefRetryApproach').onclick = retryApproach;
  $('menuBriefing').onclick = $('btnBriefing').onclick = () => openDialog('briefing');
  $('briefingClose').onclick = () => closeDialog('briefing');
  $('briefing').onclick = e => { if (e.target.id === 'briefing') closeDialog('briefing'); };
  $('btnHelp').onclick = () => openDialog('help');
  $('btnGraphics').onclick = $('menuGraphics').onclick = () => { updateGraphicsPanel(); openDialog('graphics'); };
  $('graphicsClose').onclick = () => closeDialog('graphics');
  $('graphics').onclick = e => { if (e.target.id === 'graphics') closeDialog('graphics'); };
  $('graphicsPreset').onchange = e => applyGraphicsQuality(e.target.value);
  $('help').onclick = (e) => { if (e.target.id === 'help' || e.target.classList.contains('close')) closeDialog('help'); };
  $('btnView').onclick = () => cycleView();
  $('btnCockpit').onclick = () => $('controlDrawer').hidden ? openControlDrawer() : closeControlDrawer();
  $('controlClose').onclick = closeControlDrawer;
  $('controlCurrent').onclick = () => { const id = Tut.hlOf(Tut.cur()); if (id) { $('controlSearch').value = id; const h = hotById(id); if (h) selectControl(h); } };
  $('controlSearch').oninput = renderControlList;
  document.querySelectorAll('[data-control-action]').forEach(b => b.onclick = () => operateControl(b.dataset.controlAction));
  updateControlState();
  const fillVoices = () => {
    const list = Audio2.voiceList(); const cur = Audio2.voices; const pref = Audio2.vpref;
    for (const [id, kind] of [['vCapt', 'capt'], ['vAtc', 'atc'], ['vGpws', 'gpws']]) {
      const sel = $(id); sel.innerHTML = ''; const auto = document.createElement('option'); auto.value = 'auto'; auto.textContent = 'Best available' + (cur[kind] ? ` (${cur[kind].name})` : ''); sel.appendChild(auto);
      list.forEach(v => { const o = document.createElement('option'); o.value = v.name; o.textContent = `${v.name} · ${v.lang}`; sel.appendChild(o); });
      sel.value = pref[kind] && list.some(v => v.name === pref[kind]) ? pref[kind] : 'auto';
      sel.onchange = () => { Audio2.setVoice(kind, sel.value); };
    }
    $('vRate').value = pref.rate || 1; $('vRateV').textContent = (+$('vRate').value).toFixed(2) + '×';
  };
  Audio2.onVoices = () => { if (!$('voices').hidden) fillVoices(); };
  $('btnSound').onclick = () => { Audio2.init(); Audio2.pickVoices(); fillVoices(); $('vMute').value = Audio2.muteVoice ? 'off' : 'on'; openDialog('voices'); };
  $('voicesClose').onclick = () => closeDialog('voices');
  $('voices').onclick = (e) => { if (e.target.id === 'voices') closeDialog('voices'); };
  $('vRate').oninput = () => { Audio2.vpref.rate = +$('vRate').value; $('vRateV').textContent = (+$('vRate').value).toFixed(2) + '×'; Audio2.setVoice('rate', +$('vRate').value); };
  $('vMute').onchange = () => { Audio2.muteVoice = $('vMute').value === 'off'; if (Audio2.muteVoice && window.speechSynthesis) speechSynthesis.cancel(); };
  document.querySelectorAll('[data-test]').forEach(b => b.onclick = () => { const k = b.dataset.test; speechSynthesis && speechSynthesis.cancel(); Audio2.say(k === 'capt' ? "Good afternoon. I'm Captain Hughes, and I'll be flying with you to Paris today." : k === 'atc' ? 'Albion 324, Heathrow Ground, push and start approved, face east.' : 'Five hundred. Minimum. Retard.', k); });
  $('tContinue').onclick = () => Tut.cont();
  $('tShow').onclick = () => { const id = Tut.hlOf(Tut.cur()); if (id) { if (hotById(id)) openControlDrawer(id); else lookAtHot(id); } };
  $('tDo').onclick = () => Tut.doit();
  $('tRepeat').onclick = () => Tut.repeat();
  $('tNext').onclick = () => Tut.next(); $('tPrev').onclick = () => Tut.prev();
  $('tMin').onclick = () => $('captain').classList.toggle('min');
  $('debriefClose').onclick = () => closeDialog('debrief');
  $('debriefMenu').onclick = () => { closeDialog('debrief'); openMenu(); };
  Tut.onUI = renderTutUI;
  document.querySelectorAll('.look').forEach(b => b.onclick = () => {
    VIEW.lookTo = null; VIEW.mode = 'cockpit'; VIEW.overview = b.dataset.view === 'full-panel';
    if (VIEW.overview) { VIEW.tyaw = 0; VIEW.tpitch = -18; VIEW.fov = fullPanelFov(); }
    else { const [y, p] = b.dataset.look.split(',').map(Number); VIEW.tyaw = y; VIEW.tpitch = p; VIEW.fov = b.dataset.look === '0,-10' ? 62 : 46; }
  });
}
function lookAtHot(id) {
  if (!id) return; if (VIEW.mode !== 'cockpit') VIEW.mode = 'cockpit';
  VIEW.overview = false;
  const p = hotWorldPos(id); if (!p) return; const yaw = Math.atan2(-p.x, -p.z) * R2D; const pitch = Math.atan2(p.y, Math.hypot(p.x, p.z)) * R2D;
  VIEW.lookTo = { yaw, pitch }; VIEW.fov = 30;
}
function renderTutUI() {
  const box = $('captain'); const st = Tut.cur();
  if (!Tut.active || !st) { box.hidden = true; return; }
  box.hidden = false;
  $('tPhase').textContent = st.ph; $('tStep').textContent = `${Tut.idx + 1} / ${Tut.steps.length}`;
  $('tTitle').textContent = st._waiting ? 'Stand by…' : st.title;
  $('tText').textContent = st._waiting ? waitingText(st) : st.text;
  const items = $('tItems'); items.innerHTML = '';
  if (!st._waiting && st.items) st.items.forEach(([t, f]) => { const li = document.createElement('li'); li.textContent = t; if (f()) li.className = 'ok'; items.appendChild(li); });
  $('tContinue').hidden = !(st.manual && !st._waiting);
  $('tDo').hidden = !st.doit && !st._waiting; $('tDo').textContent = st._waiting ? 'Skip ahead' : 'Do it for me';
  $('tShow').hidden = !Tut.hlOf(st) || st._waiting;
  const pct = (Tut.idx / (Tut.steps.length - 1)) * 100; $('tProg').style.width = pct + '%';
}
function waitingText(st) {
  if (st.title === 'Autopilot') return 'Climbing away. Keep the wings level and follow the flight director bars. We\'ll engage the autopilot above 300 feet.';
  if (st.title === 'Thrust reduction') return 'Keep climbing. At 1500 feet we\'ll reduce to climb thrust.';
  if (st.title === 'Flaps up') return 'Accelerating. Watch the speed tape for the green S.';
  if (st.title === 'Passing 10,000 feet') return 'Climbing to flight level 250. Look out of the window: London is behind us on the left.';
  if (st.title === 'Cruise') return 'Climbing to flight level 250.';
  if (st.title === 'Descend to 4000 feet') return 'Descending to flight level 110. I\'ll tell you when Paris clears us lower.';
  if (st.title === 'Arm the approach') return 'Following the arrival towards runway 26 right. Press T to speed up time.';
  if (st.title === 'Cleared to land') return 'Established on the ILS. Monitor the speed and the glideslope.';
  return 'Monitoring. I\'ll call the next action.';
}
function updateHUD() {
  if (!started) return;
  const st = Tut.cur(); if (st && st.items && Tut.active && !st._waiting) { const lis = $('tItems').children; st.items.forEach(([t, f], i) => { if (lis[i]) lis[i].className = f() ? 'ok' : ''; }); }
  if (st && Tut.active) { $('tTitle').textContent = st._waiting ? 'Stand by…' : st.title; if (st._waiting) $('tText').textContent = waitingText(st); }
  $('hudTc').textContent = timeComp > 1 && !S.onGround ? '×' + timeComp : ''; $('hudPause').hidden = !paused;
  const x = $('xhud'); x.hidden = VIEW.mode === 'cockpit';
  if (!x.hidden) x.innerHTML = `<span>IAS <b>${Math.round(S.ias)}</b></span><span>ALT <b>${Math.round(indicatedAlt())}</b></span><span>HDG <b>${String(Math.round(S.psi * R2D) % 360).padStart(3, '0')}</b></span><span>V/S <b>${Math.round(S.vs / 10) * 10}</b></span><span>${S.ap.lat || ''} ${S.ap.vert || ''}</span>`;
}
function showDebrief(crash) {
  const d = $('debrief'); const td = S.touchdown; const r = activeRoute.arrRwy;
  $('debriefHeading').textContent = `Flight debrief · ${activeRoute.flightNumber}`;
  let rows = [];
  if (crash) rows.push(['Outcome', 'The aircraft was damaged on landing', 'bad']);
  if (td) {
    const along = (td.x - r.tx) * r.dx + (td.z - r.tz) * r.dz; const cl = Math.abs((td.x - r.tx) * -r.dz + (td.z - r.tz) * r.dx);
    rows.push(['Touchdown rate', Math.round(td.fpm) + ' ft/min', td.fpm > -240 ? 'good' : td.fpm > -600 ? 'ok' : 'bad']);
    rows.push(['Touchdown point', Math.round(along) + ' m past the threshold', along > 250 && along < 750 ? 'good' : along > 0 && along < 1100 ? 'ok' : 'bad']);
    rows.push(['Distance from centreline', cl.toFixed(1) + ' m', cl < 3 ? 'good' : cl < 8 ? 'ok' : 'bad']);
    rows.push(['Pitch at touchdown', td.pitch.toFixed(1) + '°', td.pitch > 2 && td.pitch < 7.5 ? 'good' : 'ok']);
  }
  rows.push(['Maximum bank', Math.round(S.stats.maxBank) + '°', S.stats.maxBank < 30 ? 'good' : S.stats.maxBank < 40 ? 'ok' : 'bad']);
  rows.push(['Overspeed', (S.stats.overspeedT || 0) < 1 ? 'None' : Math.round(S.stats.overspeedT) + ' s', (S.stats.overspeedT || 0) < 1 ? 'good' : 'bad']);
  rows.push(['Tail strike', S.tailStrike ? 'Yes' : 'No', S.tailStrike ? 'bad' : 'good']);
  rows.push(['Fuel used', Math.round(7800 - S.fuel) + ' kg', 'ok']);
  rows.push(['Flight time', fmtTime(S.time), 'ok']);
  $('debriefRows').innerHTML = rows.map(([a, b, c]) => `<tr><th>${a}</th><td class="${c}">${b}</td></tr>`).join('');
  openDialog('debrief');
}
window.addEventListener('load', () => { boot().catch(err => { $('loadmsg').textContent = 'Could not start: ' + err.message; console.error(err); }); });
