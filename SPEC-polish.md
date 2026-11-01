# SPEC-polish — Bottom panel (sheet bar + landscape rail)

Base: commit `04a31b6`. Scope: `.bbar` and the build slots (`slotBtn`, `src/main.js` ~L487–503, `src/style.css` L92–137, L171–181). Source evidence: `td-feedback/iphone-0305.png` (iPhone, 03:05). It shows a flat plank bar, slots that show only the cost number (70/120/100/90/150), and an empty band of map under the bar where the home indicator sits.

**Maps are randomly generated, using the same grid sizes (15×8 / 8×15).** Nothing here may depend on a fixed map layout or on particular spot positions. The panel is anchored to the viewport and safe area only. The play rect P keeps being computed from `L.barR` as it is today.

## 1. Fixes (root causes)
1. **Flat:** `actionbar_body` is tiled with no edge light, no inner shadow and no cast shadow. Fix: §4.
2. **No icons:** `slotBtn` already appends `<img icon_k>`, but on the phone it doesn't show (it is sized by the 64-px rules and covered by the cost/slot art at 52 px). Fix: icon gets its own well and layer, with cost on a separate plate (§3).
3. **Gap under the panel:** `.bbar{bottom:var(--sb)}` lifts the *whole box*, background included, above the inset. Fix: the panel box goes to `bottom:0`, and `padding-bottom: calc(8px + env(safe-area-inset-bottom))`. The background/9-slice fills the inset, and the controls stay above it. The same applies to the rail on the right (`padding-right` + inset, art bleeds to the screen edge) and to the left side in lefty mode.

## 2. Assets
### 2.1 Existing (verified with `ls`, 03:14 Brussels time)
| Use | Path |
|---|---|
| Tower icons (current, 1024², downscale at build to 96/144 px) | archer `public/assets/weapons/01-arrow-ballista.png` · cannon `02-iron-cannon.png` · mage `08-arcane-orb-tower.png` · frost `04-frost-crystal-spire.png` · tesla `05-tesla-lightning-coil.png` (source `/workspace/td-weapons/`) |
| Gold coin | `game-art/td-pack-2/ui/icon/icon_gold.png`, `icon_gold_96.png` |
| Interim skin | `td-pack-2/ui/mobile/slot_64_{normal,selected,disabled,locked,pressed}{,@2x,@3x}.png`, `slot_48_*`, `button_64_*`, `rail_frame*`, `ui/bar/actionbar_body.png`, `bar_frame.png`, `wave_fill.png` |

Note: **td-pack-2 contains no tower icons.** The brief said to use them from there. The only tower icons on disk are the `td-weapons` set above, which `manifest.json` already uses as `icon_<tower>`.

### 2.2 hud2 — LANDED (TD-9a, now in use)
Copied from `game-art/td-pack-2/ui/hud2/` to `public/assets/ui/hud2/` (PNG at 1x/@2x/@3x, picked by DPR via `uiSrc`). Margins come from `hud2/nine_slice.json` and are copied into `manifest.ui` (`hudPanel`, `hudPanelTop`, `startWave`, `waveFrame`, `waveFill`, `towerSlot`, `towerSlotSel`, `towerIcon`). The JSON wins over the old request table.
| Name | Size @1x | 9-slice (T,R,B,L) | Use |
|---|---|---|---|
| `panel_bottom.png` / `panel_top.png` | 128×150 | 28,28,28,28 | sheet bar + landscape rail, drawn at 0.5 (14 px borders) |
| `button_start_wave_{normal,pressed,disabled}.png` | 120×48 | 18,22,18,22 | Start wave; the label is live text (16 px) |
| `wave_progress_frame.png` / `wave_progress_fill.png` | 160×24 / 48×12 | 10,12,10,12 / 0,6,0,6 | HUD wave progress (touch modes) |
| `tower_slot_{normal,disabled,locked}.png` | 64×64 | — | build-bar slots (`locked` is not used, see §8.1) |
| `tower_slot_selected.png` | 76×76 incl. glow | — | `::before` centred on the 64 px slot |
| `icons/icon_tower_{archer,cannon,frost,mage,tesla}.png` | 48×48 | — | slot icons (40 px portrait / 36 px rail), replacing the td-weapons set in the bar |
There is no `tower_slot_pressed`: pressed = CSS `translate(2px,3px)` + the drop shadow removed (Start wave also uses its `_pressed` art).

## 3. Layout (CSS px)
Panel content height is fixed; the panel grows by `env(safe-area-inset-bottom)`. Values below assume iPhone insets: portrait bottom 34; landscape right 47 (notch is left, home bar is bottom 21).

### Portrait 390×844
| Element | Rect x,y,w,h |
|---|---|
| Panel art | 0,670,390,174: rim lip 670–682, content 682–810, **inset fill 810–844** |
| Cast shadow on map | 0,652–670 (gradient, see §4) |
| Slots ×5 | x = 13+74·i, y 682, **64×64** (gap 10) |
| Icon well / icon | slot +10,+6, 44×44 |
| Cost plate | slot +4,+44, 56×18: coin 16×16 then the number in **16 px** Lilita One, centred as a group |
| Next-wave text | 13,766, 16 px, max 180 w, 2 lines |
| Start wave / progress | 206,754,171,48 (progress frame takes the same rect during a wave) |
| Last control edge | y 802 → 8 px above the inset |

### Landscape 844×390 (side rail, SPEC-mobile §3.2)
| Element | Rect |
|---|---|
| Rail art | 709,0,135,390: content 709–797, **inset fill 797–844**, art bleeds under the home bar to y 390 |
| Cast shadow on map | 691–709, full height |
| Slots ×5 | x 721, y = 8+60·i, **64×56**. Same slot art, scaled vertically to 0.875: icon 40×40, plate 56×16 |
| Cost | inside the plate, 16 px. In landscape the plate overlaps the icon's lower 4 px; that is OK |
| Start wave | 721,308,76,56; bottom edge 364 ≥ 21 px above the screen bottom |
| Lefty mode | mirror: art 0–135, inset fill on the left |

All tap targets ≥ 48×48 (smallest: rail slot 64×56). All text ≥ 16 px. The hotkey digit stays desktop-only.

## 4. Slot states (never colour alone)
| State | Frame | Icon | Cost plate | Extra non-colour cue |
|---|---|---|---|---|
| **Affordable** → `normal` | warm wood + gold rim, raised 3 px bevel | full colour | gold coin + cream number | — (baseline) |
| **Unaffordable** → `disabled` | rim goes iron-grey, bevel flattened to 1 px (looks "sunk") | desaturated 70%, 80% brightness | coin gets a **diagonal slash**, number is replaced by **"Need 30"** (shortfall), 16 px | slot stays tappable (stats/long-press), `aria-disabled="true"` |
| **Selected** | gold rim thickens 2→4 px + outer glow, slot **lifts 4 px** and its shadow grows | full colour, scale 1.06 | unchanged | **chevron ▲ notch** under the slot (portrait) / ◀ beside it (rail), and `aria-pressed="true"` |
| **Locked** (not unlocked yet this run, future use) | dark iron, chains | **silhouette** (black 60%) | plate shows a **padlock** icon + "Wave 4" | not tappable for build; long-press explains |

Priority: locked > selected > disabled > normal. A selected, unaffordable tower keeps the selected lift + chevron **and** the "Need X" plate. This fixes today's code order bug where `locked` hides `sel`.

## 5. Depth & press
Single light source **top-left, 135°**.
- **Panel:** 2 px rim light along the top lip (`#fff3c4` at 60%, fading out to the right). 1 px dark seam under the lip. Inner shadow `inset 0 6px 10px -4px rgba(30,15,5,.55)` so the slots read as sitting *in* a tray.
- **Cast shadow on the map:** 18 px gradient `rgba(20,10,0,.45)→0` above the panel (left of the rail). It is drawn on the DOM, not the canvas, so random maps need nothing.
- **Slot bevel:** 3 px top-left highlight / bottom-right shade baked into the art. A drop shadow `2px 3px 0 rgba(0,0,0,.45)` (offset follows the light). Icon well: inner shadow `inset 2px 2px 4px rgba(0,0,0,.6)`.
- **Pressed (slot + Start):** `translate(2px,3px)`, drop shadow goes to `0 0 0`, inner well shadow deepens. Press-in 60 ms ease-out on `pointerdown`, release 120 ms `cubic-bezier(.3,1.6,.5,1)` (small overshoot). Haptic 10 ms on build select.
- **Reduced motion:** no translate/scale/overshoot. Pressed = instant shadow removal + 1 px darker frame, and selected = rim + chevron without lift or glow pulse.

## 6. Accessibility
- Labels: "Build Archer Tower, 70 gold" / "Archer Tower, need 30 more gold" / "Archer Tower, locked until wave 4". `aria-pressed` for selected.
- Live region when affordability flips: "Cannon now affordable" (throttled to once per 2 s).
- Contrast: cost text ≥ 4.5:1 on the plate. Focus ring 3 px `--focus` outside the bevel (offset 2 px), visible over the gold rim.
- 200% text: the plate number may shrink the coin to 12 px before wrapping. The panel never covers controls with the inset.

## 7. Acceptance
1. iPhone portrait: no map visible below the panel; Start wave bottom ≥ 8 px above the home indicator.
2. Five tower icons are visible at 44 px; cost has a coin on every slot.
3. Unaffordable is distinguishable in greyscale (slash + "Need X").
4. Layout tests (`test/`) assert rects in §3 for 390×844 and 844×390 with insets 0 and 34/47+21, on 3 random seeds.

## 8. Open questions
1. Is "locked" a real mechanic (tower unlock by wave)? Today `locked` is used for "can't afford". This spec splits them.
2. Will Art Lead ship `tower_slot_pressed`, or do we derive it in CSS (§5)?
3. File format and JSON name for hud2 9-slice margins.
4. Tower icons: should the 48 px `hud2/icons/` replace the `td-weapons` 1024² set entirely? (Recommended.)

## 9. Decisions (TD-9a)
1. **Locked: dropped.** No tower unlocks by wave in this game (all 5 are available from wave 1), so `locked` was only ever "can't afford". That state is now `.off` → `tower_slot_disabled`, with a desaturated icon, the cost replaced by "Need N" (the shortfall), and `aria-disabled="true"`. The slot stays tappable. `tower_slot_locked.png` is shipped but unused.
2. Pressed: derived in CSS (no `_pressed` slot art).
3. hud2 margins JSON: `nine_slice.json`, PNG.
4. Tower icons: hud2 48 px icons replace td-weapons in the build bar. Desktop mode keeps its existing skin.
5. Short phones (≤700 px tall): sheet slots are 56×56 so the grid tile stays ≥32 px.
