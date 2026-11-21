// Shared constants for Shadowline: a top-down stealth game.
// One file, one job: every number the rest of the game agrees on.

export const TILE = 32;

// The canvas is laid out from the map: the renderer scales this to the window.
export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 640;

// Player movement, in pixels per second.
export const PLAYER_SPEED = 150;
export const PLAYER_SNEAK_SPEED = 78;
export const PLAYER_RADIUS = 11;

// Guard sight: how far a guard sees, and how wide the cone is.
export const GUARD_VIEW_RANGE = 205;
export const GUARD_VIEW_HALF_ANGLE = 0.65; // ~37 degrees each side
export const GUARD_PATROL_SPEED = 68;
export const GUARD_CHASE_SPEED = 145;
export const GUARD_RADIUS = 12;

// Detection: 0 is unseen, 1 is fully spotted and the alarm sounds.
export const DETECT_FILL_BASE = 1.05; // per second, point blank, walking, lit floor
export const DETECT_DECAY = 0.28; // per second while unseen
export const DETECT_SNEAK_FACTOR = 0.45;
export const DETECT_SHADOW_FACTOR = 0.5;
export const DETECT_CHASE_LOSE_SECONDS = 3.0; // unseen this long while chasing -> search
export const DETECT_SEARCH_SECONDS = 4.0; // searching this long -> back to patrol

// A thrown noisemaker: how far its clatter carries, and how many you carry.
export const NOISE_RADIUS = 190;
export const NOISEMAKERS_START = 3;

// Screens the game can be on.
export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_LEVEL_CLEAR = 'level-clear';
export const SCREEN_WIN = 'win';

// Colours, kept in one place so the look stays consistent.
export const COLORS = {
  floorLight: '#232a33',
  floorDark: '#1e242d',
  shadowFloor: '#151a20',
  wall: '#3d4a5a',
  wallTop: '#55677d',
  crate: '#5a4632',
  crateTop: '#7a6248',
  exit: '#37d67a',
  intel: '#ffd166',
  player: '#e8e6df',
  playerSneak: '#9fb4c7',
  guardCalm: '#f2c14e',
  guardSuspicious: '#ff9f1c',
  guardAlarm: '#ff3b30',
  coneCalm: 'rgba(242, 193, 78, 0.20)',
  coneSuspicious: 'rgba(255, 159, 28, 0.28)',
  coneAlarm: 'rgba(255, 59, 48, 0.30)',
  hud: '#e8e6df',
  danger: '#ff3b30',
};
