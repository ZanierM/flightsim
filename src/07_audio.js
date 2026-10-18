// ---------- Sound: synthesised engines, airflow, systems, chimes and voices ----------
const Audio2 = (() => {
  let ctx = null, master, interior, nodes = {}, noiseBuf, enabled = false, volume = 0.8, ext = false;
  const voices = { capt: null, gpws: null, atc: null };
  function makeNoise(type) {
    const len = ctx.sampleRate * 4; const b = ctx.createBuffer(1, len, ctx.sampleRate); const d = b.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1;
      if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else if (type === 'pink') { b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164; b2 = 0.57000 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
      else d[i] = w; }
    return b;
  }
  function loop(buf) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * 3); return s; }
  function chain(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; }
  function gain(v = 0) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function filt(type, f, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  function osc(type, f) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; }
  function init() {
    if (ctx) { ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = gain(volume); master.connect(ctx.destination);
    // cockpit acoustic: everything outside passes through a lowpass "fuselage" filter
    interior = filt('lowpass', 2600, 0.5); const intG = gain(1); chain(interior, intG, master); nodes.intFilt = interior;
    const brown = makeNoise('brown'), pink = makeNoise('pink'), white = makeNoise('white'); noiseBuf = { brown, pink, white };
    // engines
    nodes.eng = [0, 1].map(i => {
      const pan = ctx.createStereoPanner(); pan.pan.value = i ? 0.45 : -0.45; pan.connect(interior);
      const rumble = chain(loop(brown), filt('lowpass', 120, 0.8), gain(0)); rumble.connect(pan);
      const roar = chain(loop(pink), filt('bandpass', 500, 0.6), gain(0)); roar.connect(pan);
      const fanO = osc('sawtooth', 600), fanO2 = osc('sine', 1200); const fanF = filt('bandpass', 1500, 6); const fanG = gain(0); fanO.connect(fanF); fanO2.connect(fanF); chain(fanF, fanG, pan);
      const buzz = osc('sawtooth', 80); const buzzF = filt('lowpass', 900, 1); const buzzG = gain(0); chain(buzz, buzzF, buzzG, pan);
      const start = osc('triangle', 300); const startG = gain(0); chain(start, startG, pan);
      return { rumble, roar, fanO, fanO2, fanF, fanG, buzz, buzzG, start, startG, roarF: roar };
    });
    // APU (behind, far)
    const apuO = osc('sine', 400), apuO2 = osc('triangle', 820); const apuG = gain(0); apuO.connect(apuG); apuO2.connect(apuG); const apuN = chain(loop(pink), filt('highpass', 1500, 0.5), gain(0)); apuN.connect(interior); chain(apuG, filt('lowpass', 1800), interior);
    nodes.apu = { apuO, apuO2, apuG, apuN };
    // airflow
    nodes.wind = chain(loop(pink), filt('bandpass', 700, 0.5), gain(0)); nodes.wind.connect(master); nodes.windF = nodes.wind;
    nodes.windHi = chain(loop(white), filt('highpass', 3000, 0.3), gain(0)); nodes.windHi.connect(master);
    // ground roll
    nodes.roll = chain(loop(brown), filt('lowpass', 180, 1.2), gain(0)); nodes.roll.connect(master);
    // gear / flaps hydraulics
    const hyd = osc('sawtooth', 160); nodes.hydG = gain(0); chain(hyd, filt('bandpass', 420, 3), nodes.hydG, master); nodes.hyd = hyd;
    // avionics fans hum (always on with power)
    const fan = chain(loop(pink), filt('bandpass', 260, 1.5), gain(0)); fan.connect(master); nodes.avFan = fan;
    const hum = osc('sine', 400); nodes.humG = gain(0); chain(hum, nodes.humG, master);
    // CRC
    nodes.crcG = gain(0); const crc = osc('square', 1100); chain(crc, filt('lowpass', 2500), nodes.crcG, master);
    nodes.hornG = gain(0); const horn = osc('sawtooth', 440); const hm = osc('sine', 2); const hmg = gain(60); hm.connect(hmg); hmg.connect(horn.frequency); chain(horn, filt('lowpass', 1800), nodes.hornG, master);
    enabled = true;
    pickVoices(); if (window.speechSynthesis) speechSynthesis.onvoiceschanged = pickVoices;
  }
  // Voice quality: browsers expose neural voices under names such as "(Natural)", "Online", "Premium", "Enhanced" or "Google UK English".
  const VPREF = { capt: 'auto', atc: 'auto', gpws: 'auto', rate: 1.0 };
  try { Object.assign(VPREF, JSON.parse(localStorage.getItem('a320.voices') || '{}')); } catch (e) { }
  function quality(v) { let q = 0; const n = v.name;
    if (/natural|neural/i.test(n)) q += 100; if (/online/i.test(n)) q += 60; if (/premium/i.test(n)) q += 90; if (/enhanced/i.test(n)) q += 70; if (/^google/i.test(n)) q += 50;
    if (/compact|eloquence|espeak|robot|novelty|bad news|bells|boing|bubbles|cellos|whisper|zarvox|trinoids|albert|jester|organ|superstar|wobble|fred|junior|ralph|kathy/i.test(n)) q -= 200;
    if (!v.localService) q += 5; return q; }
  function rank(vs, lang, male) { return vs.filter(v => /^en/i.test(v.lang)).map(v => ({ v, s: quality(v) + (lang.test(v.lang) ? 40 : 0) + (male && /male|daniel|arthur|oliver|george|ryan|thomas|alfie|elliot|guy|david|aaron|christopher|eric|andrew|brian|liam|noah|william/i.test(v.name) && !/female/i.test(v.name) ? 25 : 0) })).sort((a, b) => b.s - a.s).map(x => x.v); }
  function pickVoices() {
    if (!window.speechSynthesis) return; const vs = speechSynthesis.getVoices(); if (!vs.length) return;
    const byName = (n) => n && n !== 'auto' ? vs.find(v => v.name === n) : null;
    const capt = rank(vs, /en-GB/i, true), atc = rank(vs, /en-(IE|AU|GB|US)/i, false), gp = rank(vs, /en-US/i, true);
    voices.capt = byName(VPREF.capt) || capt[0] || null;
    voices.atc = byName(VPREF.atc) || atc.find(v => v !== voices.capt) || voices.capt;
    voices.gpws = byName(VPREF.gpws) || gp.find(v => v !== voices.capt && v !== voices.atc) || gp[0] || voices.capt;
    Audio2.onVoices && Audio2.onVoices();
  }
  function setVoice(kind, name) { VPREF[kind] = name; try { localStorage.setItem('a320.voices', JSON.stringify(VPREF)); } catch (e) { } pickVoices(); }
  function voiceList() { return window.speechSynthesis ? rank(speechSynthesis.getVoices(), /en-GB/i, false) : []; }
  function say(text, kind = 'capt', onend) {
    if (!window.speechSynthesis || !enabled || Audio2.muteVoice) { onend && setTimeout(onend, Math.min(6000, 600 + text.length * 55)); return; }
    if (kind === 'gpws') speechSynthesis.cancel();
    // speak sentence by sentence: more natural pauses, and avoids Chrome cutting off long utterances
    const parts = String(text).match(/[^.!?]+[.!?]*\s*/g) || [text];
    parts.forEach((t, i) => {
      const u = new SpeechSynthesisUtterance(t.trim());
      u.voice = (kind === 'pa' ? voices.atc : voices[kind]) || null; u.lang = (u.voice && u.voice.lang) || 'en-GB';
      const r = VPREF.rate || 1;
      if (kind === 'gpws') { u.rate = 1.0; u.pitch = 0.8; u.volume = 1; }
      else if (kind === 'atc') { u.rate = 1.08 * r; u.pitch = 1.0; u.volume = 0.85; }
      else if (kind === 'pa') { u.rate = 0.97 * r; u.pitch = 1.05; u.volume = 0.7; }
      else { u.rate = 1.0 * r; u.pitch = 1.0; u.volume = 1; }
      if (i === parts.length - 1 && onend) { u.onend = onend; u.onerror = onend; }
      speechSynthesis.speak(u);
    });
  }
  function tone(f, t0, dur, vol = 0.2, type = 'sine', dest) {
    if (!ctx) return; const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(dest || master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function burst(dur, vol, fq, type = 'bandpass', dest) { if (!ctx) return; const s = ctx.createBufferSource(); s.buffer = noiseBuf.white; const f = filt(type, fq, 1.2); const g = ctx.createGain(); const t = ctx.currentTime; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); chain(s, f, g, dest || master); s.start(t, Math.random()); s.stop(t + dur + 0.05); }
  let lastLightT = 0, rollDist = 0;
  function update(dt, view) {
    if (!ctx || !enabled) return; const t = ctx.currentTime; const k = 0.08;
    ext = view !== 'cockpit';
    nodes.intFilt.frequency.setTargetAtTime(ext ? 16000 : 2400, t, 0.1);
    S.eng.forEach((e, i) => {
      const n = nodes.eng[i]; const n1 = e.N1 / 100, n2 = e.N2 / 100;
      const thr = clamp((e.N1 - 19) / 81, 0, 1);
      n.rumble.gain.setTargetAtTime((ext ? 0.9 : 0.55) * Math.pow(n2, 2) * (0.35 + thr), t, k);
      n.roar.gain.setTargetAtTime((ext ? 0.55 : 0.12) * Math.pow(thr, 1.6) + 0.04 * n2, t, k);
      n.roarF.frequency && 0;
      const bpf = n1 * 5200 / 60 * 36 * 0.55; n.fanO.frequency.setTargetAtTime(Math.max(30, bpf), t, k); n.fanO2.frequency.setTargetAtTime(Math.max(60, bpf * 2.01), t, k); n.fanF.frequency.setTargetAtTime(Math.max(100, bpf * 1.4), t, k);
      n.fanG.gain.setTargetAtTime((ext ? 0.12 : 0.055) * smooth(0.05, 0.3, n1) * (1 - 0.5 * thr), t, k);
      n.buzz.frequency.setTargetAtTime(Math.max(20, n1 * 92), t, k); n.buzzG.gain.setTargetAtTime((ext ? 0.12 : 0.05) * smooth(0.82, 1.0, n1) * (S.ias < 250 ? 1 : 0.3), t, k);
      n.start.frequency.setTargetAtTime(220 + n2 * 1500, t, k); n.startG.gain.setTargetAtTime(e.starting || (e.N2 > 1 && !e.run && n2 < 0.6) ? 0.035 * smooth(0, 0.2, n2) : 0, t, 0.3);
    });
    const a = S.apu; const an = a.N / 100; nodes.apu.apuO.frequency.setTargetAtTime(200 + an * 900, t, 0.2); nodes.apu.apuO2.frequency.setTargetAtTime(410 + an * 1850, t, 0.2);
    nodes.apu.apuG.gain.setTargetAtTime(an * (ext ? 0.05 : 0.012), t, 0.2); nodes.apu.apuN.gain.setTargetAtTime(an * (ext ? 0.08 : 0.01), t, 0.2);
    const v = S.ias / 300; const gearDrag = S.gearPos * smooth(0.3, 0.8, v); const sb = S.spoiler;
    nodes.wind.gain.setTargetAtTime((ext ? 0.25 : 0.32) * v * v + 0.15 * gearDrag * v + 0.1 * sb * v, t, 0.2);
    nodes.windHi.gain.setTargetAtTime(0.03 * v * v, t, 0.2);
    const gsN = S.onGround ? S.gs / 140 : 0; nodes.roll.gain.setTargetAtTime(0.9 * Math.min(1, gsN * 1.5) * (S.onGround ? 1 : 0), t, 0.05);
    // centreline light thumps
    if (S.onGround && S.gs > 25 && !ext) { rollDist += S.gs * KT * dt; if (rollDist > 15) { rollDist = 0; burst(0.05, 0.25 * Math.min(1, S.gs / 100), 90, 'lowpass'); } }
    const moving = Math.abs(S.gearPos - S.gearLever) > 0.01 || Math.abs(S.flapPos - S.flapLever) > 0.01;
    nodes.hydG.gain.setTargetAtTime(moving ? 0.03 : 0, t, 0.2); nodes.hyd.frequency.setTargetAtTime(150 + (S.gearPos * 30), t, 0.2);
    nodes.avFan.gain.setTargetAtTime(S.elec.dc ? (ext ? 0 : 0.05) : 0, t, 0.5); nodes.humG.gain.setTargetAtTime(S.elec.ac && !ext ? 0.004 : 0, t, 0.5);
    // master warning CRC
    const crcOn = S.warn.master && !S.warn.silenced && (S.time % 0.5) < 0.25; nodes.crcG.gain.setTargetAtTime(crcOn ? 0.05 : 0, t, 0.01);
    if (!S.warn.master) S.warn.silenced = false;
    // evacuation horn
    nodes.hornG.gain.setTargetAtTime(swGet('evac') && S.elec.dc ? 0.06 : 0, t, 0.05);
    // gear lock clunks
    const gl = S.gearPos > 0.999 ? 1 : S.gearPos < 0.001 ? 0 : -1; if (gl !== -1 && S._gearLock !== undefined && S._gearLock === -1) { burst(0.25, 0.6, 120, 'lowpass'); } S._gearLock = gl;
  }
  return {
    init, update, say, setVoice, voiceList, pickVoices, get voices() { return voices; }, get vpref() { return VPREF; },
    setVolume(v) { volume = v; if (master) master.gain.value = v; },
    click() { burst(0.025, 0.25, 3000); },
    toggle() { burst(0.04, 0.35, 1800); burst(0.02, 0.2, 5000); },
    chime(n = 1) { if (!ctx) return; const t = ctx.currentTime; tone(1046, t, 0.9, 0.12, 'sine'); tone(2093, t, 0.6, 0.04, 'sine'); },
    hiLo() { if (!ctx) return; const t = ctx.currentTime; tone(1318, t, 0.7, 0.1); tone(988, t + 0.45, 0.9, 0.1); },
    tone(f, d, v) { if (!ctx) return; tone(f, ctx.currentTime, d, v); },
    wiper() { burst(0.35, 0.06, 1800, 'bandpass'); },
    pa(text) { say(text, 'pa'); },
    ding() { if (!ctx) return; const t = ctx.currentTime; tone(1318, t, 1.2, 0.12); tone(1046, t + 0.25, 1.4, 0.12); },
    apDisc() { if (!ctx) return; const t = ctx.currentTime; const seq = [784, 1046, 1318, 1568, 1318, 1568]; for (let r = 0; r < 2; r++) seq.forEach((f, i) => tone(f, t + r * 0.9 + i * 0.12, 0.13, 0.08, 'square')); },
    gearLever() { burst(0.12, 0.5, 600); },
    touchdown(k) { if (!ctx) return; burst(0.35, 0.9 * k + 0.2, 70, 'lowpass'); burst(0.6, 0.25 * k + 0.05, 2400, 'bandpass'); },
    get ready() { return enabled; }
  };
})();
