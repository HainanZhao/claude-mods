import assert from 'node:assert/strict';
import { test } from 'node:test';

const motion = await import('../mods/clawd-whip/hooks/motion.mjs').catch(() => ({}));

test('walks at five columns per second', () => {
  assert.equal(typeof motion.createMotion, 'function', 'motion module must exist');
  const state = motion.advanceMotion(motion.createMotion(0), 2000, 100);
  assert.equal(state.x, 10);
  assert.equal(state.direction, 1);
});

test('reflects at both edges, even after crossing the lane several times', () => {
  const start = motion.createMotion(0);
  const right = motion.advanceMotion(start, 3000, 10);
  assert.equal(right.x, 5);
  assert.equal(right.direction, -1);
  const left = motion.advanceMotion(start, 5000, 10);
  assert.equal(left.x, 5);
  assert.equal(left.direction, 1);
  const edge = motion.advanceMotion(start, 2000, 10);
  assert.equal(edge.x, 10);
  assert.equal(edge.direction, -1);
});

test('runs for four seconds then integrates the remaining time at walking speed', () => {
  const whipped = motion.whipMotion(motion.createMotion(0), 0, 100);
  assert.equal(motion.advanceMotion(whipped, 2000, 100).x, 30);
  const expired = motion.advanceMotion(whipped, 5000, 100);
  assert.equal(expired.x, 65);
  assert.equal(expired.boostUntil, 4000);
});

test('a second whip refreshes rather than stacks the speed multiplier', () => {
  const first = motion.whipMotion(motion.createMotion(0), 0, 200);
  const second = motion.whipMotion(first, 3000, 200);
  const after = motion.advanceMotion(second, 6000, 200);
  assert.equal(after.x, 90);
  assert.equal(after.boostUntil, 7000);
  assert.equal(after.whips, 2);
});

test('pause freezes position, resume does not jump, and clicks resume a paused crab', () => {
  const paused = motion.pauseMotion(motion.createMotion(0), 1000, 100);
  assert.equal(paused.x, 5);
  assert.equal(motion.advanceMotion(paused, 8000, 100).x, 5);
  const resumed = motion.resumeMotion(paused, 8000);
  assert.equal(motion.advanceMotion(resumed, 9000, 100).x, 10);
  const whipped = motion.whipMotion(paused, 8000, 100);
  assert.equal(whipped.paused, false);
  assert.equal(motion.advanceMotion(whipped, 9000, 100).x, 20);
});

test('an idle jump stays in place and paused, with the crack before the leap', () => {
  const paused = motion.pauseMotion(motion.createMotion(0), 1000, 100);
  const jumped = motion.jumpMotion(paused, 2000);
  assert.equal(jumped.paused, true);
  assert.equal(jumped.boostUntil, 0);
  assert.equal(jumped.crackUntil, 2000 + motion.CRACK_MS);
  assert.equal(jumped.jumpUntil, 2000 + motion.CRACK_MS + motion.JUMP_MS);
  assert.equal(motion.advanceMotion(jumped, 3000, 100).x, paused.x);
});

test('resizing clamps inside the lane; zero-width lanes never divide by zero', () => {
  const walked = motion.advanceMotion(motion.createMotion(0), 8000, 100);
  const resized = motion.advanceMotion(walked, 8000, 12);
  assert.equal(resized.x, 12);
  assert.equal(resized.direction, -1);
  const tiny = motion.advanceMotion(resized, 10000, 0);
  assert.equal(tiny.x, 0);
  assert.ok(Number.isFinite(tiny.x));
});

test('motion updates are immutable and backward clock readings cause no reverse travel', () => {
  const start = motion.createMotion(1000);
  const next = motion.advanceMotion(start, 500, 100);
  assert.equal(start.x, 0);
  assert.equal(next.x, 0);
  assert.equal(next.updatedAt, 1000);
});
