# Tower defense (TD-5)

`npm run dev` starts the game; `npm test` runs the Playwright play-through (test/play.mjs). Design: SPEC.md and SPEC-mobile.md.
All art and audio live in `public/assets/` and are wired up through `src/manifest.json`, so you can swap art without touching code.

## Terrain (td-terrain kit)
`manifest.terrain` holds the tile keys and rules. Each map's `terrain` block holds `seed`, `water` cells (they may lie outside the grid), `bridges` (the middle cell of a 3-cell horizontal `bridge_h`) and `fixed` props.
The layers are grass (`hash(x,y,seed)%8`), then seeded overlay patches (about 1 per 6 cells), then the 4-bit path autotile, then the 47-tile blob water (4 fps), then Y-sorted props and decals.
Everything except the water is pre-rendered on layout.

## Animation manifest (td-pack-3)
Animations are data: `manifest.anims` defines sheets, and `manifest.sprites` maps entity states to anims.

```jsonc
"anims": {
  "goblin_walk": {
    "sheet": "a3_goblin_walk",        // image key in manifest.images
    "frameWidth": 100, "frameHeight": 96,
    "frames": 8,                      // columns used per row
    "rows": { "right": 0, "left": 1, "up": 2, "down": 3 },  // direction -> row (up/down fall back to right)
    "row": 0,                         // optional fixed row (tower sheets: row = level-1)
    "fps": 10, "loop": true,
    "anchorPx": [50, 86]              // feet / contact point in frame px (or "anchor": [0.5, 1] as a fraction)
  }
},
"sprites": {
  "enemy.goblin":  { "walk": "goblin_walk", "hit": "goblin_hit", "hitMask": "goblin_hit_mask", "death": "goblin_death" },
  "tower.archer.2": { "idle": "archer_l2_idle", "attack": "archer_l2_attack" },
  "projectile.arrow": { "fly": "projectile_arrow_anim" }
}
```

How the runtime uses them:
- **Enemies.** `walk` loops and picks its row from the facing (R/L/U/D). `hit` plays the 3-frame sheet for 0.12 s after damage; without one, the frame flashes white. `death` plays once on the R/L rows and is aligned by `anchorPx`. Death frames are wider, so the anchor keeps the feet in place. With no death sheet, the sprite fades and shrinks and `fx_death_puff` plays.
- **Towers.** `idle` loops at 6 fps. On fire, `attack` plays once (6 frames at 14 fps), and the projectile spawns on attack frame 1 (after 1/fps s). With no attack sheet, the tower recoils (dip and squash) with a muzzle glow.
- **Projectiles.** `fly` loops and is rotated toward the target. The lightning arc is anchored at its left end (`anchorPx [0,24]`), rotated, and stretched to the target length.
- **Impacts.** Each tower's `fx` (in TW, main.js) names an `impact_*` anim that plays once at the hit point.
- **Fallbacks.** If a state is `null` or missing, it falls back to the procedural version, so a partial pack still runs.

The td-pack-3 sheets come from `/workspace/game-art/td-pack-3/assets.json` and are copied into `public/assets/anim/`. `wolf_rider` and `bat` are not used.

## Audio
`public/assets/audio`: 21 SFX and music files from td-pack-2 (both .ogg and .mp3). The game plays the .ogg files, and the music loops.
`public/assets/sounds`: tower fire SFX 01–10 from td-sounds.

## Kingdom research
Tap the castle or press **K** for the Royal Council. Spend gold on 27 research ranks across Warfare, Treasury and Defense, emergency repairs, and one permanent doctrine per run. The game pauses while you choose. Every generated map reserves a clear castle site, and the camera includes the castle in the visible play area. See [KINGDOM.md](KINGDOM.md) for costs, unlocks, effects and strategy. Run `npm run test:kingdom` for the research and engine checks.


## Kingdom world menu
Explore the kingdom with WASD, arrow keys, or tap-to-walk. Destination buttons walk you to a castle; approach it and choose Defend castle (or press Enter). Willow Keep is Easy (75% enemy HP, 90% speed, 300 gold), Crownwatch is Normal (original balance), and Ironthorn is Hard (140% HP, 112% speed, 225 gold). Each road launches a fresh generated battlefield with the same tower-spot guarantees and Royal Council research.

The Last Gate launches Endless: the first ten waves use the original roster, followed by repeating cycles with 25% more regular enemies per cycle and shorter spawn intervals (floor 0.28 seconds). Trolls return every tenth wave, gain health with progression, and increase in number up to five. There is no victory cutoff; survive until your lives run out. Play again keeps the selected challenge; Kingdom returns to exploration.
