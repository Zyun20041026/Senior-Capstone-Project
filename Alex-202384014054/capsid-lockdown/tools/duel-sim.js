#!/usr/bin/env node
/*
 * 交锋 simulator: plays many seeded rounds of 守住这团细胞 with reference bots
 * and prints win rate, losses and stars. Node built-ins only.
 *
 *   node tools/duel-sim.js            idle / nearest / careful, 200 seeds each
 *   node tools/duel-sim.js 500 70     500 seeds, bots decide every 70 ticks (default 45 = 0.75 s)
 *
 * idle     never moves the macrophage, never collects, never uses a cloud
 * nearest  always crawls to the nearest particle that is down (or the nearest
 *          shadow), sweeps every light point at once, never uses a cloud
 * careful  nearest, plus a cloud on any particle that has been down for
 *          NOTICE seconds 3+ steps away (the time a person needs to notice it,
 *          turn the ball and aim); run with notice 1 s and 2 s
 *
 * Bots see the whole ball at once and drag instantly; a person does not.
 */
'use strict';
const path = require('path');
const root = path.join(__dirname, '..');
const Boards = require(path.join(root, 'js/boards.js'));
const Duel = require(path.join(root, 'js/duel.js'));

const N = Number(process.argv[2]) || 200;
const LAG = Number(process.argv[3]) || 45;
const board = Boards.build({ shape: 'icosa' });

function run(bot, upgrade, notice) {
  const rows = [];
  for (let seed = 1; seed <= N; seed++) {
    const s = Duel.play({ board, seed }, bot, { lag: LAG, upgrade, notice: notice == null ? undefined : Math.round(notice * Duel.HZ) });
    rows.push({ win: s.phase === 'win', losses: s.losses, stars: s.stars, sec: s.tick / Duel.HZ, wave: s.wave, phase: s.phase });
  }
  const wins = rows.filter((r) => r.win);
  const stars = [0, 0, 0, 0];
  rows.forEach((r) => { stars[r.stars]++; });
  const mean = (a, f) => (a.length ? a.reduce((x, r) => x + f(r), 0) / a.length : 0);
  const lostAt = [0, 0, 0, 0];
  rows.filter((r) => !r.win).forEach((r) => { lostAt[r.wave]++; });
  return {
    bot: bot + (notice != null ? ` ${notice}s` : ''), upgrade: upgrade || '-', win: (wins.length / N * 100).toFixed(0) + '%',
    losses: mean(rows, (r) => r.losses).toFixed(2), secWin: mean(wins, (r) => r.sec).toFixed(0),
    stars: `0★${stars[0]} 1★${stars[1]} 2★${stars[2]} 3★${stars[3]}`, lostInWave: `w1:${lostAt[1]} w2:${lostAt[2]} w3:${lostAt[3]}`,
    stuck: rows.filter((r) => r.phase !== 'win' && r.phase !== 'lose').length,
  };
}

console.log(`seeds ${N}, bot reaction every ${LAG} ticks (${(LAG / Duel.HZ).toFixed(2)} s)`);
const out = [run('idle'), run('nearest', 'speed'), run('nearest', 'cloud'),
  run('careful', 'speed', 1), run('careful', 'cloud', 1), run('careful', 'speed', 2), run('careful', 'cloud', 2)];
console.table(out);
