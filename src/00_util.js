'use strict';
// ---------- Maths & geo helpers ----------
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const KT = 0.514444;           // m/s per knot
const FT = 0.3048;             // m per foot
const NM = 1852;               // m per nautical mile
const G = 9.80665;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrap360 = h => ((h % 360) + 360) % 360;
const wrap180 = h => { h = wrap360(h); return h > 180 ? h - 360 : h; };
const approach = (v, t, rate) => v < t ? Math.min(v + rate, t) : Math.max(v - rate, t);

// Local flat-earth projection centred on Heathrow. x = east, z = south (three.js: -z is north)
const LAT0 = 51.47, LON0 = -0.4543;
const MX = 111320 * Math.cos(LAT0 * D2R), MZ = 110574;
function ll(lat, lon) { return { x: (lon - LON0) * MX, z: -(lat - LAT0) * MZ }; }
function toLL(x, z) { return { lat: LAT0 - z / MZ, lon: LON0 + x / MX }; }
// heading (deg true) of vector from a to b in x/z
function brg(ax, az, bx, bz) { return wrap360(Math.atan2(bx - ax, -(bz - az)) * R2D); }
function dist2(ax, az, bx, bz) { return Math.hypot(bx - ax, bz - az); }
function hdgVec(h) { return { x: Math.sin(h * D2R), z: -Math.cos(h * D2R) }; }

// Deterministic random
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry(20261017);

// 2D value noise (CPU)
const _perm = new Uint8Array(512); (() => { const r = mulberry(7); const p = []; for (let i = 0; i < 256; i++) p[i] = i; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) _perm[i] = p[i & 255]; })();
const _grad = new Float32Array(256); (() => { const r = mulberry(11); for (let i = 0; i < 256; i++) _grad[i] = r() * 2 - 1; })();
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = _grad[_perm[(xi & 255) + _perm[yi & 255]]], b = _grad[_perm[((xi + 1) & 255) + _perm[yi & 255]]];
  const c = _grad[_perm[(xi & 255) + _perm[(yi + 1) & 255]]], d = _grad[_perm[((xi + 1) & 255) + _perm[(yi + 1) & 255]]];
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, oct) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }

// ISA atmosphere
function isa(hm) {
  const h = Math.max(-500, hm);
  const T = h < 11000 ? 288.15 - 0.0065 * h : 216.65;
  const p = h < 11000 ? 101325 * Math.pow(T / 288.15, 5.2559) : 22632 * Math.exp(-(h - 11000) / 6341.6);
  const rho = p / (287.05 * T);
  return { T, p, rho, a: Math.sqrt(1.4 * 287.05 * T), sigma: rho / 1.225 };
}

function fmtTime(s) { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); }
