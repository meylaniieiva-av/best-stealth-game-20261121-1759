// Rendering for Shadowline. One file, one job: draw the world on a canvas —
// the floor, the cover, the guards and their vision cones, the player, the
// HUD, and the title / caught / clear / win screens.
//
// The game world is 30 by 20 tiles; the renderer scales it to fit the
// window and centres it, so the same frame looks right at any window size.

import {
  COLORS,
  GUARD_VIEW_HALF_ANGLE,
  GUARD_VIEW_RANGE,
  SCREEN_CAUGHT,
  SCREEN_LEVEL_CLEAR,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
  TILE,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from './config.js';

// Where the world sits on the canvas, recomputed on every resize.
let view = { scale: 1, ox: 0, oy: 0 };

export function resizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(240, Math.floor(rect.height));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  const context = canvas.getContext('2d');
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  const scale = Math.min(width / VIEW_WIDTH, height / VIEW_HEIGHT);
  view = {
    scale,
    ox: (width - VIEW_WIDTH * scale) / 2,
    oy: (height - VIEW_HEIGHT * scale) / 2,
  };
  return { width, height };
}

/** Convert a mouse position on the canvas to a point in the game world. */
export function screenToWorld(x, y) {
  return { x: (x - view.ox) / view.scale, y: (y - view.oy) / view.scale };
}

function toScreenX(x) {
  return view.ox + x * view.scale;
}

function toScreenY(y) {
  return view.oy + y * view.scale;
}

function tileColor(tile, x, y) {
  if (tile === 'D') return COLORS.shadowFloor;
  return (x + y) % 2 === 0 ? COLORS.floorLight : COLORS.floorDark;
}

function drawWorld(context, world, width, height) {
  context.save();
  context.translate(view.ox, view.oy);
  context.scale(view.scale, view.scale);

  // Floor.
  for (let y = 0; y < world.height; y += 1) {
    for (let x = 0; x < world.width; x += 1) {
      const tile = world.grid[y][x];
      if (tile === '#' || tile === 'C') continue;
      context.fillStyle = tileColor(tile, x, y);
      context.fillRect(x * TILE, y * TILE, TILE, TILE);
      if (tile === 'D') {
        // Shadow floor: a faint hatch so it reads as cover, not a hole.
        context.strokeStyle = 'rgba(255,255,255,0.05)';
        context.beginPath();
        context.moveTo(x * TILE + 6, y * TILE + TILE - 6);
        context.lineTo(x * TILE + TILE - 6, y * TILE + 6);
        context.stroke();
      }
    }
  }

  // Exit: a green door that glows once every intel is stolen.
  if (world.exit) {
    const allTaken = world.intel.every((item) => item.taken);
    const { x, y } = world.exit;
    context.fillStyle = allTaken ? COLORS.exit : '#2c5a40';
    context.fillRect(x - 13, y - 13, 26, 26);
    context.strokeStyle = allTaken ? '#a9f5c9' : '#5a7a68';
    context.lineWidth = 2;
    context.strokeRect(x - 13, y - 13, 26, 26);
    context.fillStyle = allTaken ? '#062b16' : '#9fb8a8';
    context.font = 'bold 13px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(allTaken ? 'EXIT' : 'LOCK', x, y + 1);
  }

  // Intel: glowing files waiting to be lifted.
  for (const item of world.intel) {
    if (item.taken) continue;
    const pulse = 0.6 + 0.4 * Math.sin(world.time * 3 + item.x);
    context.fillStyle = `rgba(255, 209, 102, ${0.25 + 0.2 * pulse})`;
    context.beginPath();
    context.arc(item.x, item.y, 15 + 3 * pulse, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#fff3d6';
    context.fillRect(item.x - 6, item.y - 8, 12, 16);
    context.strokeStyle = COLORS.intel;
    context.lineWidth = 1.5;
    context.strokeRect(item.x - 6, item.y - 8, 12, 16);
    context.strokeStyle = '#8a6d1f';
    context.beginPath();
    context.moveTo(item.x - 3, item.y - 3);
    context.lineTo(item.x + 3, item.y - 3);
    context.moveTo(item.x - 3, item.y + 1);
    context.lineTo(item.x + 3, item.y + 1);
    context.moveTo(item.x - 3, item.y + 5);
    context.lineTo(item.x + 1, item.y + 5);
    context.stroke();
  }

  // Thrown noisemakers: expanding rings the guards heard.
  for (const ring of world.throws) {
    const progress = 1 - ring.timeLeft / 1.1;
    context.strokeStyle = `rgba(255, 209, 102, ${0.8 * (1 - progress)})`;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(ring.x, ring.y, 8 + progress * 46, 0, Math.PI * 2);
    context.stroke();
  }

  // Walls and crates, drawn after the floor so they sit on top of it.
  for (let y = 0; y < world.height; y += 1) {
    for (let x = 0; x < world.width; x += 1) {
      const tile = world.grid[y][x];
      if (tile === '#') {
        context.fillStyle = COLORS.wall;
        context.fillRect(x * TILE, y * TILE, TILE, TILE);
        context.fillStyle = COLORS.wallTop;
        context.fillRect(x * TILE, y * TILE, TILE, 5);
      } else if (tile === 'C') {
        context.fillStyle = COLORS.crate;
        context.fillRect(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4);
        context.fillStyle = COLORS.crateTop;
        context.fillRect(x * TILE + 2, y * TILE + 2, TILE - 4, 5);
        context.strokeStyle = '#3a2d1e';
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(x * TILE + 2, y * TILE + 2);
        context.lineTo(x * TILE + TILE - 2, y * TILE + TILE - 2);
        context.moveTo(x * TILE + TILE - 2, y * TILE + 2);
        context.lineTo(x * TILE + 2, y * TILE + TILE - 2);
        context.stroke();
      }
    }
  }

  // Vision cones, then the guards standing at their points.
  for (const guard of world.guards) {
    drawCone(context, guard, world);
  }
  for (const guard of world.guards) {
    drawGuard(context, guard, world);
  }

  drawPlayer(context, world);
  context.restore();
}

function coneColor(guard, world) {
  if (world.alarm) return COLORS.coneAlarm;
  if (guard.state === 'suspicious' || guard.state === 'search') return COLORS.coneSuspicious;
  return COLORS.coneCalm;
}

function drawCone(context, guard, world) {
  const range = GUARD_VIEW_RANGE;
  context.fillStyle = coneColor(guard, world);
  context.beginPath();
  context.moveTo(guard.x, guard.y);
  context.arc(guard.x, guard.y, range, guard.angle - GUARD_VIEW_HALF_ANGLE, guard.angle + GUARD_VIEW_HALF_ANGLE);
  context.closePath();
  context.fill();
  // A brighter rim along the cone's edge, so its reach is easy to judge.
  context.strokeStyle = coneColor(guard, world).replace(/[\d.]+\)$/, '0.55)');
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(guard.x, guard.y);
  context.arc(guard.x, guard.y, range, guard.angle - GUARD_VIEW_HALF_ANGLE, guard.angle + GUARD_VIEW_HALF_ANGLE);
  context.closePath();
  context.stroke();
}

function drawGuard(context, guard, world) {
  const color = world.alarm
    ? COLORS.guardAlarm
    : guard.state === 'suspicious' || guard.state === 'search'
      ? COLORS.guardSuspicious
      : COLORS.guardCalm;
  context.fillStyle = '#1a1d22';
  context.beginPath();
  context.arc(guard.x, guard.y, 14, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = color;
  context.beginPath();
  context.arc(guard.x, guard.y, 11, 0, Math.PI * 2);
  context.fill();
  // Facing tick: which way the guard is looking.
  context.strokeStyle = '#1a1d22';
  context.lineWidth = 2.5;
  context.beginPath();
  context.moveTo(guard.x, guard.y);
  context.lineTo(guard.x + Math.cos(guard.angle) * 15, guard.y + Math.sin(guard.angle) * 15);
  context.stroke();
  // "!" while the guard is suspicious, "?" while it searches.
  if (guard.state === 'suspicious' || guard.state === 'search' || world.alarm) {
    context.fillStyle = world.alarm ? '#ff3b30' : '#ffd166';
    context.font = 'bold 18px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'bottom';
    context.fillText(guard.state === 'search' ? '?' : '!', guard.x, guard.y - 16);
  }
}

function drawPlayer(context, world) {
  const { player } = world;
  // A soft ring while sneaking: the player is harder to spot, and it shows.
  if (player.sneaking) {
    context.strokeStyle = 'rgba(159, 180, 199, 0.6)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(player.x, player.y, 17, 0, Math.PI * 2);
    context.stroke();
  }
  context.fillStyle = '#1a1d22';
  context.beginPath();
  context.arc(player.x, player.y, 13, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = player.sneaking ? COLORS.playerSneak : COLORS.player;
  context.beginPath();
  context.arc(player.x, player.y, 10, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#1a1d22';
  context.lineWidth = 2.5;
  context.beginPath();
  context.moveTo(player.x, player.y);
  context.lineTo(player.x + Math.cos(player.faceAngle) * 13, player.y + Math.sin(player.faceAngle) * 13);
  context.stroke();
}

function drawHud(context, world, width, height) {
  const taken = world.intel.filter((item) => item.taken).length;
  const total = world.intel.length;
  context.fillStyle = 'rgba(10, 12, 16, 0.72)';
  context.fillRect(0, 0, width, 44);
  context.fillStyle = COLORS.hud;
  context.font = 'bold 15px sans-serif';
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillText(world.level.name, 14, 22);
  context.fillText(`Intel ${taken}/${total}`, 250, 22);
  context.fillText(`Noisemakers ${world.noisemakers}  (click / Q)`, 360, 22);

  // Detection meter: fills amber, then red, as a guard spots you.
  const meterX = width - 240;
  const meterY = 14;
  const meterW = 150;
  context.fillStyle = '#333a44';
  context.fillRect(meterX, meterY, meterW, 16);
  const fill = world.detection;
  context.fillStyle = fill < 0.6 ? '#f2c14e' : '#ff3b30';
  context.fillRect(meterX, meterY, meterW * fill, 16);
  context.strokeStyle = '#55677d';
  context.lineWidth = 1;
  context.strokeRect(meterX, meterY, meterW, 16);
  context.fillStyle = COLORS.hud;
  context.font = '12px sans-serif';
  context.fillText(world.alarm ? 'SPOTTED' : ' unseen', meterX + meterW + 8, 22);

  // Timer, bottom right.
  const minutes = Math.floor(world.time / 60);
  const seconds = Math.floor(world.time % 60);
  context.fillStyle = 'rgba(232, 230, 223, 0.75)';
  context.font = '13px sans-serif';
  context.textAlign = 'right';
  context.fillText(`${minutes}:${String(seconds).padStart(2, '0')}`, width - 14, height - 16);

  // A short-lived message line above the floor.
  if (world.messageTime > 0 && world.message) {
    context.fillStyle = world.alarm ? '#ff6b61' : '#e8e6df';
    context.font = 'bold 16px sans-serif';
    context.textAlign = 'center';
    context.fillText(world.message, width / 2, 68);
  }

  // Controls reminder, bottom left.
  context.fillStyle = 'rgba(232, 230, 223, 0.55)';
  context.font = '12px sans-serif';
  context.textAlign = 'left';
  context.fillText('WASD / arrows move · Shift sneak · Click / Q throw noisemaker', 14, height - 16);
}

function drawPanel(context, width, height, lines) {
  context.fillStyle = 'rgba(8, 10, 14, 0.82)';
  context.fillRect(0, 0, width, height);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  let y = height / 2 - (lines.length - 1) * 26;
  for (const line of lines) {
    context.fillStyle = line.color ?? '#e8e6df';
    context.font = line.font ?? '16px sans-serif';
    context.fillText(line.text, width / 2, y);
    y += line.gap ?? 52;
  }
}

/** Draw one frame: the world, the HUD, and whichever screen is up. */
export function render(canvas, world, size) {
  const context = canvas.getContext('2d');
  const { width, height } = size;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#0b0e12';
  context.fillRect(0, 0, width, height);

  if (world.screen === SCREEN_TITLE) {
    drawWorld(context, world, width, height);
    drawPanel(context, width, height, [
      { text: 'SHADOWLINE', font: 'bold 54px sans-serif', color: '#e8e6df', gap: 64 },
      { text: 'A top-down stealth game — steal the intel, reach the exit, never be seen.', font: '17px sans-serif', gap: 40 },
      { text: world.level.briefing, font: '15px sans-serif', color: '#9fb4c7', gap: 44 },
      { text: 'WASD / arrows to move · Shift to sneak · Click or Q to throw a noisemaker', font: '15px sans-serif', gap: 44 },
      { text: 'Press Enter to begin', font: 'bold 18px sans-serif', color: '#ffd166' },
    ]);
    return;
  }

  drawWorld(context, world, width, height);
  drawHud(context, world, width, height);

  if (world.screen === SCREEN_CAUGHT) {
    drawPanel(context, width, height, [
      { text: 'CAUGHT', font: 'bold 52px sans-serif', color: '#ff3b30', gap: 60 },
      { text: 'A guard got their hands on you. The floor keeps its secrets — this time.', font: '16px sans-serif', gap: 40 },
      { text: `Floor ${world.levelIndex + 1} · ${world.time.toFixed(1)}s · spotted ${world.stats.spotted} time${world.stats.spotted === 1 ? '' : 's'}`, font: '14px sans-serif', color: '#9fb4c7', gap: 44 },
      { text: 'Press Enter to try the floor again', font: 'bold 17px sans-serif', color: '#ffd166' },
    ]);
  } else if (world.screen === SCREEN_LEVEL_CLEAR) {
    drawPanel(context, width, height, [
      { text: 'FLOOR CLEAR', font: 'bold 46px sans-serif', color: '#37d67a', gap: 60 },
      { text: `${world.level.name} — every file lifted, nobody saw a thing.`, font: '16px sans-serif', gap: 40 },
      { text: `Time ${world.time.toFixed(1)}s · spotted ${world.stats.spotted} time${world.stats.spotted === 1 ? '' : 's'}`, font: '14px sans-serif', color: '#9fb4c7', gap: 44 },
      { text: 'Press Enter for the next floor', font: 'bold 17px sans-serif', color: '#ffd166' },
    ]);
  } else if (world.screen === SCREEN_WIN) {
    drawPanel(context, width, height, [
      { text: 'GHOST RUN COMPLETE', font: 'bold 44px sans-serif', color: '#37d67a', gap: 60 },
      { text: 'Every floor cleared. Three buildings, nine files, and nobody ever knew you were there.', font: '16px sans-serif', gap: 40 },
      { text: `Total time ${world.time.toFixed(1)}s · spotted ${world.stats.spotted} time${world.stats.spotted === 1 ? '' : 's'} · noisemakers thrown ${world.stats.throws}`, font: '14px sans-serif', color: '#9fb4c7', gap: 44 },
      { text: 'Press Enter to run it all again', font: 'bold 17px sans-serif', color: '#ffd166' },
    ]);
  }
}
