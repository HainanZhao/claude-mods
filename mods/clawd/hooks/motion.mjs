export const WALK_SPEED = 5;
export const RUN_SPEED = 15;
export const BOOST_MS = 4000;
export const CRACK_MS = 350;
export const JUMP_MS = 500;

export function createMotion(now) {
  return { x: 0, direction: 1, updatedAt: now, boostUntil: 0,
    crackUntil: 0, jumpUntil: 0, gait: 0, paused: false, whips: 0 };
}

export function advanceMotion(state, now, lane) {
  const time = Math.max(state.updatedAt, now);
  const width = Math.max(0, lane);
  const startX = Math.min(width, Math.max(0, state.x));
  const direction = startX >= width ? -1 : state.direction;
  const runningMs = state.paused ? 0
    : Math.max(0, Math.min(time, state.boostUntil) - state.updatedAt);
  const elapsedMs = state.paused ? 0 : time - state.updatedAt;
  const distance = (runningMs * RUN_SPEED + (elapsedMs - runningMs) * WALK_SPEED) / 1000;
  if (width === 0) return { ...state, x: 0, updatedAt: time };
  // Unfold the reflected lane onto a circle of circumference 2 * width.
  const unfolded = direction > 0 ? startX : 2 * width - startX;
  const phase = (unfolded + distance) % (2 * width);
  return { ...state, x: phase <= width ? phase : 2 * width - phase,
    direction: phase < width ? 1 : -1, updatedAt: time,
    gait: state.gait + distance };
}

export function whipMotion(state, now, lane) {
  const advanced = advanceMotion(state, now, lane);
  return { ...advanced, paused: false, boostUntil: advanced.updatedAt + BOOST_MS,
    crackUntil: advanced.updatedAt + CRACK_MS, whips: advanced.whips + 1 };
}

// A whip with no task running: the crab jumps in place once the lash lands.
export function jumpMotion(state, now) {
  const time = Math.max(state.updatedAt, now);
  return { ...state, updatedAt: time, crackUntil: time + CRACK_MS,
    jumpUntil: time + CRACK_MS + JUMP_MS, whips: state.whips + 1 };
}

export function pauseMotion(state, now, lane) {
  return { ...advanceMotion(state, now, lane), paused: true };
}

export function resumeMotion(state, now) {
  return { ...state, paused: false, updatedAt: Math.max(state.updatedAt, now) };
}
