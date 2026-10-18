// ---------- Captain's tutorial ----------
const Tut = (() => {
  let steps = [], idx = -1, active = false, stepT = 0, spoken = false, events = new Set(), onUI = null, calls = {};
  const near = (x, z, r) => dist2(S.pos.x, S.pos.z, x, z) < r;
  const hdgNear = (h, tol) => Math.abs(wrap180(S.psi * R2D - h)) < tol;
  const ev = (n) => events.has(n);
  const ST = (o) => steps.push(o);
  // phase: label shown in the checklist header
  // ===== COCKPIT PREPARATION =====
  ST({ ph: 'Cockpit preparation', title: 'Welcome aboard', text: "Good afternoon, I'm Captain Hughes, and I'll be your training captain today. We're operating Albion 324 from London Heathrow to Paris Charles de Gaulle in an Airbus A320. The aircraft is cold and dark, so we'll bring her to life together. I'll point at every switch. Look around by dragging with the mouse; scroll on a knob to turn it. When you're ready, press Continue.", manual: true });
  ST({ ph: 'Cockpit preparation', title: 'Batteries on', text: "Look up at the overhead panel. In the ELEC section, press BAT 1 and BAT 2. The white OFF lights go out and the battery voltage appears.", hl: () => !S.elec.bat1 ? 'bat1' : 'bat2', done: () => S.elec.bat1 && S.elec.bat2, items: [['BAT 1', () => S.elec.bat1], ['BAT 2', () => S.elec.bat2]], doit: () => { S.elec.bat1 = S.elec.bat2 = true; } });
  ST({ ph: 'Cockpit preparation', title: 'APU master switch', text: "There's no ground power on this stand, so we'll use the APU, the small jet engine in the tail. Press APU MASTER SW at the front right of the overhead panel. The air intake flap starts to open.", hl: 'apu_master', done: () => S.apu.master, doit: () => S.apu.master = true });
  ST({ ph: 'Cockpit preparation', title: 'APU start', text: "Give the flap a few seconds to open, then press APU START. The blue ON light means the start sequence is running.", hl: 'apu_start', done: () => S.apu.start || S.apu.avail, doit: () => { S.apu.flap = 1; S.apu.start = true; } });
  ST({ ph: 'Cockpit preparation', title: 'Waiting for the APU', text: "Listen behind us; that's the APU spooling up. It takes about half a minute. When AVAIL lights green, the APU generator powers the aircraft and the screens will run their self test.", hl: 'apu_start', done: () => S.apu.avail, doit: () => { S.apu.N = 100; S.apu.avail = true; S.apu.start = false; } });
  ST({ ph: 'Cockpit preparation', title: 'APU bleed', text: "Now press APU BLEED in the AIR section. Bleed air from the APU will turn the engine starters later, and it runs the air conditioning.", hl: 'apu_bleed', done: () => S.apu.bleed, doit: () => S.apu.bleed = true });
  ST({ ph: 'Cockpit preparation', title: 'Align the inertial reference', text: "Turn all three ADIRS selectors, at the back left of the overhead, from OFF to NAV (click each knob once). Alignment takes about two minutes, and the white ALIGN lights go out when it's done. The laser gyros sense the Earth's rotation to find north. We mustn't move the aircraft while they align. The attitude flags on your screens will clear when they're done.", hl: () => S.adirs.findIndex(a => a !== 1) >= 0 ? 'adirs' + (S.adirs.findIndex(a => a !== 1) + 1) : 'adirs1', done: () => S.adirs.every(a => a === 1), items: [['IR 1 NAV', () => S.adirs[0] === 1], ['IR 2 NAV', () => S.adirs[1] === 1], ['IR 3 NAV', () => S.adirs[2] === 1]], doit: () => { S.adirs = [1, 1, 1]; } });
  ST({ ph: 'Cockpit preparation', title: 'Lights and signs', text: "On the front row of the overhead: NAV & LOGO lights to 1, and SEAT BELTS ON. You'll hear the cabin chime.", hl: () => !S.lt.nav ? 'navlt' : 'belts', done: () => S.lt.nav && S.lt.belts, items: [['NAV & LOGO on', () => S.lt.nav], ['SEAT BELTS on', () => S.lt.belts]], doit: () => { S.lt.nav = true; S.lt.belts = true; Audio2.ding(); } });
  ST({ ph: 'Flight computer', title: 'MCDU: INIT page', text: "Down on the centre pedestal is the MCDU, the keyboard and screen of the flight management computer. Press the INIT key on the left MCDU.", hl: 'mcdu_INIT', done: () => MCDU.page === 'INIT', doit: () => MCDU.page = 'INIT' });
  ST({ ph: 'Flight computer', title: 'Load the company route', text: "Our route is stored as company route EGLLLFPG1. Type it on the MCDU keypad: E, G, L, L, L, F, P, G, 1. You can also use your own keyboard while the pointer is over the MCDU. Check the scratchpad at the bottom of the screen, then press the line-select key beside CO RTE, top left. CLR deletes a character.", hl: () => MCDU.scratch === 'EGLLLFPG1' ? 'mcdu_L1' : 'mcdu_' + ('EGLLLFPG1'[MCDU.scratch.length] || 'CLR'), done: () => S.fms.coRte, items: [['Scratchpad shows EGLLLFPG1', () => MCDU.scratch === 'EGLLLFPG1' || S.fms.coRte], ['CO RTE loaded (L1)', () => S.fms.coRte]], doit: () => { MCDU.page = 'INIT'; S.fms.coRte = S.fms.fromTo = true; mcduClr(); fmsCheck(); } });
  ST({ ph: 'Flight computer', title: 'Flight number and cruise level', text: "Fill in the rest of the INIT page the same way: type the entry, then press the key beside its field. ALB324 into FLT NBR (L3). 30 into COST INDEX (L5), which balances fuel against time. 250 into CRZ FL (L6), our cruise level of 25,000 feet.", hl: () => { const f = S.fms; const want = !f.fltNbr ? ['ALB324', 'L3'] : f.ci == null ? ['30', 'L5'] : ['250', 'L6']; return MCDU.page !== 'INIT' ? 'mcdu_INIT' : MCDU.scratch === want[0] ? 'mcdu_' + want[1] : 'mcdu_' + (want[0][MCDU.scratch.length] || 'CLR'); }, done: () => S.fms.init, items: [['FLT NBR ALB324', () => !!S.fms.fltNbr], ['COST INDEX 30', () => S.fms.ci != null], ['CRZ FL 250', () => !!S.fms.crz]], doit: () => { Object.assign(S.fms, { fltNbr: 'ALB324', ci: 30, crz: 250 }); mcduClr(); fmsCheck(); } });
  ST({ ph: 'Flight computer', title: 'Check the flight plan', text: "Press F-PLN and check the route: runway 27 right, climb straight ahead to 1500 feet, then Epsom, Detling, Dover, across the Channel to Abbeville and Beauvais, then MOPAR and the ILS for runway 26 right. You'll see it on your navigation display once the IRS have aligned. Press Continue when you've had a look.", hl: 'mcdu_F-PLN', manual: true, doit: () => { MCDU.page = 'F-PLN'; Tut.cont(); } });
  ST({ ph: 'Flight computer', title: 'Take-off performance', text: "Press PERF. Enter today's take-off data the same way, typing the number and then pressing the key beside its field: 142 into V1 (L1), 145 into VR (L2), 149 into V2 (L3). Then 1 into FLAPS/THS (R3) for flaps 1, and 55 into FLEX TO TEMP (R4) for reduced take-off thrust.", hl: () => { if (MCDU.page !== 'PERF') return 'mcdu_PERF'; const e = S.fms.ent; const want = !e.v1 ? ['142', 'L1'] : !e.vr ? ['145', 'L2'] : !e.v2 ? ['149', 'L3'] : !e.flaps ? ['1', 'R3'] : ['55', 'R4']; return MCDU.scratch === want[0] ? 'mcdu_' + want[1] : 'mcdu_' + (want[0][MCDU.scratch.length] || 'CLR'); }, done: () => S.fms.perf, items: [['V1 142', () => S.fms.ent.v1], ['VR 145', () => S.fms.ent.vr], ['V2 149', () => S.fms.ent.v2], ['FLAPS 1', () => S.fms.ent.flaps], ['FLEX 55', () => S.fms.ent.flex]], doit: () => { MCDU.page = 'PERF'; fmsComplete(); mcduClr(); } });
  ST({ ph: 'Flight computer', title: 'Altimeter setting', text: "The Heathrow weather gives QNH 1018. Scroll the BARO knob on the left of the glareshield until its window reads 1018. Clicking the knob pushes it to STD, so just scroll.", hl: 'baro', done: () => S.baro.qnh === 1018 && !S.baro.std, doit: () => { S.baro.qnh = 1018; S.baro.std = false; } });
  ST({ ph: 'Flight computer', title: 'Initial altitude', text: "Our clearance is the standard departure, climbing to 6000 feet. Scroll the ALT knob on the FCU until the ALT window above it reads 06000. Hold Shift to scroll faster.", hl: 'fcu_alt', done: () => S.fcu.alt === 6000, doit: () => S.fcu.alt = 6000 });
  ST({ ph: 'Flight computer', title: 'Take-off configuration', text: "Set flaps 1 with the flap lever on the right of the pedestal, or press F. Then arm the ground spoilers: lift the speed brake lever, or press slash. Finally press AUTO BRAKE MAX on the centre panel, in case we have to reject the take-off.", hl: () => S.flapLever !== 1 ? 'flaps' : !S.sbArmed ? 'spoilers' : 'ab_MAX', done: () => S.flapLever === 1 && S.sbArmed && S.autobrake === 3, items: [['FLAPS 1', () => S.flapLever === 1], ['GND SPLRS armed', () => S.sbArmed], ['AUTO BRK MAX', () => S.autobrake === 3]], doit: () => { S.flapLever = 1; S.sbArmed = true; S.autobrake = 3; } });
  // ===== PUSHBACK & START =====
  ST({ ph: 'Pushback and start', title: 'Clearance', freq: 121905, who: 'Heathrow Ground', atc: ['Albion 324, Heathrow Ground, push and start approved, face east. Squawk 4 5 2 1.', 'Push and start approved, face east, squawk 4 5 2 1, Albion 324.'], text: "Ground has cleared us to push back and given us a squawk code. Doors are closed. Switch the BEACON on (front row of the overhead): the flashing red light warns the ground crew that engines are about to start. Then type 4521 on the ATC transponder keypad at the back of the pedestal.", hl: () => S.lt.beacon ? 'xpdr_4' : 'beacon', done: () => S.lt.beacon && S.xpdr.code === '4521', items: [['BEACON on', () => S.lt.beacon], ['Squawk 4521 (ATC panel keypad)', () => S.xpdr.code === '4521']], doit: () => { S.lt.beacon = true; S.xpdr.code = '4521'; S.xpdr.entry = ''; }, enter: () => { S.doorsClosed = true; setTimeout(() => { Audio2.ding(); Audio2.pa('Cabin crew, arm doors and cross check.'); showATC('Purser (PA)', 'Cabin crew, arm doors and cross check.'); }, 9000); } });
  ST({ ph: 'Pushback and start', title: 'Release the parking brake', text: "The tug is connected. Release the parking brake, the red handle at the back of the pedestal, or press Shift B. The tug will push us back while we start the engines.", hl: 'parkbrk', done: () => !S.parkBrake, doit: () => S.parkBrake = false, exit: () => startPushback() });
  ST({ ph: 'Pushback and start', title: 'Ignition', text: "Turn the ENG MODE selector, between the two engine master switches, to IGN START.", hl: 'engmode', done: () => S.engMode === 2, doit: () => S.engMode = 2 });
  ST({ ph: 'Pushback and start', title: 'Start engine 2', text: "We start number 2 first. Set ENG 2 MASTER to ON. Watch the upper screen: N2 climbs, fuel and ignition come on at 16 percent, then EGT rises. Engine 2 will be stable in about 40 seconds.", hl: 'eng2', done: () => S.eng[1].run, items: [['ENG 2 MASTER ON', () => S.eng[1].master], ['ENG 2 stable', () => S.eng[1].run]], doit: () => S.eng[1].master = true });
  ST({ ph: 'Pushback and start', title: 'Start engine 1', text: "Engine 2 is stable. Now ENG 1 MASTER to ON.", hl: 'eng1', done: () => S.eng[0].run, items: [['ENG 1 MASTER ON', () => S.eng[0].master], ['ENG 1 stable', () => S.eng[0].run]], doit: () => S.eng[0].master = true });
  ST({ ph: 'Pushback and start', title: 'After start', text: "Both engines are running. Wait for the tug to finish, then set the parking brake. Turn ENG MODE back to NORM, and switch off APU BLEED and then the APU MASTER SW. The engines supply power and air now.", hl: () => S.pushback ? 'engmode' : !S.parkBrake ? 'parkbrk' : S.engMode !== 1 ? 'engmode' : S.apu.bleed ? 'apu_bleed' : 'apu_master', done: () => !S.pushback && S.parkBrake && S.engMode === 1 && !S.apu.bleed && !S.apu.master, items: [['Pushback complete', () => !S.pushback], ['PARK BRK set', () => S.parkBrake], ['ENG MODE NORM', () => S.engMode === 1], ['APU BLEED off', () => !S.apu.bleed], ['APU MASTER off', () => !S.apu.master]], doit: () => { if (!S.pushback) S.parkBrake = true; S.engMode = 1; S.apu.bleed = false; S.apu.master = false; } });
  ST({ ph: 'Pushback and start', title: 'Take-off config test', text: "Press T.O CONFIG on the ECAM control panel, at the front of the pedestal. It checks flaps, armed spoilers, autobrake MAX, rudder trim and landing gear. Correct any fault it reports, then test again. Check the take-off memo on the upper screen too.", hl: 'toconfig', done: () => takeoffConfigNormal() && S.cabinReady, doit: () => { S.flapLever = S.flapPos = 1; S.sbArmed = true; S.sbLever = S.spoiler = 0; S.autobrake = 3; S.rudTrim = 0; S.gearLever = S.gearPos = 1; S.toConfigTested = true; S.cabinReady = true; }, enter: () => { setTimeout(() => { S.cabinReady = true; Audio2.ding(); showATC('Purser', 'Captain, cabin is secure and ready for departure.'); }, 9000); } });
  // ===== TAXI =====
  ST({ ph: 'Taxi', title: 'Taxi to 27R', freq: 121905, who: 'Heathrow Ground', atc: ['Albion 324, taxi holding point A1, runway 27 right, via Alpha. Follow the greens.', 'Holding point A1, 27 right, via Alpha, Albion 324.'], text: "Set the NOSE light to TAXI and release the parking brake. Add a touch of thrust to get rolling, then back to idle. Steer with the tiller: comma and full stop keys, or the left and right arrows. Follow the green centreline lights to the holding point and keep the speed below 20 knots. Use B to brake.", hl: () => S.lt.nose < 1 ? 'nose' : S.parkBrake ? 'parkbrk' : null, done: () => near(HOLD_27R.x, HOLD_27R.z, 45) && S.gs < 5, items: [['NOSE light TAXI', () => S.lt.nose >= 1], ['PARK BRK off', () => !S.parkBrake], ['At holding point A1', () => near(HOLD_27R.x, HOLD_27R.z, 45)]], doit: () => { autoTaxi(); }, skipDo: () => { S.lt.nose = Math.max(S.lt.nose, 1); S.parkBrake = false; } });
  ST({ ph: 'Before take-off', title: 'Line up', freq: 118505, who: 'Heathrow Tower', atc: ['Albion 324, runway 27 right, line up and wait.', 'Line up and wait 27 right, Albion 324.'], text: "We're on Tower now. Lights for take-off: STROBE on, LAND lights on, NOSE light to T.O. Set the TCAS selector on the ATC panel to TA/RA so the transponder is fully on. Then taxi onto the runway and line up on the centreline, heading 270, close to the threshold markings.", hl: () => S.lt.strobe < 2 ? 'strobe' : !S.lt.land ? 'land' : S.lt.nose < 2 ? 'nose' : S.xpdr.tcas < 2 ? 'tcas' : null, done: () => S.lt.strobe === 2 && S.lt.land && S.lt.nose === 2 && S.xpdr.tcas === 2 && near(1560, -850, 70) && hdgNear(270, 6) && S.gs < 8, items: [['STROBE on', () => S.lt.strobe === 2], ['LAND lights on', () => S.lt.land], ['NOSE light T.O', () => S.lt.nose === 2], ['TCAS TA/RA', () => S.xpdr.tcas === 2], ['Lined up 27R', () => near(1560, -850, 70) && hdgNear(270, 6)]], doit: () => { S.lt.strobe = 2; S.lt.land = true; S.lt.nose = 2; S.xpdr.tcas = 2; S.xpdr.mode = 1; placeAt(1560, -850, 270); S.parkBrake = false; }, enter: () => setTimeout(() => { Audio2.pa('Cabin crew, seats for take-off.'); showATC('Captain (PA)', 'Cabin crew, seats for take-off.'); }, 6000) });
  // ===== TAKE-OFF =====
  ST({ ph: 'Take-off', title: 'Cleared for take-off', freq: 118505, who: 'Heathrow Tower', atc: ['Albion 324, wind 250 degrees 8 knots, runway 27 right, cleared for take-off.', 'Cleared for take-off 27 right, Albion 324.'], text: "Hold the brakes, push the thrust levers to about 50 percent and let the engines stabilise, then all the way to the FLX MCT detent. Press Shift F, or drag the levers. Keep the centreline with the rudder: Z and X. I'll call the speeds.", hl: 'thrust', done: () => S.tl.every(t => t >= DET.FLX - 0.02) && !S.parkBrake, doit: () => { S.parkBrake = false; S.tl = [DET.FLX, DET.FLX]; } });
  ST({ ph: 'Take-off', title: 'Rotate', text: "At rotate, pull the sidestick back smoothly, about 3 degrees per second, towards 15 degrees nose up. Use the down arrow or S key. Follow the green flight director bars on your PFD.", hl: 'sidestick', done: () => !S.onGround && S.ra > 35, quiet: true });
  ST({ ph: 'Take-off', title: 'Gear up', text: "Positive climb. Gear up: press G or click the gear lever.", hl: 'gear', done: () => S.gearLever === 0, doit: () => setGear(0) });
  ST({ ph: 'Climb', title: 'Autopilot', text: "Now engage autopilot 1. Press AP1 on the FCU, or press A. Notice the flight mode annunciator at the top of the PFD: SRS for the pitch, NAV for the route.", hl: 'fcu_ap1', done: () => S.fcu.ap1 || S.fcu.ap2, doit: () => { S.fcu.ap1 = true; }, wait: () => S.ra > 300 });
  ST({ ph: 'Climb', title: 'Thrust reduction', text: "LVR CLB is flashing on the PFD. Pull both thrust levers back to the CL detent: press Shift C or drag them. The autothrust becomes active.", hl: 'thrust', done: () => S.tl.every(t => Math.abs(t - DET.CL) < 0.02), doit: () => { S.tl = [DET.CL, DET.CL]; }, wait: () => S.ra > 1400 });
  ST({ ph: 'Climb', title: 'Flaps up', text: "We're accelerating. Once the speed passes the green S on the speed tape, retract the flaps: flaps zero, press V.", hl: 'flaps', done: () => S.flapLever === 0, doit: () => S.flapLever = 0, wait: () => S.ias > speeds().S - 2 });
  ST({ ph: 'Climb', title: 'Climb to FL250', freq: 128405, who: 'London Control', atc: ['Albion 324, London Control, climb flight level 250.', 'Climb flight level 250, Albion 324.'], text: "We're cleared to flight level 250. Scroll the ALT knob to 25000, then click it to push it in for a managed climb: a dot appears in the ALT window. Above the 6000 foot transition altitude we use standard pressure, so click the BARO knob to show Std.", hl: () => S.fcu.alt !== 25000 ? 'fcu_alt' : !['CLB', 'OP CLB'].includes(S.ap.vert) ? 'fcu_alt' : 'baro', done: () => S.fcu.alt === 25000 && ['CLB', 'OP CLB', 'ALT*', 'ALT'].includes(S.ap.vert) && S.baro.std, items: [['ALT 25000', () => S.fcu.alt === 25000], ['ALT knob pushed', () => ['CLB', 'OP CLB'].includes(S.ap.vert) || (S.fcu.alt === 25000 && indicatedAlt() > 24000)], ['BARO STD', () => S.baro.std]], doit: () => { S.fcu.alt = 25000; S.ap.vert = 'CLB'; S.baro.std = true; }, wait: () => S.ap.vert === 'ALT' || S.ap.vert === 'ALT*' || indicatedAlt() > 5000 });
  ST({ ph: 'Climb', title: 'Passing 10,000 feet', text: "Passing flight level 100 the speed limit lifts and we accelerate. Switch the landing lights off.", hl: 'land', done: () => !S.lt.land, doit: () => S.lt.land = false, wait: () => indicatedAlt() > 10000, enter: () => Audio2.ding() });
  // ===== CRUISE =====
  ST({ ph: 'Cruise', title: 'Cruise', text: "We're levelling at flight level 250. That's the Kent coast below; Dover's white cliffs are ahead and France is across the Channel. You can speed up time with T. I'll tell you when it's time to descend.", done: () => distToGo() < 88, quiet: false, wait: () => indicatedAlt() > 24000 || S.ap.vert === 'ALT' });
  // ===== DESCENT =====
  ST({ ph: 'Descent', title: 'Start descent', freq: 128280, who: 'Paris Control', atc: ['Albion 324, Paris Control, bonjour. Descend flight level 110.', 'Descend flight level 110, Albion 324.'], text: "Top of descent. Scroll the ALT knob to 11000 and click it to push for a managed descent. The thrust goes to idle and the aircraft pitches down to hold the speed.", hl: 'fcu_alt', done: () => S.fcu.alt === 11000 && ['DES', 'OP DES', 'ALT*', 'ALT'].includes(S.ap.vert) && indicatedAlt() < 24800, doit: () => { S.fcu.alt = 11000; S.ap.vert = 'DES'; S.fms.phase = 'DESCENT'; }, enter: () => { S.time_compress = 1; } });
  ST({ ph: 'Descent', title: 'Approach briefing', text: "Briefing: ILS approach runway 26 right, course 266, frequency 110.10. Decision height 200 feet. Flaps full, autobrake medium. If we go around, it's TOGA thrust and climb to 5000 feet. Press Continue when you're happy.", manual: true });
  ST({ ph: 'Descent', title: 'Descend to 4000 feet', freq: 125825, who: 'De Gaulle Approach', atc: ['Albion 324, descend altitude 4000 feet, QNH 1015.', 'Descend 4000 feet, QNH 1015, Albion 324.'], text: "Scroll the ALT knob to 4000 and click to push it. Then set the Paris QNH: right-click the BARO knob to pull it out of Std, and scroll to 1015. Below 10,000 feet, landing lights back on.", hl: () => S.fcu.alt !== 4000 ? 'fcu_alt' : S.baro.std || S.baro.qnh !== 1015 ? 'baro' : 'land', done: () => S.fcu.alt === 4000 && !S.baro.std && S.baro.qnh === 1015 && S.lt.land, items: [['ALT 4000 pushed', () => S.fcu.alt === 4000], ['QNH 1015', () => !S.baro.std && S.baro.qnh === 1015], ['LAND lights on', () => S.lt.land]], doit: () => { S.fcu.alt = 4000; S.ap.vert = 'DES'; S.baro.std = false; S.baro.qnh = 1015; S.lt.land = true; }, wait: () => indicatedAlt() < 12500 });
  // ===== APPROACH =====
  ST({ ph: 'Approach', title: 'Arm the approach', freq: 125825, who: 'De Gaulle Approach', atc: ['Albion 324, cleared ILS approach runway 26 right.', 'Cleared ILS 26 right, Albion 324.'], text: "We're cleared for the ILS. Press LS on your EFIS panel to show the ILS scales, then press APPR on the FCU. LOC and G/S appear in blue: armed. Engage AP2 as well for a dual autopilot approach.", hl: () => !S.efisLS ? 'efis_ls' : S.ap.vertArm !== 'G/S' && !['G/S*', 'G/S', 'LAND'].includes(S.ap.vert) ? 'fcu_appr' : 'fcu_ap2', done: () => S.efisLS && (S.ap.vertArm === 'G/S' || ['G/S*', 'G/S', 'LAND', 'FLARE'].includes(S.ap.vert)) && S.fcu.ap1 && S.fcu.ap2, items: [['LS on', () => !!S.efisLS], ['APPR armed', () => S.ap.vertArm === 'G/S' || ['G/S*', 'G/S', 'LAND', 'FLARE'].includes(S.ap.vert)], ['AP1 and AP2 engaged', () => S.fcu.ap1 && S.fcu.ap2]], doit: () => { S.efisLS = true; S.ap.vertArm = 'G/S'; if (!S.ap.lat.startsWith('LOC')) S.ap.latArm = 'LOC'; S.fcu.ap1 = S.fcu.ap2 = true; }, wait: () => distToGo() < 30 || S.loc.dist < 22 * NM });
  ST({ ph: 'Approach', title: 'Flaps 1', text: "Speed is reducing towards green dot. Flaps 1, press F.", hl: 'flaps', done: () => S.flapLever >= 1, doit: () => S.flapLever = 1, wait: () => S.ias < 222 });
  ST({ ph: 'Approach', title: 'Flaps 2', text: "Below 200 knots, flaps 2.", hl: 'flaps', done: () => S.flapLever >= 2, doit: () => S.flapLever = 2, wait: () => S.ias < 205 || S.ap.lat.startsWith('LOC') });
  ST({ ph: 'Approach', title: 'Gear down', text: "Localiser alive. Gear down, press G. Hear the gear coming down and the extra wind noise.", hl: 'gear', done: () => S.gearLever === 1, doit: () => setGear(1), wait: () => S.ap.lat.startsWith('LOC') || S.ap.vert.startsWith('G/S') || S.ra < 3000 });
  ST({ ph: 'Approach', title: 'Flaps 3 and FULL', text: "Flaps 3, then flaps FULL as the speed allows. Check the ground spoilers are armed and set AUTO BRAKE MED.", hl: () => S.flapLever < 4 ? 'flaps' : !S.sbArmed ? 'spoilers' : 'ab_MED', done: () => S.flapLever === 4 && S.sbArmed && S.autobrake === 2, items: [['FLAPS FULL', () => S.flapLever === 4], ['GND SPLRS armed', () => S.sbArmed], ['AUTO BRK MED', () => S.autobrake === 2]], doit: () => { S.flapLever = 4; S.sbArmed = true; S.autobrake = 2; }, enter: () => setTimeout(() => { Audio2.pa('Cabin crew, seats for landing.'); showATC('Captain (PA)', 'Cabin crew, seats for landing.'); }, 4000) });
  ST({ ph: 'Landing', title: 'Cleared to land', freq: 119250, who: 'De Gaulle Tower', atc: ['Albion 324, Charles de Gaulle Tower, wind 250 degrees 8 knots, runway 26 right, cleared to land.', 'Cleared to land 26 right, Albion 324.'], text: "Landing memo all green. Stabilised. Your choice now: keep both autopilots in for an automatic landing, or press Q at 'minimum' and fly it yourself. To hand-fly, keep the flight path vector on the runway, and at 30 feet pull gently to flare and reduce the thrust to idle when you hear 'retard'.", done: () => S.onGround && S.touchdown, quiet: false, wait: () => S.gs_.valid && S.ap.vert.startsWith('G/S') || S.ra < 1500 });
  ST({ ph: 'Landing', title: 'Reverse thrust', text: "Touchdown! Thrust levers to idle and then reverse: hold Page Down or press R. Keep straight with the rudder.", hl: 'thrust', done: () => S.rev.some(r => r > 0.8) || S.gs < 50, doit: () => S.tl = [-1, -1] });
  ST({ ph: 'Landing', title: 'Slow down', text: "Seventy knots. Reverse idle, thrust levers back to idle with Page Up or I. Brake to walking pace with B.", hl: 'thrust', done: () => S.gs < 20 && S.tl.every(t => t >= -0.01), doit: () => S.tl = [0, 0], wait: () => S.gs < 75 });
  // ===== AFTER LANDING =====
  ST({ ph: 'After landing', title: 'After landing', text: "Welcome to Paris. Bring the aircraft to a stop with the brakes. After landing: flaps up, disarm the spoilers, STROBE to AUTO, landing lights off.", hl: () => S.flapLever ? 'flaps' : S.sbArmed ? 'spoilers' : S.lt.strobe === 2 ? 'strobe' : 'land', done: () => S.gs < 1 && S.flapLever === 0 && !S.sbArmed && S.lt.strobe < 2 && !S.lt.land, items: [['Stopped', () => S.gs < 1], ['FLAPS 0', () => S.flapLever === 0], ['SPLRS disarmed', () => !S.sbArmed], ['STROBE AUTO', () => S.lt.strobe < 2], ['LAND lights off', () => !S.lt.land]], doit: () => { S.flapLever = 0; S.sbArmed = false; S.sbLever = 0; S.lt.strobe = 1; S.lt.land = false; }, enter: () => setTimeout(() => { Audio2.pa('Cabin crew, disarm doors and cross check.'); showATC('Captain (PA)', 'Cabin crew, disarm doors and cross check.'); }, 5000) });
  ST({ ph: 'Shutdown', title: 'Shutdown', text: "Ground will tow us to the stand. Parking brake on, both ENG MASTERS off, then BEACON off and SEAT BELTS off.", hl: () => !S.parkBrake ? 'parkbrk' : S.eng[0].master ? 'eng1' : S.eng[1].master ? 'eng2' : S.lt.beacon ? 'beacon' : 'belts', done: () => S.parkBrake && !S.eng[0].master && !S.eng[1].master && !S.lt.beacon && !S.lt.belts, items: [['PARK BRK on', () => S.parkBrake], ['ENG 1 off', () => !S.eng[0].master], ['ENG 2 off', () => !S.eng[1].master], ['BEACON off', () => !S.lt.beacon], ['SEAT BELTS off', () => !S.lt.belts]], doit: () => { S.parkBrake = true; S.eng[0].master = S.eng[1].master = false; S.lt.beacon = false; S.lt.belts = false; } });
  ST({ ph: 'Debrief', title: 'Debrief', text: "That's the end of the flight. Well done. Here's your debrief.", manual: false, done: () => false, enter: () => setTimeout(() => showDebrief(), 3500) });

  // where the aircraft should be when a step is reached by skipping
  const AT = { 'Welcome aboard': 'stand', 'Take-off config test': 'pushed', 'Taxi to 27R': 'pushed', 'Line up': 'hold', 'Cleared for take-off': 'runway', 'Rotate': 'roll', 'Gear up': 'liftoff',
    'Autopilot': 'climb400', 'Thrust reduction': 'climb1500', 'Flaps up': 'climb2000', 'Climb to FL250': 'climb6000', 'Passing 10,000 feet': 'climb10k', 'Cruise': 'cruise', 'Start descent': 'tod',
    'Approach briefing': 'tod', 'Descend to 4000 feet': 'desc12', 'Arm the approach': 'appr', 'Flaps 1': 'appr', 'Flaps 2': 'appr', 'Gear down': 'appr10', 'Flaps 3 and FULL': 'appr10',
    'Cleared to land': 'final', 'Reverse thrust': 'touchdown', 'Slow down': 'rollout', 'After landing': 'stopped', 'Shutdown': 'stopped', 'Debrief': 'stopped' };
  { let last = 'stand'; steps.forEach(st => { st.at = AT[st.title] || last; last = st.at; }); }
  function applyDone(k) { const st = steps[k]; try { if (st.skipDo) st.skipDo(); else if (st.doit) st.doit(); } catch (e) { console.warn(e); } }
  function jump(j) {
    j = clamp(j, 0, steps.length - 1); if (j === idx) return;
    const from = idx; window.speechSynthesis && speechSynthesis.cancel();
    if (j < from) { scenario('cold', null, true); for (let k = 0; k < j; k++) applyDone(k); }
    else for (let k = Math.max(from, 0); k < j; k++) applyDone(k);
    setupAt(steps[j].at);
    goto(j);
  }
  function cur() { return steps[idx]; }
  function hlOf(st) { if (!st || !st.hl) return null; return typeof st.hl === 'function' ? st.hl() : st.hl; }
  function goto(i) {
    const prev = cur(); if (prev && prev.exit) prev.exit();
    idx = i; stepT = 0; spoken = false; events.clear();
    const st = cur(); if (!st) return;
    st._waiting = !!st.wait;
    if (!st.wait) enterStep(st);
    onUI && onUI();
  }
  function enterStep(st) {
    st._waiting = false; st._entered = true;
    if (st.enter) st.enter();
    if (st.freq) { if (S.rmp.act !== st.freq) { S.rmp.stby = S.rmp.act; S.rmp.act = st.freq; } }
    if (st.atc) { showATC(st.who || 'ATC', st.atc[0], st.freq); Audio2.say(st.atc[0], 'atc', () => { setTimeout(() => { Audio2.say(st.atc[1], 'capt', () => speak(st)); }, 300); }); }
    else speak(st);
    onUI && onUI();
  }
  function speak(st) { if (st !== cur()) return; Audio2.say(st.text, 'capt'); }
  function update(dt) {
    callouts();
    if (!active) return; const st = cur(); if (!st) return; stepT += dt;
    if (st._waiting) { if (st.wait()) enterStep(st); return; }
    CK.highlightId = hlOf(st);
    const ok = st.manual ? ev('continue') && (!st.done || st.done()) : st.done && st.done();
    if (ok && stepT > 1.2) { Audio2.click(); goto(idx + 1); }
    if (Math.floor(stepT * 4) !== Math.floor((stepT - dt) * 4)) onUI && onUI();
  }
  // captain's standard callouts during take-off (as pilot monitoring)
  function callouts() {
    if (!Tut.captainOn) return;
    if (S.onGround && S.fms.phase === 'TAKEOFF') {
      if (!calls.thr && S.eng.every(e => e.N1 > 85)) { calls.thr = 1; Audio2.say('Thrust set.', 'capt'); }
      if (!calls.c100 && S.ias >= 100) { calls.c100 = 1; Audio2.say('One hundred knots.', 'capt'); }
      if (!calls.v1 && S.ias >= S.fms.v1) { calls.v1 = 1; Audio2.say('V one.', 'capt'); }
      if (!calls.vr && S.ias >= S.fms.vr) { calls.vr = 1; Audio2.say('Rotate.', 'capt'); toast('ROTATE: pull back (↓ or S)'); }
    }
    if (!S.onGround && !calls.pos && S.vs > 300 && S.ra > 30 && S.fms.phase === 'TAKEOFF') { calls.pos = 1; Audio2.say('Positive climb.', 'capt'); }
    if (S.onGround && S.touchdown && !calls.spl && S.spoiler > 0.8) { calls.spl = 1; Audio2.say('Spoilers. Reverse green.', 'capt'); }
    if (S.onGround && S.touchdown && !calls.s70 && S.gs < 72 && S.gs > 60) { calls.s70 = 1; Audio2.say('Seventy knots.', 'capt'); }
  }
  return {
    get steps() { return steps; }, get idx() { return idx; }, get active() { return active; }, captainOn: true,
    start(i = 0) { active = true; calls = {}; goto(i); },
    stop() { active = false; CK.highlightId = null; onUI && onUI(); },
    next() { jump(idx + 1); }, prev() { jump(idx - 1); }, jump,
    cont() { events.add('continue'); },
    doit() { const st = cur(); if (st && st._waiting) { setupAt(st.at); enterStep(st); return; } if (st && st.doit) { st.doit(); Audio2.click(); } else events.add('continue'); },
    repeat() { const st = cur(); if (st) Audio2.say(st.text, 'capt'); },
    event(n) { events.add(n); },
    find(title) { return steps.findIndex(s => s.title === title); },
    update, cur, hlOf, set onUI(f) { onUI = f; }, resetCalls() { calls = {}; }
  };
})();

function startPushback() {
  if (S.pushback || !S.onGround) return;
  S.pushback = { t: 0, dur: 75 }; showATC('Ground crew', 'Brakes released, pushing back.');
}
function stepPushback(dt) {
  const pb = S.pushback; if (!pb) return;
  if (S.parkBrake && pb.t < 3) { return; }
  pb.t += dt; const k = clamp(pb.t / pb.dur, 0, 1); const s = k * k * (3 - 2 * k);
  const P0 = { x: LHR_STAND.x, z: LHR_STAND.z }, P1 = { x: LHR_STAND.x, z: PUSH_END.z }, P2 = { x: PUSH_END.x, z: PUSH_END.z };
  const bz = (t) => ({ x: (1 - t) ** 2 * P0.x + 2 * (1 - t) * t * P1.x + t * t * P2.x, z: (1 - t) ** 2 * P0.z + 2 * (1 - t) * t * P1.z + t * t * P2.z });
  const p = bz(s), p2 = bz(Math.min(1, s + 0.01)), p1 = bz(Math.max(0, s - 0.01));
  const mv = brg(p1.x, p1.z, p2.x, p2.z);
  S.pos.x = p.x; S.pos.z = p.z; S.pos.y = groundH(p.x, p.z); S.psi = wrap360(mv + 180) * D2R; S.vel.set(0, 0, 0);
  S.pushback.v = 0;
  if (k >= 1) { S.pushback = null; showATC('Ground crew', 'Pushback complete. Set parking brake, disconnecting the tug. Bye bye.'); }
}
let _autoTaxi = false;
function autoTaxi() { _autoTaxi = true; S.parkBrake = false; S.lt.nose = Math.max(S.lt.nose, 1); }
function stepAutoTaxi(dt) {
  if (!_autoTaxi) return;
  // follow TAXI_LHR to the holding point using a pure-pursuit steering law
  const path = TAXI_LHR; let best = 0, bd = 1e9; path.forEach((p, i) => { const d = dist2(S.pos.x, S.pos.z, p[0], p[1]); if (d < bd) { bd = d; best = i; } });
  const tgtI = Math.min(best + 1, 6); const tgt = path[tgtI];
  const b = brg(S.pos.x, S.pos.z, tgt[0], tgt[1]); const err = wrap180(b - S.psi * R2D);
  S.tiller = clamp(err / 25, -1, 1);
  const dh = dist2(S.pos.x, S.pos.z, HOLD_27R.x, HOLD_27R.z);
  const tgtSpd = dh < 60 ? 0 : Math.abs(err) > 25 ? 8 : 16;
  const tl = S.gs < tgtSpd - 2 ? 0.18 : 0; S.tl = [tl, tl];
  S.brakeL = S.brakeR = S.gs > tgtSpd + 2 ? 0.5 : 0;
  if (dh < 45 && S.gs < 2) { _autoTaxi = false; S.tiller = 0; S.brakeL = S.brakeR = 0; }
}
