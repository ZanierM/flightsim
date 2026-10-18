const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('src/07_audio.js', 'utf8');
const list = [
  { name: 'Daniel', lang: 'en-GB', localService: true },
  { name: 'Bahh', lang: 'en-US', localService: false },
  { name: 'Eddy (English (United Kingdom))', lang: 'en-GB', localService: true },
  { name: 'Moira', lang: 'en-IE', localService: true },
  { name: 'Good News', lang: 'en-US', localService: true },
  { name: 'Samantha', lang: 'en-US', localService: true },
];
const speechSynthesis = { getVoices: () => list };
const context = vm.createContext({ window: { speechSynthesis }, speechSynthesis, localStorage: { getItem: () => null, setItem() {} } });
vm.runInContext(source, context);
const audio = vm.runInContext('Audio2', context);
audio.pickVoices();
assert.equal(audio.voices.capt.name, 'Daniel');
assert.equal(audio.voices.atc.name, 'Moira');
assert.notEqual(audio.voices.gpws.name, 'Bahh');

// A deliberate manual voice choice remains available.
audio.setVoice('atc', 'Bahh');
assert.equal(audio.voices.atc.name, 'Bahh');
audio.setVoice('atc', 'auto');
assert.equal(audio.voices.atc.name, 'Moira');
console.log('Automatic voice selection avoids novelty voices.');
