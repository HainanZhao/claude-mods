import { CRACK_MS, JUMP_MS } from './motion.mjs';

// The lane is drawn on a quadrant grid, as Claude Code's banner draws Clawd:
// each terminal cell is 2x2 pixels in one color over the background.
const ORANGE = '#d77757';
const HANDLE_COLOR = '#3b2a1c';
const WHIP_COLOR = '#7a5230';
const CRACK_COLOR = '#fff3a0';
const DUST_COLORS = ['#c9bfb2', '#b3a898', '#8f8679'];

// Clawd pixel for pixel from the banner (▐▛███▜▌ / ▝▜█████▛▘ / ▘▘ ▝▝); its eyes
// are gaps. The second leg frame shuffles half a cell toward travel.
const BODY = [
  '...############...',
  '...##.######.##...',
  '.################.',
  '...############...',
];
const LEGS = ['....#.#....#.#....', '.....#.#....#.#...'];

const SPRITE_PIXELS = BODY[0].length;
export const SPRITE_WIDTH = SPRITE_PIXELS / 2;
// Headroom for the idle jump, in pixels; even, so Clawd at rest sits on the
// same cell boundaries as the banner and draws with its exact glyphs.
const JUMP_HEIGHT = 2;
const PIXEL_ROWS = JUMP_HEIGHT + BODY.length + 2;
export const SPRITE_ROWS = PIXEL_ROWS / 2;
// Columns the whip needs beside the crab.
export const WHIP_REACH = 6;

const FRAMES = LEGS.map(legs => [...BODY, legs]);
const FRAMES_LEFT = FRAMES.map(frame => frame.map(row => [...row].reverse().join('')));

// The lash: a curve from the handle to a tip that swings down onto the trailing
// claw. Pixels measured back from the sprite's trailing edge, rows from its top.
const HANDLE = [[11, 4], [7, 2]];
const LASH_TIPS = [[4, -1], [2, -1], [0, 0], [0, 2]];
const LASH_BENDS = [[12, -1], [8, -1], [4, -1], [4, 1]];

// `state.x` is the crab's left edge in columns; it lands on half columns, so
// the walk moves a pixel at a time. Returns `{ pixels, x }`: the scene as rows
// of colored pixels (null is the terminal's own background), two per column,
// and the crab's left pixel.
export function lanePixels(state, columns) {
  const cells = Math.max(0, Math.floor(columns));
  if (cells < SPRITE_WIDTH) return null;
  const width = cells * 2;
  const pixels = Array.from({ length: PIXEL_ROWS }, () => Array(width).fill(null));
  const x = Math.max(0, Math.min(width - SPRITE_PIXELS, Math.round(state.x * 2)));
  const right = state.direction > 0;
  // Pixel `offset` beyond the crab's left or right edge.
  const beside = left => offset => left ? x - 1 - offset : x + SPRITE_PIXELS + offset;
  const behind = beside(right);
  // The lane has no margins, so at an edge the lash comes from the front;
  // Clawd is symmetric, so it reads the same.
  const whipSide = (right ? x : width - x - SPRITE_PIXELS) >= WHIP_REACH * 2 ? behind : beside(!right);
  const plot = (column, row, color) => {
    row += JUMP_HEIGHT;
    if (column >= 0 && column < width && row >= 0 && row < PIXEL_ROWS) pixels[row][column] = color;
  };
  if (!state.paused && state.updatedAt < state.boostUntil) {
    const drift = Math.floor(state.gait * 2) % 4;
    for (const [offset, row, w, h, shade] of [[2, 3, 3, 2, 0], [7, 4, 2, 1, 1], [11, 4, 1, 1, 2]]) {
      for (let dy = 0; dy < h; dy += 1) {
        for (let dx = 0; dx < w; dx += 1) plot(behind(offset + drift + dx), row + dy, DUST_COLORS[shade]);
      }
    }
  }
  if (state.updatedAt < state.crackUntil) {
    const phase = Math.min(3, Math.floor((CRACK_MS - state.crackUntil + state.updatedAt) / 90));
    const curve = (from, bend, to, color) => {
      for (let i = 0; i <= 24; i += 1) {
        const t = i / 24;
        const along = (a, b, c) => (1 - t) ** 2 * a + 2 * (1 - t) * t * b + t ** 2 * c;
        plot(whipSide(Math.round(along(from[0], bend[0], to[0]))), Math.round(along(from[1], bend[1], to[1])), color);
      }
    };
    curve(HANDLE[0], HANDLE[0], HANDLE[1], HANDLE_COLOR);
    const tip = LASH_TIPS[phase];
    curve(HANDLE[1], LASH_BENDS[phase], tip, WHIP_COLOR);
    if (phase === 3) {
      for (const [dx, dy] of [[0, 0], [1, -1], [1, 1], [2, 0], [0, -1], [0, 1]]) {
        plot(whipSide(tip[0] + dx), tip[1] + dy, CRACK_COLOR);
      }
    }
  }
  const jump = JUMP_MS - Math.max(0, (state.jumpUntil ?? 0) - state.updatedAt);
  const lift = jump >= 0 && jump < JUMP_MS ? Math.round(JUMP_HEIGHT * Math.sin(Math.PI * jump / JUMP_MS)) : 0;
  const frame = (right ? FRAMES : FRAMES_LEFT)[Math.floor(state.gait / 2) % 2];
  frame.forEach((line, row) => [...line].forEach((key, i) => {
    if (key === '#') pixels[row + JUMP_HEIGHT - lift][x + i] = ORANGE;
  }));
  return { pixels, x };
}

const QUADRANTS = ' ▘▝▀▖▌▞▛▗▚▐▜▄▙▟█';

// Packs cells [from, to) into terminal rows of same-colored runs, one
// quadrant glyph per cell: top-left, top-right, bottom-left, bottom-right.
export function quadrantRuns(pixels, from, to) {
  const rows = [];
  for (let row = 0; row < pixels.length; row += 2) {
    const runs = [];
    for (let column = from; column < to; column += 1) {
      const quad = [pixels[row][2 * column], pixels[row][2 * column + 1],
        pixels[row + 1]?.[2 * column] ?? null, pixels[row + 1]?.[2 * column + 1] ?? null];
      const counts = new Map();
      for (const color of quad) if (color) counts.set(color, (counts.get(color) ?? 0) + 1);
      const [main, other] = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([color]) => color);
      // A cell holds one color over the background, or two filling it. Where a
      // second color meets a gap, the gap wins, so Clawd's eyes stay open.
      const fill = other && !quad.includes(null) ? other : null;
      const bits = quad.reduce((sum, color, i) => sum + (color === main ? 1 << i : 0), 0);
      const cell = !main ? { text: ' ' }
        : { text: QUADRANTS[bits], color: main, ...(fill ? { backgroundColor: fill } : {}) };
      const last = runs.at(-1);
      if (last && last.color === cell.color && last.backgroundColor === cell.backgroundColor) last.text += cell.text;
      else runs.push(cell);
    }
    rows.push(runs);
  }
  return rows;
}
