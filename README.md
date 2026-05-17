# Star Shower

Star Shower is a standalone browser game. Collect falling stars, avoid damaging strikes, and manage boost/blight effects while trying to reach level 10.

This repo is intentionally separate from the main portfolio site so the game can be developed, versioned, and published on its own. The portfolio can link to the finished game without owning the game source.

## Gameplay

The player collects stars to gain points and speed. Strikes damage health. Boosts help the player, while blights create temporary hazards.

Goal:

- Reach level 10 to win.
- The win score is `1500`.

Controls:

- Keyboard: `WASD` or arrow keys.
- Pointer/touch: click or touch movement.
- Optional joystick modes are available when joystick support is enabled.

## Progression

Levels are score-based:

```text
Level 1: 0
Level 2: 25
Level 3: 75
Level 4: 150
Level 5: 250
Level 6: 400
Level 7: 600
Level 8: 850
Level 9: 1150
Level 10: 1500
```

Boost/blight unlock schedule:

```text
Level 1: health
Level 2: health + freeze
Level 3: health + magnet + freeze
Level 4: health + magnet + freeze + daze
Level 5: health + magnet + double + freeze + daze
Level 6+: health + magnet + double + freeze + daze + fog
```

Current boost/blight effects:

- Health: increases health.
- Magnet: triples pickup range.
- Double: stars count twice.
- Freeze: freezes player movement.
- Daze: reverses movement.
- Fog: limits visible area.

## Project Structure

```text
index.html
theme.css
star-shower.css
site.js
game.js
state.js
options.js
input.js
draw/
  assets.js
  index.js
entities/
  constants.js
  index.js
images/
  icons/
audio/
```

## Game Files

- `index.html`: standalone page shell.
- `theme.css`: global theme variables, fonts, colors, glow, and page-level layout.
- `star-shower.css`: game canvas sizing, border, responsive fullscreen behavior, and Star Shower-specific layout.
- `site.js`: page helpers and falling background particles outside the game canvas.
- `game.js`: game orchestration, progression rules, canvas theme config, popup state, audio, startup, and win/lose flow.
- `state.js`: shared mutable runtime state and state setters.
- `options.js`: saved options, difficulty values, movement/color options, tunables, and shared layout helpers.
- `input.js`: keyboard, pointer, touch, joystick, menu, and pause input.
- `draw/`: canvas rendering.
- `entities/`: player, stars, strikes, boosts, blights, collision bursts, and entity tuning constants.

### $\textcolor{purple}{Dev \ Notes}$

The project uses native JavaScript modules and has no build step. Keep imports relative and browser-safe.

The current module boundaries are:

- `game.js` answers: what happens next?
- `state.js` answers: what shared values exist right now?
- `options.js` answers: what settings and reusable tunables exist?
- `input.js` answers: how does the player/menu receive input?
- `draw/` answers: what appears on canvas?
- `entities/` answers: what are game objects doing?

Recommended next cleanup areas:

- Split HUD drawing out of `draw/index.js`.
- Split boost/blight logic out of `entities/index.js`.
- Remove compatibility exports once imports are fully direct.
- Future audio placeholders fail quietly so the game stays playable while assets are in progress. At the moment, `audio/music-loop.mp3` may 404 during local preview until a music file is added.

## Deployment

Because the game is static, it can be deployed anywhere that serves plain files, including GitHub Pages.

For GitHub Pages, publish the repo root or copy the static files to the configured Pages branch/folder. Make sure the deployed site includes:

- `index.html`
- CSS files
- JavaScript files and folders
- `images/`
- `audio/` if audio assets are ready
