const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const audioSource = fs.readFileSync(path.join(__dirname, '..', 'src', '07_audio.js'), 'utf8');
const spokenText = vm.runInNewContext(`${audioSource}\nAudio2.spokenText`, {
  localStorage: { getItem: () => null },
});

assert.equal(spokenText('Press APU MASTER SW.'), 'Press A P U MASTER switch.');
assert.equal(spokenText('Wait for the green APU AVAIL light.'), 'Wait for the green A P U available light.');
assert.equal(spokenText('Press AP1 on the FCU, then arm APPR.'), 'Press autopilot 1 on the F C U, then arm approach.');
assert.equal(spokenText('Set QNH and check the ILS on the PFD.'), 'Set Q N H and check the I L S on the P F D.');
assert.equal(spokenText('Press F-PLN on the MCDU.'), 'Press flight plan on the M C D U.');
assert.equal(spokenText('The word capulet is not an APU label.'), 'The word capulet is not an A P U label.');

console.log('Spoken cockpit labels: passed');
