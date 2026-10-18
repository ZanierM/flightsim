const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Stub {}
const context = vm.createContext({
  THREE: { Vector3: Stub, Quaternion: Stub, Euler: Stub, Raycaster: Stub, Vector2: Stub },
  clamp: (n, min, max) => Math.max(min, Math.min(max, n)),
  Audio2: { toggle() {} },
});
for (const file of ['src/04_aircraft.js', 'src/06_cockpit.js', 'src/08_tutorial.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}
const evaluate = source => vm.runInContext(source, context);
const state = () => evaluate('({ position: S.sw.landPos, light: S.lt.land })');
const switchHot = evaluate("togHot({ hot: h => h }, 'land', 760, 1352, ['ON', 'OFF', 'RETRACT'], () => S.sw.landPos, setLandingLights, 'LAND')");

assert.deepEqual({ ...state() }, { position: 2, light: false });
switchHot.click({ v: 0.25 }); // RETRACT -> OFF
assert.deepEqual({ ...state() }, { position: 1, light: false });
switchHot.click({ v: 0.25 }); // OFF -> ON
assert.deepEqual({ ...state() }, { position: 0, light: true });
switchHot.click({ v: 0.75 }); // ON -> OFF
assert.deepEqual({ ...state() }, { position: 1, light: false });
switchHot.click({ v: 0.75 }); // OFF -> RETRACT
assert.deepEqual({ ...state() }, { position: 2, light: false });
switchHot.click(); // control drawer wraps around to ON
assert.deepEqual({ ...state() }, { position: 0, light: true });

evaluate("Tut.steps.find(s => s.title === 'Passing 10,000 feet').doit()");
assert.deepEqual({ ...state() }, { position: 1, light: false });
assert.equal(evaluate("Tut.steps.find(s => s.title === 'Passing 10,000 feet').done()"), true);
evaluate("Tut.steps.find(s => s.title === 'Descend to 4000 feet').doit()");
assert.deepEqual({ ...state() }, { position: 0, light: true });
assert.equal(evaluate("Tut.steps.find(s => s.title === 'Descend to 4000 feet').done()"), true);
console.log('Landing-light switch and tutorial actions passed.');
