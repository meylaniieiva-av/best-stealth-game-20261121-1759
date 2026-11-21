# Shadowline — a top-down stealth game

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/meylaniieiva-av/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/meylaniieiva-av/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

Shadowline is a complete top-down stealth game: sneak past patrolling guards, steal every intel file on the floor, and reach the exit unseen — across three floors with more guards and tighter sightlines on each one. Guards patrol fixed routes with visible vision cones, react to what they see and hear, and give chase when the alarm goes up; shadow floor and a sneak move let a patient player through, and a throwable noisemaker pulls guards away from a route.

## Run it

```sh
node serve.ts
# open http://localhost:8080 in desktop Chrome
```

No build step, no install, no network: `game/` is plain static files, and
`game/index.html` plays offline in a desktop browser.

## How to play

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Shift (hold) | Sneak — slower, quieter, spotted half as fast |
| Click, or Q | Throw a noisemaker at the mouse position |
| Enter | Start, retry a floor, continue to the next floor |

- **Objective:** collect every intel file (walk over it), then reach the green EXIT. The exit stays locked until the last file is stolen.
- **Vision cones:** a guard sees you when you are inside its yellow cone with no wall or crate between you. The detection meter (top right) fills while you are seen — faster up close, faster still while running, slower while sneaking or standing on dark shadow floor — and drains while you are hidden.
- **Alarm:** a full meter raises the alarm and every guard runs at you. Break line of sight for a few seconds and they search your last seen spot, then stand down. A guard that reaches you ends the run.
- **Noisemakers:** you carry 3. A throw makes a clatter every guard in earshot walks over to investigate — useful for clearing a route, but it spends a finite resource.

## Verification (reproduce from zero)

```sh
# 1. Serve the game and open it (desktop Chrome, no network needed)
node serve.ts
# http://localhost:8080

# 2. Play floor 1: steal 3 intel files, reach the exit. The HUD shows
#    Intel 3/3 when the exit unlocks.

# 3. Deterministic scenes (the same frame every time, same seed):
#    http://localhost:8080/index.html?shot=start&seed=1   title screen
#    http://localhost:8080/index.html?shot=play&seed=1    mid-game, floor 1
#    http://localhost:8080/index.html?shot=caught&seed=1  alarm raised

# 4. Headless logic check (Node 22, no browser): drives the real game
#    update with an autopilot and checks every floor can be cleared, a
#    reckless player gets caught, and a noisemaker pulls a guard.
#    (The check script was used during development; the game itself needs
#    only steps 1–3 above.)
```

## Proof of play

`screenshots/` holds three frames rendered by the game's own code in a
browser — never edited, composited, or borrowed:

- `1-start.jpg` — title screen over floor 1: guards, cones, cover, exit.
- `2-play.jpg` — mid-game: the player sneaking with 2 of 3 intel stolen.
- `3-caught.jpg` — the alarm up: red cones, a guard closing in.

## Scope and honest limits

- The game is fully playable and winnable: all three floors were cleared by
  a cautious autopilot driving the real update loop, and a reckless autopilot
  was caught on floor 1 — the stealth is real, not decorative.
- What it is not: there is no save system, no settings menu, and no mobile
  touch controls — keyboard and mouse on desktop is the whole interface.
- Sound is synthesized with the Web Audio API (footsteps, pickup, alarm);
  there are no audio files and no music track.
- Known roughness: guards re-path by walking straight at a target and
  sliding along walls rather than pathfinding around corners, so a chase
  through a cluttered room can look clumsy for a second before the guard
  rounds the corner.

## Recommendations (if this were iterated on)

1. Give chasing guards the same tile pathfinding the screenshot autopilot
   uses, so pursuits route around crates instead of sliding along them.
2. Add a fourth floor that reuses the existing levels with faster patrols,
   for players who clear the three floors without being spotted.
3. Add a quiet "ghost" bonus to the end screen for finishing a floor with
   the alarm never raised.

## Additional information

- Environment: Node.js 22+, desktop Chrome; no dependencies, no network
  requests at runtime. Entry point: `main.ts` (Node 22, standard library
  only) copies `game/` and `screenshots/` to `/output` and writes
  `/output/dossier.json`.
- Layout: `game/src/` is split by job — `config.js` (numbers),
  `levels.js` (the three floors), `guard.js` (patrol/vision/chase),
  `world.js` (state and rules), `render.js` (canvas and HUD),
  `input.js` (keyboard/mouse), `audio.js` (synthesized sound),
  `shots.js` (deterministic screenshot scenes), `main.js` (loop/screens).
- Built: 22 November 2026, for make.fun's "Make the best stealth game"
  bounty (best-stealth-game-20261121-1759, $50 in USDC).

---

<sub>Entered on [make.fun](https://make.fun/?ref=8cx6jc10&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
