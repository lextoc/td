# TD

A clean tower-defense foundation: one permanent woodland map, no towers or enemies.

## Run

`npm run dev` serves the game at http://localhost:5173. No dependencies required.
`npm run check` checks JavaScript syntax. `npm run build` creates a static `dist/` directory.

## Layout contract

- The world and its HTML UI share a **1600 × 900 (16:9)** coordinate system.
- The entire view scales uniformly to fit the window. No cropping or responsive rearranging of the map/UI.
- Unused screen space contains a muted, decorative forest. It is outside the playable world.
- Terrain is seeded, generated once, and unchanged by resizing or reloading.
- Map definitions live in `src/maps.js`; additional maps can be added there.
- Artwork is drawn locally with Canvas; no external assets, fonts, or runtime dependencies.

The aspect ratio is an initial default, not a restriction on future design. Change the world dimensions and map/UI together if a different ratio is selected.
