# TD Terrain: "Storybook Meadow" in-game terrain kit

These tiles are built to match `td-pack-2/logo/title_art.png`. Generated textures and props were made on magenta, cut out with `td-pack/_raw/cut.py` (`key`, `despill`, `killmag`), then given the #2a1a12 outline and a contact shadow. All edges, autotiles and water frames are made procedurally in `_src/` from the generated textures, so the seams line up exactly.

## Grid
- **128 px square cells.** I kept this grid because towers, enemies and fx in td-pack are already sized for it. The map's logical size is `cols x rows` cells. You render it at native size and scale the whole canvas with one uniform factor (see "Any aspect ratio").
- All tiles are 128x128. Path and water tiles are **RGBA overlays** and always draw on top of the grass layer. Grass shows through their soft edges, which keeps the blending continuous across tile borders.

## Layer order (back to front)
1. `grass_base`: one of `tiles/grass/grass_0..7.png` for every cell, including path and water cells.
2. `grass_overlays`: `overlay_patch_0..3.png` (256 px, soft alpha). Place them freely at about 1 per 6 cells to break up repetition. They are drawn before path and water, so those layers cover them.
3. `path`: the 4-bit autotile.
4. `water`: the 47-tile autotile, animated at 4 frames and 4 fps.
5. `ground_decals`: lily pads and any decals that lie flat on the ground.
6. `props`: sort by anchor y (bottom-centre) and draw back to front together with towers, enemies and the bridge.

## Variant randomisation
- Grass variant = `hash(x, y, seed) % 8`, using the hash in `_src/build.py`. Any uniform hash works. All 8 variants share the same border strip, so any variant can sit next to any other. Only the interiors differ.
- Overlays use a seeded RNG for position and patch index.
- Decals (tufts, flowers, small rocks) get random jitter inside cells. `_src/demo.py:props_for` shows the rules.

## Path autotile (4-bit)
`mask = N*1 + E*2 + S*4 + W*8`, where a neighbour counts if it is a path, bridge, spawn or exit cell.
| mask | tile | mask | tile |
|---|---|---|---|
| 0 | isolated | 5 / 10 | straight_v / straight_h |
| 1,2,4,8 | end caps n/e/s/w | 3,6,12,9 | corners ne/es/sw/nw |
| 7,11,14,13 | T-junctions nes/new/esw/nsw | 15 | cross |
- **Start/exit pieces:** mark a path cell on the map border as `S` (spawn) or `X` (exit). Its off-map neighbour then counts as path, so the road runs cleanly off the screen edge. If a spawn or exit sits inside the map, use the end-cap tile plus a signpost. A separate gate or cave sprite is not included.

## Water autotile (47-tile blob, 8-bit)
Bits: `N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128`. A neighbour counts if it is water or bridge, **or off the map**, so lakes can run off the edge. Drop a diagonal bit unless both of its cardinal neighbours are set. That leaves 47 canonical masks. `assets.json -> water.mask_to_tile` lists all 256 to 47 mappings. Files are named `tiles/water/water_<mask>_f<frame>.png`, with frames 0 to 3 at **4 fps**, looping. The set covers straight shores, outer corners, inner corners, channels and single-cell ponds. The shoreline is an earthy bank lip with stones and a dark outline, and the shallows are lighter.

## Props
`props/*.png` are transparent, with the #2a1a12 outline and a baked soft contact shadow. `assets.json` gives each prop's `size` and `anchor` (the bottom-centre contact point). Draw at `(px - ax, py - ay)`.
Trees: oak_big (2 cells tall), oak, pine, pine_small, birch. Also bush_big and bush_small; rock_big, rock_medium and rock_small; flowers, grass_tuft, mushrooms, stump, fence, signpost, barrel, lily_pad (water only) and bridge_h.
- **Bridge:** `bridge_h` spans 3 water cells along a horizontal path row. Mark those cells `=`: water for the water autotile, path for the path autotile and pathing. Anchor it at (centre x of the middle cell, row_top + 127). There is **no vertical bridge**, so design path crossings to run horizontally.

## Path and buildable rules
- Enemies walk only on cells marked path, bridge, spawn or exit.
- **Buildable** = grass cell with no blocking prop. Trees, bushes, rocks (medium and big), stump, fence, barrel and signpost block a cell. Tufts, flowers and rock_small are decoration only and must not block building.
- Water is never buildable.
- Leave the grass cells next to the path free of blocking props so there are good tower spots. The demo scatter rule only puts decals there.

## Any aspect ratio (responsive)
- Write maps in cells, and give each one a portrait layout (for example 8x15) and a landscape layout (for example 15x8). You can also use one layout and transpose its path, but horizontal bridges limit this.
- `scale = min(viewportW / (cols*128), viewportH / (rows*128))`. Render the map at native size and draw it scaled by `scale`. Fill the letterbox with extra grass and decor cells: the tiles have no fixed size and every tile is seamless, so you can add margin rows or columns on any side.
- On phones the scale is usually 0.4 to 0.6. The art reads well at that size, but downscale with linear or mipmapped filtering, not nearest-neighbour.

## Files
`tiles/grass` (8 tiles + 4 overlays), `tiles/path` (16), `tiles/water` (47x4), `props` (19), `assets.json`, `contact_sheet.png`, `demo_portrait_8x15.png/.gif`, `demo_landscape_15x8.png/.gif`, `_tests/` (tiling tests + `seam_report.json`), `_src/` (`tiles.py`, `props.py`, `build.py` (map renderer), `demo.py`, `check.py`, `sheet.py`, `raw/` generations).
Rebuild with `cd _src && python3 tiles.py && python3 props.py && python3 demo.py && python3 sheet.py && python3 check.py`.
