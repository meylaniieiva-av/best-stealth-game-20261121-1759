// Shadowline's entry point. One file, one job: boot the game, run the loop,
// and move between the title, play, caught, floor-clear and win screens.
//
// ?shot=start|play|caught renders one deterministic screenshot scene instead
// of the title screen (the screenshots in screenshots/ are taken this way).

import { SCREEN_CAUGHT, SCREEN_LEVEL_CLEAR, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './config.js';
import { createInput } from './input.js';
import { sounds } from './audio.js';
import { bindWorld, createWorld, updateWorld } from './world.js';
import { render, resizeCanvas, screenToWorld } from './render.js';
import { shotWorld } from './shots.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const input = createInput(canvas);
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

let world;
if (shot) {
  world = shotWorld(shot, Number(params.get('seed') ?? 1) || 1);
} else {
  world = createWorld(0);
  world.screen = SCREEN_TITLE;
}
bindWorld(world);
world.screenToWorld = screenToWorld;

let size = resizeCanvas(canvas);
window.addEventListener('resize', () => {
  size = resizeCanvas(canvas);
});

function announce(text) {
  if (status) status.textContent = text;
}

function restartFloor(levelIndex) {
  world = createWorld(levelIndex);
  bindWorld(world);
  world.screenToWorld = screenToWorld;
  world.screen = SCREEN_PLAY;
}

function onConfirm() {
  sounds.unlock();
  if (world.screen === SCREEN_TITLE) {
    world.screen = SCREEN_PLAY;
    announce('Floor 1. Steal the intel, reach the exit, stay unseen.');
  } else if (world.screen === SCREEN_CAUGHT) {
    restartFloor(world.levelIndex);
    announce(`Floor ${world.levelIndex + 1}, again.`);
  } else if (world.screen === SCREEN_LEVEL_CLEAR) {
    restartFloor(world.levelIndex + 1);
    announce(`Floor ${world.levelIndex + 1}.`);
  } else if (world.screen === SCREEN_WIN) {
    restartFloor(0);
    announce('Floor 1. Steal the intel, reach the exit, stay unseen.');
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!shot) {
    if (input.confirmPressed) {
      onConfirm();
      input.consumeConfirm();
    }
    if (world.screen === SCREEN_PLAY) {
      updateWorld(world, input, dt);
    }
  }
  render(canvas, world, size);
  requestAnimationFrame(frame);
}

announce('Shadowline. Press Enter to begin.');
requestAnimationFrame(frame);
