// Keyboard and mouse input for Shadowline. One file, one job: read the
// devices and hand the game a clean picture of what the player is doing.
//
// Movement: WASD or arrow keys. Shift: sneak (slow, quiet, harder to spot).
// Click (or Q): throw a noisemaker at the mouse position — the nearest
// guards walk over to investigate the clatter.

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, inside: false };
  // Clicks are queued so the game loop never misses one between frames.
  const clicks = [];

  function keyName(event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    return key;
  }

  function onKeyDown(event) {
    const gameKeys = [' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
    if (gameKeys.includes(keyName(event))) event.preventDefault();
    keys.add(keyName(event));
  }

  function onKeyUp(event) {
    keys.delete(keyName(event));
  }

  function onBlur() {
    keys.clear();
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.inside = true;
  }

  function onMouseDown(event) {
    if (event.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    clicks.push({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);

  return {
    // A unit movement vector from the held keys, or {x:0,y:0} when idle.
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      if (x !== 0 && y !== 0) {
        const length = Math.hypot(x, y);
        x /= length;
        y /= length;
      }
      return { x, y };
    },
    get sneaking() {
      return keys.has('shift');
    },
    // True once per press of Enter or Space — the game clears it after reading.
    get confirmPressed() {
      return keys.has('enter') || keys.has(' ');
    },
    consumeConfirm() {
      keys.delete('enter');
      keys.delete(' ');
    },
    get throwPressed() {
      return keys.has('q');
    },
    consumeThrow() {
      keys.delete('q');
    },
    mouse,
    // Drain the click queue: every click since the last frame, in order.
    drainClicks() {
      return clicks.splice(0, clicks.length);
    },
  };
}
