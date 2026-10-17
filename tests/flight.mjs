import assert from 'node:assert/strict';
import {initialState,step,enterLesson,lessons} from '../docs/simulation.js';
function run(s,seconds,input={}){for(let t=0;t<seconds;t+=.05)step(s,.05,input);}
function until(s,predicate,seconds,input={}){for(let t=0;t<seconds;t+=.05){step(s,.05,input);if(predicate(s))return t;}throw new Error('Timed out '+JSON.stringify(s));}
let s=initialState();enterLesson(s,6,true);s.landinglight=true;s.throttle=100;let takeoff=until(s,s=>s.alt>30,90);assert(s.speed>130);assert(!s.crashed);console.log('Assisted takeoff',Math.round(takeoff),'seconds');
enterLesson(s,7);s.gear=false;until(s,s=>s.speed>=180,90);s.flaps=0;until(s,s=>s.alt>305,100);assert(lessons[7].checks.every(c=>c[1](s)));console.log('Initial climb checks passed');
enterLesson(s,8);s.targetAlt=15000;s.targetSpeed=250;s.ap=true;let climb=until(s,s=>s.alt*3.28084+s.elev>14500,900);assert(s.ap);console.log('Autopilot climb',Math.round(climb),'seconds',s.speed);
enterLesson(s,9);s.targetAlt=3000;s.targetSpeed=200;let descent=until(s,s=>s.alt*3.28084+s.elev<3500,1400);assert(!s.crashed);console.log('Descent',Math.round(descent),'seconds',s.speed);
enterLesson(s,10);s.approach=true;s.targetSpeed=150;s.gear=true;s.flaps=3;s.landinglight=true;run(s,30);assert(s.alt>0);assert(s.speed<200);console.log('Approach stable',Math.round(s.alt),Math.round(s.speed));
enterLesson(s,11);s.ap=false;s.throttle=37;until(s,s=>s.alt<15,180);s.throttle=0;enterLesson(s,12);let landing=until(s,s=>s.landed||s.crashed,90);console.log('Landing result',s.landed,s.touchdown,s.x,s.z,s.speed);assert(s.landed);run(s,20,{brake:true});assert(s.speed<20);enterLesson(s,13);s.brake=true;s.engine1=s.engine2=s.beacon=s.belts=false;assert(lessons[13].checks.every(c=>c[1](s)));console.log('Gate-to-gate flight passed');
s=initialState();enterLesson(s,11,true);s.ap=false;s.gear=false;until(s,s=>s.crashed,180);assert(s.crashed);console.log('Gear-up landing rejected');
s=initialState();enterLesson(s,5,true);s.throttle=15;until(s,s=>s.taxiComplete&&s.speed<2,180);console.log('Taxi check passed');
s=initialState();s.started=true;s.paused=true;s.throttle=100;run(s,60);assert.equal(s.speed,0);console.log('Pause check passed');
