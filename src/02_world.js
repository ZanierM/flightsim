// ---------- World: mask, terrain, sky, clouds, airports, buildings ----------
const W = { sunDir: new THREE.Vector3(), hazeCol: new THREE.Color(), skyCol: new THREE.Color() };
const MASK_N = 4096;
let maskData = null;     // Uint8ClampedArray RGBA
let waterLo = null, WLO_N = 512;

function mpx(x, z) { return [(x - WORLD.X0) / (WORLD.X1 - WORLD.X0) * MASK_N, (z - WORLD.Z0) / (WORLD.Z1 - WORLD.Z0) * MASK_N]; }
function mpxLL(lat, lon) { const p = ll(lat, lon); return mpx(p.x, p.z); }
const PX_M = MASK_N / (WORLD.X1 - WORLD.X0); // pixels per metre (x)

function buildMask() {
  const c = document.createElement('canvas'); c.width = c.height = MASK_N;
  const g = c.getContext('2d');
  // Sea everywhere, then land
  g.fillStyle = '#ff0000'; g.fillRect(0, 0, MASK_N, MASK_N);
  g.fillStyle = '#000000';
  for (const poly of [COAST_ENGLAND, COAST_FRANCE]) {
    g.beginPath();
    poly.forEach((p, i) => { const [x, y] = mpxLL(p[0], p[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.closePath(); g.fill();
  }
  // coastline roughness: small random bites/bulges
  const r = mulberry(99);
  g.globalCompositeOperation = 'lighter';
  // rivers
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const rv of RIVERS) {
    const pts = rv.pts;
    // subdivide with slight meander
    for (let i = 0; i < pts.length - 1; i++) {
      const [a0, a1] = mpxLL(pts[i][0], pts[i][1]), [b0, b1] = mpxLL(pts[i + 1][0], pts[i + 1][1]);
      const t0 = i / (pts.length - 1), t1 = (i + 1) / (pts.length - 1);
      const wpx = lerp(rv.w0, rv.w1, (t0 + t1) / 2) * PX_M;
      g.strokeStyle = 'rgb(255,0,0)'; g.lineWidth = Math.max(1.2, wpx);
      g.beginPath(); g.moveTo(a0, a1);
      const segs = 6; let px = a0, py = a1;
      for (let s = 1; s <= segs; s++) {
        const t = s / segs; let x = lerp(a0, b0, t), y = lerp(a1, b1, t);
        if (s < segs) { const nx = -(b1 - a1), ny = b0 - a0, L = Math.hypot(nx, ny) || 1; const m = (r() - 0.5) * 0.25; x += nx / L * m * Math.hypot(b0 - a0, b1 - a1) * 0.5; y += ny / L * m * Math.hypot(b0 - a0, b1 - a1) * 0.5; }
        g.lineTo(x, y); px = x; py = y;
      }
      g.stroke();
    }
  }
  for (const l of LAKES) { const [x, y] = mpxLL(l[0], l[1]); g.fillStyle = 'rgb(255,0,0)'; g.beginPath(); g.ellipse(x, y, l[2] * 1000 * PX_M, l[2] * 650 * PX_M, r() * 3, 0, 7); g.fill(); }
  // forests (blue) - clusters of blobs
  for (const f of FORESTS) {
    const [cx, cy] = mpxLL(f[0], f[1]); const R = f[2] * 1000 * PX_M;
    for (let i = 0; i < 70; i++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * R; const rr = (0.08 + r() * 0.22) * R;
      g.fillStyle = 'rgba(0,0,255,0.55)'; g.beginPath(); g.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rr, rr * (0.5 + r() * 0.6), r() * 3, 0, 7); g.fill();
    }
  }
  // scattered woodland
  for (let i = 0; i < 2200; i++) {
    const x = r() * MASK_N, y = r() * MASK_N, R0 = (200 + r() * 800) * PX_M; const n = 3 + (r() * 8 | 0); const ang = r() * 3;
    for (let k = 0; k < n; k++) { const d = r() * R0, a2 = ang + (r() - .5) * 2.2; const rr = R0 * (0.25 + r() * 0.45);
      g.fillStyle = `rgba(0,0,255,${(0.35 + r() * 0.3).toFixed(2)})`; g.beginPath(); g.ellipse(x + Math.cos(a2) * d, y + Math.sin(a2) * d, rr, rr * (0.4 + r() * 0.6), r() * 3, 0, 7); g.fill(); }
  }
  // urban (green)
  for (const u of URBAN) {
    const [cx, cy] = mpxLL(u[0], u[1]); const R = u[2] * 1000 * PX_M;
    const n = Math.round(40 + u[2] * 25);
    for (let i = 0; i < n; i++) {
      const a = r() * 6.283, d = Math.pow(r(), 0.8) * R; const rr = (0.12 + r() * 0.3) * R;
      const al = u[3] * (0.22 + 0.25 * (1 - d / R));
      g.fillStyle = `rgba(0,255,0,${al.toFixed(3)})`; g.beginPath(); g.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rr, rr * (0.6 + r() * 0.4), r() * 3, 0, 7); g.fill();
    }
  }
  // villages
  for (let i = 0; i < 1600; i++) {
    const x = r() * MASK_N, y = r() * MASK_N, rr = (250 + r() * 700) * PX_M;
    g.fillStyle = `rgba(0,255,0,${(0.35 + r() * 0.3).toFixed(2)})`; g.beginPath(); g.ellipse(x, y, rr, rr * (0.6 + r() * 0.4), r() * 3, 0, 7); g.fill();
  }
  // main roads (urban-ish lines) between towns
  g.lineWidth = 1.3; g.strokeStyle = 'rgba(0,140,0,0.7)';
  const towns = URBAN.filter(u => u[2] >= 2.5);
  for (let i = 0; i < towns.length; i++) {
    let best = null, bd = 1e9; for (let j = 0; j < towns.length; j++) { if (i === j) continue; const d = Math.hypot(towns[i][0] - towns[j][0], towns[i][1] - towns[j][1]); if (d < bd && d > 0.05) { bd = d; best = towns[j]; } }
    if (best && bd < 0.6) { const [a, b] = mpxLL(towns[i][0], towns[i][1]), [c2, d2] = mpxLL(best[0], best[1]); g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo((a + c2) / 2 + (r() - .5) * 40, (b + d2) / 2 + (r() - .5) * 40, c2, d2); g.stroke(); }
  }
  // Airports: clear urban/forest, mark as "airport" (urban 0, forest 0) by painting black over G/B
  g.globalCompositeOperation = 'source-over';
  const id0 = g.getImageData(0, 0, MASK_N, MASK_N); const d0 = id0.data;
  for (const ap of AIRPORTS) {
    const [px, py] = mpx(ap.cx, ap.cz); const R = ap.rx * PX_M, Rz = ap.rz * PX_M;
    for (let y = Math.floor(py - Rz - 20); y < py + Rz + 20; y++) for (let x = Math.floor(px - R - 20); x < px + R + 20; x++) {
      const e = Math.pow((x - px) / R, 2) + Math.pow((y - py) / Rz, 2); if (e > 1.3) continue;
      const k = (y * MASK_N + x) * 4; const f = e < 1 ? 0 : (e - 1) / 0.3; d0[k + 1] *= f; d0[k + 2] *= f; d0[k] = 0; d0[k + 3] = 255 * (1 - f) | 0;
    }
  }
  for (let k = 3; k < d0.length; k += 4) { /* alpha channel = airport grass flag */ if (d0[k] === 255 && d0[k - 1] + d0[k - 2] + d0[k - 3] > 0) { } }
  // alpha marks airport; elsewhere alpha 0 means "not airport": reset non-airport alpha
  // (the canvas filled alpha=255 everywhere; we re-encode below)
  maskData = new Uint8ClampedArray(d0.length);
  for (let k = 0; k < d0.length; k += 4) { maskData[k] = d0[k]; maskData[k + 1] = d0[k + 1]; maskData[k + 2] = d0[k + 2]; maskData[k + 3] = 0; }
  for (const ap of AIRPORTS) {
    const [px, py] = mpx(ap.cx, ap.cz); const R = ap.rx * PX_M, Rz = ap.rz * PX_M;
    for (let y = Math.floor(py - Rz - 20); y < py + Rz + 20; y++) for (let x = Math.floor(px - R - 20); x < px + R + 20; x++) {
      const e = Math.pow((x - px) / R, 2) + Math.pow((y - py) / Rz, 2); if (e > 1.3) continue;
      const k = (y * MASK_N + x) * 4; maskData[k + 3] = 255 * clamp(1 - (e - 1) / 0.3, 0, 1);
    }
  }
  // low-res blurred water for heights
  waterLo = new Float32Array(WLO_N * WLO_N);
  const s = MASK_N / WLO_N;
  for (let y = 0; y < WLO_N; y++) for (let x = 0; x < WLO_N; x++) {
    let acc = 0; for (let j = 0; j < s; j += 2) for (let i = 0; i < s; i += 2) acc += maskData[((y * s + j) * MASK_N + x * s + i) * 4];
    waterLo[y * WLO_N + x] = acc / (255 * (s / 2) * (s / 2));
  }
  boxBlur(waterLo, WLO_N, 2); boxBlur(waterLo, WLO_N, 2);
  const tex = new THREE.DataTexture(maskData, MASK_N, MASK_N, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true; tex.anisotropy = 8; tex.needsUpdate = true;
  tex.flipY = false;
  return tex;
}
function boxBlur(a, n, r) {
  const t = new Float32Array(a.length);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let s = 0, c = 0; for (let i = -r; i <= r; i++) { const xx = x + i; if (xx < 0 || xx >= n) continue; s += a[y * n + xx]; c++; } t[y * n + x] = s / c; }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let s = 0, c = 0; for (let i = -r; i <= r; i++) { const yy = y + i; if (yy < 0 || yy >= n) continue; s += t[yy * n + x]; c++; } a[y * n + x] = s / c; }
}
function maskAt(x, z) { // returns [water, urban, forest, airport] 0..1, nearest
  const [px, py] = mpx(x, z); const ix = clamp(px | 0, 0, MASK_N - 1), iy = clamp(py | 0, 0, MASK_N - 1);
  const k = (iy * MASK_N + ix) * 4; return [maskData[k] / 255, maskData[k + 1] / 255, maskData[k + 2] / 255, maskData[k + 3] / 255];
}
function waterLoAt(x, z) {
  const fx = clamp((x - WORLD.X0) / (WORLD.X1 - WORLD.X0) * WLO_N - 0.5, 0, WLO_N - 1.001), fz = clamp((z - WORLD.Z0) / (WORLD.Z1 - WORLD.Z0) * WLO_N - 0.5, 0, WLO_N - 1.001);
  const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz;
  const a = waterLo[iz * WLO_N + ix], b = waterLo[iz * WLO_N + ix + 1], c = waterLo[(iz + 1) * WLO_N + ix], d = waterLo[(iz + 1) * WLO_N + ix + 1];
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}

// ----- terrain height model -----
const RIDGES = [ // polyline lat/lon, height m, half-width km
  { h: 150, w: 4.5, pts: [[51.24, -0.85], [51.24, -0.57], [51.25, -0.3], [51.29, 0.0], [51.31, 0.3], [51.30, 0.6], [51.25, 0.85], [51.20, 1.05], [51.15, 1.25]] },
  { h: 170, w: 5, pts: [[50.95, -1.05], [50.90, -0.6], [50.87, -0.2], [50.84, 0.05], [50.78, 0.22]] },
  { h: 160, w: 7, pts: [[51.62, -0.95], [51.70, -0.70], [51.80, -0.45], [51.90, -0.2]] },
  { h: 90, w: 9, pts: [[51.05, -0.4], [51.05, 0.1], [51.0, 0.5]] },
  { h: 110, w: 4, pts: [[50.88, 1.62], [50.80, 1.75], [50.70, 1.85], [50.60, 1.90]] }
].map(r => ({ ...r, P: r.pts.map(p => ll(p[0], p[1])) }));
const VALLEYS = [RIVERS[0], RIVERS[2], RIVERS[3]].map(r => r.pts.map(p => ll(p[0], p[1])));
function segDist(px, pz, P) {
  let best = 1e12;
  for (let i = 0; i < P.length - 1; i++) {
    const ax = P[i].x, az = P[i].z, bx = P[i + 1].x, bz = P[i + 1].z; const vx = bx - ax, vz = bz - az;
    const t = clamp(((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz), 0, 1); const dx = px - (ax + vx * t), dz = pz - (az + vz * t);
    const d = dx * dx + dz * dz; if (d < best) best = d;
  }
  return Math.sqrt(best);
}
function rawHeight(x, z) {
  const france = smooth(150000, 200000, z + x * 0.25);
  let h = lerp(30, 95, france);
  h += 45 * fbm(x / 22000, z / 22000, 4) + 12 * fbm(x / 5000 + 10, z / 5000, 3);
  if (france > 0.01) h += france * 50 * smooth(-0.2, 0.6, fbm(x / 40000 + 3, z / 40000, 3));
  for (const r of RIDGES) { const d = segDist(x, z, r.P); if (d < r.w * 3000) h += r.h * Math.exp(-Math.pow(d / (r.w * 1000), 2)) * (0.75 + 0.25 * fbm(x / 6000, z / 6000, 2)); }
  for (const v of VALLEYS) { const d = segDist(x, z, v); if (d < 9000) h = lerp(h, 12 + h * 0.15, Math.exp(-Math.pow(d / 3500, 2)) * 0.85); }
  // London basin
  const lon = ll(51.5, -0.12); const dl = Math.hypot(x - lon.x, z - lon.z); if (dl < 30000) h = lerp(h, 22, smooth(30000, 8000, dl) * 0.8);
  return Math.max(4, h);
}
function terrainHeight(x, z) {
  let h = rawHeight(x, z);
  const w = waterLoAt(x, z); h = lerp(h, -12, smooth(0.25, 0.75, w));
  for (const ap of AIRPORTS) {
    const d = Math.hypot((x - ap.cx) / 1.6, z - ap.cz); h = lerp(h, ap.elev, smooth(ap.rz + 4500, ap.rz + 1200, d));
  }
  return h;
}
// grid-sampled height (matches rendered mesh)
const TER = { xs: null, zs: null, h: null };
function axisCoords(a0, a1, inner, outerExt) {
  const pts = []; for (let v = a0; v <= a1 + 1; v += inner) pts.push(v);
  let s = inner, v = a0; const left = []; while (v > a0 - outerExt) { s *= 1.12; v -= s; left.unshift(v); }
  s = inner; v = pts[pts.length - 1]; const right = []; while (v < a1 + outerExt) { s *= 1.12; v += s; right.push(v); }
  return left.concat(pts, right);
}
// Pavement sits clearly above the grass (a few cm is lost to the log depth buffer at distance)
const PAVE = 0.3;
function pavementLift(x, z) { for (const ap of AIRPORTS) if (Math.hypot((x - ap.cx) / 1.6, z - ap.cz) < ap.rz + 1000) return PAVE + 0.04; return 0; }
function groundH(x, z) { return terrainGridH(x, z) + pavementLift(x, z); }
function terrainGridH(x, z) {
  const xs = TER.xs, zs = TER.zs;
  let i = bsearch(xs, x), j = bsearch(zs, z);
  const tx = (x - xs[i]) / (xs[i + 1] - xs[i]), tz = (z - zs[j]) / (zs[j + 1] - zs[j]);
  const n = xs.length, H = TER.h;
  const a = H[j * n + i], b = H[j * n + i + 1], c = H[(j + 1) * n + i], d = H[(j + 1) * n + i + 1];
  // match triangle split used in mesh (a,c,b) / (b,c,d)
  if (tx + tz < 1) return a + (b - a) * tx + (c - a) * tz;
  return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
}
function bsearch(arr, v) { let lo = 0, hi = arr.length - 2; if (v <= arr[0]) return 0; if (v >= arr[hi]) return hi; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m] <= v) lo = m; else hi = m; } return lo; }

// Shared GLSL
const GLSL_COMMON = `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec2(1.7,9.2); a*=.5;} return s; }
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uHaze; uniform vec3 uCam; uniform float uVis;
vec3 aerial(vec3 col, vec3 wp){
  vec3 v = wp - uCam; float d = length(v); float H = 1500.;
  float h0 = max(uCam.y, 0.), h1 = max(wp.y, 0.);
  float dh = h1 - h0; float f = abs(dh) < 1. ? exp(-h0/H) : H*(exp(-h0/H)-exp(-h1/H))/dh;
  float tau = d * (3.4/uVis) * f + d * 1.6e-6;
  float fog = 1. - exp(-tau);
  vec3 vd = v / max(d, 1.);
  float sunAmt = pow(max(dot(vd, uSunDir), 0.), 8.);
  vec3 hz = mix(uHaze, uSunCol * 1.05, sunAmt * 0.45);
  return mix(col, hz, fog);
}
float curveDrop(vec3 wp){ vec2 d = wp.xz - uCam.xz; return dot(d,d) / 12742000.; }
`;

function groundMaterial(maskTex) {
  const U = {
    uMask: { value: maskTex }, uB: { value: new THREE.Vector4(WORLD.X0, WORLD.Z0, 1 / (WORLD.X1 - WORLD.X0), 1 / (WORLD.Z1 - WORLD.Z0)) },
    uSunDir: { value: W.sunDir }, uSunCol: { value: new THREE.Color(1.0, 0.96, 0.88) }, uHaze: { value: W.hazeCol }, uCam: { value: new THREE.Vector3() },
    uVis: { value: 40000 }, uSky: { value: W.skyCol }, uTime: { value: 0 }
  };
  return new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
${GLSL_COMMON}
varying vec3 vW; varying vec3 vN;
void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vN = normal;
  w.y -= curveDrop(w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
  #include <logdepthbuf_vertex>
}`,
    fragmentShader: `#include <common>
#include <logdepthbuf_pars_fragment>
${GLSL_COMMON}
uniform sampler2D uMask; uniform vec4 uB; uniform vec3 uSky; uniform float uTime;
varying vec3 vW; varying vec3 vN;
vec3 fieldCol(vec2 p, float france, out float edge){
  vec2 q = p + 260. * vec2(vnoise(p*0.0012), vnoise(p*0.0012+7.)) ;
  float ang = (hash12(floor(q/4000.)) - .5) * 1.2;
  mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec2 r = R * q; vec2 sz = mix(vec2(260.,190.), vec2(520.,340.), france);
  vec2 c = floor(r / sz); vec2 f = fract(r / sz);
  float h = hash12(mod(c, 997.));
  float h2 = hash12(mod(c+31., 997.));
  vec3 col;
  if (h < .30) col = mix(vec3(.24,.34,.13), vec3(.30,.40,.16), h2);       // pasture
  else if (h < .50) col = mix(vec3(.38,.42,.20), vec3(.44,.46,.24), h2);  // grass ley
  else if (h < .68) col = mix(vec3(.56,.50,.30), vec3(.64,.58,.36), h2);  // wheat stubble
  else if (h < .80) col = mix(vec3(.40,.32,.22), vec3(.47,.38,.27), h2);  // ploughed
  else if (h < .90) col = mix(vec3(.30,.38,.15), vec3(.50,.52,.22), h2);  // crops
  else col = mix(vec3(.58,.56,.30), vec3(.66,.62,.42), h2);
  if (france < .5 && h < .55) col *= vec3(.92,1.05,.9);
  col = mix(col, col * vec3(1.08,1.02,.92), france);
  vec2 e = min(f, 1.-f) * sz; edge = min(e.x, e.y);
  // ploughed / crop rows
  float rows = sin(r.x * (h > .6 ? 1.2 : .6)) * .5 + .5; col *= 1. - .05 * rows * step(.5, h);
  return col;
}
void main(){
  #include <logdepthbuf_fragment>
  vec2 uv = (vW.xz - uB.xy) * uB.zw;
  vec4 m = texture2D(uMask, uv);
  vec2 p = vW.xz;
  float dist = length(vW - uCam);
  float france = smoothstep(150000., 200000., p.y + p.x * .25);
  float edge; vec3 col = fieldCol(p, france, edge);
  // regional variation so the patchwork isn't uniform from altitude
  float reg = vnoise(p * .00012) * .6 + vnoise(p * .0005) * .4;
  col *= mix(vec3(.88,.95,.84), vec3(1.12,1.05,.9), reg);
  col = mix(col, vec3(dot(col, vec3(.33))), .12);
  float fw = max(fwidth(p.x), 0.05);
  float hedge = 1. - smoothstep(3., 3. + fw * 1.5, edge);
  col = mix(col, vec3(.13,.19,.08), hedge * .85 * (1. - smoothstep(4000., 15000., dist)));
  col = mix(col, vec3(.26,.32,.17), smoothstep(4000., 18000., dist) * .35);
  // fine grain
  float g = vnoise(p * .35) * .5 + vnoise(p * 2.1) * .5; col *= .9 + .2 * g * (1. - smoothstep(300., 2500., dist));
  // forest
  float fo = smoothstep(.28, .5, m.b * (.45 + 1.1 * (vnoise(p*.003) * .5 + vnoise(p*.015) * .35 + vnoise(p*.07) * .15)));
  vec3 fcol = mix(vec3(.09,.15,.06), vec3(.16,.22,.09), vnoise(p * .04)) * (.75 + .5 * vnoise(p * .6));
  col = mix(col, fcol, fo);
  // urban
  float ur = smoothstep(.15, .7, m.g + (vnoise(p*.006)-.5)*.2);
  vec2 blk = fract(p / 95.); float street = 1. - smoothstep(.0, .06, min(min(blk.x, 1.-blk.x), min(blk.y,1.-blk.y)));
  float roofs = hash12(mod(floor(p / 14.), 977.));
  vec3 ucol = mix(vec3(.42,.40,.38), vec3(.56,.50,.46), roofs);
  ucol = mix(ucol, vec3(.48,.32,.26), step(.62, roofs) * (1. - france) * .8);
  ucol = mix(ucol, vec3(.25,.33,.18), step(.86, hash12(mod(floor(p / 60.), 977.))) * .8); // gardens/parks
  ucol = mix(ucol, vec3(.30,.30,.31), street * (1. - smoothstep(1500., 6000., dist)));
  ucol = mix(ucol, vec3(.45,.43,.42), smoothstep(3000., 20000., dist) * .5);
  col = mix(col, ucol, ur * .92);
  // airport grass
  float meadow = vnoise(p * .008) * .65 + vnoise(p * .035) * .35;
  vec3 acol = mix(vec3(.27,.35,.15), vec3(.46,.48,.27), meadow);
  float mowing = sin(p.x * .19 + vnoise(p * .0015) * 3.);
  acol *= .94 + .08 * mowing * (1. - smoothstep(1600., 7000., dist));
  float dry = smoothstep(.62, .79, vnoise(p * .003 + vec2(12., 5.)));
  acol = mix(acol, vec3(.52,.48,.31), dry * .32);
  acol *= .94 + .12 * vnoise(p * .7) * (1. - smoothstep(250., 1800., dist));
  col = mix(col, acol, m.a);
  // lighting
  vec3 n = normalize(vN);
  n = normalize(n + vec3(vnoise(p*.05)-.5, 0., vnoise(p*.05+3.)-.5) * .12 * (1. - smoothstep(800., 4000., dist)));
  float dif = max(dot(n, uSunDir), 0.);
  vec3 lit = col * (uSunCol * dif * 1.05 + uSky * .42 + vec3(.04));
  // water
  float wa = smoothstep(.35, .65, m.r);
  if (wa > 0.) {
    vec3 vd = normalize(vW - uCam);
    vec2 wp = p * .03 + vec2(uTime * .05, uTime * .03);
    vec3 wn = normalize(vec3((vnoise(wp) - .5) * .35 + (vnoise(wp * 4.3) - .5) * .18, 1., (vnoise(wp + 5.) - .5) * .35 + (vnoise(wp * 4.1 + 2.) - .5) * .18));
    wn = normalize(mix(wn, vec3(0,1,0), smoothstep(2000., 40000., dist)));
    float fres = .02 + .98 * pow(1. - max(dot(-vd, wn), 0.), 5.);
    vec3 refl = reflect(vd, wn);
    float spec = pow(max(dot(refl, uSunDir), 0.), 220.) * 6. + pow(max(dot(refl, uSunDir), 0.), 18.) * .25;
    vec3 deep = mix(vec3(.05,.13,.17), vec3(.08,.17,.18), france);
    vec3 sky = mix(uHaze, uSky * 1.4, .4);
    vec3 wc = mix(deep * (.6 + .5 * dif), sky, fres) + uSunCol * spec;
    lit = mix(lit, wc, wa);
  }
  gl_FragColor = vec4(aerial(lit, vW), 1.);
}`,
    extensions: { derivatives: true }
  });
}

function buildTerrain(scene, maskTex) {
  const xs = axisCoords(WORLD.X0, WORLD.X1, 1000, 500000), zs = axisCoords(WORLD.Z0, WORLD.Z1, 1000, 500000);
  TER.xs = xs; TER.zs = zs;
  const nx = xs.length, nz = zs.length; const H = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) H[j * nx + i] = terrainHeight(xs[i], zs[j]);
  TER.h = H;
  const pos = new Float32Array(nx * nz * 3), nor = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = (j * nx + i) * 3; pos[k] = xs[i]; pos[k + 1] = H[j * nx + i]; pos[k + 2] = zs[j]; }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const i0 = Math.max(i - 1, 0), i1 = Math.min(i + 1, nx - 1), j0 = Math.max(j - 1, 0), j1 = Math.min(j + 1, nz - 1);
    const dx = (H[j * nx + i1] - H[j * nx + i0]) / (xs[i1] - xs[i0]), dz = (H[j1 * nx + i] - H[j0 * nx + i]) / (zs[j1] - zs[j0]);
    const L = Math.hypot(dx, 1, dz); const k = (j * nx + i) * 3; nor[k] = -dx / L; nor[k + 1] = 1 / L; nor[k + 2] = -dz / L;
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6); let q = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(100000, 0, 130000), 2e6);
  const mat = groundMaterial(maskTex);
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; scene.add(mesh);
  return mesh;
}

// ----- Sky -----
function buildSky(scene) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSunDir: { value: W.sunDir }, uHaze: { value: W.hazeCol }, uAlt: { value: 0 } },
    vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vD; void main(){ vD = normalize(position); vec4 w = modelMatrix * vec4(position,1.); gl_Position = projectionMatrix * viewMatrix * w; gl_Position.z = gl_Position.w * 0.99999;
#include <logdepthbuf_vertex>
}`,
    fragmentShader: `#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uSunDir; uniform vec3 uHaze; uniform float uAlt; varying vec3 vD;
void main(){
#include <logdepthbuf_fragment>
  vec3 d = normalize(vD);
  float alt = clamp(uAlt / 12000., 0., 1.);
  float dip = -sqrt(2. * max(uAlt, 1.) / 6371000.);
  float e = d.y - dip;
  vec3 zen = mix(vec3(.20,.40,.78), vec3(.09,.22,.58), alt);
  vec3 mid = mix(vec3(.45,.62,.86), vec3(.30,.48,.80), alt);
  vec3 col = mix(uHaze, mid, smoothstep(0., .18 - alt * .08, e));
  col = mix(col, zen, smoothstep(.15, .9, e));
  float cs = max(dot(d, uSunDir), 0.);
  col += vec3(1., .9, .7) * (pow(cs, 6.) * .18 + pow(cs, 60.) * .35);
  col += vec3(1., .98, .92) * smoothstep(.99975, .99992, cs) * 8.;
  if (e < 0.) col = mix(uHaze, uHaze * .92, smoothstep(0., -.08, e));
  // thin cirrus
  vec2 p = d.xz / max(d.y + .08, .02) * 2.;
  float c = 0.; vec2 q = p * vec2(.6, 2.5);
  float n = 0., a = .5; for (int i = 0; i < 4; i++) { n += a * fract(sin(dot(floor(q), vec2(12.9, 78.2))) * 43758.5) * 0.0; a *= .5; }
  gl_FragColor = vec4(col, 1.);
}`,
    side: THREE.BackSide, depthWrite: false
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(900000, 48, 24), mat); m.renderOrder = -10; m.frustumCulled = false; scene.add(m); return m;
}

// ----- Clouds -----
function cloudTexture() {
  const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  const id = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x / N) * 2 - 1, v = (y / N) * 2 - 1; const r = Math.hypot(u, v);
    const n = fbm(x / 18, y / 18, 4) * 0.9 + fbm(x / 6 + 30, y / 6, 2) * 0.35;
    let a = clamp((1 - r) * 1.6 + n * 0.9 - 0.15, 0, 1); a = a * a * (3 - 2 * a);
    const k = (y * N + x) * 4; id.data[k] = id.data[k + 1] = id.data[k + 2] = 255; id.data[k + 3] = a * 255;
  }
  g.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearMipmapLinearFilter; return t;
}
function buildClouds(scene) {
  const r = mulberry(4242);
  const puffs = [];
  const addCluster = (cx, cz, base, scale) => {
    const n = 5 + (r() * 9 | 0); const w = (400 + r() * 900) * scale;
    for (let i = 0; i < n; i++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * w; const s = (250 + r() * 420) * scale;
      const hh = r() * w * 0.45 * (1 - d / w * 0.6);
      puffs.push([cx + Math.cos(a) * d, base + s * 0.35 + hh, cz + Math.sin(a) * d * 0.8, s, cx, base, cz, w]);
    }
  };
  // Scattered cumulus over the route, with clear sight lines on final approach.
  for (let i = 0; i < 520; i++) {
    const x = WORLD.X0 + r() * (WORLD.X1 - WORLD.X0), z = WORLD.Z0 + r() * (WORLD.Z1 - WORLD.Z0);
    const dl = Math.hypot(x - 0, z - 0), dc = Math.hypot(x - CDG.rwys[0].tx, z - CDG.rwys[0].tz);
    if (dl < 5000 || dc < 5000) continue;
    const sea = waterLoAt(x, z) > 0.5;
    if (sea && r() < 0.6) continue;
    addCluster(x, z, 1150 + r() * 350, 0.8 + r() * 0.7);
  }
  for (const ap of AIRPORTS) for (let i = 0; i < 18; i++) {
    const a = r() * Math.PI * 2, d = 8500 + r() * 19000;
    addCluster(ap.cx + Math.cos(a) * d, ap.cz + Math.sin(a) * d, 1250 + r() * 550, .7 + r() * .6);
  }
  const N = puffs.length;
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry(); geo.index = base.index; geo.setAttribute('position', base.attributes.position); geo.setAttribute('uv', base.attributes.uv);
  const aP = new Float32Array(N * 4), aC = new Float32Array(N * 4);
  const fill = (order) => { order.forEach((pi, i) => { const p = puffs[pi]; aP[i * 4] = p[0]; aP[i * 4 + 1] = p[1]; aP[i * 4 + 2] = p[2]; aP[i * 4 + 3] = p[3]; aC[i * 4] = p[4]; aC[i * 4 + 1] = p[5]; aC[i * 4 + 2] = p[6]; aC[i * 4 + 3] = p[7]; }); };
  fill([...Array(N).keys()]);
  const ia = new THREE.InstancedBufferAttribute(aP, 4), ic = new THREE.InstancedBufferAttribute(aC, 4);
  geo.setAttribute('aP', ia); geo.setAttribute('aC', ic); geo.instanceCount = N;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: cloudTexture() }, uSunDir: { value: W.sunDir }, uSunCol: { value: new THREE.Color(1, .97, .92) }, uHaze: { value: W.hazeCol }, uCam: { value: new THREE.Vector3() }, uVis: { value: 40000 }, uSky: { value: W.skyCol } },
    vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
${GLSL_COMMON}
attribute vec4 aP; attribute vec4 aC; varying vec2 vUv; varying vec3 vW; varying float vShade; varying float vFade; varying vec3 vRel;
void main(){
  vUv = uv; vec3 c = aP.xyz; c.y -= curveDrop(c); vW = aP.xyz;
  vec4 mv = viewMatrix * vec4(c, 1.);
  float rot = fract(sin(dot(aP.xz, vec2(12.9898,78.233))) * 43758.5) * 6.28;
  vec2 o = position.xy; o = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * o;
  mv.xy += o * aP.w * 2.2;
  vec3 rel = normalize((aP.xyz - aC.xyz) / vec3(aC.w, aC.w*.6, aC.w) + vec3(0., .25, 0.));
  vRel = rel;
  vShade = clamp((aP.y - aC.y) / (aC.w * .5), 0., 1.);
  float d = length(aP.xyz - uCam);
  vFade = smoothstep(aP.w * .6, aP.w * 2.2, d);
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`,
    fragmentShader: `#include <common>
#include <logdepthbuf_pars_fragment>
${GLSL_COMMON}
uniform sampler2D uTex; uniform vec3 uSky; varying vec2 vUv; varying vec3 vW; varying float vShade; varying float vFade; varying vec3 vRel;
void main(){
  #include <logdepthbuf_fragment>
  vec4 t = texture2D(uTex, vUv);
  float a = t.a * vFade; if (a < .01) discard;
  vec2 q = vUv * 2. - 1.;
  float lightSide = dot(vRel, uSunDir) * .5 + .5;
  float l = mix(.55, 1.05, lightSide) * mix(.72, 1.0, vShade);
  l += pow(lightSide, 4.) * .15;
  vec3 col = mix(uSky * .65 + vec3(.25), uSunCol, l * .85) * l;
  col = aerial(col, vW);
  gl_FragColor = vec4(col, a * .92);
}`,
    transparent: true, depthWrite: false
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 5; scene.add(mesh);
  // depth sort (far to near) periodically
  const dists = new Float32Array(N);
  mesh.userData.density = 1;
  mesh.userData.sort = (cam) => {
    const visible = Math.max(1, Math.round(N * mesh.userData.density));
    const order = new Array(visible);
    for (let i = 0; i < visible; i++) {
      const pi = Math.floor(i * N / visible), p = puffs[pi];
      dists[pi] = (p[0] - cam.x) ** 2 + (p[1] - cam.y) ** 2 + (p[2] - cam.z) ** 2;
      order[i] = pi;
    }
    order.sort((a, b) => dists[b] - dists[a]); fill(order);
    geo.instanceCount = visible; ia.needsUpdate = true; ic.needsUpdate = true;
  };
  return mesh;
}

// ----- textures for airports -----
function noiseCanvas(w, h, base, amp, scale, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const id = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = fbm(x / scale, y / scale, 3) + (Math.random() - 0.5) * 0.35; const k = (y * w + x) * 4;
    const v = fn ? fn(x, y, n) : null;
    id.data[k] = clamp(base[0] + n * amp, 0, 255); id.data[k + 1] = clamp(base[1] + n * amp, 0, 255); id.data[k + 2] = clamp(base[2] + n * amp, 0, 255); id.data[k + 3] = 255;
  }
  g.putImageData(id, 0, 0); return c;
}
function rwyEndTexture(num, w) {
  const Wd = 256, Hh = 2048, M = Hh / 900; // 900 m section
  const c = noiseCanvas(Wd, Hh, [58, 58, 60], 26, 6); const g = c.getContext('2d');
  const sx = Wd / w; // px per m across
  g.fillStyle = 'rgba(245,245,240,0.92)';
  // threshold bar? piano keys: 30 m long starting 6 m in
  const nk = w >= 60 ? 16 : 12; const kw = 1.8 * sx, gap = (Wd - 2 * 3 * sx - nk * kw) / (nk - 1 + 2);
  for (let i = 0; i < nk; i++) { const x = 3 * sx + gap + i * (kw + gap) + (i >= nk / 2 ? gap * 1.5 : 0) - (i < nk / 2 ? gap * .5 : 0); g.fillRect(x, 6 * M, kw, 30 * M); }
  // designator number (reads approaching the threshold: bottom of letters towards threshold)
  g.save(); g.translate(Wd / 2, 48 * M); g.scale(1, -1);
  g.font = `bold ${Math.round(9 * M)}px "Arial Narrow", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'top';
  // stretched lettering (runway numbers are elongated): scale Y by ratio
  g.save(); g.scale(sx / M * 1.0, 1);
  const digits = num.replace(/[LRC]/, ''), letter = num.replace(/[0-9]/g, '');
  g.font = `bold ${Math.round(18 * M)}px Arial, sans-serif`;
  g.restore();
  g.restore();
  // draw text with manual scaling so it reads from the approach (letters upright when looking along runway heading)
  const drawText = (txt, cy, hM) => {
    g.save(); g.translate(Wd / 2, cy); g.scale(1, -hM * M / 100); g.font = 'bold 100px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, 0, 0); g.restore();
  };
  if (letter) { drawText(letter, 60 * M, 9); }
  drawText(digits, (letter ? 82 : 60) * M, 9);
  // centreline stripes from 100 m
  for (let y = 100; y < 900; y += 50) g.fillRect(Wd / 2 - 0.45 * sx, y * M, 0.9 * sx, 30 * M);
  // touchdown zone markings (pairs)
  const tdz = [[150, 3], [300, 3], [450, 2], [600, 2], [750, 1]];
  for (const [y, n] of tdz) for (let s = -1; s <= 1; s += 2) for (let i = 0; i < n; i++) { const x0 = Wd / 2 + s * (3.5 + i * 3) * sx; g.fillRect(s > 0 ? x0 : x0 - 1.8 * sx, y * M, 1.8 * sx, 22.5 * M); }
  // aiming points at 400 m
  for (let s = -1; s <= 1; s += 2) { const x0 = Wd / 2 + s * 9 * sx; g.fillRect(s > 0 ? x0 : x0 - 10 * sx, 400 * M, 10 * sx, 50 * M); }
  // edge lines
  g.fillRect(0.5 * sx, 0, 0.9 * sx, Hh); g.fillRect(Wd - 1.4 * sx, 0, 0.9 * sx, Hh);
  // tyre marks
  g.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 260; i++) { const y = (250 + Math.random() * 500) * M; const x = Wd / 2 + (Math.random() - 0.5) * 22 * sx; g.fillStyle = `rgba(30,30,30,${0.12 + Math.random() * 0.2})`; g.fillRect(x, y, 0.4 * sx + Math.random() * sx, (20 + Math.random() * 120) * M); }
  g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c); t.anisotropy = 16; t.minFilter = THREE.LinearMipmapLinearFilter; return t;
}
function rwyMidTexture(w) {
  const Wd = 256, Hh = 256, M = Hh / 50; const c = noiseCanvas(Wd, Hh, [60, 60, 62], 24, 6); const g = c.getContext('2d'); const sx = Wd / w;
  g.fillStyle = 'rgba(240,240,236,0.9)'; g.fillRect(Wd / 2 - 0.45 * sx, 0, 0.9 * sx, 30 * M);
  g.fillRect(0.5 * sx, 0, 0.9 * sx, Hh); g.fillRect(Wd - 1.4 * sx, 0, 0.9 * sx, Hh);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; return t;
}
function taxiTexture() {
  const c = noiseCanvas(128, 128, [72, 72, 72], 22, 5); const g = c.getContext('2d');
  g.fillStyle = '#d9a514'; g.fillRect(61, 0, 6, 128); g.fillStyle = 'rgba(220,200,90,.6)'; g.fillRect(2, 0, 3, 128); g.fillRect(123, 0, 3, 128);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
function concreteTexture() {
  const c = noiseCanvas(256, 256, [150, 150, 146], 30, 9); const g = c.getContext('2d'); g.strokeStyle = 'rgba(60,60,60,.45)'; g.lineWidth = 1.2;
  for (let i = 0; i <= 256; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  g.globalCompositeOperation = 'multiply'; for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(90,85,80,${Math.random() * 0.2})`; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 10 + Math.random() * 30, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
function facadeTexture(kind) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d'); const r = mulberry(kind.length * 77);
  if (kind === 'glass') {
    // tinted curtain wall: sky reflection gradient, floor bands, mullions, interior glimpses
    const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#9fb6c6'); gr.addColorStop(.45, '#6d8597'); gr.addColorStop(1, '#3a4d5b'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 128) { for (let x = 0; x < 512; x += 32) { const v = r(); g.fillStyle = `rgba(${v < .15 ? '255,236,200' : '20,30,38'},${v < .15 ? .18 : .12 + r() * .15})`; g.fillRect(x + 2, y + 14, 28, 100); } }
    g.fillStyle = 'rgba(255,255,255,.10)'; g.beginPath(); g.moveTo(0, 512); g.lineTo(512, 120); g.lineTo(512, 220); g.lineTo(0, 512); g.fill();
    g.fillStyle = '#cfd5d9'; for (let y = 0; y < 512; y += 128) g.fillRect(0, y, 512, 12);
    g.fillStyle = 'rgba(210,216,220,.85)'; for (let x = 0; x < 512; x += 32) g.fillRect(x, 0, 3, 512);
    g.fillStyle = 'rgba(40,46,50,.5)'; for (let y = 0; y < 512; y += 128) g.fillRect(0, y + 12, 512, 3);
  } else if (kind === 'hangar') {
    g.fillStyle = '#c9ccc8'; g.fillRect(0, 0, 512, 512); for (let x = 0; x < 512; x += 8) { g.fillStyle = x % 16 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.08)'; g.fillRect(x, 0, 4, 512); }
    g.fillStyle = 'rgba(60,70,80,.25)'; g.fillRect(0, 420, 512, 92);
  } else {
    g.fillStyle = kind === 'brick' ? '#8a6a58' : '#bdb7ab'; g.fillRect(0, 0, 512, 512);
    for (let y = 16; y < 512; y += 64) { g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, y + 44, 512, 4); for (let x = 10; x < 512; x += 40) { const v = r(); g.fillStyle = v < .2 ? '#d8dfe2' : v < .3 ? '#e9d9b0' : '#3c4852'; g.fillRect(x, y, 26, 34); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, y, 26, 4); } }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
function ribbon(pts, width, y, texLen) {
  const P = [], UV = [], I = []; let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    if (i > 0) acc += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    const nx = -dz, nz = dx;
    P.push(p[0] + nx * width / 2, y, p[1] + nz * width / 2, p[0] - nx * width / 2, y, p[1] - nz * width / 2);
    UV.push(0, acc / texLen, 1, acc / texLen);
    if (i > 0) { const k = i * 2; I.push(k - 2, k, k - 1, k - 1, k, k + 1); } // counter-clockwise from above so the face points up
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I); g.computeVertexNormals();
  return g;
}
function quadXZ(cx, cz, w, l, hdg, y) { // rectangle centred, length along heading
  const g = new THREE.PlaneGeometry(w, l); g.rotateX(-Math.PI / 2); g.rotateY(-hdg * D2R); g.translate(cx, y, cz); return g;
}

const PAPIS = []; // {x,z,y, hdg, lights:[sprite...]}
const RWY_LIGHTS = [];
function buildAirports(scene, mats) {
  const midTex = { 45: rwyMidTexture(45), 50: rwyMidTexture(50), 60: rwyMidTexture(60) };
  const tTaxi = taxiTexture(), tConc = concreteTexture();
  const matTaxi = new THREE.MeshLambertMaterial({ map: tTaxi, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const matConc = new THREE.MeshLambertMaterial({ map: tConc, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const lightTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  W.lightTex = lightTex;
  for (const ap of AIRPORTS) {
    const y0 = ap.elev + PAVE + 0.06;
    for (const r of ap.rwys) {
      const endLen = 900, w = r.w;
      const tA = rwyEndTexture(r.name, w), tB = rwyEndTexture(r.opp, w);
      const mA = new THREE.MeshLambertMaterial({ map: tA, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      const mB = new THREE.MeshLambertMaterial({ map: tB, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      // threshold A section: from threshold forwards 900m. texture v=0 at threshold.
      const mk = (fromT, len, mat, flip) => {
        const g = new THREE.PlaneGeometry(w, len); g.rotateX(-Math.PI / 2);
        // plane's local -z = forward; uv v goes 0 at +z(back) to 1 at -z(front)
        const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) { let v = uv.getY(i); uv.setY(i, flip ? v : 1 - v); if (flip) uv.setX(i, 1 - uv.getX(i)); }
        g.rotateY(-r.hdg * D2R); const c = fromT + len / 2; g.translate(r.tx + r.dx * c, y0, r.tz + r.dz * c);
        scene.add(new THREE.Mesh(g, mat));
      };
      mk(0, endLen, mA, false);
      mk(r.len - endLen, endLen, mB, true);
      const midL = r.len - 2 * endLen; const mt = midTex[w].clone(); mt.needsUpdate = true; mt.repeat.set(1, midL / 50);
      const mm = new THREE.MeshLambertMaterial({ map: mt, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      mk(endLen, midL, mm, false);
      // Narrow concrete shoulders break the hard asphalt-to-grass boundary.
      const shoulderTex = tConc.clone(); shoulderTex.repeat.set(1, r.len / 50); shoulderTex.needsUpdate = true;
      const shoulderMat = new THREE.MeshLambertMaterial({ map: shoulderTex });
      for (const side of [-1, 1]) {
        const offset = side * (w / 2 + 1.7), cx = r.tx + r.dx * r.len / 2 - r.dz * offset, cz = r.tz + r.dz * r.len / 2 + r.dx * offset;
        scene.add(new THREE.Mesh(quadXZ(cx, cz, 3.4, r.len, r.hdg, y0 - .035), shoulderMat));
      }
      // blast pads
      for (const s of [-1, 1]) { const g = quadXZ(s < 0 ? r.tx - r.dx * 40 : r.ex + r.dx * 40, s < 0 ? r.tz - r.dz * 40 : r.ez + r.dz * 40, w, 80, r.hdg, y0 - 0.02); scene.add(new THREE.Mesh(g, matTaxi)); }
      // edge lights & centreline lights
      const lp = []; for (let d = 0; d <= r.len; d += 60) for (const s of [-1, 1]) lp.push(r.tx + r.dx * d - r.dz * s * (w / 2 + 1.5), y0 + 0.4, r.tz + r.dz * d + r.dx * s * (w / 2 + 1.5));
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
      const lm = new THREE.PointsMaterial({ map: lightTex, size: 2.2, color: 0xfff1c8, transparent: true, depthWrite: false, opacity: 0.55 });
      scene.add(new THREE.Points(lg, lm));
      // approach lights before threshold (bars every 30 m, 900 m)
      const ap1 = []; for (let d = 30; d <= 900; d += 30) for (let k = -2; k <= 2; k++) ap1.push(r.tx - r.dx * d - r.dz * k * 1.2, y0 + 1.2, r.tz - r.dz * d + r.dx * k * 1.2);
      for (const d of [150, 300]) for (let k = -12; k <= 12; k++) ap1.push(r.tx - r.dx * d - r.dz * k * 1.5, y0 + 1.2, r.tz - r.dz * d + r.dx * k * 1.5);
      const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.Float32BufferAttribute(ap1, 3));
      scene.add(new THREE.Points(ag, new THREE.PointsMaterial({ map: lightTex, size: 2.5, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0.6 })));
      // approach light stands (grey poles)
      const poleG = new THREE.CylinderGeometry(0.08, 0.1, 1.2, 5); const poleM = new THREE.MeshLambertMaterial({ color: 0x6a6a64 });
      const inst = new THREE.InstancedMesh(poleG, poleM, 30); const mtx = new THREE.Matrix4();
      for (let i = 0; i < 30; i++) { const d = 30 + i * 30; mtx.makeTranslation(r.tx - r.dx * d, y0 + 0.6, r.tz - r.dz * d); inst.setMatrixAt(i, mtx); }
      scene.add(inst);
      // PAPI on left side, 300 m in, both ends
      for (const end of [0, 1]) {
        const hd = end ? wrap360(r.hdg + 180) : r.hdg, dd = hdgVec(hd); const tx = end ? r.ex : r.tx, tz = end ? r.ez : r.tz;
        const px = tx + dd.x * 330, pz = tz + dd.z * 330; const nx = dd.z, nz = -dd.x; // left normal
        const lights = [];
        for (let i = 0; i < 4; i++) {
          const off = w / 2 + 15 + i * 9; const x = px + nx * off, z = pz + nz * off;
          const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.9), new THREE.MeshLambertMaterial({ color: 0x777770 })); box.position.set(x, y0 + 0.4, z); box.rotation.y = -hd * D2R; scene.add(box);
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: lightTex, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0.95 })); sp.scale.set(5, 5, 5); sp.position.set(x, y0 + 0.8, z); scene.add(sp);
          lights.push({ sp, ang: [3.5, 3.17, 2.83, 2.5][i] });
        }
        PAPIS.push({ x: px, z: pz, y: y0, hd, lights });
      }
    }
  }
  // ---- Heathrow layout ----
  const yL = LHR.elev + PAVE;
  const taxi = (pts, w = 23) => { const g = ribbon(pts, w, yL, 25); scene.add(new THREE.Mesh(g, matTaxi)); };
  taxi(TAXI_LHR.slice(0, 6).concat([[1760, -760], [1760, -830]]));
  taxi([[1760, -830], [1745, -850], [1700, -850]], 40);
  taxi([[-2300, -720], [1600, -720]]); taxi([[-2200, 460], [1450, 460]]); taxi([[-2300, -350], [700, -350]]);
  taxi([[1600, -720], [1700, -720], [1760, -700]]);
  for (const x of [-1800, -900, -100, 600, 1300]) taxi([[x, -720], [x, -850]]);
  for (const x of [-1600, -500, 700, 1300]) taxi([[x, -350], [x, 460]]);
  taxi([[1300, 460], [1300, 590]]); taxi([[-500, 460], [-500, 590]]);
  // aprons
  const apron = (cx, cz, w, l) => scene.add(new THREE.Mesh(quadXZ(cx, cz, w, l, 0, yL - 0.03), matConc));
  apron(900, -290, 900, 110); apron(-200, 0, 1400, 500); apron(-1600, 0, 900, 600);
  const T = (t) => { const m = new THREE.MeshLambertMaterial({ map: t }); return m; };
  const mGlass = T(facadeTexture('glass')), mOff = T(facadeTexture('office')), mHang = T(facadeTexture('hangar')), mRoof = new THREE.MeshLambertMaterial({ color: 0x8c8f92 });
  const building = (cx, cz, w, d, h, rot = 0, mat = mGlass) => {
    const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 40, uv.getY(i) * h / 20);
    const m = new THREE.Mesh(g, [mat, mat, mRoof, mRoof, mat, mat]); m.position.set(cx, yL + h / 2, cz); m.rotation.y = rot; scene.add(m); return m;
  };
  building(900, -205, 820, 60, 22); building(900, -150, 500, 80, 14, 0, mOff);
  // our stand: lead-in line, stop bar and a jet bridge (retracts once the doors close)
  const yel = new THREE.MeshBasicMaterial({ color: 0xe0b020, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  scene.add(new THREE.Mesh(quadXZ(900, -290, 0.4, 80, 0, yL + 0.02), yel)); scene.add(new THREE.Mesh(quadXZ(900, -282, 8, 0.5, 0, yL + 0.02), yel));
  const jb = new THREE.Group(); jb.position.set(915, yL, -258);
  const link = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.2, 22), new THREE.MeshLambertMaterial({ color: 0xb9bdbf })); link.position.set(915, yL + 4.6, -247); scene.add(link);
  const linkLeg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.0, 0.8), new THREE.MeshLambertMaterial({ color: 0x5c6266 })); linkLeg.position.set(915, yL + 1.5, -252); scene.add(linkLeg);
  const jbM = new THREE.MeshLambertMaterial({ color: 0xb9bdbf }), jbD = new THREE.MeshLambertMaterial({ color: 0x5c6266 });
  const rot = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 3.2, 16), jbD); rot.position.y = 4.6; jb.add(rot);
  const tun = new THREE.Group(); tun.position.y = 4.6; jb.add(tun);
  const jt1 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.0, 26), jbM); jt1.position.z = -13; tun.add(jt1);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.4, 3.4), jbD); cab.position.z = -27.5; tun.add(cab);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4.6, 0.6), jbD); leg.position.set(0, -2.3, -22); tun.add(leg);
  const whl = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 1.2), new THREE.MeshLambertMaterial({ color: 0x222222 })); whl.position.set(0, -4.2, -22); tun.add(whl);
  tun.rotation.y = 0.41; scene.add(jb); W.jetBridge = { jb, tun, cab, t1: jt1, ext: 1 };
  // pushback tug (shown during pushback)
  const tug = new THREE.Group(); const tb = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.3, 5.2), new THREE.MeshLambertMaterial({ color: 0xd8d8d0 })); tb.position.y = 1.0; tug.add(tb);
  const tc = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.6), new THREE.MeshLambertMaterial({ color: 0x2b3a46 })); tc.position.set(0, 2.1, 1.2); tug.add(tc);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 5), jbD); bar.position.set(0, 0.6, -4.8); tug.add(bar);
  tug.visible = false; scene.add(tug); W.tug = tug;
  // service vans at neighbouring stands
  const vanM = new THREE.MeshLambertMaterial({ color: 0xf0f0ec });
  for (const [x, z, r] of [[700, -262, 0.3], [1100, -258, -0.2], [1305, -265, 0.1], [860, -330, 1.57]]) { const v = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 5.5), vanM); v.position.set(x, yL + 1.2, z); v.rotation.y = r; scene.add(v); }
  building(-200, 160, 1100, 120, 24); building(-1600, 250, 700, 110, 40); building(-1600, -140, 420, 60, 18);
  building(1250, 200, 260, 200, 30, 0, mOff); building(1500, 120, 200, 120, 26, 0, mOff); building(1600, 330, 160, 90, 24, 0, mOff);
  // maintenance base and cargo area to the south and east (fills the field like the real airport)
  apron(1350, 700, 700, 260); apron(-900, 760, 1200, 220); apron(2200, -100, 500, 600);
  building(1300, 860, 220, 90, 28, 0, mHang); building(1560, 860, 220, 90, 28, 0, mHang); building(-1200, 880, 380, 80, 18, 0, mOff); building(-600, 880, 300, 70, 16, 0, mOff);
  building(2300, 120, 160, 220, 22, 0, mHang); building(2300, -260, 160, 160, 18, 0, mOff);
  taxi([[1300, 590], [1300, 700]]); taxi([[-500, 590], [-500, 760]]); taxi([[1760, -430], [1760, -100], [2050, -100]]);
  // control tower
  const tw = new THREE.Group(); tw.position.set(250, yL, -60);
  tw.add(new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 75, 16), new THREE.MeshLambertMaterial({ color: 0xcfd2d3 })).translateY(37.5));
  tw.add(new THREE.Mesh(new THREE.CylinderGeometry(9, 7, 7, 20), new THREE.MeshLambertMaterial({ color: 0x3c5464, emissive: 0x0a1418 })).translateY(78));
  tw.add(new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 1.5, 20), new THREE.MeshLambertMaterial({ color: 0xdedede })).translateY(82));
  scene.add(tw);
  // ---- CDG layout ----
  const r0 = CDG.rwys[0]; const yC = CDG.elev + PAVE;
  const dd = hdgVec(266), nn = { x: dd.z, z: -dd.x };
  const at = (along, side) => [r0.tx + dd.x * along + nn.x * side, r0.tz + dd.z * along + nn.z * side];
  const taxiC = (a) => { const g = ribbon(a, 23, yC, 25); scene.add(new THREE.Mesh(g, matTaxi)); };
  taxiC([at(-50, 190), at(4300, 190)]); taxiC([at(-50, 2810), at(4300, 2810)]);
  taxiC(TAXI_CDG.slice(0, 4));
  taxiC([at(-50, 190), at(-50, 0), at(40, 0)]);
  for (const a of [600, 1500, 2300, 3200, 4000]) taxiC([at(a, 0), at(a, 190), at(a + 150, 600)]);
  for (const a of [800, 2000, 3400]) taxiC([at(a, 2810), at(a, 2400)]);
  const [tcx, tcz] = at(2300, 1500);
  scene.add(new THREE.Mesh(quadXZ(tcx, tcz, 3200, 1200, 266, yC - 0.03), matConc));
  scene.add(new THREE.Mesh(quadXZ(CDG_STAND.x, CDG_STAND.z, 0.5, 200, 176, yC + 0.03), yel));
  const bC = (along, side, w, d, h, mat = mGlass) => { const [x, z] = at(along, side); const m = building(x, z, w, d, h, -266 * D2R, mat); m.position.y = yC + h / 2; };
  bC(1300, 1500, 1100, 70, 20); bC(2700, 1300, 800, 60, 18); bC(2700, 1700, 800, 60, 18); bC(3500, 1500, 600, 90, 22, mOff); bC(1800, 1000, 300, 100, 16, mOff);
  const [t1x, t1z] = at(500, 1500); const t1 = new THREE.Mesh(new THREE.CylinderGeometry(95, 95, 32, 32), new THREE.MeshLambertMaterial({ color: 0x8b8680 })); t1.position.set(t1x, yC + 16, t1z); scene.add(t1);
  const [twx, twz] = at(2300, 1050); const tw2 = tw.clone(); tw2.position.set(twx, yC, twz); scene.add(tw2);
}

// Mixed-height tree belts outside the airfields add a grounded horizon without
// placing foliage on runways, taxiways or aprons. All crowns share two draw calls.
function buildVegetation(scene) {
  const r = mulberry(78541), trees = [], target = 2400;
  for (let tries = 0; trees.length < target && tries < target * 30; tries++) {
    const ap = AIRPORTS[tries % AIRPORTS.length];
    const angle = r() * Math.PI * 2, radius = 1.18 + Math.pow(r(), 1.3) * 1.55;
    const x = ap.cx + Math.cos(angle) * ap.rx * radius;
    const z = ap.cz + Math.sin(angle) * ap.rz * radius;
    if (x < WORLD.X0 || x > WORLD.X1 || z < WORLD.Z0 || z > WORLD.Z1) continue;
    const m = maskAt(x, z);
    if (m[0] > .15 || m[3] > .08 || r() > .55 + m[2] * .4) continue;
    const height = 6 + r() * 9, width = height * (.27 + r() * .16);
    trees.push({ x, y: groundH(x, z), z, height, width, shade: r() });
  }
  const trunkGeo = new THREE.CylinderGeometry(.14, .23, 1, 5);
  const crownGeo = new THREE.IcosahedronGeometry(1, 1);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x71654c }), trees.length);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), trees.length * 2);
  const matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scale = new THREE.Vector3(), color = new THREE.Color();
  trees.forEach((t, i) => {
    pos.set(t.x, t.y + t.height * .18, t.z); scale.set(.22, t.height * .36, .22);
    matrix.compose(pos, q, scale); trunks.setMatrixAt(i, matrix);
    for (let l = 0; l < 2; l++) {
      pos.set(t.x + (l ? t.width * .22 : 0), t.y + t.height * (l ? .76 : .60), t.z + (l ? -t.width * .16 : 0));
      scale.set(t.width * (l ? .72 : 1), t.height * (l ? .27 : .33), t.width * (l ? .72 : 1));
      matrix.compose(pos, q, scale); crowns.setMatrixAt(i * 2 + l, matrix);
      color.setRGB(.15 + t.shade * .09, .22 + t.shade * .12, .09 + t.shade * .06);
      crowns.setColorAt(i * 2 + l, color);
    }
  });
  trunks.userData.fullCount = trees.length; crowns.userData.fullCount = trees.length * 2;
  trunks.frustumCulled = crowns.frustumCulled = false;
  scene.add(trunks, crowns);
  return { trunks, crowns };
}

// ----- City buildings (instanced) -----
function buildCities(scene) {
  const r = mulberry(31337);
  const N = 46000; const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const mat = new THREE.MeshLambertMaterial({ map: facadeTexture('office') });
  const mesh = new THREE.InstancedMesh(geo, mat, N); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  const tall = [[51.513, -0.083, 900, 230], [51.505, -0.020, 700, 235], [48.892, 2.236, 900, 210], [48.842, 2.32, 300, 210]].map(t => ({ ...ll(t[0], t[1]), R: t[2], H: t[3] }));
  let n = 0, tries = 0;
  while (n < N && tries < N * 30) {
    tries++;
    const x = WORLD.X0 + r() * (WORLD.X1 - WORLD.X0), z = WORLD.Z0 + r() * (WORLD.Z1 - WORLD.Z0);
    const mk = maskAt(x, z); if (mk[0] > 0.2 || mk[3] > 0.05) continue;
    const u = mk[1]; if (r() > Math.pow(u, 2.2) * 1.4) continue;
    let h = u > 0.85 ? 14 + r() * 30 : 6 + r() * 9, w = 12 + r() * 26, d = 10 + r() * 22;
    for (const t of tall) { const dd = Math.hypot(x - t.x, z - t.z); if (dd < t.R * 1.5) { h = Math.max(h, (40 + r() * t.H) * smooth(t.R * 1.5, t.R * .2, dd)); w = 25 + r() * 25; d = w; } }
    const gh = groundH(x, z);
    p.set(x, gh - 1, z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 3.14); s.set(w, h + 1, d);
    m.compose(p, q, s); mesh.setMatrixAt(n, m);
    const g = 0.62 + r() * 0.3; col.setRGB(g, g * (0.95 + r() * .05), g * (0.9 + r() * .1)); mesh.setColorAt(n, col); n++;
  }
  mesh.count = n; mesh.userData.fullCount = n; mesh.frustumCulled = false; scene.add(mesh);
  // the Eiffel Tower and a few landmarks as simple forms
  const ef = ll(48.8584, 2.2945); const eg = new THREE.Group(); const em = new THREE.MeshLambertMaterial({ color: 0x5a4a3a });
  const legs = new THREE.CylinderGeometry(6, 62, 115, 4, 1, true); const l1 = new THREE.Mesh(legs, em); l1.position.y = 57; l1.rotation.y = Math.PI / 4; eg.add(l1);
  const up = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 9, 185, 4), em); up.position.y = 207; up.rotation.y = Math.PI / 4; eg.add(up);
  eg.position.set(ef.x, groundH(ef.x, ef.z), ef.z); scene.add(eg);
  return mesh;
}
