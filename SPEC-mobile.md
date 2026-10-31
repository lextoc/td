# TD — Mobile & Adaptive Layout Spec (v1, extends SPEC.md)

Goal: the map fills every viewport. No letterbox and no empty bands. Three Kingsroad variants on the 128 px tile grid. Recommended approach: **one canvas fills the whole viewport, the grid is fitted to the safe play area, and everything outside the grid is drawn as edge-fill decor tiles.** HUD and menus are DOM overlays in CSS px.

Data and checks: `td-game/mobile-tools/maps.py` (variants, checks, tile and decor derivation), `mobile-tools/render.py` (wireframes), `mobile-tools/checks.txt` (last run). All UI paths are under `UI/` = `game-art/td-ui-v4/2x/`, and pack paths are under `game-art/td-pack/`. All were checked with `ls`.

## 1. Map variants
Coordinates are (col,row) from the top-left. Enemies enter from off-map west and leak off-map east. In every variant the first and last rows are decor-only, because the HUD bars sit over them. Corner logic is the same as SPEC.md §2: each path tile opens toward its previous and next tile (the spawn tile toward W, the exit tile toward E). `{E,W}`→`dirt_path_straight_h`, `{N,S}`→`straight_v`, `{S,W}`→`corner_sw`, `{N,E}`→`corner_ne`, `{N,W}`→`corner_nw`, `{S,E}`→`corner_se` (pixel-verified in SPEC.md). Every path in this spec has westward legs, so enemies use the `enemies/*_left.png` sprites while moving W.

**Landscape correction:** the shipped SPEC.md path is really **23** tiles, not 25. Its spots (13,2) and (6,2) also touch no path tile. The landscape variant below refines the map: the exit leg gains a dip to row 5 (25 tiles), and the spots move to (12,4) and (6,6).

### Decor fill plan (all variants, every non-path, non-spot tile)
- Ground: `tiles/grass_{(c*7+r*3) mod 3 + 1}.png`. This also applies to edge-fill tiles, which can have negative coordinates (use a positive modulo).
- Overlay (bottom-centre anchored, scaled by tile/128): `CYC[(c*5+r*3) mod 10]` with CYC = `tree_1, bush_1, –, rock_1, flowers, tree_2, –, bush_2, rock_2, tree_3` (`decor/*.png`).
- Low-decor rule: if a tile is 8-adjacent to a path tile or a spot, swap trees for low decor (`tree_1`→`flowers`, `tree_2`→`bush_1`, `tree_3`→`bush_2`). This keeps tall art from covering the road or spots, and keeps taps unambiguous.
- Fixed tiles: `decor/signpost.png` above the spawn and `decor/fence.png` beside the exit (positions in the tables).
- **Edge fill** (outside the grid, under insets and HUD): grass as above, plus `EDGE[(c*5+r*3) mod 6]` = `tree_1, tree_3, bush_2, tree_2, rock_3, –`. This makes a dense forest frame. Dim it 25% so it reads as out of play. It is never interactive.
- Legend for the maps below: `#` path, `O` spot, `T` tree_1, `Y` tree_2, `A` tree_3, `b` bush_1, `B` bush_2, `r` rock_1, `R` rock_2, `K` rock_3, `f` flowers, `S` signpost, `F` fence, `.` grass only.

### Variant data (script output, verbatim)
```
== portrait 8x15
path (0,2) (1,2) (2,2) (3,2) (4,2) (5,2) (5,3) (5,4) (5,5) (4,5) (3,5) (2,5) (1,5) (1,6) (1,7) (1,8) (2,8) (3,8) (4,8) (5,8) (5,9) (5,10) (5,11) (6,11) (7,11)
   (0,2) (1,2) (2,2) (3,2) (4,2) -> dirt_path_straight_h
   (5,2) -> dirt_path_corner_sw
   (5,3) (5,4) -> dirt_path_straight_v
   (5,5) -> dirt_path_corner_nw
   (4,5) (3,5) (2,5) -> dirt_path_straight_h
   (1,5) -> dirt_path_corner_se
   (1,6) (1,7) -> dirt_path_straight_v
   (1,8) -> dirt_path_corner_ne
   (2,8) (3,8) (4,8) -> dirt_path_straight_h
   (5,8) -> dirt_path_corner_sw
   (5,9) (5,10) -> dirt_path_straight_v
   (5,11) -> dirt_path_corner_ne
   (6,11) (7,11) -> dirt_path_straight_h
spots (1,3) (4,3) (6,3) (3,4) (0,6) (2,6) (4,6) (3,7) (0,9) (3,9) (6,9) (4,10) (4,12) (6,12)
  T Y T Y T Y T Y
  S R r R r R r R
  # # # # # # . b
  B O B f O # O f
  . B . O . # . B
  b # # # # # b T
  O # O r O r R r
  b # b O b . b .
  f # # # # # f B
  O . B O B # O .
  f b f b O # f b
  r R r R r # # #
  . b . b O b O F
  A f A f B f B f
  . B . B . B . B
== landscape 15x8
path (0,2) (1,2) (2,2) (3,2) (4,2) (4,3) (4,4) (4,5) (5,5) (6,5) (7,5) (8,5) (8,4) (8,3) (8,2) (9,2) (10,2) (11,2) (11,3) (11,4) (11,5) (12,5) (13,5) (13,4) (14,4)
   (0,2) (1,2) (2,2) (3,2) -> dirt_path_straight_h
   (4,2) -> dirt_path_corner_sw
   (4,3) (4,4) -> dirt_path_straight_v
   (4,5) -> dirt_path_corner_ne
   (5,5) (6,5) (7,5) -> dirt_path_straight_h
   (8,5) -> dirt_path_corner_nw
   (8,4) (8,3) -> dirt_path_straight_v
   (8,2) -> dirt_path_corner_se
   (9,2) (10,2) -> dirt_path_straight_h
   (11,2) -> dirt_path_corner_sw
   (11,3) (11,4) -> dirt_path_straight_v
   (11,5) -> dirt_path_corner_ne
   (12,5) -> dirt_path_straight_h
   (13,5) -> dirt_path_corner_nw
   (13,4) -> dirt_path_corner_se
   (14,4) -> dirt_path_straight_h
spots (2,1) (2,3) (3,4) (5,3) (6,4) (6,6) (7,6) (9,4) (9,6) (10,1) (10,3) (12,3) (12,4) (12,6)
  T b f b T Y T Y T b f b T Y T
  S R O R r R r R r R O R r R r
  # # # # # b . b # # # # . b .
  B f O f # O B f # f O # O f B
  . B . O # B O B # O . # O # #
  Y T b f # # # # # f b # # # F
  R r R r R r O O R O R r O r R
  b . b . b . b . b . b . b . b
== square 11x11
path (0,2) (1,2) (2,2) (3,2) (3,3) (3,4) (3,5) (3,6) (3,7) (4,7) (5,7) (6,7) (6,6) (6,5) (6,4) (6,3) (7,3) (8,3) (8,4) (8,5) (8,6) (8,7) (8,8) (9,8) (10,8)
   (0,2) (1,2) (2,2) -> dirt_path_straight_h
   (3,2) -> dirt_path_corner_sw
   (3,3) (3,4) (3,5) (3,6) -> dirt_path_straight_v
   (3,7) -> dirt_path_corner_ne
   (4,7) (5,7) -> dirt_path_straight_h
   (6,7) -> dirt_path_corner_nw
   (6,6) (6,5) (6,4) -> dirt_path_straight_v
   (6,3) -> dirt_path_corner_se
   (7,3) -> dirt_path_straight_h
   (8,3) -> dirt_path_corner_sw
   (8,4) (8,5) (8,6) (8,7) -> dirt_path_straight_v
   (8,8) -> dirt_path_corner_ne
   (9,8) (10,8) -> dirt_path_straight_h
spots (2,1) (5,2) (9,2) (4,3) (2,4) (4,5) (5,5) (7,5) (9,5) (2,7) (9,7) (5,8) (7,8) (9,9)
  T b f b T Y T Y T Y T
  S R O R r R r R r R r
  # # # # . O . b . O .
  B f B # O f # # # f B
  . B O # . B # B # B .
  Y f b # O O # O # O b
  R r R # R r # r # r R
  b . O # # # # . # O b
  f B f B f O f O # # #
  B . B . B . B . B O F
  T Y T Y T Y T Y f b f
```
Checks (`python3 td-game/mobile-tools/maps.py`): **37/37 PASS** (12 per variant: contiguity, length 23–27, no repeats, bounds, no path on HUD rows, spawn/exit on edges, exactly 14 unique spots, spots in bounds, spots off path, spots 8-adjacent to path, path assets exist, decor assets exist). Lengths: portrait 25, landscape 25, square 25.

## 2. Variant selection and scaling
`a = innerWidth / innerHeight` (layout viewport, CSS px).
- `a < 0.8` → **portrait** 8×15 (phones upright, iPad upright at 0.69–0.75)
- `0.8 ≤ a ≤ 1.25` → **square** 11×11 (split view, foldables, square windows)
- `a > 1.25` → **landscape** 15×8 (phones sideways, tablets sideways, desktop)
- Hysteresis: switch only when `a` crosses a threshold by more than 0.03, so resizes near a threshold don't flip the variant back and forth. On a variant switch mid-run, pause the game and keep towers by **spot index** (the 14 spots are index-matched across variants). Enemies keep their **path progress fraction** (i/len), and all three paths are 25 tiles.

Play area P = the viewport minus the safe-area insets (`env(safe-area-inset-*)`), minus any HUD that must not cover playable tiles (the landscape right rail, 88 px). The top and bottom bars do not shrink P, because they sit over the decor-only first and last rows.

```
s      = min(P.w / cols, P.h / rows)          // CSS px per tile, contain-fit
s      = clamp(s, 40, 128)                     // never below 40, never upscale art past 1:1 at DPR1
s_dev  = floor(s * devicePixelRatio)            // integer device px per tile, no seams
origin = P.xy + (P.wh - grid*s) / 2            // centred in P
```
Then draw tiles for every (c,r) in `floor(-origin/s) … ceil((viewport-origin)/s)`. Cells outside 0..cols-1 × 0..rows-1 are **edge fill** (§1). The canvas always covers 100% of the viewport, including behind the notch and the home indicator, so no letterbox colour is ever visible. If s hits 40 (viewports under about 320 px), the grid exceeds P: allow one-finger pan, clamped to the grid bounds. If s hits 128 (big monitors), the extra space becomes more forest.

Hit targets: a build spot or tower is hit-tested as a **56 CSS px circle around the tile centre**, and the nearest centre wins. That gives at least 48 px targets even at s = 44 (landscape phone).

Reference results: 390×844 (insets T47 B34) → s = 48.75, origin (0, 63). 844×390 (insets L47 R47 B21) → s = 44.13, origin (47, 8). 1024×1024 → s = 93.1, origin (0, 0). 1920×1080 → s = 128 (same as SPEC.md). Gameplay units (range, speed) stay in tiles, so the variants play the same.

## 3. Mobile HUD and menus
Global: tap targets ≥ 48×48 CSS px with ≥ 8 px gaps; body text ≥ 16 px, numbers 18 px bold, titles 28 px (system stack from SPEC.md). Colours and contrast are as in SPEC.md. HUD containers pad by `env(safe-area-inset-*)`, and the bar art extends under the inset. Pixel art scales by integer device multiples only: at DPR 3, 32 CSS = 96 dev (icons 64 → 1.5×; use 48 CSS on DPR 2 and 32 CSS on DPR 3, so the art always lands on whole device pixels).

Square viewports use the **portrait layout**, with every size multiplied by `k = clamp(s/48.75, 1, 1.5)`. Desktop (`a > 1.25` and width ≥ 1280) keeps the SPEC.md layout scaled by s/128.

### 3.1 Portrait @ 390×844 (wireframe-portrait.png)
| Element | Rect x,y,w,h (CSS) | Asset |
|---|---|---|
| Top bar | 0,47,390,64 (art extends to y 0) | `UI/hud/hud_body.png` tiled, `hud_cap_left/right.png` at 0.5× |
| Gold | icon 8,63,32,32; "250" at 44,66 | `UI/icon/icon_gold.png` |
| Lives | icon 96,63; "20" at 132,66 | `UI/icon/icon_heart.png` |
| Wave | icon 176,63; "3/10" at 212,66 | `UI/icon/icon_wave.png` (portrait drops the 280 px `hud_center` crest) |
| Speed | 282,55,48,48 | `UI/button/button_*.png`, "1×" |
| Pause | 334,55,48,48 | `UI/button/button_*.png`, "II" (Mute moves into Pause) |
| Bottom bar | 0,746,390,98 (content 746–810, inset below) | `UI/bar/actionbar_body.png` tiled (portrait omits the dragon ends) |
| Next-wave text | 12,766, 16 px | "Next: 8 Goblins" |
| Start wave | 206,754,176,48 | `UI/button/button_*.png`, "Start wave (12)" |
| During a wave | replaces Start wave: 206,766,176,24 | `UI/bar/bar_frame.png` + `wave_fill.png`, plus `UI/icon/icon_skull.png` 32 px at 166,762 with the count |
| **Bottom sheet** | 0,480,390,364 (content ends at 810) | `UI/panel/panel_dark_*.png` 9-slice; a 40×4 drag handle at 175,488 (drawn) |
| Sheet title | 16,500, 20 px | "Build here" / "Archer Tower — Lv 1" |
| Tower cards ×5 | x = 15+74·i, y 536, 64×64 | `UI/slot/slot_normal/selected/locked.png`; icon 40 px from `td-weapons/0X-*.png`; cost 16 px below the card at y 604 |
| Detail line | 16,632,358, 16 px (2 lines) | "Damage 12 · Rate 1.25/s · Range 2.5" |
| Upgrade view | avatar 16,536,64,64 | `td-avatars/0X-*.png`; name and stats beside it at x 92 |
| Cancel / Sell | 16,746,171,56 | `UI/button/button_*.png` |
| Build / Upgrade | 203,746,171,56 | `UI/button/button_*.png`, "Build 70" / "Upgrade 60" |

### 3.2 Landscape @ 844×390 (wireframe-landscape.png)
| Element | Rect | Asset |
|---|---|---|
| Top bar | 47,0,662,52 | `UI/hud/hud_body.png` tiled, caps at 0.5× |
| Gold / Lives / Enemies | icons at 55 / 151 / 247, y 10, 32 px; numbers at +36 | `icon_gold`, `icon_heart`, `icon_skull` |
| Wave crest | 308,0,140,96 | `UI/hud/hud_center.png` 0.5×, "Wave 3/10" 16 px (it covers only decor in row 1) |
| Wave progress | 464,14,128,24 | `UI/bar/bar_frame.png` + `wave_fill.png` at 0.5× |
| Speed / Pause | 600,2,48,48 / 652,2,48,48 | `UI/button/button_*.png` |
| **Right rail** (thumb) | 709,0,88,369 (art extends to 844,390) | `UI/panel/panel_dark_*.png` 9-slice |
| Idle: next-wave text | 717,16,72, 16 px, 3 lines | "Next / 8 / Goblins" |
| Idle: Start wave | 721,308,76,56 | `UI/button/button_*.png`, "Start" (countdown under it, 16 px) |
| Build: slots ×5 | 725, y = 8+60·i, 56×56 | `UI/slot/slot_*.png` plus a `td-weapons` icon; cost overlaid at bottom-right, 16 px with outline |
| Build: confirm | 721,308,76,56 | `UI/button/button_*.png`, "Build" |
| Upgrade: avatar / Upgrade / Sell | 725,8,56,56 / 721,188,76,56 / 721,248,76,56 | `td-avatars/…`, `UI/button/button_*.png` |
| Detail card | 497,236,204,125; flips to 55,236 if the selected tile is in cols ≥ 10 | `UI/panel/panel_dark_*.png`; name, stats (16 px), Cancel button 12,65,180,48 inside the card |
| Left-handed option | Settings: "Controls on left" mirrors the rail to x 47 and shifts P right | — |

### 3.3 Tap-to-select → confirm (no hover)
1. Tap an empty spot. The spot shows `UI/overlay/place_valid.png` (128 px scaled to s), and the sheet or rail opens in Build mode with nothing selected. In portrait, if the spot's centre is below the sheet top minus s, the map pans up (240 ms ease, instant with reduced motion) so the spot sits one tile above the sheet. Edge fill covers the revealed area.
2. Tap a tower card. A ghost of the Lv1 sprite (50% alpha) and `UI/overlay/range_circle.png` appear on the spot, the detail line updates, and the confirm button reads "Build 70". Tapping the same card again also confirms. A card you can't afford shows `slot_locked` and "Need 70"; it stays tappable so you can still read its stats.
3. Tap Build → the tower is placed. The sheet closes and gives haptic feedback (`navigator.vibrate(10)` where supported).
4. Tap a built tower → Upgrade view (range circle shown). Upgrade is a single tap. Sell is a single tap followed by a toast "Sold for 49" with an **Undo** button (48 px, 3 s). Undo is safer than a confirm dialog.
5. Dismiss: tap empty map, Cancel, swipe the sheet down, or the Android back gesture (`popstate`). Long-press (500 ms) on a tower or card shows its full stats as a tooltip, which replaces hover.
6. Pinch-zoom is disabled on the canvas (`touch-action: none`), but browser zoom on the DOM UI is allowed.

### 3.4 Screens
- **Title:** full-bleed `mock_game.png`, cover-fit (crop, never letterbox) with a 40% overlay. Panel `UI/panel/panel_*` width `min(560, safeW − 32)`, centred. Ribbon `UI/banner/ribbon_left/body/right.png` across the panel top. Four buttons, full panel width minus 48 and 56 tall, stacked with 12 px gaps. The loading bar is `UI/bar/bar_frame.png` + `progress_fill.png` at panel width.
- **Wave start:** the ribbon (height 56, width `min(720, safeW − 32)`) sits 16 px below the top bar, with 20 px text. Toasts appear just above the bottom bar (portrait) or above the detail-card position (landscape), 16 px text.
- **Pause:** a 60% dim layer with the `panel_dark` modal `min(400, safeW − 32)` wide and centred. Buttons Resume / Restart / Sound / Motion / Quit, each 56 tall. In landscape, if the panel would be taller than safeH − 32, use two columns.
- **Win/Lose:** the same modal at `min(800, safeW − 32)` with the ribbon on top. Stats wrap to one per line under 600 px wide. The buttons are stacked full-width in portrait and side by side in landscape.
- Pause on `visibilitychange`, on orientation change, and on variant switch.

### 3.5 Accessibility
- Every control is a real `<button>` with an `aria-label` ("Pause", "Game speed 1x", "Build Archer Tower, 70 gold"). The canvas has `role="application"` with a live region that announces "Spot 5 selected", "Wave 3 started", and "Lives 14".
- Keyboard and switch control: the SPEC.md map focus mode still applies. Spots and towers are also exposed as an offscreen list of buttons in path order, so VoiceOver can swipe through them.
- Never rely on colour alone: `place_invalid` shows its ✕, and locked cards show "Need X". Contrast is ≥ 4.5:1 for all text. Numbers drawn over the map get a 2 px outline.
- Respect `prefers-reduced-motion` (no pan easing, no slide-ins) and the OS text size: the DOM UI uses `rem`, and the sheet scrolls internally if 200% text overflows it. Minimum targets do not shrink with zoom.
- Lefty mode (rail on the left) is in Settings. Auto-pause when the sheet is open is a Settings option, default **off** (on with reduced motion).

## 4. Wireframes
`td-game/wireframe-portrait.png` (390×844 @2x), `wireframe-landscape.png` (844×390 @2x), and `wireframe-square.png` (1024×1024 @1x), rendered by `mobile-tools/render.py` from the real tiles, decor, and UI art. They show the path numbered 1–25, spots (blue boxes), SPAWN (green) and EXIT (red), the grid outline, edge fill (dimmed), safe-area insets (pink), the HUD bars, and the sheet or detail-card outline (yellow).

## 5. Missing assets (no invented paths)
1. Icons for pause, play, speed, mute, close and undo (text glyphs on `button_*` are used for now).
2. A bottom-sheet drag handle and a sheet-specific top edge (`panel_dark` 9-slice is used for now).
3. A vertical rail frame: `actionbar_*` is horizontal-only, so the rail uses `panel_dark`.
4. A small-size slot/button set for 48–64 CSS targets. The 2x kit only lands on integer device pixels at specific DPRs, and `1x/` slots are 48 px.
5. A compact HUD crest (`hud_center` at 280×192 is too large for portrait).
6. A long-press/tooltip bubble. Haptic and UI sounds are also still missing (see SPEC.md §9).

## 6. Open questions
1. Is it OK to fix SPEC.md (path 23→25, spots (13,2)/(6,2) → (12,4)/(6,6)) so desktop and mobile share the landscape data?
2. Should a mid-run rotation be allowed (with spot-index mapping), or should the variant lock for the whole run? I recommend allowing it, since it is cheap given the index-matched spots.
3. In the landscape phone variant, s = 44 is below 48; the 56 px hit circle covers this. Should rows 0 and 7 be dropped on short screens (giving s ≈ 49) instead?
