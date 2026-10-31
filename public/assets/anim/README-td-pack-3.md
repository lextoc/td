# td-pack-3: animated sprite sheets

Animated versions of the static td-pack sprites. The style follows td-pack/BRIEF.md. All motion is built **procedurally from the existing td-pack art**, so the identity, scale and palette match exactly. The only new generated art is one front-view and one back-view key frame per enemy (`_raw/<enemy>_fb.jpg`). Each was made with GenerateImage on magenta with the td-pack sprite as the reference image, then cut with td-pack/_raw/cut.py and scaled to the side sprite's height. You can rebuild everything with `python3 _src/cut_views.py && python3 _src/build.py && python3 _src/qa_and_previews.py`.

## Format
- Each sheet is one grid PNG with uniform cells. Frames run row-major, left to right, and each row is one direction or level (see `rowNames`).
- `anchor` is normalised within the cell; `anchorPx` is the same point in pixels. Enemies and towers are anchored at the bottom centre (the feet or base on the ground). Projectiles and impacts are anchored at the centre, except the lightning arc, which is anchored at its left-middle origin; stretch it along x to the target.
- **Enemy walk:** rows are right, left, up (back view), down (front view), with 8 frames each. Left is an exact mirror of right. A soft contact shadow is baked into each cell.
- **Enemy hit:** 3 frames per direction (85%, 40% and 0% white plus a knock-back squash). `*_hit_mask.png` holds pure-white silhouettes in the same cells, for a shader or additive flash.
- **Enemy death:** 8 frames in two rows (right, left). Play it once and hold the empty last frame. The death cells are wider than the walk cells because the body topples. Align them with `anchorPx`.
- **Tower idle:** 4 frames looping, in rows l1, l2 and l3, at 128×160 bottom-centre, identical to the static sprite's footprint. **Tower attack:** 6 frames. Spawn the projectile on frame 1.
- **Projectiles:** they face right; rotate them to the velocity.
- **Impacts:** one per tower type, 7–8 frames, 128×128.
- Previews: `contact_sheet.png` and `previews/*.gif`. The QA numbers are in `_src/qa_report.txt`.

## Sheets
| path | cell | cols×rows | frames | rows | anchor | fps | loop | how made |
|---|---|---|---|---|---|---|---|---|
| enemies/goblin_walk.png | 100×96 | 8×4 | 32 | right, left, up, down | 0.500,0.896 | 10 | True | procedural puppet (leg shear/lift, body bob+sway, squash) from key frames; right=td-pack side sprite, left=mirror, up/down=generated turnaround key frames |
| enemies/goblin_hit.png | 100×96 | 3×4 | 12 | right, left, up, down | 0.500,0.896 | 20 | False | procedural: white tint 85%/40%/0% + knock-back squash |
| enemies/goblin_hit_mask.png | 100×96 | 3×4 | 12 | right, left, up, down | 0.500,0.896 | 20 | False | procedural: pure-white silhouette matching hit frames (use additively or as shader mask; frame 0 mask also fits idle/walk pose 0) |
| enemies/goblin_death.png | 198×102 | 8×2 | 16 | right, left | 0.500,0.882 | 12 | False | procedural: white flash, squash, topple 85deg about feet, darken+fade, painted dust puffs (use right row for right/up, left row for left/down) |
| enemies/orc_walk.png | 128×124 | 8×4 | 32 | right, left, up, down | 0.500,0.919 | 10 | True | procedural puppet (leg shear/lift, body bob+sway, squash) from key frames; right=td-pack side sprite, left=mirror, up/down=generated turnaround key frames |
| enemies/orc_hit.png | 128×124 | 3×4 | 12 | right, left, up, down | 0.500,0.919 | 20 | False | procedural: white tint 85%/40%/0% + knock-back squash |
| enemies/orc_hit_mask.png | 128×124 | 3×4 | 12 | right, left, up, down | 0.500,0.919 | 20 | False | procedural: pure-white silhouette matching hit frames (use additively or as shader mask; frame 0 mask also fits idle/walk pose 0) |
| enemies/orc_death.png | 268×130 | 8×2 | 16 | right, left | 0.500,0.908 | 12 | False | procedural: white flash, squash, topple 85deg about feet, darken+fade, painted dust puffs (use right row for right/up, left row for left/down) |
| enemies/knight_walk.png | 114×124 | 8×4 | 32 | right, left, up, down | 0.500,0.919 | 10 | True | procedural puppet (leg shear/lift, body bob+sway, squash) from key frames; right=td-pack side sprite, left=mirror, up/down=generated turnaround key frames |
| enemies/knight_hit.png | 114×124 | 3×4 | 12 | right, left, up, down | 0.500,0.919 | 20 | False | procedural: white tint 85%/40%/0% + knock-back squash |
| enemies/knight_hit_mask.png | 114×124 | 3×4 | 12 | right, left, up, down | 0.500,0.919 | 20 | False | procedural: pure-white silhouette matching hit frames (use additively or as shader mask; frame 0 mask also fits idle/walk pose 0) |
| enemies/knight_death.png | 258×130 | 8×2 | 16 | right, left | 0.500,0.908 | 12 | False | procedural: white flash, squash, topple 85deg about feet, darken+fade, painted dust puffs (use right row for right/up, left row for left/down) |
| enemies/troll_boss_walk.png | 224×216 | 8×4 | 32 | right, left, up, down | 0.500,0.954 | 8 | True | procedural puppet (leg shear/lift, body bob+sway, squash) from key frames; right=td-pack side sprite, left=mirror, up/down=generated turnaround key frames |
| enemies/troll_boss_hit.png | 224×216 | 3×4 | 12 | right, left, up, down | 0.500,0.954 | 20 | False | procedural: white tint 85%/40%/0% + knock-back squash |
| enemies/troll_boss_hit_mask.png | 224×216 | 3×4 | 12 | right, left, up, down | 0.500,0.954 | 20 | False | procedural: pure-white silhouette matching hit frames (use additively or as shader mask; frame 0 mask also fits idle/walk pose 0) |
| enemies/troll_boss_death.png | 496×222 | 8×2 | 16 | right, left | 0.500,0.946 | 12 | False | procedural: white flash, squash, topple 85deg about feet, darken+fade, painted dust puffs (use right row for right/up, left row for left/down) |
| enemies/wolf_rider_walk.png | 150×148 | 8×4 | 32 | right, left, up, down | 0.500,0.932 | 10 | True | procedural puppet (leg shear/lift, body bob+sway, squash) from key frames; right=td-pack side sprite, left=mirror, up/down=generated turnaround key frames |
| enemies/wolf_rider_hit.png | 150×148 | 3×4 | 12 | right, left, up, down | 0.500,0.932 | 20 | False | procedural: white tint 85%/40%/0% + knock-back squash |
| enemies/wolf_rider_hit_mask.png | 150×148 | 3×4 | 12 | right, left, up, down | 0.500,0.932 | 20 | False | procedural: pure-white silhouette matching hit frames (use additively or as shader mask; frame 0 mask also fits idle/walk pose 0) |
| enemies/wolf_rider_death.png | 330×154 | 8×2 | 16 | right, left | 0.500,0.922 | 12 | False | procedural: white flash, squash, topple 85deg about feet, darken+fade, painted dust puffs (use right row for right/up, left row for left/down) |
| enemies/bat_walk.png | 134×104 | 8×4 | 32 | right, left, up, down | 0.500,0.904 | 10 | True | procedural wing-flap squash + bob from key frames |
| enemies/bat_hit.png | 134×104 | 3×4 | 12 | right, left, up, down | 0.500,0.904 | 20 | False | procedural: white tint 85%/40%/0% + knock-back squash |
| enemies/bat_hit_mask.png | 134×104 | 3×4 | 12 | right, left, up, down | 0.500,0.904 | 20 | False | procedural: pure-white silhouette matching hit frames (use additively or as shader mask; frame 0 mask also fits idle/walk pose 0) |
| enemies/bat_death.png | 194×90 | 8×2 | 16 | right, left | 0.500,0.867 | 12 | False | procedural: white flash, squash, topple 85deg about feet, darken+fade, painted dust puffs (use right row for right/up, left row for left/down) |
| towers/tower_archer_idle.png | 128×160 | 4×3 | 12 | l1, l2, l3 | 0.500,1.000 | 6 | True | procedural: 1px sine ripple on red flag/pennant pixels |
| towers/tower_archer_attack.png | 128×160 | 6×3 | 18 | l1, l2, l3 | 0.500,1.000 | 14 | False | procedural: squash/stretch recoil anchored at bottom-centre + painted fx (bow whoosh lines); fire projectile on frame 1 |
| towers/tower_cannon_idle.png | 128×160 | 4×3 | 12 | l1, l2, l3 | 0.500,1.000 | 6 | True | procedural: gold-trim glint pulse + small sparkles |
| towers/tower_cannon_attack.png | 128×160 | 6×3 | 18 | l1, l2, l3 | 0.500,1.000 | 14 | False | procedural: squash/stretch recoil anchored at bottom-centre + painted fx (muzzle flash + smoke); fire projectile on frame 1 |
| towers/tower_mage_idle.png | 128×160 | 4×3 | 12 | l1, l2, l3 | 0.500,1.000 | 6 | True | procedural: purple crystal glow pulse + sparkles |
| towers/tower_mage_attack.png | 128×160 | 6×3 | 18 | l1, l2, l3 | 0.500,1.000 | 14 | False | procedural: squash/stretch recoil anchored at bottom-centre + painted fx (orb flare); fire projectile on frame 1 |
| towers/tower_frost_idle.png | 128×160 | 4×3 | 12 | l1, l2, l3 | 0.500,1.000 | 6 | True | procedural: ice-crystal glow pulse + sparkles |
| towers/tower_frost_attack.png | 128×160 | 6×3 | 18 | l1, l2, l3 | 0.500,1.000 | 14 | False | procedural: squash/stretch recoil anchored at bottom-centre + painted fx (ice flare); fire projectile on frame 1 |
| towers/tower_tesla_idle.png | 128×160 | 4×3 | 12 | l1, l2, l3 | 0.500,1.000 | 6 | True | procedural: coil-orb glow pulse + sparkles + crackle bolt |
| towers/tower_tesla_attack.png | 128×160 | 6×3 | 18 | l1, l2, l3 | 0.500,1.000 | 14 | False | procedural: squash/stretch recoil anchored at bottom-centre + painted fx (discharge bolts); fire projectile on frame 1 |
| projectiles/projectile_arrow_anim.png | 80×32 | 4×1 | 4 | main | 0.800,0.500 | 12 | True | procedural: 2deg wobble + speed lines; rotate whole sprite to velocity; faces right (0 rad) |
| projectiles/projectile_cannonball_anim.png | 40×40 | 8×1 | 8 | main | 0.500,0.500 | 16 | True | procedural: texture rotated 45deg/frame with the top-left highlight held fixed; faces right (0 rad) |
| projectiles/projectile_magic_bolt_anim.png | 80×60 | 6×1 | 6 | main | 0.500,0.500 | 12 | True | procedural: scale pulse 0.94-1.04 + glow + trailing sparkles; faces right (0 rad) |
| projectiles/projectile_frost_shard_anim.png | 80×48 | 4×1 | 4 | main | 0.500,0.500 | 12 | True | procedural: shimmer glow + frost sparkle trail; faces right (0 rad) |
| projectiles/projectile_lightning_arc_anim.png | 96×48 | 4×1 | 4 | main | 0.000,0.500 | 24 | True | procedural: re-drawn jagged bolt each frame in the base arc palette (#2a1a12 outline, #ffd23f, white core); stretch horizontally to target distance; faces right (0 rad) |
| fx/impact_cannon.png | 128×128 | 8×1 | 8 | main | 0.500,0.500 | 16 | False | extended td-pack fx_explosion (4 generated frames) to 8: procedural pre-flash, scaled in-betweens, fade-out tail |
| fx/impact_mage.png | 128×128 | 8×1 | 8 | main | 0.500,0.500 | 16 | False | extended td-pack fx_magic_burst (4 generated frames) to 8: procedural pre-flash, scaled in-betweens, fade-out tail |
| fx/impact_frost.png | 128×128 | 8×1 | 8 | main | 0.500,0.500 | 16 | False | extended td-pack fx_frost_hit (4 generated frames) to 8: procedural pre-flash, scaled in-betweens, fade-out tail |
| fx/impact_tesla.png | 128×128 | 8×1 | 8 | main | 0.500,0.500 | 16 | False | extended td-pack fx_lightning_hit (4 generated frames) to 8: procedural pre-flash, scaled in-betweens, fade-out tail |
| fx/impact_archer.png | 128×128 | 7×1 | 7 | main | 0.500,0.500 | 16 | False | procedural: tinted td-pack death_puff dust (scaled 55%) + painted wood splinters + hit pip |

## Known limitations
- The walk cycles are puppet animation: the legs shear or lift and the body bobs and sways. They are not hand-drawn stride poses, so they read as a lively waddle rather than full leg articulation. On the side views, anything below the hip line (for example the knight's shield tip and the lower half of the wolf) shears along with the legs.
- The up and down key frames were generated and checked by eye against the side sprite. Small detail differences remain: the goblin's hood is redder and the orc's shoulder pad sits on the other side. The bat's "front" view is closer to a 3/4 view.
- The mage purple and magic glow trip a naive magenta detector. That is the intended #b77cff magic colour, not key fringe. There is 0 magenta fringe in all other sheets.
