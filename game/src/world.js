// The world of Shadowline. One file, one job: the state of a floor and how
// one tick of play changes it — movement, sight, suspicion, the alarm,
// stealing intel, throwing noisemakers, and reaching the exit.
//
// The renderer draws this state; the input feeds it; nothing here touches
// the canvas or the network.

import {
  DETECT_CHASE_LOSE_SECONDS,
  DETECT_DECAY,
  DETECT_FILL_BASE,
  DETECT_SEARCH_SECONDS,
  DETECT_SHADOW_FACTOR,
  DETECT_SNEAK_FACTOR,
  GUARD_VIEW_RANGE,
  NOISEMAKERS_START,
  NOISE_RADIUS,
  PLAYER_RADIUS,
  PLAYER_SNEAK_SPEED,
  PLAYER_SPEED,
  SCREEN_CAUGHT,
  SCREEN_LEVEL_CLEAR,
  SCREEN_PLAY,
  SCREEN_WIN,
  TILE,
} from './config.js';
import { LEVELS } from './levels.js';
import { calmGuard, canSee, createGuard, updateGuard } from './guard.js';
import { sounds } from './audio.js';

// How far apart, in pixels, two samples of a sightline may be.
const LOS_STEP = 6;

export function createWorld(levelIndex = 0) {
  const level = LEVELS[levelIndex];
  const grid = level.map.map((row) => [...row]);
  const height = grid.length;
  const width = grid[0].length;

  const player = { x: 0, y: 0, radius: PLAYER_RADIUS, sneaking: false, faceAngle: 0, moving: false };
  const intel = [];
  let exit = null;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = grid[y][x];
      if (tile === 'P') {
        player.x = (x + 0.5) * TILE;
        player.y = (y + 0.5) * TILE;
        grid[y][x] = '.';
      } else if (tile === 'I') {
        intel.push({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, taken: false });
        grid[y][x] = '.';
      } else if (tile === 'X') {
        exit = { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, tileX: x, tileY: y };
        grid[y][x] = '.';
      }
    }
  }

  const world = {
    levelIndex,
    level,
    grid,
    width,
    height,
    player,
    guards: level.guards.map(createGuard),
    intel,
    exit,
    screen: SCREEN_PLAY,
    detection: 0, // 0 unseen, 1 fully spotted
    alarm: false,
    alarmTime: 0,
    chaseLostTime: 0,
    noisemakers: NOISEMAKERS_START,
    throws: [], // {x, y, timeLeft} — expanding rings the guards can hear
    time: 0,
    steps: 0,
    caughtBy: null,
    message: '',
    messageTime: 0,
    stats: { spotted: 0, throws: 0 },
  };
  // Guards move through world.moveCircle: bind it here so every world — one
  // the game loop made or one a screenshot scene made — can move its guards.
  bindWorld(world);
  return world;
}

export function tileAt(world, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= world.width || ty >= world.height) return '#';
  return world.grid[ty][tx];
}

export function isSolidTile(tile) {
  return tile === '#' || tile === 'C';
}

/** True when the straight line between two points crosses no wall or crate. */
export function hasLineOfSight(world, x1, y1, x2, y2) {
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(distance / LOS_STEP));
  for (let i = 1; i < steps; i += 1) {
    const x = x1 + ((x2 - x1) * i) / steps;
    const y = y1 + ((y2 - y1) * i) / steps;
    if (isSolidTile(tileAt(world, x, y))) return false;
  }
  return true;
}

/**
 * Move a circle (an object with x, y) toward (nx, ny), sliding along solid
 * tiles instead of stopping dead. Returns {arrived}: true when the circle
 * is within 2px of the target.
 */
export function moveCircle(world, entity, nx, ny, radius) {
  // Try the full step, then each axis alone, so movement slides along walls.
  const tryMove = (x, y) => {
    for (const [ox, oy] of [[-radius, -radius], [radius, -radius], [-radius, radius], [radius, radius]]) {
      if (isSolidTile(tileAt(world, x + ox, y + oy))) return false;
    }
    entity.x = x;
    entity.y = y;
    return true;
  };
  if (!tryMove(nx, ny)) {
    if (!tryMove(nx, entity.y)) tryMove(entity.x, ny);
  }
  return { arrived: Math.hypot(nx - entity.x, ny - entity.y) < 2 };
}

// The world needs moveCircle too; bind it so guards can call world.moveCircle.
export function bindWorld(world) {
  world.tileAt = (x, y) => tileAt(world, x, y);
  world.hasLineOfSight = (x1, y1, x2, y2) => hasLineOfSight(world, x1, y1, x2, y2);
  world.moveCircle = (entity, nx, ny, radius) => moveCircle(world, entity, nx, ny, radius);
}

function tileIsShadow(world, x, y) {
  return tileAt(world, x, y) === 'D';
}

function flashMessage(world, text, seconds = 2.5) {
  world.message = text;
  world.messageTime = seconds;
}

/** Throw a noisemaker at (x, y): a clatter every guard in earshot investigates. */
export function throwNoisemaker(world, x, y) {
  if (world.noisemakers <= 0 || world.screen !== SCREEN_PLAY) return false;
  world.noisemakers -= 1;
  world.stats.throws += 1;
  world.throws.push({ x, y, timeLeft: 1.1 });
  sounds.throwClatter();
  for (const guard of world.guards) {
    const distance = Math.hypot(guard.x - x, guard.y - y);
    if (distance <= NOISE_RADIUS) {
      guard.state = 'suspicious';
      guard.stateTime = 0;
      guard.target = { x, y };
    }
  }
  flashMessage(world, 'Clatter! The guards go to look.', 1.6);
  return true;
}

/** One tick of play. `input` is the object input.js returns; `dt` seconds. */
export function updateWorld(world, input, dt) {
  if (world.screen !== SCREEN_PLAY) return;
  world.time += dt;
  if (world.messageTime > 0) world.messageTime -= dt;
  for (const ring of world.throws) ring.timeLeft -= dt;
  world.throws = world.throws.filter((ring) => ring.timeLeft > 0);

  const player = world.player;
  const move = input.moveVector();
  player.sneaking = input.sneaking;
  player.moving = move.x !== 0 || move.y !== 0;
  if (player.moving) {
    const speed = player.sneaking ? PLAYER_SNEAK_SPEED : PLAYER_SPEED;
    const nx = player.x + move.x * speed * dt;
    const ny = player.y + move.y * speed * dt;
    player.faceAngle = Math.atan2(move.y, move.x);
    moveCircle(world, player, nx, ny, player.radius);
    world.steps += 1;
    if (world.steps % 14 === 0) sounds.step(player.sneaking);
  }

  // A click, or Q, throws a noisemaker at the mouse (clicks win over Q).
  const clicks = input.drainClicks();
  if (clicks.length > 0) {
    const last = clicks[clicks.length - 1];
    const point = world.screenToWorld ? world.screenToWorld(last.x, last.y) : { x: last.x, y: last.y };
    throwNoisemaker(world, point.x, point.y);
  } else if (input.throwPressed) {
    input.consumeThrow();
    const point = world.screenToWorld
      ? world.screenToWorld(input.mouse.x, input.mouse.y)
      : { x: input.mouse.x, y: input.mouse.y };
    throwNoisemaker(world, point.x, point.y);
  }

  // Steal intel by walking over it.
  for (const item of world.intel) {
    if (!item.taken && Math.hypot(item.x - player.x, item.y - player.y) < TILE * 0.7) {
      item.taken = true;
      sounds.pickup();
      const left = world.intel.filter((i) => !i.taken).length;
      flashMessage(world, left === 0 ? 'All intel stolen — get to the exit!' : `Intel stolen. ${left} left.`);
    }
  }

  // Reach the exit once every intel is taken.
  const taken = world.intel.filter((i) => !i.taken).length;
  if (taken === 0 && world.exit) {
    const distance = Math.hypot(world.exit.x - player.x, world.exit.y - player.y);
    if (distance < TILE * 0.75) {
      if (world.levelIndex + 1 < LEVELS.length) {
        world.screen = SCREEN_LEVEL_CLEAR;
        sounds.levelClear();
      } else {
        world.screen = SCREEN_WIN;
        sounds.win();
      }
      return;
    }
  }

  // Sight: does any guard see the player right now?
  let seen = false;
  let nearestSeen = null;
  let nearestDistance = Infinity;
  for (const guard of world.guards) {
    const sees = canSee(guard, player.x, player.y, world);
    guard.seesPlayer = sees;
    if (sees) {
      seen = true;
      const distance = Math.hypot(guard.x - player.x, guard.y - player.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestSeen = guard;
      }
    }
  }

  if (seen && nearestSeen) {
    // Closer, faster and louder is spotted faster; sneaking and shadow slow it.
    // Running through a cone is the riskiest thing you can do: it fills the
    // meter far faster than walking, and sneaking far slower.
    const closeness = 1 - (nearestDistance / GUARD_VIEW_RANGE) * 0.55;
    let rate = DETECT_FILL_BASE * closeness;
    if (player.sneaking) rate *= DETECT_SNEAK_FACTOR;
    else if (player.moving) rate *= 1.6;
    if (tileIsShadow(world, player.x, player.y)) rate *= DETECT_SHADOW_FACTOR;
    world.detection = Math.min(1, world.detection + rate * dt);
    world.chaseLostTime = 0;
    if (world.detection >= 1 && !world.alarm) {
      world.alarm = true;
      world.alarmTime = 0;
      world.stats.spotted += 1;
      sounds.alert();
      flashMessage(world, 'SPOTTED! Break line of sight!', 2.5);
    }
  } else {
    world.detection = Math.max(0, world.detection - DETECT_DECAY * dt);
    if (world.alarm) {
      world.chaseLostTime += dt;
      if (world.chaseLostTime >= DETECT_CHASE_LOSE_SECONDS) {
        // Lost them: guards search the last seen spot, then stand down.
        for (const guard of world.guards) {
          if (guard.state === 'chase') {
            guard.state = 'search';
            guard.stateTime = 0;
            guard.target = guard.lastSeen ? { ...guard.lastSeen } : { x: player.x, y: player.y };
          }
        }
        world.alarm = false;
        world.chaseLostTime = 0;
        flashMessage(world, 'You lost them… for now.', 2.5);
      }
    }
  }

  if (world.alarm) world.alarmTime += dt;

  // Guards act: chase the player while the alarm is up, else patrol.
  for (const guard of world.guards) {
    let orders = null;
    if (world.alarm) {
      orders = { kind: 'chase', x: player.x, y: player.y };
    } else if (guard.state === 'suspicious' && guard.target) {
      orders = { kind: 'investigate', x: guard.target.x, y: guard.target.y };
    }
    const result = updateGuard(guard, dt, world, orders);
    if (result === 'caught') {
      world.screen = SCREEN_CAUGHT;
      world.caughtBy = guard;
      sounds.caught();
      return;
    }
  }

  // The alarm also cools off on its own: search long enough and the floor calms.
  if (!world.alarm) {
    let searching = false;
    for (const guard of world.guards) {
      if (guard.state === 'search' && guard.stateTime >= DETECT_SEARCH_SECONDS) {
        calmGuard(guard);
      }
      if (guard.state === 'search') searching = true;
    }
    if (!searching && world.detection === 0) {
      for (const guard of world.guards) {
        if (guard.state === 'suspicious' && guard.stateTime > 6) calmGuard(guard);
      }
    }
  }
}
