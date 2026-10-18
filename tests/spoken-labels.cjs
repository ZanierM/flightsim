const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const audioSource = fs.readFileSync(path.join(__dirname, '..', 'src', '07_audio.js'), 'utf8');
const audio = vm.runInNewContext(`${audioSource}\nAudio2`, {
  localStorage: { getItem: () => null },
});
const { spokenText, speechChunks } = audio;

assert.equal(spokenText('Press APU MASTER SW.'), 'Press A P U MASTER switch.');
assert.equal(spokenText('Wait for the green APU AVAIL light.'), 'Wait for the green A P U available light.');
assert.equal(spokenText('Press AP1 on the FCU, then arm APPR.'), 'Press autopilot 1 on the F C U, then arm approach.');
assert.equal(spokenText('Set QNH and check the ILS on the PFD.'), 'Set Q N H and check the I L S on the P F D.');
assert.equal(spokenText('Press F-PLN on the MCDU.'), 'Press flight plan on the M C D U.');
assert.equal(spokenText('The word capulet is not an APU label.'), 'The word capulet is not an A P U label.');
assert.deepEqual(Array.from(speechChunks('Set QNH 1015. Press APU MASTER SW.')), ['Set QNH 1015. Press APU MASTER SW.']);
assert.deepEqual(Array.from(speechChunks('Tune ILS 110.10. Check the PFD.')), ['Tune ILS 110.10. Check the PFD.']);
const longLesson = 'Check the overhead switches. '.repeat(12).trim();
assert.ok(speechChunks(longLesson).length > 1);
assert.equal(speechChunks(longLesson).join(' '), longLesson);
assert.ok(speechChunks('check '.repeat(70).trim()).every(part => part.length <= 190));

console.log('Spoken cockpit labels: passed');
