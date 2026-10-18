// ---------- Aircraft state, systems, flight model, FMGC & autopilot ----------
const AC = { S: 122.6, span: 34.1, mZFW: 56500, eyeFwd: -15.55, eyeUp: 4.05, eyeSide: -0.52, wheelbase: 12.6 };
// Configurations: index by flap lever 0..4 (CONF 0,1(+F),2,3,FULL)
const CONF = [
  { name: '0', CL0: 0.20, CLmax: 1.45, CD: 0.000, angle: 0, slat: 0, VFE: 350 },
  { name: '1+F', CL0: 0.52, CLmax: 1.95, CD: 0.010, angle: 10, slat: 18, VFE: 215 },
  { name: '2', CL0: 0.66, CLmax: 2.10, CD: 0.022, angle: 15, slat: 22, VFE: 200 },
  { name: '3', CL0: 0.80, CLmax: 2.30, CD: 0.032, angle: 20, slat: 22, VFE: 185 },
  { name: 'FULL', CL0: 1.02, CLmax: 2.60, CD: 0.052, angle: 35, slat: 27, VFE: 177 }
];
const CLA = 5.3; // per rad
const DET = { REVMAX: -1, REVIDLE: -0.12, IDLE: 0, CL: 0.55, FLX: 0.8, TOGA: 1 };

function newState() {
  return {
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), psi: 0, theta: 0, phi: 0, q: new THREE.Quaternion(),
    onGround: true, gearLever: 1, gearPos: 1, flapLever: 0, flapPos: 0, flapAngle: 0,
    sbLever: 0, sbArmed: false, spoiler: 0, brakeL: 0, brakeR: 0, parkBrake: true, autobrake: 0, abActive: false,
    tl: [0, 0], rev: [0, 0], tiller: 0, rudder: 0, stickP: 0, stickR: 0,
    eng: [mkEng(), mkEng()], engMode: 1,
    apu: { master: false, flap: 0, start: false, N: 0, avail: false, bleed: false, egt: 20 },
    elec: { bat1: false, bat2: false, ac: false, dc: false, ext: false },
    adirs: [0, 0, 0], adirsT: [0, 0, 0], aligned: false,
    lt: { beacon: false, nav: false, strobe: 0, land: false, nose: 0, belts: false, nosmoke: false, logo: false, wing: false },
    fcu: { spd: 140, spdMan: false, mach: false, machV: 0.78, trkFpa: false, hdg: 270, hdgMan: false, alt: 6000, vs: 0, vsMode: false, loc: false, appr: false, ap1: false, ap2: false, athr: false, fd: true, altInc: 1000 },
    baro: { qnh: 1013, std: false }, baroActual: 1018,
    fuel: 7800, mass: 56500 + 7800,
    fms: { init: false, coRte: false, fromTo: false, fltNbr: '', ci: null, crz: 0, ent: { v1: false, vr: false, v2: false, flaps: false, flex: false }, perf: false, v1: 142, vr: 145, v2: 149, flex: 55, phase: 'PREFLIGHT', wp: 1, accAlt: 1500 },
    ap: { lat: '', vert: '', latArm: '', vertArm: '', athrMode: '', athrArmed: false, gammaC: 0, bankC: 0, n1C: 40, spdT: 140, altCapVs: 0, flare: false, trk: 0 },
    fd: { pitch: 0, roll: 0 },
    // flight control internals
    gammaT: 0, flareMode: false, thetaRef: 0,
    // derived
    ias: 0, tas: 0, gs: 0, mach: 0, alt: 0, ra: 0, vs: 0, alpha: 0, gamma: 0, trk: 0, iasTrend: 0, nz: 1,
    loc: { dev: 0, valid: false, dist: 0, xte: 0 }, gs_: { dev: 0, valid: false, herr: 0 },
    tailStrike: false, touchdown: null, crashed: false, hardLanding: false, toConfigTested: false,
    time: 0, airborneT: 0, warn: { master: false, caution: false, msgs: [] }, wind: new THREE.Vector3(), windDir: 250, windKt: 8,
    stats: { maxBank: 0, overspeed: 0, maxG: 1, tdFpm: 0, tdDist: 0, tdCl: 0, flown: 0 },
    pushback: null,
    sw: { landPos: 2 }, momT: {}, guard: {}, fireTest: {}, efis: { mode: 3, cstr: false, wpt: false, vord: false, ndb: false, arpt: false }, duBrt: { pfd: 1, nd: 1, ewd: 1, sd: 1 },
    rmp: { act: 121905, stby: 118505, sel: 0 }, xpdr: { code: '2000', entry: '', mode: 0, tcas: 0 }, chrono: { run: false, t: 0 }, et: { run: false, t: 0 }, rudTrim: 0, sdPage: null, vol: 0.8, annTest: false, dcOnT: null, altLaw: false,
  };
}
function mkEng() { return { master: false, N1: 0, N2: 0, EGT: 25, FF: 0, run: false, starting: false, ign: false, startFail: '' }; }

let S = newState();
function setLandingLights(position) { S.sw.landPos = clamp(position, 0, 2); S.lt.land = S.sw.landPos === 0; }

function takeoffConfigFaults() {
  const faults = [];
  if (S.flapLever < 1 || S.flapLever > 3 || Math.abs(S.flapPos - S.flapLever) > 0.05) faults.push('FLAPS');
  if (!S.sbArmed || S.sbLever > 0.05 || S.spoiler > 0.05) faults.push('SPOILERS');
  if (S.autobrake !== 3) faults.push('AUTO BRK MAX');
  if (Math.abs(S.rudTrim) > 0.3) faults.push('RUDDER TRIM');
  if (S.gearPos < 0.95) faults.push('LANDING GEAR');
  return faults;
}
function takeoffConfigNormal() { return S.toConfigTested && takeoffConfigFaults().length === 0; }

function placeAt(x, z, hdg) {
  S.pos.set(x, groundH(x, z), z); S.psi = hdg * D2R; S.theta = 0; S.phi = 0; S.vel.set(0, 0, 0); S.onGround = true;
}

// ---------- helpers ----------
const _f = new THREE.Vector3(), _u = new THREE.Vector3(), _r = new THREE.Vector3(), _va = new THREE.Vector3(), _e = new THREE.Euler();
function updQuat() { _e.set(S.theta, -S.psi, -S.phi, 'YXZ'); S.q.setFromEuler(_e); }
function confIndex() { return Math.round(S.flapPos); }
function acPowered() { return S.elec.ac; }
function n1Idle() { return 19.5 + clamp(S.alt / 40000, 0, 1) * 8; }
function n1Climb() { return 85.5 + clamp(S.alt / 30000, 0, 1) * 5; }
function speeds() { // VLS, F, S, green dot, VMAX, Vapp (kt)
  const m = S.mass, rho0 = 1.225;
  const vs = (clm) => Math.sqrt(2 * m * G / (rho0 * AC.S * clm)) / KT;
  const c = confIndex();
  const vlsTab = [1.28 * vs(CONF[0].CLmax), 1.23 * vs(CONF[1].CLmax), 1.23 * vs(CONF[2].CLmax), 1.23 * vs(CONF[3].CLmax), 1.23 * vs(CONF[4].CLmax)];
  const gd = 1.38 * vs(CONF[0].CLmax) + Math.max(0, S.alt - 20000) / 1000;
  const sS = 1.27 * vs(CONF[1].CLmax), fF = 1.24 * vs(CONF[3].CLmax);
  let vls = vlsTab[c]; if (S.onGround || S.fms.phase === 'TAKEOFF') vls = Math.min(vls, S.fms.v2);
  const vmax = Math.min(CONF[c].VFE, S.gearPos > 0.05 ? 280 : 350, machToIas(0.82));
  return { vls, F: fF, S: sS, gd, vmax, vapp: vlsTab[4] + 5, vsw: vs(CONF[c].CLmax) * 1.03 };
}
function machToIas(M) { const a = isa(S.pos.y); return M * a.a * Math.sqrt(a.sigma) / KT; }
function iasToMach(ias) { const a = isa(S.pos.y); return ias * KT / Math.sqrt(a.sigma) / a.a; }
function indicatedAlt() { // feet, with altimeter setting
  const trueFt = S.pos.y / FT; if (S.baro.std) return trueFt - (S.baroActual - 1013.25) * 27.3;
  return trueFt - (S.baroActual - S.baro.qnh) * 27.3;
}

// ---------- engines / APU / electrics ----------
function stepSystems(dt) {
  const el = S.elec;
  el.dc = el.bat1 || el.bat2 || el.ac;
  // APU
  const apu = S.apu;
  if (apu.master && el.dc) { apu.flap = Math.min(1, apu.flap + dt / 3); } else { apu.flap = Math.max(0, apu.flap - dt / 3); apu.start = false; }
  if (!apu.master && apu.N > 0) { apu.N = Math.max(0, apu.N - dt * (apu.avail ? 0.4 : 4)); if (apu.N < 95) apu.avail = false; }
  if (apu.start && apu.master && apu.flap >= 1 && el.dc) { apu.N = Math.min(100, apu.N + dt * (apu.N < 50 ? 2.6 : 4.2)); if (apu.N >= 95) { apu.avail = true; apu.start = false; } }
  if (apu.avail && apu.master) apu.N = approach(apu.N, 100, dt * 5);
  apu.egt = approach(apu.egt, apu.N > 5 ? (apu.avail ? (apu.bleed ? 520 : 380) : 300 + apu.N * 5) : 25, dt * 60);
  const bleedPress = (apu.avail && apu.bleed && apu.master) ? 38 : ((S.eng[0].run && swGet('bleed1')) || (S.eng[1].run && swGet('bleed2'))) ? 32 : 0; S.bleedPress = bleedPress;
  // engines
  const a = isa(S.pos.y);
  S.eng.forEach((e, i) => {
    const fuelOk = S.fuel > 0;
    if (e.master && !e.run && !e.starting && S.engMode === 2 && el.dc) { e.starting = true; e.startFail = ''; }
    if (e.starting) {
      if (!e.master) { e.starting = false; e.ign = false; }
      else if (bleedPress < 20 && e.N2 < 50) { e.N2 = Math.max(0, e.N2 - dt * 2); if (e.N2 < 1) { e.startFail = 'NO BLEED'; } }
      else {
        const r = e.N2 < 16 ? 1.25 : e.N2 < 30 ? 1.35 : 1.15;
        e.N2 = Math.min(58.5, e.N2 + r * dt);
        if (e.N2 >= 16) { e.ign = true; e.FF = 120 + (e.N2 - 16) * 4; e.EGT = approach(e.EGT, 380 + (e.N2 - 16) * 9 - Math.max(0, e.N2 - 45) * 12, dt * 40); }
        e.N1 = Math.max(0, (e.N2 - 20) * 0.51);
        if (e.N2 >= 58.5) { e.starting = false; e.run = true; e.ign = false; e.N1 = 19.5; }
      }
    } else if (e.run) {
      if (!e.master || !fuelOk) { e.run = false; }
      const tgt = n1Target(i);
      const up = tgt > e.N1; const tau = up ? (e.N1 < 30 ? 3.6 : 1.7) : 2.0;
      e.N1 += (tgt - e.N1) * (1 - Math.exp(-dt / tau)) + (up ? 0 : 0);
      e.N2 = 58.5 + (e.N1 - 19.5) * 0.53;
      const f = clamp((e.N1 - 19.5) / 80.5, 0, 1);
      e.EGT = approach(e.EGT, 405 + f * 440 + (1 - a.sigma) * 40, dt * 50);
      e.FF = 290 + Math.pow(f, 1.6) * 3300 * Math.pow(a.sigma, 0.55);
    } else {
      e.N1 = Math.max(0, e.N1 - dt * (e.N1 > 10 ? 3 : 1)); e.N2 = Math.max(0, e.N2 - dt * (e.N2 > 10 ? 3 : 1)); e.FF = 0; e.EGT = approach(e.EGT, 30, dt * 6);
      // windmilling
      if (!S.onGround && S.tas > 60) { e.N1 = Math.max(e.N1, S.tas / KT * 0.05); }
    }
    // reversers
    const wantRev = S.tl[i] < -0.05 && S.onGround && e.run;
    S.rev[i] = approach(S.rev[i], wantRev ? 1 : 0, dt / 1.5);
  });
  el.ac = (apu.avail && apu.master && swGet('apu_gen')) || (S.eng[0].run && swGet('gen1')) || (S.eng[1].run && swGet('gen2')) || el.ext;
  if (el.dc && S.dcOnT == null) S.dcOnT = S.time; if (!el.dc) S.dcOnT = null;
  S.altLaw = !swGet('elac1') && !swGet('elac2');
  // fuel
  const ff = S.eng[0].FF + S.eng[1].FF + (apu.avail ? 120 : 0);
  S.fuel = Math.max(0, S.fuel - ff / 3600 * dt); S.mass = AC.mZFW + S.fuel;
  // ADIRS alignment
  for (let k = 0; k < 3; k++) {
    if (S.adirs[k] && el.dc) S.adirsT[k] = Math.min(1, S.adirsT[k] + dt / (S.adirs[k] === 2 ? 25 : 120)); else if (!S.adirs[k]) S.adirsT[k] = 0;
  }
  S.aligned = S.adirsT[0] >= 1 || S.adirsT[1] >= 1; S.navAligned = S.aligned && (S.adirs[0] === 1 || S.adirs[1] === 1);
  // gear & flaps hydraulics (need engine running or electric for flaps slowly)
  const hs = hydState(); const hyd = hs.g > 0 || hs.y > 0; S.hyd = hs;
  if (hs.g > 0) S.gearPos = approach(S.gearPos, S.gearLever, dt / 9);
  const flapRate = hyd ? 1 / 9 : 0;
  S.flapPos = approach(S.flapPos, S.flapLever, dt * flapRate);
  const fi = Math.floor(S.flapPos), ff2 = S.flapPos - fi;
  S.flapAngle = lerp(CONF[fi].angle, CONF[Math.min(fi + 1, 4)].angle, ff2);
  // spoilers
  let spTarget = S.sbLever * (S.onGround ? 1 : 0.8);
  if (S.sbArmed && S.onGround && S.airborneT === 0 && S.groundSpoilersOut) spTarget = 1;
  S.spoiler = approach(S.spoiler, spTarget, dt * 1.5);
}
function n1Target(i) {
  const lv = S.tl[i]; const idle = n1Idle(), clN1 = n1Climb();
  if (lv < -0.05) { const k = clamp((-lv - 0.12) / 0.88, 0, 1); return S.rev[i] > 0.9 ? lerp(idle, 72, k) : idle; }
  let manual;
  if (lv <= DET.CL) manual = lerp(idle, clN1, lv / DET.CL);
  else if (lv <= DET.FLX) manual = lerp(clN1, S.onGround || S.alt < 3000 ? 91 : 93, (lv - DET.CL) / (DET.FLX - DET.CL));
  else manual = lerp(S.onGround || S.alt < 3000 ? 91 : 93, 100, (lv - DET.FLX) / (DET.TOGA - DET.FLX));
  if (S.fcu.athr && S.ap.athrMode && lv > 0.02 && lv <= DET.CL + 0.01) return Math.min(manual, clamp(S.ap.n1C, idle, clN1));
  return manual;
}
function engThrust(i) {
  const e = S.eng[i]; const a = isa(S.pos.y);
  if (!e.run && e.N1 < 5) return 0;
  const f = Math.pow(clamp((e.N1 - 19.5) / 80.5, 0, 1), 1.6);
  let T = (3300 + (106000 - 3300) * f) * Math.pow(a.sigma, 0.78) * (1 - 0.42 * S.mach);
  if (!e.run) T *= 0.05;
  if (S.rev[i] > 0.5) T *= -0.42 * S.rev[i];
  return T;
}

// ---------- flight model ----------
function stepFlight(dt) {
  const a = isa(S.pos.y);
  // wind (from S.windDir) with altitude, plus light turbulence
  const altFt = S.pos.y / FT;
  S.windKt = 7 + clamp(altFt / 25000, 0, 1) * 48; S.windDir = 250 + clamp(altFt / 25000, 0, 1) * 25;
  const wv = hdgVec(S.windDir + 180); const gust = S.ra > 5 ? (fbm(S.time * 0.35, 3.1, 2) * 2.2) : 0;
  S.wind.set(wv.x * (S.windKt + gust) * KT, 0, wv.z * (S.windKt + gust) * KT);
  updQuat();
  _f.set(0, 0, -1).applyQuaternion(S.q); _u.set(0, 1, 0).applyQuaternion(S.q); _r.set(1, 0, 0).applyQuaternion(S.q);
  _va.copy(S.vel).sub(S.wind);
  if (S.onGround) _va.y = 0;
  const V = _va.length();
  const vf = _va.dot(_f), vu = _va.dot(_u);
  const alpha = V > 5 ? Math.atan2(-vu, vf) : 0;
  const qbar = 0.5 * a.rho * V * V;
  const ci = S.flapPos; const c0 = CONF[Math.floor(ci)], c1 = CONF[Math.min(Math.floor(ci) + 1, 4)], cf = ci - Math.floor(ci);
  const CL0 = lerp(c0.CL0, c1.CL0, cf), CLmax = lerp(c0.CLmax, c1.CLmax, cf), CDf = lerp(c0.CD, c1.CD, cf);
  const aStall = (CLmax - CL0) / CLA;
  let CL = CL0 + CLA * alpha;
  if (alpha > aStall) CL = CLmax - 2.2 * (alpha - aStall);
  if (alpha < -0.25) CL = CL0 - CLA * 0.25;
  CL -= S.spoiler * 0.45;
  const hR = Math.max(0, S.ra);
  const ge = hR < AC.span ? 1 + 0.05 * Math.pow(1 - hR / AC.span, 2) : 1;
  CL *= ge;
  const CD = 0.0205 + CDf + 0.043 * CL * CL / (ge * ge) + 0.018 * S.gearPos + 0.03 * S.spoiler + (S.mach > 0.78 ? (S.mach - 0.78) * 0.4 : 0);
  const L = qbar * AC.S * CL, D = qbar * AC.S * CD;
  const T = engThrust(0) + engThrust(1);
  const m = S.mass;
  S.alpha = alpha * R2D;
  const vhat = V > 0.5 ? _va.clone().divideScalar(V) : _f.clone();
  const F = new THREE.Vector3();
  F.addScaledVector(_f, T);
  F.addScaledVector(vhat, -D);
  if (!S.onGround) {
    const ld = _u.clone().addScaledVector(vhat, -_u.dot(vhat)); if (ld.lengthSq() > 1e-6) ld.normalize();
    F.addScaledVector(ld, L);
    F.y -= m * G;
    // side force kills sideslip
    F.addScaledVector(_r, -_va.dot(_r) * m * 0.9);
    const acc = F.divideScalar(m);
    S.vel.addScaledVector(acc, dt);
    S.nz = (L * Math.cos(S.phi) * 0 + L) / (m * G);
    flightControlsAir(dt, V, qbar, CL0, aStall, alpha);
    S.pos.addScaledVector(S.vel, dt);
    S.airborneT += dt;
    // touchdown
    const gh = groundH(S.pos.x, S.pos.z);
    const tailClear = S.pos.y - gh - Math.sin(Math.max(S.theta, 0)) * 18.5 + 1.75;
    if (S.pos.y <= gh) {
      const vsFpm = S.vel.y / FT * 60;
      S.pos.y = gh; S.onGround = true; S.vel.y = 0; S.flareMode = false;
      if (S.airborneT > 3) {
        S.touchdown = { fpm: vsFpm, x: S.pos.x, z: S.pos.z, t: S.time, ias: S.ias, pitch: S.theta * R2D };
        S.stats.tdFpm = vsFpm;
        if (vsFpm < -600) S.hardLanding = true;
        if (vsFpm < -1400 || Math.abs(S.phi) > 12 * D2R || S.theta < -3 * D2R) S.crashed = true;
        if (S.gearPos < 0.9) S.crashed = true;
        if (S.sbArmed || S.tl.every(t => t < 0.05)) S.groundSpoilersOut = true;
        Audio2.touchdown(Math.min(1, -vsFpm / 400));
      }
      S.airborneT = 0;
      if (S.ap.lat !== 'ROLL OUT' && S.fcu.ap1) { /* keep for rollout */ }
    }
  } else {
    // ---- ground roll ----
    const hv = hdgVec(S.psi * R2D); const fh = new THREE.Vector3(hv.x, 0, hv.z);
    let Vg = S.vel.dot(fh);
    const N = Math.max(0, m * G - L * Math.cos(S.theta));
    let fx = T * Math.cos(S.theta) - D * Math.sign(Vg || 1) * (vf >= 0 ? 1 : -1);
    // rolling resistance & brakes
    const roll = 0.0085 * N;
    let brake = Math.max(S.brakeL, S.brakeR);
    if (S.parkBrake) brake = 1;
    // autobrake
    if (S.autobrake && S.groundSpoilersOut && S.fms.phase !== 'TAKEOFF') {
      const dec = [0, 1.7, 3.0, 6.0][S.autobrake] * (S.autobrake === 3 ? 1 : 1);
      S.abActive = Vg > 1;
      const need = m * dec + fx - roll; brake = Math.max(brake, clamp(need / (0.45 * N + 1), 0, 1));
    } else S.abActive = false;
    let fric = roll + brake * 0.45 * N;
    if (S.pushback) { Vg = 0; }
    else if (Math.abs(Vg) < 0.05 && Math.abs(fx) <= fric) { Vg = 0; }
    else { const acc = (fx - Math.sign(Vg || fx) * fric) / m; const nv = Vg + acc * dt; Vg = (Vg > 0 && nv < 0) || (Vg < 0 && nv > 0) ? 0 : nv; if (Vg < 0) Vg = Math.max(Vg, -1); }
    // steering
    const gsKt = Math.abs(Vg) / KT;
    const nws = swGet('askid') && (S.hyd ? S.hyd.y > 0 : true) ? 1 : 0;
    const tillerMax = 75 * clamp((80 - gsKt) / 60, 0, 1) * nws;
    const steer = (S.tiller * tillerMax + (S.rudder + S.rudTrim / 20) * 6 * nws * clamp((130 - gsKt) / 40, 0.3, 1)) * D2R;
    if (!S.pushback) S.psi += Vg * Math.tan(clamp(steer, -1.2, 1.2)) / AC.wheelbase * dt;
    // aero yaw from rudder at speed
    S.psi += S.rudder * clamp((gsKt - 40) / 80, 0, 1) * 1.5 * D2R * dt;
    const hv2 = hdgVec(S.psi * R2D);
    S.vel.set(hv2.x * Vg, 0, hv2.z * Vg);
    S.pos.addScaledVector(S.vel, dt);
    S.pos.y = groundH(S.pos.x, S.pos.z);
    // pitch on ground
    flightControlsGround(dt, V, qbar, L, m);
    S.phi = approach(S.phi, 0, dt * 0.2);
    // liftoff
    const vertAcc = (L * Math.cos(S.theta) + T * Math.sin(S.theta) - m * G) / m;
    const recentTD = S.touchdown && S.time - S.touchdown.t < 15 && !S.tl.some(t => t >= DET.FLX - 0.02);
    if (vertAcc > 0.05 && V > 50 * KT && !recentTD) {
      S.onGround = false; S.vel.y = 0.3; S.gammaT = 0; S.airborneT = 0.001; S.groundSpoilersOut = false;
      S.stats.liftoffT = S.time;
    }
    if (S.theta > 11.6 * D2R) S.tailStrike = true;
    S.nz = 1;
  }
  // derived values
  S.tas = V; S.ias = V * Math.sqrt(a.sigma) / KT; S.mach = V / a.a;
  const gsv = Math.hypot(S.vel.x, S.vel.z); S.gs = gsv / KT; if (gsv > 1) S.trk = wrap360(Math.atan2(S.vel.x, -S.vel.z) * R2D); else S.trk = wrap360(S.psi * R2D);
  S.vs = S.vel.y / FT * 60; S.gamma = V > 10 ? Math.asin(clamp(_va.y / V, -1, 1)) * R2D : 0;
  S.alt = S.pos.y / FT;
  S.ra = (S.pos.y - groundH(S.pos.x, S.pos.z)) / FT;
  S.stats.maxBank = Math.max(S.stats.maxBank, Math.abs(S.phi * R2D)); S.stats.maxG = Math.max(S.stats.maxG, S.nz);
  S.stats.flown += gsv * dt;
}
function flightControlsAir(dt, V, qbar, CL0, aStall, alpha) {
  const ap = S.fcu.ap1 || S.fcu.ap2;
  const m = S.mass; const gam = Math.asin(clamp(S.vel.clone().sub(S.wind).y / Math.max(V, 1), -1, 1));
  // --- roll ---
  let pDot;
  if (ap) { pDot = clamp((S.ap.bankC * D2R - S.phi) * 1.2, -5 * D2R, 5 * D2R); }
  else {
    const rp = S.stickR;
    if (Math.abs(rp) > 0.03) pDot = rp * 15 * D2R;
    else pDot = Math.abs(S.phi) > 33 * D2R && !S.altLaw ? -Math.sign(S.phi) * 5 * D2R : 0;
  }
  S.phi = clamp(S.phi + pDot * dt, -67 * D2R, 67 * D2R);
  // --- pitch ---
  const raFt = S.ra;
  if (!ap && raFt < 50 && S.vs < 200 && S.airborneT > 5) { if (!S.flareMode) { S.flareMode = true; } }
  if (raFt > 80) S.flareMode = false;
  let thetaDot;
  if (S.flareMode && !ap) {
    thetaDot = S.stickP * 3.5 * D2R - (raFt < 30 ? 0.3 * D2R : 0);
  } else {
    if (ap) S.gammaT = S.ap.gammaC * D2R;
    else {
      const sp = S.stickP; const nzc = sp >= 0 ? sp * 1.5 : sp * 1.0;
      if (Math.abs(sp) > 0.02) S.gammaT = gam + (G / Math.max(V, 40)) * nzc * 2.5 * dt * 10;
      // when the stick is released, hold the current path
      if (Math.abs(sp) <= 0.02 && S._spPrev > 0.02) S.gammaT = gam;
      S.gammaT = clamp(S.gammaT, -25 * D2R, 30 * D2R);
    }
    // required CL for path + turn
    const nzReq = Math.cos(gam) / Math.max(Math.cos(S.phi), 0.3) + 0 ;
    let CLreq = m * G * nzReq / Math.max(qbar * AC.S, 1);
    let aReq = (CLreq - CL0 + S.spoiler * 0.45) / CLA;
    // alpha protection
    const aProt = aStall - (S.altLaw ? -1 : 2.5) * D2R; if (aReq > aProt) { aReq = aProt; }
    S.gInt = clamp((S.gInt || 0) + (S.gammaT - gam) * dt, -0.08, 0.08);
    let thCmd = S.gammaT + aReq + 0.9 * (S.gammaT - gam) + 0.6 * S.gInt;
    thCmd = clamp(thCmd, -15 * D2R, (S.flapPos > 0.5 ? 25 : 30) * D2R);
    // high speed protection
    if (S.ias > 360) thCmd += (S.ias - 360) * 0.002;
    thetaDot = clamp((thCmd - S.theta) * 1.6, -4 * D2R, 4.5 * D2R);
  }
  S._spPrev = Math.abs(S.stickP);
  S.theta = clamp(S.theta + thetaDot * dt, -20 * D2R, 35 * D2R);
  // --- yaw: coordinated turn + weathervane ---
  const va = S.vel.clone().sub(S.wind); const trkAir = Math.atan2(va.x, -va.z);
  let dpsi = trkAir - S.psi; while (dpsi > Math.PI) dpsi -= 2 * Math.PI; while (dpsi < -Math.PI) dpsi += 2 * Math.PI;
  S.psi += (G * Math.tan(S.phi) / Math.max(V, 40) + dpsi * 1.5 + S.rudder * 1.2 * D2R) * dt;
  S.psi = ((S.psi % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}
function flightControlsGround(dt, V, qbar, L, m) {
  const ap = S.fcu.ap1 || S.fcu.ap2;
  const iasKt = S.ias;
  const auth = clamp((iasKt - 85) / 45, 0, 1);
  let tgtRate;
  if (S.stickP > 0.05 && auth > 0) tgtRate = S.stickP * 5.5 * auth * D2R;
  else if (S.theta > 0) tgtRate = -(1.0 + (1 - clamp(L / (m * G), 0, 1)) * 2.5) * D2R * (S.stickP < -0.05 ? 1.8 : 1);
  else tgtRate = 0;
  S.theta = clamp(S.theta + tgtRate * dt, 0, 14 * D2R);
  S.gammaT = 0; S.flareMode = false; S.gInt = 0;
}

// ---------- navigation sources ----------
function updNav() {
  const ils = ILS26R;
  const dLoc = dist2(S.pos.x, S.pos.z, ils.locX, ils.locZ);
  const b = brg(ils.locX, ils.locZ, S.pos.x, S.pos.z);
  const dev = wrap180(b - wrap360(ils.crs + 180));
  S.loc.dev = dev; S.loc.dist = dLoc; S.loc.valid = dLoc < 25 * NM * 1.1 && Math.abs(dev) < 35 && acPowered();
  S.loc.xte = dLoc * Math.sin(dev * D2R); // + = course to the right of the aircraft (aircraft left of course)
  const dGs = dist2(S.pos.x, S.pos.z, ils.gsX, ils.gsZ);
  const hAbove = S.pos.y - (ils.elev + 0);
  const ang = Math.atan2(hAbove, dGs) * R2D;
  S.gs_.dev = ang - ils.gs; S.gs_.herr = hAbove - dGs * Math.tan(ils.gs * D2R);
  S.gs_.valid = S.loc.valid && Math.abs(dev) < 10 && dGs < 20 * NM && hAbove > -20;
  S.gs_.dist = dGs;
}

// ---------- FMGC: managed speed & phase ----------
function managedSpeed() {
  const sp = speeds(); const ph = S.fms.phase; const altFt = indicatedAlt();
  if (ph === 'TAKEOFF' || ph === 'PREFLIGHT') return S.fms.v2 + 10;
  if (ph === 'CLIMB') return S.ap.exped ? sp.gd : altFt < 10000 ? 250 : 290;
  if (ph === 'CRUISE') return 290;
  if (ph === 'DESCENT') return S.ap.exped ? (altFt < 10500 ? 250 : 340) : altFt < 10500 ? 250 : 290;
  if (ph === 'APPROACH') { const c = confIndex(); return [sp.gd, sp.S, sp.F, sp.F, sp.vapp][c] + (c === 4 ? 0 : 0); }
  if (ph === 'GO AROUND') return S.fms.v2 + 10;
  return 250;
}
function targetSpeed() { return S.fcu.spdMan ? (S.fcu.mach ? machToIas(S.fcu.machV) : S.fcu.spd) : managedSpeed(); }
function fmsPhase() {
  const f = S.fms; const altFt = indicatedAlt();
  if (f.phase === 'PREFLIGHT' && S.onGround && S.tl.some(t => t >= DET.FLX - 0.02) && S.ias < 80) f.phase = 'TAKEOFF';
  if (f.phase === 'TAKEOFF' && !S.onGround && S.ra > f.accAlt) f.phase = 'CLIMB';
  if (f.phase === 'CLIMB' && altFt > (f.crz || CRZ_FL) * 100 - 150 && altFt > S.fcu.alt - 200) f.phase = 'CRUISE';
  if ((f.phase === 'CLIMB' || f.phase === 'CRUISE') && S.fcu.alt < altFt - 2000 && (S.ap.vert === 'DES' || S.ap.vert === 'OP DES' || S.ap.vert === 'V/S') && S.loc.dist < 160 * NM) f.phase = 'DESCENT';
  if ((f.phase === 'DESCENT' || f.phase === 'CRUISE') && (S.flapLever >= 1 || (distToGo() < 30 && altFt < 12000))) f.phase = 'APPROACH';
  if (f.phase === 'APPROACH' && S.onGround && S.gs < 30 && S.airborneT === 0 && S.touchdown) f.phase = 'DONE';
}

// ---------- autopilot / flight director ----------
function ap_engage(n) {
  if (S.onGround || S.airborneT < 4 || S.ra < 100) return false;
  S.fcu['ap' + n] = !S.fcu['ap' + n];
  if (!S.fcu.ap1 && !S.fcu.ap2) Audio2.apDisc();
  return true;
}
function ap_disconnect(reason) { if (S.fcu.ap1 || S.fcu.ap2) { S.fcu.ap1 = S.fcu.ap2 = false; Audio2.apDisc(); S.warn.apOffT = S.time; } }
function athr_toggle() {
  if (S.fcu.athr) { S.fcu.athr = false; S.ap.athrMode = ''; S._athrDiscT = S.time; Audio2.chime(1); }
  else { S.fcu.athr = true; }
}
function stepAP(dt) {
  const ap = S.ap, fcu = S.fcu, f = S.fms;
  const altFt = indicatedAlt(); const tgtAlt = fcu.alt; const vsFpm = S.vs;
  const spdT = targetSpeed(); ap.spdT = spdT;
  // speed trend (kt/s), filtered
  S.iasTrend = lerp(S.iasTrend, (S.ias - (S._iasPrev ?? S.ias)) / dt, 0.04); S._iasPrev = S.ias;
  // ---------- vertical modes ----------
  if (S.onGround) {
    if (S.tl.some(t => t >= DET.FLX - 0.02) && f.phase !== 'DONE') { ap.vert = 'SRS'; ap.lat = 'RWY'; ap.vertArm = 'CLB'; ap.latArm = 'NAV'; ap.athrArmed = true; if (fcu.fd && !fcu.athr && !S.touchdown) fcu.athr = true; }
    else if (f.phase === 'DONE' || S.touchdown) { if (ap.vert === 'FLARE' || ap.vert === 'LAND') { ap.vert = 'ROLL OUT'; ap.lat = 'ROLL OUT'; } }
    else { ap.vert = ''; ap.lat = ''; ap.vertArm = ''; ap.latArm = ''; }
    ap.gammaC = 0;
  } else {
    const gamNow = S.gamma;
    const speedOnElev = (minG, maxG) => {
      const rate = 0.035 * (S.ias - spdT) + 0.35 * S.iasTrend;
      ap.gammaC = clamp(ap.gammaC + rate * dt, minG, maxG);
    };
    const vsToGamma = (vs) => Math.asin(clamp(vs * FT / 60 / Math.max(S.tas, 30), -0.5, 0.5)) * R2D;
    // transitions
    if (ap.vert === 'SRS' && S.ra > f.accAlt) { ap.vert = Math.abs(tgtAlt - altFt) < 300 ? 'ALT' : (fcu.altManagedPulled ? 'OP CLB' : 'CLB'); ap.vertArm = ''; }
    if (ap.vert === '' || !ap.vert) { ap.vert = 'V/S'; fcu.vs = Math.round(vsFpm / 100) * 100; }
    // ALT capture from climb/descent modes
    const capModes = ['CLB', 'OP CLB', 'DES', 'OP DES', 'V/S', 'SRS'];
    if (capModes.includes(ap.vert) && ap.vert !== 'SRS') {
      const err = tgtAlt - altFt; const thr = Math.max(Math.abs(vsFpm) / 6, 60);
      const towards = (err > 0 && vsFpm > 50) || (err < 0 && vsFpm < -50);
      if (Math.abs(err) < thr && towards) { ap.vert = 'ALT*'; ap.altCapVs = Math.abs(vsFpm); }
      else if (Math.abs(err) < 40) ap.vert = 'ALT';
    }
    if (ap.vert === 'ALT*' && Math.abs(tgtAlt - altFt) < 25) ap.vert = 'ALT';
    // G/S capture
    if (ap.vertArm === 'G/S' && S.gs_.valid && S.gs_.dev > -0.08 && S.gs_.dev < 0.5 && (ap.lat === 'LOC' || ap.lat === 'LOC*')) { ap.vert = 'G/S*'; ap.vertArm = ''; ap.gsCapT = S.time; }
    if (ap.vert === 'G/S*' && S.time - ap.gsCapT > 4) ap.vert = 'G/S';
    if (ap.vert === 'G/S' && S.ra < 400 && ap.lat === 'LOC') { ap.vert = 'LAND'; ap.lat = 'LAND'; }
    if ((ap.vert === 'LAND') && S.ra < 30) ap.vert = 'FLARE';
    // vertical commands
    switch (ap.vert) {
      case 'SRS': { const tgt = f.v2 + 10; const rate = 0.05 * (S.ias - Math.max(tgt, S.ias < f.v2 ? f.v2 : tgt)) + 0.3 * S.iasTrend; ap.gammaC = clamp((ap.gammaC || gamNow) + rate * dt, 2, 16); break; }
      case 'CLB': case 'OP CLB': speedOnElev(0.5, 18); if (tgtAlt < altFt - 100) ap.vert = 'OP DES'; break;
      case 'DES': case 'OP DES': speedOnElev(-14, -0.3); if (tgtAlt > altFt + 100) ap.vert = 'OP CLB'; break;
      case 'ALT*': { const err = tgtAlt - altFt; const vs = clamp(err * 1.8, -Math.max(ap.altCapVs, 500), Math.max(ap.altCapVs, 500)); ap.gammaC = approach(ap.gammaC, vsToGamma(vs), dt * 1.5); break; }
      case 'ALT': { if (ap.holdAlt == null) ap.holdAlt = tgtAlt; const err = ap.holdAlt - altFt; const vs = clamp(err * 2.2, -1200, 1200); ap.gammaC = approach(ap.gammaC, vsToGamma(vs), dt * 1.2); break; }
      case 'V/S': { const vs = fcu.vs; ap.gammaC = approach(ap.gammaC, vsToGamma(vs), dt * 1.0); break; }
      case 'G/S*': case 'G/S': case 'LAND': {
        const herr = S.gs_.herr; const gs = -ILS26R.gs - clamp(herr * 0.045, -1.8, 1.8) - 0.0;
        // compensate wind: use air path
        ap.gammaC = approach(ap.gammaC, gs, dt * 0.8); break; }
      case 'FLARE': { const vsT = -Math.min(800, 230 + Math.max(0, S.ra) * 14); ap.gammaC = approach(ap.gammaC, Math.max(vsToGamma(vsT), -3.2), dt * 1.5); break; }
      default: break;
    }
    if (ap.vert !== 'ALT') ap.holdAlt = null;
  }
  // ---------- lateral ----------
  if (!S.onGround) {
    if (ap.lat === 'RWY' && S.ra > 30) { ap.lat = (ap.latArm === 'NAV' && S.fms.coRte) ? 'NAV' : 'RWY TRK'; ap.latArm = ''; ap.trk = S.trk; }
    if (ap.lat === '' ) { ap.lat = 'HDG'; fcu.hdg = Math.round(S.psi * R2D) || 360; }
    if (ap.latArm === 'NAV' && ap.lat === 'HDG' && S.fms.coRte) { /* NAV arm waits for intercept; simplify: immediate */ ap.lat = 'NAV'; ap.latArm = ''; }
    if (ap.latArm === 'LOC' && S.loc.valid && Math.abs(S.loc.dev) < 3.5) { ap.lat = 'LOC*'; ap.latArm = ''; ap.locCapT = S.time; }
    if (ap.lat === 'LOC*' && Math.abs(S.loc.dev) < 0.4 && S.time - ap.locCapT > 3) ap.lat = 'LOC';
    let trkCmd = null, hdgCmd = null;
    switch (ap.lat) {
      case 'HDG': hdgCmd = fcu.hdg; break;
      case 'RWY TRK': trkCmd = ap.trk; break;
      case 'NAV': trkCmd = lnav(); break;
      case 'LOC*': case 'LOC': case 'LAND': {
        const xte = S.loc.xte; const xteRate = (xte - (ap._xtePrev ?? xte)) / dt; ap._xtePrev = xte;
        const kx = ap.lat === 'LOC*' ? 0.018 : 0.03; const corr = clamp(xte * kx + xteRate * 0.6, -30, 30);
        trkCmd = wrap360(ILS26R.crs + corr); break; }
      default: hdgCmd = S.psi * R2D;
    }
    let err;
    if (trkCmd != null) err = wrap180(trkCmd - S.trk); else err = wrap180(hdgCmd - S.psi * R2D);
    const maxBank = (ap.lat === 'LOC' || ap.lat === 'LAND') ? 15 : 25;
    ap.bankC = clamp(err * 2.2, -maxBank, maxBank);
    if (ap.lat === 'FLARE' || S.ra < 30) ap.bankC = clamp(ap.bankC, -5, 5);
  } else {
    ap.bankC = 0;
    if (ap.lat === 'ROLL OUT' && (fcu.ap1 || fcu.ap2)) { const corr = clamp(S.loc.xte * 0.05, -6, 6); const err = wrap180(ILS26R.crs + corr - S.psi * R2D); S.rudder = clamp(err * 0.3, -1, 1); }
  }
  // ---------- autothrust ----------
  if (fcu.athr) {
    const inDet = S.tl.every(t => t > 0.02 && t <= DET.CL + 0.01);
    const anyAbove = S.tl.some(t => t > DET.CL + 0.01);
    if (S.onGround && !S.touchdown) { ap.athrMode = ''; }
    else if (anyAbove) { ap.athrMode = ''; ap.athrArmed = true; }
    else if (S.tl.every(t => t <= 0.02)) { if (!S.onGround || S.touchdown) { fcu.athr = false; ap.athrMode = ''; } }
    else if (inDet) {
      const e1 = S.eng[0].N1, idle = n1Idle(), cl = n1Climb();
      if (ap.vert === 'CLB' || ap.vert === 'OP CLB' || ap.vert === 'SRS') { ap.athrMode = 'THR CLB'; ap.n1C = cl; }
      else if (ap.vert === 'DES' || ap.vert === 'OP DES') { ap.athrMode = 'THR IDLE'; ap.n1C = idle; }
      else if ((ap.vert === 'FLARE' && S.ra < 25) || ap.vert === 'ROLL OUT' || (S.onGround && S.touchdown)) { ap.athrMode = 'THR IDLE'; ap.n1C = idle; }
      else {
        ap.athrMode = 'SPEED';
        const err = spdT - S.ias; const rate = 1.1 * err - 3.8 * S.iasTrend;
        ap.n1C = clamp((ap.n1C || e1) + rate * dt, idle, cl);
      }
      ap.athrArmed = false;
    } else { ap.athrMode = ''; }
    // alpha floor
    if (!S.onGround && S.alpha > (CONF[confIndex()].CLmax - CONF[confIndex()].CL0) / CLA * R2D - 1.5 && S.ra > 100) { ap.alphaFloor = true; }
  } else { ap.athrMode = ''; }
  // ---------- flight director bars ----------
  if (!S.onGround) {
    S.fd.pitch = clamp((ap.gammaC * D2R + (S.theta - S.gamma * D2R) - S.theta) * R2D, -10, 10);
    S.fd.roll = clamp((ap.bankC - S.phi * R2D) / 3, -10, 10);
  } else { S.fd.pitch = ap.vert === 'SRS' ? clamp(15 - S.theta * R2D, -10, 10) * (S.ias > S.fms.vr - 5 ? 1 : 0) : 0; S.fd.roll = 0; }
}
function lnav() {
  const fp = FPLAN; let i = S.fms.wp; if (i >= fp.length) i = fp.length - 1;
  const w = fp[i];
  if (w.type === 'ALT') { if (indicatedAlt() > w.alt) { S.fms.wp++; } return w.hdg; }
  let prev = fp[i - 1]; if (prev.type === 'ALT') prev = { x: S.fms.altLegX ?? S.pos.x, z: S.fms.altLegZ ?? S.pos.z };
  const legBrg = brg(prev.x, prev.z, w.x, w.z);
  // cross-track (positive = aircraft right of leg)
  const dx = S.pos.x - prev.x, dz = S.pos.z - prev.z; const lv = hdgVec(legBrg);
  const along = dx * lv.x + dz * lv.z; const legLen = dist2(prev.x, prev.z, w.x, w.z);
  const rnx = -lv.z, rnz = lv.x; // right-hand normal of heading vector (x east, z south): heading north (0,-1) -> right (1,0)
  const xr = dx * rnx + dz * rnz;
  // sequencing with turn anticipation
  const nxt = fp[i + 1];
  let antic = 300;
  if (nxt && !nxt.rwy || (nxt && nxt.name === 'RW26R')) { const b2 = brg(w.x, w.z, nxt.x, nxt.z); const dA = Math.abs(wrap180(b2 - legBrg)); const R = Math.pow(S.tas, 2) / (G * Math.tan(25 * D2R)); antic = Math.min(R * Math.tan(dA / 2 * D2R), 9000) + 200; }
  if (legLen - along < antic && i < fp.length - 1) { S.fms.wp++; if (fp[i].type === 'ALT') { } }
  if (w.type !== 'ALT' && prev && fp[i - 1].type === 'ALT' && S.fms.altLegX == null) { S.fms.altLegX = S.pos.x; S.fms.altLegZ = S.pos.z; }
  return wrap360(legBrg - clamp(xr * 0.012, -45, 45));
}
function distToGo() { // nm along remaining route to destination
  const fp = FPLAN;
  // Once established on the ILS, the course-fix is behind us. Continuing to
  // route through it makes the MCDU distance grow again on short final.
  if (S.fms.wp >= fp.length - 1 || /^(LOC|LAND|ROLL OUT)/.test(S.ap.lat)) {
    const r = CDG.rwys[0];
    return dist2(S.pos.x, S.pos.z, r.tx, r.tz) / NM;
  }
  let i = Math.max(S.fms.wp, 1); let d = 0, px = S.pos.x, pz = S.pos.z;
  for (let k = i; k < fp.length; k++) { const w = fp[k]; if (w.type === 'ALT') continue; d += dist2(px, pz, w.x, w.z); px = w.x; pz = w.z; }
  return d / NM;
}

// ---------- warnings / callouts ----------
const CALLS = [2500, 1000, 500, 400, 300, 200, 100, 50, 40, 30, 20, 10];
function stepWarnings(dt) {
  const w = S.warn; w.msgs = []; let master = false, caution = false;
  const sp = speeds();
  if (!S.onGround && S.ias > sp.vmax + 4) { w.msgs.push({ t: 'OVERSPEED', c: 'red' }); master = true; S.stats.overspeedT = (S.stats.overspeedT || 0) + dt; }
  const stall = !S.onGround && S.ra > 30 && S.alpha > ((lerp(CONF[Math.floor(S.flapPos)].CLmax, CONF[Math.ceil(S.flapPos)].CLmax, S.flapPos % 1) - lerp(CONF[Math.floor(S.flapPos)].CL0, CONF[Math.ceil(S.flapPos)].CL0, S.flapPos % 1)) / CLA * R2D - 0.3);
  if (stall) { w.msgs.push({ t: 'STALL', c: 'red' }); master = true; }
  if (!S.onGround && S.ra < 750 && S.ra > 30 && S.gearPos < 0.5 && S.ias < 190 && S.vs < 0) { w.msgs.push({ t: 'L/G NOT DOWN', c: 'red' }); master = true; }
  if (S.tailStrike) w.msgs.push({ t: 'TAIL STRIKE', c: 'amber' });
  if (S.onGround && S.parkBrake && S.tl.some(t => t > DET.FLX - 0.05)) { w.msgs.push({ t: 'CONFIG PARK BRK ON', c: 'red' }); master = true; }
  if (S.onGround && S.tl.some(t => t > DET.FLX - 0.05) && (S.flapLever === 0 || S.flapLever > 3)) { w.msgs.push({ t: 'CONFIG FLAPS NOT IN T.O CONFIG', c: 'red' }); master = true; }
  if (S.warn.apOffT && S.time - S.warn.apOffT < 3) { w.msgs.push({ t: 'AP OFF', c: 'red' }); master = true; }
  for (const k of ['eng1', 'apu', 'eng2']) if (S.elec.dc && S.time - (S.fireTest[k] ?? -99) < 3) { w.msgs.push({ t: (k === 'apu' ? 'APU' : 'ENG ' + k[3]) + ' FIRE', c: 'red' }); master = true; }
  if (swGet('evac')) { w.msgs.push({ t: 'EVAC COMMAND', c: 'red' }); }
  const cautions = [];
  if (S.fuel < 1500) cautions.push('FUEL LO LEVEL');
  if (S.altLaw) cautions.push('F/CTL ALTN LAW');
  if (S.elec.dc && !S.elec.ac && engRunning()) cautions.push('ELEC AC BUS 1+2 FAULT');
  if (typeof swAbnormals === 'function') swAbnormals().forEach(m => cautions.push(m));
  w.cautions = cautions; w.ack = (w.ack || []).filter(m => cautions.includes(m));
  caution = cautions.some(m => !w.ack.includes(m));
  const ck = cautions.filter(m => !w.ack.includes(m)).join('|'); if (ck && ck !== w._ck && ck.length > (w._ck || '').length) Audio2.chime(); w._ck = ck;
  if (!S.elec.dc) { master = false; caution = false; }
  w.master = master; w.caution = caution;
  // GPWS
  const now = S.time;
  w.gpwsLt = false;
  if (!S.onGround && S.airborneT > 10 && swGet('gpws_sys')) {
    if (S.ra < 1000 && S.ra > 30 && S.vs < -1800) w.gpwsLt = true;
    if (S.ra < 1000 && S.ra > 30 && S.vs < -1800 && now - (w.sinkT || 0) > 3) { Audio2.say('Sink rate', 'gpws'); w.sinkT = now; }
    if (S.ra < 500 && S.ra > 50 && S.gearPos < 0.5 && S.ias < 190 && now - (w.tlgT || 0) > 4) { Audio2.say('Too low, gear', 'gpws'); w.tlgT = now; }
    if (stall && now - (w.stallT || 0) > 2) { Audio2.say('Stall, stall', 'gpws'); w.stallT = now; }
  }
  // radio altitude callouts on approach
  if (!S.onGround && S.vs < -100 && S.airborneT > 30) {
    for (const c of CALLS) {
      if (S._raPrev > c && S.ra <= c && !(w['c' + c])) {
        w['c' + c] = true;
        if (c === 200) { Audio2.say('Minimum', 'gpws'); }
        else Audio2.say(c === 2500 ? 'Twenty five hundred' : c === 1000 ? 'One thousand' : c === 500 ? 'Five hundred' : String(c), 'gpws');
      }
    }
    if (S.ra < 20 && S.tl.some(t => t > 0.03) && now - (w.retT || 0) > 1.2) { Audio2.say('Retard', 'gpws'); w.retT = now; }
  }
  if (S.ra > 3000) CALLS.forEach(c => w['c' + c] = false);
  S._raPrev = S.ra;
}
