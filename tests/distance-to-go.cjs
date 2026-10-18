const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Vector3 {}
class Quaternion {}
class Euler {}
const context = vm.createContext({ THREE: { Vector3, Quaternion, Euler } });
vm.runInContext(fs.readFileSync('src/04_aircraft.js', 'utf8'), context, { filename: 'src/04_aircraft.js' });
const evaluate = source => vm.runInContext(source, context);

evaluate(`
  const NM = 1852;
  const CDG = { rwys: [{ tx: 0, tz: 0 }] };
  const FPLAN = Array.from({ length: 10 }, (_, i) => ({ x: i === 8 ? -20000 : 0, z: 0 }));
  function dist2(x1, z1, x2, z2) { return Math.hypot(x2 - x1, z2 - z1); }
  S.pos.x = -10000; S.pos.z = 0; S.fms.wp = 8; S.ap.lat = 'NAV';
`);
assert.equal(evaluate('distToGo()'), 30000 / 1852, 'NAV includes the remaining course fix');

evaluate("S.ap.lat = 'LOC'; S.pos.x = 500");
assert.equal(evaluate('distToGo()'), 500 / 1852, 'on the ILS, distance is to the runway');

evaluate("S.ap.lat = 'NAV'; S.fms.wp = 9");
assert.equal(evaluate('distToGo()'), 500 / 1852, 'the final waypoint is the runway');
console.log('Distance-to-go sequencing on final passed.');
