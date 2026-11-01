export const RESEARCH = [
  { id: 'steel', branch: 'Warfare', name: 'Tempered steel', costs: [45, 80, 125], effect: rank => `+${rank * 8}% tower damage`, description: 'Sharper arrows and stronger spells. Applies to every tower.' },
  { id: 'drill', branch: 'Warfare', name: 'Battle drills', costs: [50, 90, 140], requires: 'steel', effect: rank => `+${rank * 6}% attack speed`, description: 'Crews reload and cast faster.' },
  { id: 'optics', branch: 'Warfare', name: 'Watchtower optics', costs: [40, 75, 115], requires: 'drill', effect: rank => `+${(rank * .15).toFixed(2)} tiles of range`, description: 'Every tower can reach farther down the road.' },
  { id: 'bounty', branch: 'Treasury', name: 'Bounty contracts', costs: [65, 110, 165], effect: rank => `+${rank} gold per kill`, description: 'Earn extra gold for each defeated enemy.' },
  { id: 'stipend', branch: 'Treasury', name: 'Trade caravans', costs: [40, 70, 105], effect: rank => `+${rank * 8} gold per wave cleared`, description: 'Caravans pay only after a wave is defeated. No passive interest.' },
  { id: 'salvage', branch: 'Treasury', name: 'Salvage guild', costs: [35, 65, 95], requires: 'stipend', effect: rank => `${70 + rank * 5}% tower resale value`, description: 'Recover more of the gold actually invested in a tower.' },
  { id: 'masonry', branch: 'Defense', name: 'Reinforced walls', costs: [45, 75, 110], effect: rank => `+${rank * 2} maximum lives`, description: 'Each rank also restores 2 lives immediately.' },
  { id: 'wards', branch: 'Defense', name: 'Gate wards', costs: [45, 80, 120], requires: 'masonry', effect: rank => `${rank} ward charges per wave`, description: 'Each charge absorbs one lost life. Refills at wave start; new ranks grant one charge immediately.' },
  { id: 'alchemy', branch: 'Defense', name: 'Arcane workshop', costs: [45, 80, 120], requires: 'wards', effect: rank => `+${rank * 15}% frost duration, +${rank * 5}% blast radius${rank === 3 ? ', +1 Tesla target' : ''}`, description: 'Improve frost control and cannon blasts. Rank III also adds one Tesla chain target.' }
];
export const DOCTRINES = [
  { id: 'conquest', name: 'Conquest', benefit: '+15% tower damage', drawback: '20% less kill gold', description: 'End battles quickly, but your war machine consumes the spoils.' },
  { id: 'commerce', name: 'Commerce', benefit: '+25% wave-clear gold', drawback: '8% slower tower attacks', description: 'Invest in a richer late game at the cost of immediate firepower.' },
  { id: 'bastion', name: 'Bastion', benefit: '+4 maximum lives, heal 4, +2 wards per wave', drawback: '8% less tower damage', description: 'A forgiving defense for dangerous leaks and the final Troll.' }
];
export const RANK_WAVES = [0, 3, 6];
export const DOCTRINE_COST = 120;
export const REPAIR_COST = 35;
export const newKingdom = () => ({ ranks: {}, doctrine: null, spent: 0, wards: 0, repairs: 0 });
export const rankOf = (state, id) => state.ranks[id] || 0;
export const totalRanks = state => Object.values(state.ranks).reduce((sum, rank) => sum + rank, 0);
export function modifiers(state) {
  const rank = id => rankOf(state, id);
  return {
    damage: (1 + rank('steel') * .08) * (state.doctrine === 'conquest' ? 1.15 : state.doctrine === 'bastion' ? .92 : 1),
    rate: (1 + rank('drill') * .06) * (state.doctrine === 'commerce' ? .92 : 1),
    range: rank('optics') * .15,
    bounty: rank('bounty'), killGold: state.doctrine === 'conquest' ? .8 : 1,
    stipend: rank('stipend') * 8, clearGold: state.doctrine === 'commerce' ? 1.25 : 1,
    refund: .7 + rank('salvage') * .05,
    maxLives: 20 + rank('masonry') * 2 + (state.doctrine === 'bastion' ? 4 : 0),
    wards: rank('wards') + (state.doctrine === 'bastion' ? 2 : 0),
    slowDuration: 1 + rank('alchemy') * .15, splash: 1 + rank('alchemy') * .05,
    chain: rank('alchemy') === 3 ? 1 : 0
  };
}
export function towerStats(base, state) {
  const m = modifiers(state);
  return [base[0], +(base[1] * m.damage).toFixed(2), +(base[2] * m.rate).toFixed(3), +(base[3] + m.range).toFixed(2)];
}
export function researchOffer(state, id, cleared, gold) {
  const item = RESEARCH.find(item => item.id === id);
  if (!item) return { ok: false, reason: 'Unknown research' };
  const rank = rankOf(state, id), cost = item.costs[rank];
  if (rank >= item.costs.length) return { ok: false, reason: 'Fully researched', rank };
  const requiredWave = RANK_WAVES[rank];
  const reason = item.requires && !rankOf(state, item.requires) ? `Requires ${RESEARCH.find(r => r.id === item.requires).name} I`
    : cleared < requiredWave ? `Clear wave ${requiredWave}` : gold < cost ? `Need ${cost - gold} more gold` : '';
  return { ok: !reason, reason, rank, cost, requiredWave };
}
export function buyResearch(state, id, cleared, gold) {
  const offer = researchOffer(state, id, cleared, gold);
  if (!offer.ok) return null;
  const next = { ...state, ranks: { ...state.ranks, [id]: offer.rank + 1 }, spent: state.spent + offer.cost };
  if (id === 'wards') next.wards++;
  return { state: next, gold: gold - offer.cost, heal: id === 'masonry' ? 2 : 0 };
}
export function doctrineOffer(state, cleared, gold) {
  const reason = state.doctrine ? 'Doctrine already chosen' : cleared < 5 ? 'Clear wave 5' : totalRanks(state) < 6 ? 'Install 6 research ranks' : gold < DOCTRINE_COST ? `Need ${DOCTRINE_COST - gold} more gold` : '';
  return { ok: !reason, reason, cost: DOCTRINE_COST };
}
export function chooseDoctrine(state, id, cleared, gold) {
  if (!DOCTRINES.some(d => d.id === id) || !doctrineOffer(state, cleared, gold).ok) return null;
  return { state: { ...state, doctrine: id, spent: state.spent + DOCTRINE_COST, wards: state.wards + (id === 'bastion' ? 2 : 0) }, gold: gold - DOCTRINE_COST, heal: id === 'bastion' ? 4 : 0 };
}
export const killReward = (base, state) => { const m = modifiers(state); return Math.max(1, Math.floor((base + m.bounty) * m.killGold)); };
export const waveReward = (wave, state) => { const m = modifiers(state); return Math.floor((20 + 5 * wave + m.stipend) * m.clearGold); };
export const sellValue = (invested, state) => Math.floor(invested * (70 + rankOf(state, 'salvage') * 5) / 100);
export function absorbLeak(state, lives) {
  const absorbed = Math.min(lives, state.wards);
  return { state: { ...state, wards: state.wards - absorbed }, lost: lives - absorbed, absorbed };
}
export function buyRepair(state, lives, gold) {
  if (gold < REPAIR_COST || lives >= modifiers(state).maxLives) return null;
  return { state: { ...state, spent: state.spent + REPAIR_COST, repairs: state.repairs + 1 }, gold: gold - REPAIR_COST, lives: Math.min(modifiers(state).maxLives, lives + 3) };
}
