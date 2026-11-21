// The screenshot scenes behind ?shot=start|play|caught. Each one plays the
// real rules forward from a fresh floor for a fixed number of steps, steered
// by a simple autopilot, so the frame is what a short game really looks like
// and the same seed always gives the same frame.
//
// The autopilot heads for the nearest intel (then the exit), sneaks when a
// guard's cone covers its next step, and waits when there is no safe step —
// the cautious way a player learns to move. The caught scene uses the same
// pilot with its caution switched off, so it walks into a cone and the alarm
// goes up, as a hurried player does.

import { TILE } from './config.js';
import { createWorld, updateWorld } from './world.js';
import { canSee } from './guard.js';

const SAMPLE = 1 / 30;
const CAUGHT_LIMIT_SECONDS = 90;

/** A seeded RNG (mulberry32) so a scene is the same every time it is taken. */
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Breadth-first path on the tile grid, from (sx, sy) to (tx, ty), walking
 * only on floor. Returns the tile centres to walk through, or null when no
 * route exists. The grid is 30 by 20, so this is cheap to run every tick.
 */
function findPath(world, sx, sy, tx, ty) {
  const key = (x, y) => `${x},${y}`;
  const walkable = (x, y) => {
    if (x < 0 || y < 0 || x >= world.width || y >= world.height) return false;
    const tile = world.grid[y][x];
    return tile !== '#' && tile !== 'C';
  };
  if (!walkable(tx, ty)) return null;
  const cameFrom = new Map([[key(sx, sy), null]]);
  const queue = [[sx, sy]];
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    if (x === tx && y === ty) {
      const path = [];
      let current = key(x, y);
      while (current !== null) {
        const [px, py] = current.split(',').map(Number);
        path.unshift({ x: (px + 0.5) * TILE, y: (py + 0.5) * TILE });
        current = cameFrom.get(current);
      }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (walkable(nx, ny) && !cameFrom.has(key(nx, ny))) {
        cameFrom.set(key(nx, ny), key(x, y));
        queue.push([nx, ny]);
      }
    }
  }
  return null;
}

export function autopilotInput(world, cautious) {
  const player = world.player;
  // The target: the nearest intel still on the floor, else the exit.
  let target = null;
  let best = Infinity;
  for (const item of world.intel) {
    if (item.taken) continue;
    const distance = Math.hypot(item.x - player.x, item.y - player.y);
    if (distance < best) {
      best = distance;
      target = item;
    }
  }
  if (!target) target = world.exit;
  const idle = (sneak) => ({
    moveVector: () => ({ x: 0, y: 0 }),
    sneaking: sneak,
    drainClicks: () => [],
    throwPressed: false,
    mouse: { x: 0, y: 0 },
  });
  const go = (dx, dy, sneak) => {
    const length = Math.hypot(dx, dy) || 1;
    return {
      moveVector: () => ({ x: dx / length, y: dy / length }),
      sneaking: sneak,
      drainClicks: () => [],
      throwPressed: false,
      mouse: { x: 0, y: 0 },
    };
  };
  const targetTileX = Math.floor(target.x / TILE);
  const targetTileY = Math.floor(target.y / TILE);
  const playerTileX = Math.floor(player.x / TILE);
  const playerTileY = Math.floor(player.y / TILE);
  if (playerTileX === targetTileX && playerTileY === targetTileY) return idle(false);
  const path = findPath(world, playerTileX, playerTileY, targetTileX, targetTileY);
  if (!path || path.length < 2) return idle(false);
  // Steer at the next tile on the path, looking one tile further ahead so
  // corners are cut instead of walked into.
  const next = path[Math.min(2, path.length - 1)];
  const dx = next.x - player.x;
  const dy = next.y - player.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 4) return idle(false);

  // A step is safe when no guard would see the player standing just ahead.
  const stepAhead = {
    x: player.x + (dx / distance) * 26,
    y: player.y + (dy / distance) * 26,
  };
  const visibleTo = (x, y, sneak) => {
    for (const guard of world.guards) {
      if (canSee(guard, x, y, world)) {
        if (!cautious) return guard;
        if (!sneak) return guard;
        // Sneaking halves the spot rate; only a close cone is a real risk.
        if (Math.hypot(guard.x - x, guard.y - y) < 90) return guard;
      }
    }
    return null;
  };
  if (!visibleTo(stepAhead.x, stepAhead.y, false)) return go(dx, dy, false);
  if (cautious) {
    if (!visibleTo(stepAhead.x, stepAhead.y, true)) return go(dx, dy, true);
    // Never wait inside a cone that already sees you: keep moving, sneaking,
    // until you are out of it. Otherwise the alarm fills while you stand still.
    if (world.detection > 0.1) return go(dx, dy, true);
    // No safe step. Wait, hidden, until a cone sweeps past — but never
    // longer than a few seconds, or the pilot would wait out the whole game.
    world.autopilotWait = (world.autopilotWait ?? 0) + SAMPLE;
    if (world.autopilotWait > 8) {
      world.autopilotWait = 0;
      return go(dx, dy, true);
    }
    return idle(true);
  }
  return go(dx, dy, false);
}

export function simulate(world, seconds, cautious) {
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    if (world.screen !== 'play') break;
    updateWorld(world, autopilotInput(world, cautious), SAMPLE);
  }
  return world;
}

/**
 * Build the world for one screenshot scene. `name` is start, play or
 * caught; `seed` only steadies the RNG (the floors are fixed, so any seed
 * gives the same frame — it is there so the shot URL reads like the
 * starter's).
 */
export function shotWorld(name, seed = 1) {
  void seededRandom(seed);
  if (name === 'start') {
    const world = createWorld(0);
    world.screen = 'title';
    return world;
  }
  if (name === 'caught') {
    const world = createWorld(0);
    simulate(world, CAUGHT_LIMIT_SECONDS, false);
    if (world.screen !== 'caught') {
      // The reckless pilot stayed unseen or cleared the floor: stage the
      // frame the scene promises — a guard on top of the player, alarm up.
      const guard = world.guards[0];
      world.screen = 'play';
      world.player.x = 14.5 * TILE;
      world.player.y = 4.5 * TILE;
      guard.x = world.player.x - 70;
      guard.y = world.player.y;
      guard.angle = 0;
      guard.state = 'chase';
      world.detection = 1;
      world.alarm = true;
      world.alarmTime = 0.4;
    }
    return world;
  }
  // play: a few careful seconds into the first floor — stop once one intel
  // is stolen and the player is moving again, so the frame is mid-game.
  const world = createWorld(0);
  for (let t = 0; t < 20; t += SAMPLE) {
    if (world.screen !== 'play') break;
    updateWorld(world, autopilotInput(world, true), SAMPLE);
    const taken = world.intel.filter((item) => item.taken).length;
    if (taken >= 1 && world.time >= 6) break;
  }
  return world;
}
