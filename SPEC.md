# TD — Game Spec (v1)

Browser-only (HTML5 Canvas + DOM overlay for UI text/focus), no backend. Saves only settings + best result in `localStorage`. All asset paths are relative to `/workspace/` and were verified with `ls`.

**Look:** `game-art/td-pack/mock_game.png` (painted, Kingdom-Rush style). Frame chrome comes from the pixel-art UI kit `game-art/td-ui-v4/2x/` (always the 2x set, nearest-neighbour, never smoothed).

**Base resolution:** 1920×1080 logical px. Scale uniformly to fit the window (letterbox `#141019`). All px below are logical.

**Pack facts:** tile 128×128 (`assets.json` `tileSize: 128`). Towers 128×160, anchor bottom-centre (0.5, 1.0). Enemies face right, and `*_left.png` mirrors exist. FX are 4 frames of 128×128 (strip 512×128, frames at x = 0/128/256/384), played at 12 fps.

Wireframe: `td-game/wireframe-map.png`

---

## 1. Screens

Global UI rules:
- Font: one bold sans (system stack `"Trebuchet MS", Verdana, sans-serif`). No font asset exists (see Missing assets).
- Sizes: body 22 px, labels 18 px minimum, numbers 28 px, titles 56 px.
- Text colour: `#f2deb0` on dark panels (`#221a2b`), contrast ≈ 13:1. Dark text `#2a1a12` on parchment panels (`#d8b27a`), ≈ 9:1. Numbers over the map get a 2 px `#1a1016` outline.
- Buttons: 9-slice `button_*.png` with 2x margins of 36 px left/right and 22 px top/bottom. Minimum size 144×56. States: normal / hover / pressed / disabled. Keyboard focus = hover art plus a 3 px `#fff1a8` outline offset 2 px. Never rely on hover alone.
- Panels: 9-slice with a 48 px margin (2x). Use `panel_*` (parchment) for the title screen and `panel_dark_*` for everything in-game.
- Reduced motion: if `prefers-reduced-motion` is set or the Settings toggle is on, turn off screen shake, banner slide-ins, and coin-pop FX. Fades become instant, and FX play only their peak frame for 150 ms.
- Mute: `M` everywhere, plus the HUD mute button. State persists in `localStorage` (key `td.muted`). Default volume is 70%. Audio starts only after the first user gesture, per browser autoplay policy.

### 1.1 Title screen
| Element | Rect (x,y,w,h) | Asset |
|---|---|---|
| Background | 0,0,1920,1080 | `game-art/td-pack/mock_game.png` with a 40% `#141019` overlay |
| Panel | 640,240,640,600 | `panel_*` 9-slice |
| Title ribbon | 600,180,720,80 | `ribbon_left/body/right` 3-slice |
| Play button | 816,420,288,72 | `button_*` |
| How to play button | 816,512,288,72 | `button_*` |
| Sound toggle button | 816,604,288,72 | `button_*` |
| Reduced motion toggle | 816,696,288,72 | `button_*` |
| Footer text | 640,780,640,40 | text |

Copy:
- Ribbon: **TD**
- Buttons: **Play**, **How to play**, **Sound: On** / **Sound: Off**, **Motion: Full** / **Motion: Reduced**
- Footer: "Hold the road. 10 waves. 20 lives."

How to play opens a `panel_dark` modal (560,200,800,680). Copy: "Click a build spot, pick a tower, and stop enemies before they reach the exit. Each leaked enemy costs lives. Earn gold from kills and wave clears. Upgrade or sell a tower by clicking it." Button: **Got it** (Esc closes).

States:
- **Loading:** the buttons are replaced by `bar_frame` drawn at 704,500,512,96 (2x art scaled ×2, nearest-neighbour) holding `progress_fill`, with the text "Loading… 42%". Play stays disabled until 100%.
- **Error:** if any asset fails, show "Some game files didn't load. Check your connection and try again." with a **Retry** button, which re-fetches only the failed files.
- **Empty:** not applicable.

Focus order: Play → How to play → Sound → Motion. Play is autofocused. Enter activates the focused button.

### 1.2 Map / game screen
- Map: 15×8 tiles = 1920×1024 at origin (0,0). Rows 0 and 7 sit under the UI chrome, carry decor only, and are never buildable or on the path.
- Strip 0,1024,1920,56: solid `#141019` behind the build bar.
- Layering, bottom to top: tiles → decor → build spots → towers and enemies (y-sorted by anchor) → projectiles → FX → HP bars → range/placement overlays → HUD → panels → modals.
- Enemy HP bar: 48×6 px, 8 px above the sprite top. Track `#1a1016`, fill `#7ccf4a`, and `#d23a3a` once HP drops below 30%. Hidden at full HP.

### 1.3 HUD (top bar, always visible in game)
| Element | Rect | Asset / copy |
|---|---|---|
| Left cap | 0,0,96,104 | `hud_cap_left.png` |
| Bar body (tiled) | 96,0,1728,80 | `hud_body.png` |
| Right cap | 1824,0,96,104 | `hud_cap_right.png` |
| Gold | icon 112,8,64,64; number 184,20 | `icon_gold.png`, "250" |
| Lives | icon 312,8; number 384,20 | `icon_heart.png`, "20" |
| Enemies left | icon 512,8; number 584,20 | `icon_skull.png`, "0" |
| Crest | 820,0,280,192 | `hud_center.png`, centred text "Wave 3/10" (28 px) at y 70, `icon_wave.png` 64×64 at 928,8 |
| Wave progress | 1180,16,256,48 | `bar_frame.png` + `wave_fill.png` (window 176×16 at +40,+16), draining as enemies die or leak |
| Pause | 1456,12,112,56 | `button_*`, label "II" / "▶" |
| Speed | 1576,12,112,56 | `button_*`, label "1×" / "2×" |
| Mute | 1696,12,112,56 | `button_*`, label "♪" / "♪̸" |

Every HUD button has an `aria-label`: "Pause", "Game speed 1x", "Mute sound".

When gold changes, the number tweens over 300 ms (instant with reduced motion). When a life is lost, the heart flashes `#d23a3a` for 200 ms. Below 5 lives, the lives number turns `#ff7a6a`.

### 1.4 Build bar (bottom) and build/upgrade panel
**Build bar:**

| Element | Rect | Asset |
|---|---|---|
| Body (3-slice) | 440,968,1040,112 | `actionbar_body.png` with a 32 px end margin |
| Dragon end, left | 240,780,220,300 | `actionbar_end_left.png` |
| Dragon end, right | 1460,780,220,300 | `actionbar_end_right.png` |
| Tower slots ×5 | x = 480 + 112·i, y 976, 96×96 | `slot_normal` / `slot_selected` / `slot_locked` (the locked slot means not enough gold) |
| Slot icon | slot +16,+16, 64×64 | weapon PNG (§3), downscaled |
| Hotkey label | slot +6,+4 | "1"–"5", 18 px |
| Cost label | slot right-aligned, +72 y | "70", 18 px, `#f0c34a` with outline |
| Start wave button | 1240,992,192,64 | `button_*`, text "Start wave" |

Next-wave preview text sits to the left of the button at 1072,1000 (18 px), for example "Next: 6 Orcs, 6 Goblins".

**Build flow:**
1. Click an empty build spot, or select a slot first and then click a spot.
2. A radial panel opens. Use `panel_dark_*` 9-slice, 600×136, centred above the spot and clamped to x 16..1904, y 96..952. It holds the 5 slots plus a tooltip line.
3. Valid spots show `place_valid.png` scaled to 128×128. Invalid spots show `place_invalid.png`.
4. Hovering or focusing a tower shows its range with `range_circle.png`, scaled so the diameter = 2 × range × 128 px.

**Upgrade panel** (click a built tower): `panel_dark_*` 360×300, placed 16 px right of the tower, or on the left if the tower is in col ≥ 11. Clamp y to 96..952.

| Element | Rect within the panel |
|---|---|
| Avatar | 24,24,96,96 (§3) |
| Name and level | 136,28, 28 px: "Archer Tower — Lv 1" |
| Stats | 136,64, 18 px: "Damage 12 · Rate 1.25/s · Range 2.5" |
| Next-level line | 24,136: "Next: Damage 18 · Rate 1.4/s · Range 2.75" (`#7ccf4a` for increases) |
| Upgrade button | 24,216,150,56: "Upgrade 60" |
| Sell button | 186,216,150,56: "Sell 49" |

States:
- Upgrade is disabled with the label "Need 60" when gold is short.
- At max level, Upgrade shows the disabled "Max level".
- Sell is a single click (no confirm), because it's undoable for 3 s: a toast says "Sold for 49. Press Z to undo".

Focus order: Upgrade → Sell → Close (Esc).

### 1.5 Wave start
- On wave start, a ribbon 3-slice (600,400,720,80) slides down from y -80 over 300 ms, holds 1.5 s, then fades out over 300 ms. With reduced motion it shows and hides instantly. The text is 32 px, for example "Wave 3 — Goblins & Orcs".
- Between waves, the Start wave button shows a 12 s countdown ("Start wave (12)"). The wave auto-starts at 0.
- Calling a wave early pays +1 gold for each second remaining (toast "+7 early bonus").
- When a wave is cleared, a toast appears under the crest at 760,200 for 2 s: "Wave cleared! +35 gold".

### 1.6 Pause overlay
A full-screen `#141019` overlay at 60% opacity, with a `panel_dark` box at 760,340,400,400. Title "Paused". Buttons: **Resume**, **Restart**, **Quit to title**. Restart and Quit ask "Lose this run?" with **Yes** and **No**, and **No** is focused by default.

### 1.7 Win / Lose
A `panel_dark` modal at 560,240,800,600 over a 60% dim overlay. It has a ribbon at 600,200,720,80.

| | Win | Lose |
|---|---|---|
| Ribbon | "Victory!" | "Defeat" |
| Body | "The road holds. Lives left: 14 / 20" | "The enemy broke through on wave 7." |
| Stats | "Enemies defeated: 182 · Gold earned: 1,640 · Time: 9:12" | same |
| Buttons | **Play again**, **Title** | **Retry**, **Title** |

The best result is stored in `td.best` as `{wave, lives}`. Focus goes to the first button. Sound: no stinger asset exists, so the screen is silent (see Missing assets).

**Accessibility (all screens):**
- Tab order runs left to right and top to bottom as listed above. Every interactive element is a real `<button>` in the DOM overlay.
- Map focus mode: press `Tab` into the map, then arrow keys move a focus ring between build spots and towers in path order. `Enter` opens the panel.
- Colour is never the only signal. Invalid placement also shows the ✕ in `place_invalid`, and a disabled cost also shows "Need X".
- The game auto-pauses on `visibilitychange`.

---

## 2. Map: "Kingsroad"
- Grid: 15 cols × 8 rows of 128 px tiles. Coordinates are (col,row) with origin top-left.
- Spawn: (0,2), with enemies entering from x = -64. Exit: (14,4), where an enemy leaks at x = 1920+64.
- Path (25 tiles, in order). The tile asset for each entry is in brackets.
  1. (0,2) (1,2) (2,2) (3,2) [`dirt_path_straight_h`]
  2. (4,2) [`dirt_path_corner_sw`]
  3. (4,3) (4,4) [`dirt_path_straight_v`]
  4. (4,5) [`dirt_path_corner_ne`]
  5. (5,5) (6,5) (7,5) [`dirt_path_straight_h`]
  6. (8,5) [`dirt_path_corner_nw`]
  7. (8,4) (8,3) [`dirt_path_straight_v`]
  8. (8,2) [`dirt_path_corner_se`]
  9. (9,2) (10,2) [`dirt_path_straight_h`]
  10. (11,2) [`dirt_path_corner_sw`]
  11. (11,3) [`dirt_path_straight_v`]
  12. (11,4) [`dirt_path_corner_ne`]
  13. (12,4) (13,4) (14,4) [`dirt_path_straight_h`]
- Corner names were verified by pixel test: `corner_sw` opens W+S, `corner_ne` opens N+E, `corner_nw` opens N+W, `corner_se` opens S+E.
- Enemies walk tile-centre to tile-centre and use the `_left` sprite only while moving west. This path never moves west, so the `_left` sprites are unused on this map.
- Buildable rule: towers go **only** on these 14 fixed build spots, drawn with `towers/build_spot.png`: (2,1) (2,3) (3,4) (5,3) (6,2) (6,4) (7,6) (9,4) (9,6) (10,1) (10,3) (12,3) (12,5) (13,2). One tower per spot. Path, water, decor, and rows 0 and 7 are never buildable.
- Ground: every other tile uses `grass_1/2/3`, picked by `(col*7+row*3)%3`.
- Water: (0..3, 6..7) uses `tiles/water.png`. Edge tiles are skipped because the pack has no outer-corner water edge (see Missing assets).
- Decor (bottom-centre anchor, pixel x,y):

| Decor | Positions |
|---|---|
| `decor/signpost.png` | 60,250 |
| `decor/tree_1.png` | 64,180; 1500,190 |
| `decor/tree_3.png` | 1790,250 |
| `decor/tree_2.png` | 1840,700 |
| `decor/bush_1.png` | 900,700 |
| `decor/rock_3.png` | 1700,840 |
| `decor/flowers.png` | 760,190 |
| `decor/fence.png` | 1600,640 |
| `decor/bush_2.png` | 560,880 |

All decor is placed off the path and off build spots.
- All tile paths are prefixed `game-art/td-pack/tiles/` plus `.png`.

## 3. Towers (5)
Target selection: the enemy furthest along the path within range. Range is measured centre to centre in tiles. "Lv2 / Lv3" costs are the upgrade price for that step.

| Tower | Sprites Lv1–3 | Icon (`td-weapons/`) | Fire sound | Projectile / hit FX | Avatar |
|---|---|---|---|---|---|
| Archer | `tower_archer_l1..l3` | `01-arrow-ballista.png` | `td-sounds/01-arrow-ballista.ogg` | `projectile_arrow` / none | `td-avatars/01-archer.png` |
| Cannon | `tower_cannon_l1..l3` | `02-iron-cannon.png` | `td-sounds/02-iron-cannon.ogg` | `projectile_cannonball` / `fx_explosion` | `td-avatars/05-cannoneer.png` |
| Mage | `tower_mage_l1..l3` | `08-arcane-orb-tower.png` | `td-sounds/08-arcane-orb.ogg` | `projectile_magic_bolt` / `fx_magic_burst` | `td-avatars/03-fire-mage.png` |
| Frost | `tower_frost_l1..l3` | `04-frost-crystal-spire.png` | `td-sounds/04-frost-crystal.ogg` | `projectile_frost_shard` / `fx_frost_hit` | `td-avatars/04-frost-mage.png` |
| Tesla | `tower_tesla_l1..l3` | `05-tesla-lightning-coil.png` | `td-sounds/05-tesla-coil.ogg` | `projectile_lightning_arc` / `fx_lightning_hit` | `td-avatars/09-lightning-golem.png` |

Path prefixes:
- Sprites: `game-art/td-pack/towers/…png`
- Projectiles: `game-art/td-pack/projectiles/…png`
- FX: `game-art/td-pack/fx/<name>_strip.png`

**Hit sounds do not exist.** Every weapon has only one sound (0.65–1.2 s). v1 plays the fire sound on fire and no hit sound. `.wav` twins exist, but ship `.ogg` only.

The table below is cumulative per level. Cost = build cost (Lv1) or upgrade cost (Lv2/Lv3).

| Tower | Lv | Cost | Dmg | Rate/s | Range | Special | DPS |
|---|---|---|---|---|---|---|---|
| Archer | 1 | 70 | 12 | 1.25 | 2.5 | — | 15 |
| | 2 | 60 | 18 | 1.4 | 2.75 | — | 25 |
| | 3 | 90 | 26 | 1.6 | 3.0 | — | 42 |
| Cannon | 1 | 120 | 30 | 0.5 | 2.25 | splash r 0.75 tile, full dmg | 15 |
| | 2 | 90 | 45 | 0.55 | 2.5 | splash r 0.85 | 25 |
| | 3 | 130 | 65 | 0.6 | 2.75 | splash r 1.0 | 39 |
| Mage | 1 | 100 | 28 | 0.8 | 2.5 | — | 22 |
| | 2 | 80 | 42 | 0.8 | 2.75 | — | 34 |
| | 3 | 120 | 60 | 0.9 | 3.0 | — | 54 |
| Frost | 1 | 90 | 6 | 1.0 | 2.0 | slow 35% for 1.5 s | 6 |
| | 2 | 70 | 9 | 1.0 | 2.25 | slow 45% for 1.5 s | 9 |
| | 3 | 100 | 12 | 1.2 | 2.5 | slow 55% for 2 s | 14 |
| Tesla | 1 | 150 | 16 | 0.9 | 2.0 | chains to 3 targets (−20% per jump) | 14+ |
| | 2 | 110 | 24 | 1.0 | 2.25 | chain 4 | 24+ |
| | 3 | 150 | 34 | 1.1 | 2.5 | chain 5 | 37+ |

Slows don't stack: the strongest one wins and its timer refreshes. Projectile speed is 8 tiles/s, and the tesla arc is instant (drawn for 120 ms).

## 4. Enemies (3)
| Enemy | HP (wave 1 base) | Speed (tiles/s) | Gold | Lives on leak | Sprite (`game-art/td-pack/enemies/`) | Death FX | Sound |
|---|---|---|---|---|---|---|---|
| Goblin | 40 | 1.6 | 4 | 1 | `enemy_goblin.png` / `enemy_goblin_left.png` | `fx/fx_death_puff_strip.png` + `fx/fx_coin_pop_strip.png` | **none (missing)** |
| Orc | 110 | 1.0 | 8 | 1 | `enemy_orc.png` / `enemy_orc_left.png` | same | **none** |
| Knight | 300 | 0.7 | 15 | 2 | `enemy_knight.png` / `enemy_knight_left.png` | same | **none** |

- HP scaling: HP × (1 + 0.08 × (wave − 1)), rounded down.
- `td-avatars/02-knight.png` is a hero portrait, not an enemy, so enemies use pack sprites only.

## 5. Waves
Waves spawn in the order listed. Groups within a wave run back to back.

| # | Composition (in order) | Count | Spawn interval | Delay after previous clear | Total HP | Kill gold |
|---|---|---|---|---|---|---|
| 1 | Goblin ×8 | 8 | 1.2 s | 15 s (first build phase) | 320 | 32 |
| 2 | Goblin ×12 | 12 | 1.0 s | 12 s | 516 | 48 |
| 3 | Orc ×6, Goblin ×6 | 12 | 1.2 s | 12 s | 1,038 | 72 |
| 4 | Orc ×10 | 10 | 1.0 s | 12 s | 1,360 | 80 |
| 5 | Goblin ×15, Knight ×4 | 19 | 0.8 s | 12 s | 2,364 | 120 |
| 6 | Orc ×12, Goblin ×6 | 18 | 0.9 s | 12 s | 2,184 | 120 |
| 7 | Knight ×6, Orc ×10 | 16 | 1.1 s | 12 s | 4,284 | 170 |
| 8 | Goblin ×25 (rush) | 25 | 0.5 s | 12 s | 1,550 | 100 |
| 9 | Knight ×10, Orc ×10 | 20 | 1.0 s | 12 s | 6,720 | 230 |
| 10 | Knight ×12, Orc ×15, Goblin ×20 | 47 | 0.7 s | 12 s | 10,387 | 380 |

## 6. Economy
| Setting | Value |
|---|---|
| Starting gold | 250 |
| Starting lives | 20 |
| Sell refund | 70% of total invested (build + upgrades), or 100% within 3 s of the undo window |
| Wave-clear bonus | 20 + 5 × wave (25 … 70) |
| Early-call bonus | +1 gold per countdown second left |

Sanity check:
- Gold available before each wave: 250, 307, 385, 492, 612, 777, 947, 1,172, 1,332, 1,627. A full clear ends at about 2,077 gold.
- Wave 1: 250 buys 3 archers (45 DPS). Eight 40-HP goblins at 1.6 t/s spend about 3 s inside each 2.5-tile radius, so 2 archers already clear it.
- Wave 10: 1,627 gold builds about 7 Lv3 towers (≈ 300 DPS combined, more with splash and chain). Over ≈ 70 s of wave time that is ≈ 21k potential damage against 10.4k HP. That is beatable but needs frost plus good coverage.
- A full max-out of all 14 spots (≈ 4,000 g) is not affordable, so choices matter.

## 7. Controls
| Action | Mouse | Keyboard |
|---|---|---|
| Select tower to build | click slot | `1` Archer, `2` Cannon, `3` Mage, `4` Frost, `5` Tesla |
| Place | click build spot | arrow keys move the spot focus, then `Enter` |
| Select a built tower | click tower | arrow keys, then `Enter` |
| Upgrade selected | Upgrade button | `U` |
| Sell selected | Sell button | `S` (`Z` undoes within 3 s) |
| Start wave / call early | Start wave button | `Space` |
| Pause / resume | Pause button | `P` |
| Speed 1× ↔ 2× | Speed button | `F` |
| Mute | Mute button | `M` |
| Cancel / close / deselect | right-click | `Esc`. Press it again with nothing open to open Pause |

Hotkeys are shown in tooltips, for example "Archer Tower (1)". They are ignored while a modal has focus, except `Esc`.

## 8. Asset table (UI)
`UI/` = `game-art/td-ui-v4/2x/`.

| UI element | Path |
|---|---|
| Parchment panel (title, how-to) | `UI/panel/panel_tl.png`, `panel_t.png`, `panel_tr.png`, `panel_l.png`, `panel_c.png`, `panel_r.png`, `panel_bl.png`, `panel_b.png`, `panel_br.png` |
| Dark panel (upgrade, build radial, pause, win/lose, how-to) | `UI/panel/panel_dark_tl.png`, `panel_dark_t.png`, `panel_dark_tr.png`, `panel_dark_l.png`, `panel_dark_c.png`, `panel_dark_r.png`, `panel_dark_bl.png`, `panel_dark_b.png`, `panel_dark_br.png` |
| Buttons (all) | `UI/button/button_normal.png`, `button_hover.png`, `button_pressed.png`, `button_disabled.png` |
| Title / wave / win / lose ribbon | `UI/banner/ribbon_left.png`, `ribbon_body.png`, `ribbon_right.png` |
| HUD bar | `UI/hud/hud_cap_left.png`, `hud_body.png`, `hud_cap_right.png`, `hud_center.png` |
| Gold / lives / enemies / wave icons | `UI/icon/icon_gold.png`, `icon_heart.png`, `icon_skull.png`, `icon_wave.png` |
| Loading bar | `UI/bar/bar_frame.png` + `UI/bar/progress_fill.png` |
| Wave progress | `UI/bar/bar_frame.png` + `UI/bar/wave_fill.png` |
| Build bar | `UI/bar/actionbar_body.png`, `actionbar_end_left.png`, `actionbar_end_right.png` |
| Tower slots | `UI/slot/slot_normal.png`, `slot_selected.png`, `slot_locked.png` |
| Placement / range overlays | `UI/overlay/place_valid.png`, `place_invalid.png`, `range_circle.png` |
| Tower slot icons | `td-weapons/01-arrow-ballista.png`, `02-iron-cannon.png`, `08-arcane-orb-tower.png`, `04-frost-crystal-spire.png`, `05-tesla-lightning-coil.png` |
| Upgrade-panel portraits | `td-avatars/01-archer.png`, `05-cannoneer.png`, `03-fire-mage.png`, `04-frost-mage.png`, `09-lightning-golem.png` |
| Build spot | `game-art/td-pack/towers/build_spot.png` |
| Title background | `game-art/td-pack/mock_game.png` |
| Enemy HP bar | drawn rectangles (no asset; `UI/bar/health_fill.png` is too wide at 176 px) |

Unused this version: `mana_fill`, `health_fill`, `*_sheet.png`, `1x/`, troll boss, bat, wolf rider, `td-textures-small/` (32/64 px pixel tiles that clash with the 128 px painted pack), and weapons/sounds 03, 06, 07, 09, 10.

## 9. Missing assets (flagged, no invented paths)
1. **Hit / impact sounds.** Only one sound per weapon exists, so v1 plays no hit sounds.
2. **Enemy sounds** (spawn, death, leak). v1 is silent.
3. **UI sounds** (click, build, upgrade, sell, wave start, life lost, coin) and **win/lose stingers and music**. v1 is silent.
4. **HUD icons for pause, play, speed, and mute.** v1 uses text glyphs on `button_*`.
5. **Font.** v1 uses the system font stack.
6. **Water corner-edge tiles.** Only straight edges `grass_water_edge_n/e/s/w` exist, so v1 uses plain `water.png`.
7. **Logo / title art.** v1 shows the text "TD" on the ribbon.
8. **Mage avatar.** There is no arcane mage portrait. v1 uses `03-fire-mage.png`, which does not quite match the purple tower.

## 10. Open questions
1. The style clash is real. The UI kit is hand-pixel art (and its brief references `td-textures-small`), while the td-pack world is painted. I recommend keeping the kit at 2x for chrome only, but confirm the mix is acceptable, or a painted UI pass is needed.
2. Should the boss (`enemy_troll_boss`) be added as a wave-10 finale? It is skipped to keep the enemy count at 3.
