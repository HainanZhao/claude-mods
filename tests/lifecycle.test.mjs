import assert from 'node:assert/strict';
import { test } from 'node:test';

// Native tests exercise mounting/presses. This boundary harness can delay a
// host clock response and observe AbortSignals (which do not cross native hooks).
async function harness() {
  const { register } = await import(`../mods/clawd/hooks/register.mjs?case=${crypto.randomUUID()}`);
  const hooks = new Map();
  const clips = [];
  let now = 1000;
  let nowRead = () => Promise.resolve(now);
  let invalidations = 0;
  let callback;
  let timerStarts = 0;
  const element = type => props => ({ type, props,
    children: props.children == null ? [] : Array.isArray(props.children) ? props.children : [props.children] });
  const $ = {
    clock: {
      now: () => nowRead(),
      every: (ms, fn) => { timerStarts += 1; callback = fn; return { cancel() {} }; },
    },
    ui: {
      invalidate() { invalidations += 1; },
      resolve: () => Object.fromEntries(['Box', 'Text', 'Button', 'Client', 'Raster', 'Svg'].map(type => [type, element(type)])),
    },
    store: { get: async () => undefined, set: async () => {} },
    audio: { play: (clip, options) => {
      clips.push({ clip, options });
      return new Promise(resolve => options.signal.addEventListener('abort', resolve, { once: true }));
    } },
  };
  register((name, matcher, handler) => {
    hooks.set(name, handler ?? matcher);
    return { catch() {} };
  });
  const call = (name, e) => hooks.get(name)($, e, async () =>
    name === 'ui.render' ? { type: 'Box', props: {}, children: [] } : {});
  await call('session.start', { isInteractive: true });
  const tree = await call('ui.render', { surface: 'terminal', props: { bodyColumns: 80, maxRows: 12 } });
  function find(node, key) {
    if (node?.props?.key === key) return node;
    for (const child of node?.children ?? []) {
      const found = find(child, key);
      if (found) return found;
    }
  }
  return {
    // The terminal lane is a Client whose clicks arrive as ui.message posts.
    call, clips, press: key => (key === 'whip'
      ? call('ui.message', { element: 'crab-lane', data: { whip: true } })
      : find(tree, key).props.onPress()),
    frame: () => callback(), invalidations: () => invalidations,
    timers: () => timerStarts,
    delayClock: () => {
      let release;
      nowRead = () => {
        nowRead = () => Promise.resolve(now);
        return new Promise(resolve => { release = () => resolve(now); });
      };
      return () => release();
    },
    setTime: value => { now = value; },
  };
}

test('a clock response arriving after session end cannot start new audio', async () => {
  const h = await harness();
  const release = h.delayClock();
  const click = h.press('whip');
  await h.call('session.end', {});
  release();
  await click;
  assert.equal(h.clips.length, 0);
});

test('a frame awaiting the clock does not invalidate after session end', async () => {
  const h = await harness();
  await h.call('turn.start', { turnId: 'main' });
  const before = h.invalidations();
  const release = h.delayClock();
  const frame = h.frame();
  await h.call('session.end', {});
  release();
  await frame;
  assert.equal(h.invalidations(), before);
});

test('a rapid re-whip replaces the clip, and session end aborts it', async () => {
  const h = await harness();
  await h.press('whip');
  assert.equal(h.clips[0].options.signal.aborted, false);
  h.setTime(1200);
  await h.press('whip');
  assert.equal(h.clips.length, 2);
  assert.equal(h.clips[0].options.signal.aborted, true);
  await h.call('session.end', {});
  assert.equal(h.clips[1].options.signal.aborted, true);
});

test('a whip click awaiting the clock cannot restart walking after task completion', async () => {
  const h = await harness();
  await h.call('turn.start', { turnId: 'main' });
  const release = h.delayClock();
  const pending = h.press('whip');
  await h.call('turn.complete', { turnId: 'main', answer: '', reason: 'answer' });
  release();
  await pending;
  assert.equal(h.timers(), 1, 'task completion must not be undone by a pending whip click');
});
