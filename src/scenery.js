export function findCastle(map, view) {
  const width = 3, height = 3, clearance = .75;
  const blocked = [...map.path, ...map.spots, map.entry, map.exit, ...(map.terrain.water || []),
    ...Object.keys(map.terrain.fixed || {}).map(key => key.split(',').map(Number)),
    ...(map.terrain.bridges || []).flatMap(([c, r]) => [[c - 1, r], [c, r], [c + 1, r]])];
  const candidates = [];
  for (let r = 0; r <= map.rows - height; r++) for (let c = 0; c <= map.cols - width; c++) {
    if (c < view.left || r < view.top || c + width > view.right || r + height > view.bottom) continue;
    if ((map.hudRows || []).some(row => row >= r && row < r + height)) continue;
    if (blocked.some(([x, y]) => x + 1 > c - clearance && x < c + width + clearance && y + 1 > r - clearance && y < r + height + clearance)) continue;
    candidates.push({ c, r, width, height });
  }
  return candidates.length ? candidates[(map.seed >>> 0) % candidates.length] : null;
}
