const fs = require('fs');
const lines = fs.readFileSync('logs/rl_log_1779977586185.jsonl', 'utf-8').split('\n').filter(Boolean);
const data = lines.map(l => JSON.parse(l));
let epRewards = {};
let qTable = {};
data.forEach(d => {
  epRewards[d.episode] = (epRewards[d.episode] || 0) + d.reward;
  qTable[d.state] = d.qValues;
});
const eps = Object.keys(epRewards).map(Number).sort((a,b)=>a-b);
const first20 = eps.slice(0, 20).reduce((a,e)=>a+epRewards[e],0)/20;
const last20 = eps.slice(-20).reduce((a,e)=>a+epRewards[e],0)/20;
console.log('Total Episodes:', eps.length);
console.log('Avg Reward (First 20):', first20);
console.log('Avg Reward (Last 20):', last20);
console.log('Latest Epsilon:', data[data.length-1].epsilon);

console.log('\n--- State Analysis ---');
// State format: phase - nsStraight - nsLeft - ewStraight - ewLeft
// Phase 0: NS Straight Green
// Phase 1: NS Left Green
// Phase 2: EW Straight Green
// Phase 3: EW Left Green

const phase0_ew_congested = Object.keys(qTable).filter(s => s.startsWith('0-') && parseInt(s.split('-')[1]) === 0 && parseInt(s.split('-')[3]) >= 2);
console.log('\nPhase 0 (NS Green) but NS Empty, EW Congested:');
phase0_ew_congested.slice(0, 5).forEach(s => console.log(`State ${s}: Keep Green(0)=${qTable[s][0].toFixed(2)}, Switch(1)=${qTable[s][1].toFixed(2)}`));

const phase0_ns_congested = Object.keys(qTable).filter(s => s.startsWith('0-') && parseInt(s.split('-')[1]) >= 2 && parseInt(s.split('-')[3]) === 0);
console.log('\nPhase 0 (NS Green) and NS Congested, EW Empty:');
phase0_ns_congested.slice(0, 5).forEach(s => console.log(`State ${s}: Keep Green(0)=${qTable[s][0].toFixed(2)}, Switch(1)=${qTable[s][1].toFixed(2)}`));
