import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMotion, jumpMotion, pauseMotion, whipMotion } from '../mods/clawd-radio/hooks/motion.mjs';
import { SPRITE_ROWS, SPRITE_WIDTH, WHIP_REACH, quadrantRuns, lanePixels } from '../mods/clawd-radio/hooks/art.mjs';

// The lane is two pixels per column; `x` and the slices below are in pixels.
const W = SPRITE_WIDTH * 2;
const REACH = WHIP_REACH * 2;
const LANE = 160;
const filled = (pixels, from, to) => pixels.some(row => row.slice(from, to).some(Boolean));
const glyphs = (pixels, from, to) => quadrantRuns(pixels, from, to).map(runs => runs.map(run => run.text).join(''));

test('at rest Clawd is drawn with exactly the banner logo glyphs', () => {
  const { pixels } = lanePixels(pauseMotion({ ...createMotion(0), x: 1 }, 0, 50), 12);
  assert.deepEqual(glyphs(pixels, 1, 1 + SPRITE_WIDTH).slice(1), [
    ' ▐▛███▜▌ ',
    '▝▜█████▛▘',
    '  ▘▘ ▝▝  ',
  ]);
  assert.equal(pixels.length, SPRITE_ROWS * 2);
});

test('the crab sits at its walking position, a pixel per half column', () => {
  const { pixels, x } = lanePixels({ ...createMotion(0), x: 5.5 }, 80);
  assert.equal(x, 11);
  assert.ok(filled(pixels, x, x + W));
  assert.ok(!filled(pixels, 0, x) && !filled(pixels, x + W, LANE));
});

test('legs alternate as the crab walks', () => {
  const state = { ...createMotion(0), x: 5 };
  assert.notDeepEqual(lanePixels(state, 80).pixels, lanePixels({ ...state, gait: 2 }, 80).pixels);
});

test('the crab faces its direction of travel', () => {
  const state = { ...createMotion(0), x: 5, gait: 2 };
  const { pixels, x } = lanePixels(state, 80);
  const left = lanePixels({ ...state, direction: -1 }, 80).pixels;
  assert.deepEqual(left.map(row => row.slice(x, x + W).reverse()), pixels.map(row => row.slice(x, x + W)));
});

test('sprinting dust trails behind the crab in either travel direction', () => {
  const state = { ...whipMotion(createMotion(0), 0, 50), x: 20, updatedAt: 1000 };
  const right = lanePixels(state, 80);
  const left = lanePixels({ ...state, direction: -1 }, 80);
  assert.ok(filled(right.pixels, 0, right.x));
  assert.ok(!filled(right.pixels, right.x + W, LANE));
  assert.ok(filled(left.pixels, left.x + W, LANE));
  assert.ok(!filled(lanePixels({ ...state, paused: true }, 80).pixels, 0, right.x));
});

test('the whip swings through multiple visible phases behind the crab, handle included', () => {
  const state = { ...whipMotion(createMotion(0), 0, 50), x: 20, boostUntil: 0 };
  const poses = [0, 100, 200, 300].map(updatedAt => lanePixels({ ...state, updatedAt }, 80));
  assert.equal(new Set(poses.map(pose => JSON.stringify(pose.pixels))).size, 4);
  for (const { pixels, x } of poses) {
    assert.ok(filled(pixels, x - REACH, x));
    assert.ok(pixels.flat().includes('#3b2a1c'));
  }
});

test('an idle whip lands the lash, then the crab jumps in place and lands', () => {
  const idle = { ...pauseMotion(createMotion(0), 0, 50), x: 20 };
  const jumping = jumpMotion(idle, 0);
  const at = updatedAt => lanePixels({ ...jumping, updatedAt }, 80);
  const top = ({ pixels, x }) => pixels.findIndex(row => row.slice(x, x + W).some(Boolean));
  const ground = top(lanePixels(idle, 80));
  assert.ok(filled(at(100).pixels, at(100).x - REACH, at(100).x));
  assert.ok(top(at(600)) < ground);
  assert.equal(at(600).x, at(0).x);
  assert.deepEqual(at(900).pixels, lanePixels(idle, 80).pixels);
});

test('the crab starts at the left edge, and at either edge the whip comes from the front', () => {
  const cracking = { ...whipMotion(createMotion(0), 0, 50), boostUntil: 0 };
  const atLeft = lanePixels(cracking, 80);
  assert.equal(atLeft.x, 0);
  assert.ok(filled(atLeft.pixels, W, W + REACH));
  const atRight = lanePixels({ ...cracking, x: 999, direction: -1 }, 80);
  assert.equal(atRight.x, LANE - W);
  assert.ok(filled(atRight.pixels, LANE - W - REACH, LANE - W));
  assert.equal(lanePixels(createMotion(0), SPRITE_WIDTH).x, 0);
  assert.equal(lanePixels(createMotion(0), SPRITE_WIDTH - 1), null);
});

test('quadrants pack 2x2 pixels per cell into same-colored runs, gaps kept open', () => {
  const a = '#111';
  const b = '#222';
  const rows = quadrantRuns([
    [a, a, a, null, b, b],
    [a, null, null, null, a, a],
  ], 0, 3);
  assert.deepEqual(rows, [[
    { text: '▛▘', color: a },
    { text: '▀', color: b, backgroundColor: a },
  ]]);
  // A second color beside a gap is dropped rather than painted over the gap.
  assert.deepEqual(quadrantRuns([[a, b], [a, null]], 0, 1), [[{ text: '▌', color: a }]]);
});
