// Guard behaviour for Shadowline. One file, one job: how a guard patrols,
// what it can see, and how it reacts when it spots — or hears — something.
//
// States:
//   patrol     — walks its waypoints, cone sweeping the floor.
//   suspicious — caught a glimpse or heard a clatter: walks to look.
//   chase      — the alarm is up: runs at the player's last seen spot.
//   search     — lost the player while chasing: checks the spot, then gives up.
//
// The world owns the alarm; a guard only reports what it sees and follows
// the orders the world gives it (a chase target, or an investigate point).

import {
  GUARD_CHASE_SPEED,
  GUARD_PATROL_SPEED,
  GUARD_RADIUS,
  GUARD_VIEW_HALF_ANGLE,
  GUARD_VIEW_RANGE,
  TILE,
} from './config.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_CHASE = 'chase';
export const GUARD_SEARCH = 'search';

export function createGuard(def) {
  const start = def.waypoints[0];
  return {
    x: (start[0] + 0.5) * TILE,
    y: (start[1] + 0.5) * TILE,
    angle: 0,
    waypoints: def.waypoints.map(([x, y]) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE })),
    waypointIndex: 1 % def.waypoints.length,
    pause: def.pause ?? 0.8,
    pauseLeft: 0,
    state: GUARD_PATROL,
    stateTime: 0,
    // Where this guard is heading when it is not patrolling.
    target: null,
    // Where it last saw the player (chase) or heard a noise (investigate).
    lastSeen: null,
    // 0..1: how sure this guard is that something is there. Fills while the
    // player is in its cone; the world turns it into the shared alarm.
    suspicion: 0,
  };
}

/** True when the guard's eyes can reach (px, py): in range, inside the cone, no wall between. */
export function canSee(guard, px, py, world) {
  const dx = px - guard.x;
  const dy = py - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance > GUARD_VIEW_RANGE) return false;
  if (distance > GUARD_RADIUS + 2) {
    const toPlayer = Math.atan2(dy, dx);
    let diff = toPlayer - guard.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > GUARD_VIEW_HALF_ANGLE) return false;
  }
  return world.hasLineOfSight(guard.x, guard.y, px, py);
}

/** Step the guard toward (tx, ty) at `speed`, sliding along walls. Returns true on arrival. */
function stepToward(guard, tx, ty, speed, dt, world) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 2) return true;
  const step = Math.min(distance, speed * dt);
  const nx = guard.x + (dx / distance) * step;
  const ny = guard.y + (dy / distance) * step;
  guard.angle = Math.atan2(dy, dx);
  world.moveCircle(guard, nx, ny, GUARD_RADIUS);
  // Arrived means at the waypoint itself, not merely at the end of one step.
  return Math.hypot(tx - guard.x, ty - guard.y) < 2;
}

/**
 * One tick of guard AI. `orders` is the world's word for this guard:
 *   { kind: 'chase', x, y }     — run at the player
 *   { kind: 'investigate', x, y } — walk over and look
 *   null                         — no orders, patrol as usual
 * Returns 'caught' when this guard reaches the player mid-chase.
 */
export function updateGuard(guard, dt, world, orders) {
  guard.stateTime += dt;

  if (orders && orders.kind === 'chase') {
    guard.state = GUARD_CHASE;
    guard.lastSeen = { x: orders.x, y: orders.y };
    stepToward(guard, orders.x, orders.y, GUARD_CHASE_SPEED, dt, world);
    const distance = Math.hypot(world.player.x - guard.x, world.player.y - guard.y);
    if (distance < GUARD_RADIUS + world.player.radius - 2) return 'caught';
    return null;
  }

  if (orders && orders.kind === 'investigate') {
    if (guard.state !== GUARD_SUSPICIOUS) {
      guard.state = GUARD_SUSPICIOUS;
      guard.stateTime = 0;
      guard.target = { x: orders.x, y: orders.y };
    }
    const arrived = stepToward(guard, guard.target.x, guard.target.y, GUARD_PATROL_SPEED * 1.5, dt, world);
    if (arrived) {
      // Look around for a moment, then go back to the patrol.
      guard.pauseLeft = 1.6;
      guard.state = GUARD_PATROL;
      guard.stateTime = 0;
    }
    return null;
  }

  if (guard.state === GUARD_SEARCH) {
    if (guard.target) {
      const arrived = stepToward(guard, guard.target.x, guard.target.y, GUARD_PATROL_SPEED * 1.4, dt, world);
      if (arrived || guard.stateTime > 4) {
        guard.state = GUARD_PATROL;
        guard.stateTime = 0;
        guard.target = null;
      }
    } else {
      guard.state = GUARD_PATROL;
      guard.stateTime = 0;
    }
    return null;
  }

  // Patrol (or standing and looking after an investigation).
  if (guard.pauseLeft > 0) {
    guard.pauseLeft -= dt;
    return null;
  }
  const target = guard.waypoints[guard.waypointIndex];
  const arrived = stepToward(guard, target.x, target.y, GUARD_PATROL_SPEED, dt, world);
  if (arrived) {
    guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    guard.pauseLeft = guard.pause;
  }
  return null;
}

/** Send a guard back to its patrol after the alarm dies down. */
export function calmGuard(guard) {
  guard.state = GUARD_PATROL;
  guard.stateTime = 0;
  guard.suspicion = 0;
  guard.target = null;
  guard.lastSeen = null;
}
