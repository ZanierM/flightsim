const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Vector3 {}
class Quaternion {}
class Euler {}
const context = vm.createContext({ THREE: { Vector3, Quaternion, Euler } });
for (const file of ['src/04_aircraft.js', 'src/08_tutorial.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}
const evaluate = source => vm.runInContext(source, context);

evaluate('S.flapLever = S.flapPos = 1; S.sbArmed = true; S.sbLever = S.spoiler = 0; S.autobrake = 3; S.rudTrim = 0; S.gearPos = 1; S.toConfigTested = true');
assert.equal(evaluate('takeoffConfigNormal()'), true);
for (const [change, expected] of [
  ['S.flapLever = 0', 'FLAPS'],
  ['S.sbArmed = false', 'SPOILERS'],
  ['S.autobrake = 0', 'AUTO BRK MAX'],
  ['S.rudTrim = 2', 'RUDDER TRIM'],
  ['S.gearPos = 0.5', 'LANDING GEAR'],
]) {
  const saved = evaluate('({ flapLever: S.flapLever, sbArmed: S.sbArmed, autobrake: S.autobrake, rudTrim: S.rudTrim, gearPos: S.gearPos })');
  evaluate(change);
  assert.equal(evaluate('takeoffConfigNormal()'), false, change);
  assert.equal(evaluate('takeoffConfigFaults()[0]'), expected, change);
  Object.assign(evaluate('S'), saved);
}

evaluate("S.efisLS = true; S.ap.vertArm = 'G/S'; S.fcu.ap1 = true; S.fcu.ap2 = false");
assert.equal(evaluate("Tut.steps.find(s => s.title === 'Arm the approach').done()"), false);
evaluate("Tut.steps.find(s => s.title === 'Arm the approach').doit()");
assert.equal(evaluate("Tut.steps.find(s => s.title === 'Arm the approach').done()"), true);
console.log('Take-off configuration and approach tutorial checks passed.');
