// Procedural sound for Shadowline. One file, one job: every sound the game
// makes, synthesized with the Web Audio API — no audio files, no network.
//
// The context is created lazily on the first user gesture (browsers refuse
// audio before one), so calling these before the first keypress is a no-op.

let context = null;
let master = null;

function ensureContext() {
  if (context !== null) return true;
  try {
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return false;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.16;
    master.connect(context.destination);
    return true;
  } catch {
    return false;
  }
}

/** A short tone: frequency slides from `from` to `to` over `seconds`. */
function tone(from, to, seconds, type = 'sine', when = 0) {
  if (!ensureContext()) return;
  if (context.state === 'suspended') void context.resume();
  const start = context.currentTime + when;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(1, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  oscillator.connect(gain);
  gain.connect(master);
  oscillator.start(start);
  oscillator.stop(start + seconds + 0.05);
}

/** Filtered noise burst, for footsteps and the noisemaker's clatter. */
function noise(seconds, frequency, when = 0) {
  if (!ensureContext()) return;
  if (context.state === 'suspended') void context.resume();
  const start = context.currentTime + when;
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = context.createBufferSource();
  source.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = frequency;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.5, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(start);
}

export const sounds = {
  // Call once from the first gesture so later sounds are allowed to play.
  unlock() {
    ensureContext();
  },
  step(sneaking) {
    noise(0.05, sneaking ? 500 : 900);
  },
  pickup() {
    tone(880, 1320, 0.12, 'sine');
    tone(1320, 1760, 0.14, 'sine', 0.09);
  },
  throwClatter() {
    noise(0.09, 2400);
    noise(0.07, 1600, 0.12);
    noise(0.06, 1200, 0.22);
  },
  alert() {
    tone(220, 440, 0.28, 'sawtooth');
    tone(440, 330, 0.3, 'sawtooth', 0.22);
  },
  caught() {
    tone(392, 98, 0.7, 'sawtooth');
    tone(196, 65, 0.7, 'square', 0.05);
  },
  levelClear() {
    tone(523, 523, 0.12, 'triangle');
    tone(659, 659, 0.12, 'triangle', 0.12);
    tone(784, 784, 0.2, 'triangle', 0.24);
  },
  win() {
    tone(523, 523, 0.14, 'triangle');
    tone(659, 659, 0.14, 'triangle', 0.14);
    tone(784, 784, 0.14, 'triangle', 0.28);
    tone(1046, 1046, 0.3, 'triangle', 0.42);
  },
};
