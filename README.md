# Star Shower

Star Shower is a standalone browser game. Collect falling stars, avoid damaging strikes, and manage boost/blight effects while trying to reach level 10.

This repo is intentionally separate from the main portfolio site so the game can be developed, versioned, and published on its own. The portfolio can link to the finished game without owning the game source.

## Gameplay

The player collects stars to gain points and speed. Strikes cost one life. Boosts help the player, while blights create temporary hazards.

Goal:

- Reach level 10 to win.
- The win score is `200`.
- Health starts at `💚 5/5`.
- Each strike costs `1` life.

Controls:

- Keyboard: `WASD` or arrow keys.
- Pointer/touch: click or touch movement.
- Optional joystick modes are available when joystick support is enabled.

## Progression

Levels are score-based:

```text
Level 1: 0
Level 2: 5
Level 3: 25
Level 4: 50
Level 5: 75
Level 6: 100
Level 7: 125
Level 8: 150
Level 9: 175
Level 10: 200
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

- Health 💚: increases health.
- Magnet 🧲: triples pickup range, with range scaling up on larger screens.
- Double 🌟: stars count twice.
- Freeze 🥶: freezes player movement.
- Daze 😵‍💫: reverses movement.
- Fog 😵: limits visible area.

HUD:

- `🏆 current/10`: current level.
- `⭐ score`: current score.
- `💚 current/5`: current lives.
- Top-center constellation: progress toward the next level.
- Right-side status: pause control plus active boost/blight timers.

Responsive tuning:

- Star, strike, and pickup density scale with canvas area.
- Player speed scales up on larger screens and stays unchanged on small screens.
- Magnet range scales up on larger screens and stays unchanged on small screens.

## Game Files

- `index.html`: standalone page shell.
- `theme.css`: global theme variables, Annotation Mono font fallback, colors, glow, and page-level layout.
- `star-shower.css`: game canvas sizing, border, responsive fullscreen behavior, and Star Shower-specific layout.
- `site.js`: page helpers and falling background particles outside the game canvas.
- `game.js`: game orchestration, progression rules, canvas theme config, popup state, audio, startup, and win/lose flow.
- `state.js`: shared mutable runtime state and state setters.
- `options.js`: saved options, difficulty values, movement options, health/magnet tunables, and shared layout helpers.
- `input.js`: keyboard, pointer, touch, joystick, menu, and pause input.
- `draw/`: canvas rendering.
- `entities/`: player, stars, strikes, boosts, blights, collision bursts, and entity tuning constants.

## Dev Notes

The project uses native JavaScript modules and has no build step. Keep imports relative and browser-safe.

The current module boundaries are:

- `game.js` answers: what happens next?
- `state.js` answers: what shared values exist right now?
- `options.js` answers: what settings and reusable tunables exist?
- `input.js` answers: how does the player/menu receive input?
- `draw/` answers: what appears on canvas?
- `entities/` answers: what are game objects doing?

Commenting style:

- Use file headers to explain ownership: what belongs in the file and what does not.
- Use pseudocode comments before long flow functions, especially update loops, input routing, spawning, collision, and drawing order.
- Comment why the order matters, not what each obvious line does.
- Keep comments current when behavior changes. Stale comments are worse than no comments.

Useful pseudocode template:

```js
// Feature pseudocode:
// 1. Validate whether this state should run.
// 2. Update the smallest state needed for this frame/action.
// 3. Trigger side effects like sounds, popups, or saved options.
// 4. Refresh dependent UI bounds/status so input and drawing stay in sync.
```

Recommended next cleanup areas:

- Split HUD drawing out of `draw/index.js`.
- Split boost/blight logic out of `entities/index.js`.
- Remove compatibility exports once imports are fully direct.
- Future audio placeholders fail quietly so the game stays playable while assets are in progress. At the moment, `audio/music-loop.mp3` may 404 during local preview until a music file is added.
