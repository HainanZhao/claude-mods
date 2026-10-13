import { createMotion, advanceMotion, whipMotion, jumpMotion, pauseMotion, resumeMotion } from './motion.mjs';
import { SPRITE_ROWS, SPRITE_WIDTH, quadrantRuns, lanePixels } from './art.mjs';

// The host statically reads literal on(...) and $.noun.method(...) calls.
// All helpers using $ stay in this file; pure art and motion are imported.
let motion = createMotion(0);
let timer = null;
let audioController = null;
let active = false;
let nowMs = 0;
let lastSoundAt = -Infinity;
let generation = 0;
let activityGeneration = 0;
let resting = false;
let currentTurnId = null;
// Columns the crab can walk in, as last drawn; motion is in real columns so the
// pace holds whatever the pane's width.
let walkRoom = 80 - SPRITE_WIDTH;

export function register(on) {
  on('session.start', async ($, e, next) => {
    const mine = ++generation;
    activityGeneration += 1;
    active = false;
    stopAnimation();
    stopSound();
    const result = await next(e);
    const time = await $.clock.now();
    if (mine !== generation) return result;
    nowMs = time;
    // Rest until a task runs; walking only signals that Claude is working.
    motion = pauseMotion(createMotion(nowMs), nowMs, walkRoom);
    resting = true;
    currentTurnId = null;
    lastSoundAt = -Infinity;
    active = e.isInteractive;
    // The band may have been drawn before the session was ready.
    if (active) $.ui.invalidate('ui.render');
    return result;
  }).catch(($, e, next) => next(e));

  on('session.end', ($, e, next) => {
    generation += 1;
    activityGeneration += 1;
    active = false;
    stopAnimation();
    stopSound();
    return next(e);
  });

  on('turn.start', async ($, e, next) => {
    const mine = generation;
    const epoch = ++activityGeneration;
    currentTurnId = e.turnId;
    stopAnimation();
    const time = await $.clock.now();
    if (active && mine === generation && epoch === activityGeneration) {
      nowMs = time;
      resting = false;
      motion = resumeMotion({ ...motion, boostUntil: 0, crackUntil: 0, jumpUntil: 0 }, nowMs);
      startAnimation($);
      $.ui.invalidate('ui.render');
    }
    return next(e);
  }).catch(($, e, next) => next(e));

  on('turn.complete', async ($, e, next) => {
    const mine = generation;
    const epoch = activityGeneration;
    const result = await next(e);
    if (e.agentId || !active || (currentTurnId && currentTurnId !== e.turnId)) return result;
    const time = await $.clock.now();
    if (!active || mine !== generation || epoch !== activityGeneration) return result;
    activityGeneration += 1;
    nowMs = time;
    resting = true;
    motion = { ...pauseMotion(motion, nowMs, walkRoom), boostUntil: 0, crackUntil: 0, jumpUntil: 0 };
    stopAnimation();
    stopSound();
    $.ui.invalidate('ui.render');
    return result;
  }).catch(($, e, next) => next(e));

  // A click on the band hands its focus ring to its first control. Refusing it
  // on the crab keeps the crab from painting inverted; clicks still press it.
  on('ui.focus', { component: 'AbovePrompt' }, ($, e, next) => (e.element === 'whip' ? {} : next(e)));

  on('ui.message', ($, e, next) => {
    if (e.element === 'crab-lane' && e.data?.whip) void whip($);
    return next(e);
  });

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const props = e.props ?? e;
    const previous = await next(e);
    if (!active || props.hasSurvey) return previous;
    const { Box, Text, Button, Client } = $.ui.resolve(e);
    const columns = Math.max(1, Math.min(240, props.bodyColumns ?? e.viewport?.columns ?? 80));
    // One row stays free for whatever draws below, such as the radio.
    const room = (props.maxRows ?? 12) - bandRows(previous, columns) - 1;
    if (room < SPRITE_ROWS || columns < SPRITE_WIDTH) return previous;
    walkRoom = Math.max(0, columns - SPRITE_WIDTH);
    const { pixels, x: pixel } = lanePixels(motion, columns);
    let lane;
    if (e.surface === 'terminal') {
      // The whole lane takes the click, through a Client: a lane-wide Button
      // would invert under the pointer and the focus.
      lane = Client({ key: 'crab-lane', module: './lane.mjs', width: columns, height: SPRITE_ROWS,
        props: { rows: quadrantRuns(pixels, 0, columns) } });
    } else {
      const picture = (from, to) => Text({ children: quadrantRuns(pixels, from, to).flatMap((runs, row) =>
        [...(row ? ['\n'] : []), ...runs.map(({ text, ...colors }) => Text({ ...colors, children: text }))]) });
      // The crab may straddle half a cell; the Button covers every cell it touches.
      const [from, to] = [Math.floor(pixel / 2), Math.ceil(pixel / 2 + SPRITE_WIDTH)];
      const cells = [];
      if (from > 0) cells.push(picture(0, from));
      cells.push(Button({ key: 'whip', plain: true, onPress: () => whip($), children: picture(from, to) }));
      if (to < columns) cells.push(picture(to, columns));
      lane = Box({ key: 'crab-lane', flexDirection: 'row', width: columns, height: SPRITE_ROWS,
        overflow: 'hidden', children: cells });
    }
    // Clawd heads the band, so it sits above the radio whichever mod draws first.
    return Box({ flexDirection: 'column', children: [Box({ key: 'clawd', children: [lane] }), previous] });
  }).catch(($, e, next) => next(e));
}

const animating = () => !motion.paused || nowMs < motion.jumpUntil;

function startAnimation($) {
  if (timer || !active || !animating()) return;
  const mine = generation;
  const epoch = activityGeneration;
  timer = $.clock.every(100, async () => {
    const time = await $.clock.now();
    if (!active || !animating() || mine !== generation || epoch !== activityGeneration) return;
    nowMs = time;
    motion = advanceMotion(motion, nowMs, walkRoom);
    if (resting && nowMs >= motion.boostUntil && nowMs >= motion.jumpUntil) {
      motion = pauseMotion(motion, nowMs, walkRoom);
      stopAnimation();
      stopSound();
    }
    $.ui.invalidate('ui.render');
  });
}

function stopAnimation() {
  timer?.cancel();
  timer = null;
}

function stopSound() {
  audioController?.abort();
  audioController = null;
}

async function whip($) {
  if (!active) return;
  const mine = generation;
  const epoch = activityGeneration;
  const time = await $.clock.now();
  if (!active || mine !== generation || epoch !== activityGeneration) return;
  nowMs = time;
  // Running only signals that Claude is working, so an idle whip just startles it.
  motion = resting && nowMs >= motion.boostUntil ? jumpMotion(motion, nowMs) : whipMotion(motion, nowMs, walkRoom);
  startAnimation($);
  $.ui.invalidate('ui.render');
  // Animation responds to every click. Limit sound retriggers to 8 per second.
  if (nowMs - lastSoundAt < 125) return;
  lastSoundAt = nowMs;
  stopSound();
  const controller = new AbortController();
  audioController = controller;
  // Fire and forget: speaker latency must never hold the button or the agent.
  void $.audio.play({ asset: 'assets/whip-crack.wav' }, { gain: 1, signal: controller.signal })
    .catch(() => {})
    .finally(() => {
      if (audioController === controller) audioController = null;
    });
}

function inlineText(element) {
  if (typeof element === 'string') return element;
  return (element?.children ?? []).map(inlineText).join('');
}

// Conservative height estimate for the preceding mod's native tree. Never
// truncate its content; yield our artwork when the combined band needs room.
function bandRows(element, columns) {
  if (!element) return 0;
  if (typeof element === 'string') {
    return element ? element.split('\n').reduce((rows, line) => rows + Math.max(1, Math.ceil(Array.from(line).length / columns)), 0) : 0;
  }
  const props = element.props ?? {};
  const children = element.children ?? [];
  // next(e) returns this opaque core placeholder in the real host. AbovePrompt
  // has no core content outside a survey, to which our render hook already yields.
  // It must not be treated like an unknown-height drawing from another mod.
  if (element.type === 'engine') return 0;
  if (element.type === 'Text') {
    return bandRows(inlineText(element), columns);
  }
  if (element.type === 'Raster') return props.rows ?? 1;
  if (element.type === 'Client' && typeof props.height === 'number') return props.height;
  if (['Button', 'Input', 'Select', 'Link'].includes(element.type)) return 1;
  // Image, Markdown, Client, or percentage sizing can depend on a surface's
  // layout. If we cannot bound it here, give the existing mod all its space.
  if (element.type !== 'Box') return Infinity;
  if ([props.height, props.minHeight, props.width].some(size => typeof size === 'string')) return Infinity;
  const innerColumns = Math.max(1, Math.min(columns, props.width ?? columns)
    - 2 * (props.paddingX ?? props.padding ?? 0) - (props.borderStyle ? 2 : 0));
  const heights = children.map(child => bandRows(child, innerColumns));
  const content = props.flexDirection === 'row' && !props.flexWrap
    ? Math.max(0, ...heights) : heights.reduce((rows, height) => rows + height, 0);
  const padding = (props.paddingTop ?? props.paddingY ?? props.padding ?? 0)
    + (props.paddingBottom ?? props.paddingY ?? props.padding ?? 0);
  const margin = (props.marginTop ?? props.marginY ?? props.margin ?? 0)
    + (props.marginBottom ?? props.marginY ?? props.margin ?? 0);
  const gap = props.flexDirection === 'row' ? 0 : (props.gap ?? 0) * Math.max(0, children.length - 1);
  return Math.max(content + padding + gap + (props.borderStyle ? 2 : 0),
    props.height ?? 0, props.minHeight ?? 0) + margin;
}
