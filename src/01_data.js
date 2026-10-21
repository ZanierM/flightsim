// ---------- Geographic data (approximate, hand-digitised) ----------
const WORLD = { X0: -95000, X1: 285000, Z0: -82000, Z1: 342000 };

const COAST_ENGLAND = [ // land polygon, lat/lon
  [50.78,-2.2],[50.79,-1.5],[50.80,-1.12],[50.73,-0.79],[50.78,-0.55],[50.81,-0.37],[50.82,-0.14],[50.79,0.05],[50.74,0.25],[50.79,0.36],
  [50.86,0.57],[50.92,0.74],[50.91,0.98],[50.97,0.97],[51.07,1.08],[51.10,1.22],[51.13,1.33],[51.16,1.40],[51.23,1.41],[51.33,1.43],
  [51.38,1.39],[51.37,1.20],[51.37,1.05],[51.39,0.91],[51.42,0.82],[51.44,0.72],[51.47,0.62],[51.46,0.52],[51.45,0.42],[51.46,0.36],
  [51.47,0.40],[51.49,0.52],[51.51,0.60],[51.52,0.72],[51.54,0.82],[51.59,0.92],[51.66,0.95],[51.73,0.98],[51.78,1.08],[51.82,1.22],
  [51.94,1.30],[52.05,1.45],[52.3,1.68],[53.5,1.6],[53.5,-2.2]
];
const COAST_FRANCE = [
  [52.5,4.5],[51.45,3.55],[51.30,3.2],[51.10,2.62],[51.05,2.36],[51.0,2.08],[50.96,1.86],[50.92,1.70],[50.87,1.58],[50.80,1.60],[50.72,1.59],
  [50.60,1.58],[50.50,1.58],[50.38,1.56],[50.25,1.60],[50.20,1.64],[50.18,1.52],[50.14,1.45],[50.07,1.38],[49.97,1.20],[49.93,1.08],
  [49.88,0.86],[49.84,0.62],[49.78,0.40],[49.70,0.20],[49.60,0.10],[49.49,0.12],[49.47,0.30],[49.43,0.33],[49.42,0.20],[49.36,0.00],
  [49.30,-0.25],[49.33,-0.60],[49.36,-0.95],[49.38,-1.15],[49.55,-1.25],[49.70,-1.27],[49.69,-1.60],[49.72,-1.95],[49.6,-2.3],[47.5,-2.3],[47.5,4.5]
];
// Rivers: [lat,lon] polyline + width in metres at start/end
const RIVERS = [
  { w0: 120, w1: 2600, pts: [[51.49,-0.62],[51.47,-0.52],[51.43,-0.45],[51.41,-0.34],[51.44,-0.30],[51.47,-0.24],[51.48,-0.18],[51.485,-0.13],[51.50,-0.12],[51.508,-0.09],[51.507,-0.06],[51.50,-0.03],[51.49,-0.01],[51.50,0.01],[51.51,0.04],[51.50,0.10],[51.48,0.17],[51.46,0.28],[51.45,0.37],[51.46,0.45],[51.48,0.55],[51.50,0.66]] },
  { w0: 90, w1: 900, pts: [[51.20,0.48],[51.25,0.50],[51.30,0.48],[51.36,0.50],[51.39,0.55],[51.42,0.62],[51.44,0.70]] },
  { w0: 110, w1: 1800, pts: [[48.70,2.50],[48.80,2.42],[48.82,2.40],[48.845,2.36],[48.86,2.32],[48.86,2.28],[48.84,2.25],[48.87,2.22],[48.92,2.21],[48.94,2.17],[48.90,2.10],[48.92,2.05],[48.98,2.02],[49.00,1.90],[49.00,1.75],[49.07,1.55],[49.20,1.35],[49.30,1.22],[49.38,1.10],[49.44,1.07],[49.42,0.92],[49.44,0.75],[49.45,0.55],[49.44,0.32]] },
  { w0: 60, w1: 140, pts: [[49.85,3.0],[49.62,2.95],[49.42,2.84],[49.30,2.62],[49.20,2.40],[49.10,2.20],[48.99,2.07]] },
  { w0: 60, w1: 700, pts: [[49.90,2.6],[49.92,2.3],[50.0,2.05],[50.10,1.85],[50.18,1.66]] }
];
const LAKES = [[51.456,-0.535,0.9],[51.445,-0.555,0.7],[51.432,-0.505,1.0],[51.415,-0.47,0.6],[51.47,-0.58,0.5],[51.40,-0.40,0.5]];
// Urban areas: lat, lon, radius km, density
const URBAN = [
  [51.507,-0.128,9,1.0],[51.52,-0.09,4,1.0],[51.55,-0.10,8,0.85],[51.46,-0.05,8,0.85],[51.51,-0.28,8,0.85],[51.42,-0.20,8,0.8],[51.57,0.05,8,0.75],[51.50,0.10,6,0.75],
  [51.60,-0.25,7,0.7],[51.47,-0.38,3.5,0.65],[51.52,-0.43,3.5,0.65],[51.40,-0.32,4,0.7],[51.37,-0.10,5,0.8],[51.40,0.05,5,0.7],[51.63,-0.05,5,0.65],
  [51.51,-0.59,3,0.7],[51.45,-0.97,5,0.75],[51.236,-0.57,3,0.65],[51.32,-0.56,3,0.65],[51.11,-0.19,3.5,0.65],[51.27,0.52,3.5,0.7],[51.28,1.08,2.5,0.7],
  [51.13,1.31,2,0.7],[51.08,1.17,2.5,0.7],[51.15,0.87,3,0.65],[50.83,-0.14,5,0.8],[50.77,0.28,3,0.7],[50.86,0.57,3,0.7],[51.38,0.52,4.5,0.75],
  [51.27,0.19,2,0.6],[51.13,0.26,3,0.65],[51.54,0.71,5,0.75],[51.44,0.22,3,0.7],[51.57,0.46,4,0.7],[51.73,0.47,4,0.7],[51.66,-0.40,4,0.7],
  [51.75,-0.34,3,0.65],[51.36,1.42,2.5,0.65],[51.33,1.38,2,0.6],[50.82,-0.37,3,0.65],[51.0,-0.1,1.8,0.55],
  [50.95,1.86,4,0.75],[50.72,1.61,3.5,0.75],[51.03,2.35,5,0.75],[50.75,2.25,2.5,0.6],[50.63,3.06,9,0.85],[50.29,2.78,3,0.65],[49.89,2.30,5,0.75],
  [50.10,1.83,2.5,0.6],[49.43,2.08,3.5,0.65],[49.42,2.83,3,0.65],[49.26,2.47,3,0.65],[49.21,2.59,1.5,0.6],[49.44,1.10,6,0.8],[49.49,0.12,6,0.8],[49.92,1.08,2.5,0.65],
  [48.857,2.35,8,1.0],[48.87,2.30,4,1.0],[48.88,2.25,8,0.9],[48.90,2.40,8,0.9],[48.83,2.45,8,0.85],[48.80,2.30,8,0.85],[48.95,2.35,7,0.8],[48.93,2.55,7,0.75],
  [48.97,2.45,5,0.65],[48.89,2.24,2.5,1.0],[48.75,2.40,7,0.7],[48.85,2.65,7,0.7],[48.80,2.15,6,0.7],[49.05,2.08,4,0.65],[48.93,2.10,4,0.7],[48.70,2.25,6,0.65]
];
const FORESTS = [
  [51.42,-0.62,5],[51.06,0.04,7],[51.00,0.40,9],[51.18,0.30,6],[51.20,-0.40,7],[51.10,-0.60,8],[51.30,0.95,5],[51.22,1.10,4],
  [49.37,2.88,8],[49.18,2.48,6],[49.15,2.65,5],[48.93,2.08,4],[49.30,2.20,5],[49.55,2.00,5],[50.40,1.75,4],[49.70,1.60,9],[49.60,0.80,8],[49.28,1.40,7],[49.0,1.6,6],[50.0,2.6,4]
];

// Airports & runways (local metres). Runway: threshold point, true heading, length, width
function makeRwy(name, opp, tx, tz, hdg, len, w) {
  const d = hdgVec(hdg);
  return { name, opp, tx, tz, hdg, len, w, ex: tx + d.x * len, ez: tz + d.z * len, dx: d.x, dz: d.z };
}
function runwayTouchdown(td, r) {
  if (!td) return false;
  const along = (td.x - r.tx) * r.dx + (td.z - r.tz) * r.dz;
  const across = (td.x - r.tx) * -r.dz + (td.z - r.tz) * r.dx;
  return along >= 0 && along <= r.len && Math.abs(across) <= r.w / 2;
}
const LHR = { icao: 'EGLL', name: 'London Heathrow', elev: 25, qnh: 1018,
  rwys: [makeRwy('27R', '09L', 1600, -850, 270, 3900, 50), makeRwy('27L', '09R', 1450, 590, 270, 3660, 50)] };
const _cdgT = ll(49.0256, 2.5600);
const CDG = { icao: 'LFPG', name: 'Paris Charles de Gaulle', elev: 119, qnh: 1015, rwys: [] };
(() => {
  const h = 266, d = hdgVec(h), n = { x: d.z, z: -d.x }; // left-hand normal (south when heading west)
  const t = _cdgT;
  CDG.rwys.push(makeRwy('26R', '08L', t.x, t.z, h, 4200, 45));
  CDG.rwys.push(makeRwy('26L', '08R', t.x - d.x * 700 + n.x * 390, t.z - d.z * 700 + n.z * 390, h, 2700, 60));
  CDG.rwys.push(makeRwy('27R', '09L', t.x + d.x * 400 + n.x * 3000, t.z + d.z * 400 + n.z * 3000, h, 2700, 60));
  CDG.rwys.push(makeRwy('27L', '09R', t.x + d.x * 200 + n.x * 3390, t.z + d.z * 200 + n.z * 3390, h, 4200, 45));
})();
Object.assign(LHR, { cx: -350, cz: -130, rx: 3500, rz: 1450 });
(() => { const r = CDG.rwys[0]; const n = { x: r.dz, z: -r.dx }; Object.assign(CDG, { cx: r.tx + r.dx * 2100 + n.x * 1600, cz: r.tz + r.dz * 2100 + n.z * 1600, rx: 4300, rz: 2500 }); })();
const AIRPORTS = [LHR, CDG];
const ILS26R = (() => { const r = CDG.rwys[0]; return { rwy: r, ident: 'GLE', freq: '110.10', crs: 266, gs: 3.0,
  locX: r.ex + r.dx * 300, locZ: r.ez + r.dz * 300, gsX: r.tx + r.dx * 300, gsZ: r.tz + r.dz * 300, elev: CDG.elev }; })();
const ILS27R = (() => { const r = LHR.rwys[0]; return { rwy: r, ident: 'IRR', freq: '110.30', crs: 270, gs: 3.0,
  locX: r.ex + r.dx * 300, locZ: r.ez + r.dz * 300, gsX: r.tx + r.dx * 300, gsZ: r.tz + r.dz * 300, elev: LHR.elev }; })();

// Flight plan. type 'ALT' = fly runway heading until altitude (ft), else fly-to fix
const OUTBOUND_FPLAN = (() => {
  const P = (name, lat, lon, alt, spd) => { const p = ll(lat, lon); return { name, x: p.x, z: p.z, alt, spd }; };
  const cf = (() => { const r = CDG.rwys[0], d = 22224; return { name: 'CF26R', x: r.tx - r.dx * d, z: r.tz - r.dz * d, alt: 4000, spd: 180 }; })();
  const mop = { name: 'MOPAR', x: cf.x + 9500, z: cf.z - 12500, alt: 7000, spd: 220 };
  const r27 = LHR.rwys[0];
  return [
    { name: '27R', x: r27.tx, z: r27.tz, rwy: true },
    { name: '(1500)', type: 'ALT', hdg: 270, alt: 1500 },
    P('EPM', 51.3186, -0.3711, 6000), P('DET', 51.3040, 0.5972, null), P('DVR', 51.1625, 1.3597, null),
    P('ABB', 50.1356, 1.8547, null), P('BVS', 49.4325, 2.1556, 11000), mop, cf,
    { name: 'RW26R', x: CDG.rwys[0].tx, z: CDG.rwys[0].tz, alt: 392, rwy: true }
  ];
})();
const RETURN_FPLAN = (() => {
  const P = (name, lat, lon, alt, spd) => { const p = ll(lat, lon); return { name, x: p.x, z: p.z, alt, spd }; };
  const dep = CDG.rwys[0], arr = LHR.rwys[0];
  return [
    { name: '26R', x: dep.tx, z: dep.tz, rwy: true },
    { name: '(1500)', type: 'ALT', hdg: 266, alt: 1500 },
    P('BVS', 49.4325, 2.1556, 6000), P('ABB', 50.1356, 1.8547, null),
    P('DVR', 51.1625, 1.3597, null), P('DET', 51.3040, 0.5972, 11000),
    { name: 'CF27R', x: arr.tx - arr.dx * 12 * NM, z: arr.tz - arr.dz * 12 * NM, alt: 4000, spd: 180 },
    { name: 'RW27R', x: arr.tx, z: arr.tz, alt: 83, rwy: true }
  ];
})();
const CRZ_FL = 250;

// Taxi route at Heathrow: stand -> holding point 27R -> line-up
// Stand: nose-in to the terminal (south). Pushback ends on taxiway facing east.
const LHR_STAND = { x: 900, z: -300, hdg: 180 };
const PUSH_END = { x: 850, z: -350, hdg: 90 };
const TAXI_LHR = [[850, -350], [1100, -350], [1680, -350], [1735, -375], [1760, -430], [1760, -700], [1760, -760], [1752, -810], [1715, -843], [1650, -850], [1600, -850]];
const HOLD_27R = { x: 1760, z: -760 };
const cdgAt = (along, side) => { const r = CDG.rwys[0], n = { x: r.dz, z: -r.dx }; return { x: r.tx + r.dx * along + n.x * side, z: r.tz + r.dz * along + n.z * side }; };
const CDG_STAND = { ...cdgAt(2300, 1170), hdg: 176 };
const CDG_PUSH_END = { ...cdgAt(2300, 850), hdg: 266 };
const TAXI_CDG = [[2300, 850], [2300, 600], [2450, 600], [2300, 190], [1500, 190], [600, 190], [-50, 190]].map(([a, s]) => { const p = cdgAt(a, s); return [p.x, p.z]; });
const HOLD_26R = cdgAt(-50, 190);

const ROUTES = {
  outbound: { id: 'outbound', from: LHR, to: CDG, depRwy: LHR.rwys[0], arrRwy: CDG.rwys[0], stand: LHR_STAND, pushEnd: PUSH_END, taxi: TAXI_LHR, hold: HOLD_27R,
    plan: OUTBOUND_FPLAN, ils: ILS26R, company: 'EGLLLFPG1', flightNumber: 'ALB324', cruiseLeg: 5,
    groundFreq: 121905, towerFreq: 118505, approachFreq: 125825, arrivalTowerFreq: 119250 },
  return: { id: 'return', from: CDG, to: LHR, depRwy: CDG.rwys[0], arrRwy: LHR.rwys[0], stand: CDG_STAND, pushEnd: CDG_PUSH_END, taxi: TAXI_CDG, hold: HOLD_26R,
    plan: RETURN_FPLAN, ils: ILS27R, company: 'LFPGEGLL1', flightNumber: 'ALB325', cruiseLeg: 4,
    groundFreq: 121605, towerFreq: 119250, approachFreq: 120400, arrivalTowerFreq: 118505 }
};
let activeRoute = ROUTES.outbound, FPLAN = activeRoute.plan, ACTIVE_ILS = activeRoute.ils;
function selectRouteData(id) {
  if (!ROUTES[id]) return false;
  activeRoute = ROUTES[id]; FPLAN = activeRoute.plan; ACTIVE_ILS = activeRoute.ils;
  return true;
}
