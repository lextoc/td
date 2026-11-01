// Average-strategy plan (spot indices are in path order on generated maps) and an in-page runner.
export const plan = [["b", 5, "archer"], ["b", 7, "archer"], ["b", 10, "archer"], ["b", 3, "archer"], ["b", 4, "archer"], ["b", 1, "archer"], ["b", 2, "cannon"], ["b", 11, "archer"], ["u", 5], ["u", 7], ["u", 10], ["u", 3], ["b", 13, "mage"], ["b", 12, "frost"], ["b", 9, "mage"], ["u", 4], ["u", 1], ["u", 2], ["u", 11], ["u", 13], ["u", 9], ["b", 0, "tesla"], ["u", 13], ["u", 9], ["u", 5], ["u", 7], ["u", 10], ["u", 3], ["u", 4], ["u", 1], ["u", 2], ["u", 11], ["b", 6, "cannon"], ["b", 8, "mage"], ["u", 12], ["u", 0], ["u", 6], ["u", 8], ["u", 12], ["u", 0], ["u", 6], ["u", 8]];
export async function runPlan(p) {
  await p.keyboard.press('Enter');
  await p.evaluate((plan) => {
    let i = 0;
    setInterval(() => { const g = td.g; if (!g || g.over || i >= plan.length) return; const [k, s, t] = plan[i]; if (k === 'b' ? g.towers[s] || td.build(s, t) : td.upgrade(s)) i++; }, 50);
    window.waves = [];
    setInterval(() => { const g = td.g; if (g && window.waves.at(-1)?.w !== g.wave) window.waves.push({ w: g.wave, lives: g.lives, gold: g.gold }); }, 20);
  }, plan);
  await p.waitForFunction(() => td.modal, null, { timeout: 300000 });
  return p.evaluate(() => ({ r: td.modal, seed: td.seed, lives: td.g.lives, wave: td.g.wave, kills: td.g.stats.kills, leaks: td.g.leaks, towers: Object.values(td.g.towers).map(t => t.type + t.lv).join(' '), waves: window.waves }));
}
