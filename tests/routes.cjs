const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Vector3 {}
class Quaternion {}
class Euler {}
const context = vm.createContext({ THREE: { Vector3, Quaternion, Euler }, CK: {}, Audio2: { stopVoice() {} }, MCDU: { page: 'INIT', scratch: '' }, mcduClr() {}, fmsCheck() {} });
for (const file of ['src/00_util.js', 'src/01_data.js', 'src/04_aircraft.js', 'src/08_tutorial.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}
const evaluate = expression => vm.runInContext(expression, context);

assert.equal(evaluate('activeRoute.id'), 'outbound');
assert.equal(evaluate('FPLAN.at(-1).name'), 'RW26R');
assert.equal(evaluate('ACTIVE_ILS.ident'), 'GLE');

evaluate("selectRouteData('return'); Tut.setRoute('return')");
assert.equal(evaluate('activeRoute.from.icao'), 'LFPG');
assert.equal(evaluate('activeRoute.to.icao'), 'EGLL');
assert.equal(evaluate('FPLAN.at(-1).name'), 'RW27R');
assert.equal(evaluate('ACTIVE_ILS.ident'), 'IRR');
assert.equal(evaluate("Tut.find('Taxi to 26R') >= 0"), true);
assert.equal(evaluate("Tut.steps.find(s => s.title === 'Altimeter setting').doit(); S.baro.qnh"), 1015);
assert.equal(evaluate("Tut.steps.find(s => s.title === 'Flight number and cruise level').doit(); S.fms.fltNbr"), 'ALB325');
assert.equal(evaluate("Tut.steps.find(s => s.title === 'Descend to 4000 feet').doit(); S.baro.qnh"), 1018);
assert.equal(evaluate("Tut.steps.find(s => s.title === 'Approach briefing').text.includes('110.30')"), true);
for (const id of ['return', 'outbound']) {
  evaluate(`selectRouteData('${id}'); Tut.setRoute('${id}')`);
  evaluate(`(() => { const r = activeRoute.arrRwy; S.onGround = true; S.crashed = false; S.touchdown = { x: r.tx + r.dx * 420, z: r.tz + r.dz * 420 }; })()`);
  assert.equal(evaluate("Tut.steps.find(s => s.title === 'Cleared to land').done()"), true, `${id}: runway touchdown`);
  evaluate('S.touchdown.x += activeRoute.arrRwy.dz * (activeRoute.arrRwy.w / 2 + 1); S.touchdown.z -= activeRoute.arrRwy.dx * (activeRoute.arrRwy.w / 2 + 1)');
  assert.equal(evaluate("Tut.steps.find(s => s.title === 'Cleared to land').done()"), false, `${id}: off-centreline touchdown`);
  evaluate("S.fms.phase = 'APPROACH'; S.gs = 0; S.airborneT = 0; fmsPhase()");
  assert.equal(evaluate('S.fms.phase'), 'APPROACH', `${id}: off-runway arrival remains incomplete`);
  evaluate('S.touchdown = { x: activeRoute.arrRwy.ex + activeRoute.arrRwy.dx, z: activeRoute.arrRwy.ez + activeRoute.arrRwy.dz }');
  assert.equal(evaluate("Tut.steps.find(s => s.title === 'Cleared to land').done()"), false, `${id}: runway overrun`);
  evaluate('S.touchdown = { x: activeRoute.arrRwy.tx + activeRoute.arrRwy.dx * 420, z: activeRoute.arrRwy.tz + activeRoute.arrRwy.dz * 420 }; fmsPhase()');
  assert.equal(evaluate('S.fms.phase'), 'DONE', `${id}: runway arrival completes`);
}

evaluate("selectRouteData('outbound'); Tut.setRoute('outbound')");
assert.equal(evaluate('ACTIVE_ILS.ident'), 'GLE');
assert.equal(evaluate("Tut.find('Taxi to 27R') >= 0"), true);
assert.equal(evaluate("Tut.steps.find(s => s.title === 'Approach briefing').text.includes('110.10')"), true);
console.log('Bidirectional route data and captain briefing passed.');
