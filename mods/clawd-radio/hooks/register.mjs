import { createMotion, advanceMotion, whipMotion, jumpMotion, pauseMotion, resumeMotion } from './motion.mjs';
import { SPRITE_ROWS, SPRITE_WIDTH, quadrantRuns, lanePixels } from './art.mjs';

// The host statically reads literal on(...) and $.noun.method(...) calls.
// All helpers using $ stay in this file; pure art and motion are imported.
let motion = createMotion(0);
let timer = null;
// Claude FM is the live stream /radio opens in a browser. YouTube streams need
// yt-dlp to find today's audio URL; the rest serve plain MP3 that ffplay reads.
const STATIONS = [
  { name: 'Claude FM', url: 'https://www.youtube.com/watch?v=tRsQsTMvPNg', youtube: true },
  { name: 'Lofi Girl', url: 'https://www.youtube.com/@LofiGirl/live', youtube: true },
  { name: 'Synthwave', url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY', youtube: true },
  { name: 'Groove Salad', url: 'https://ice1.somafm.com/groovesalad-128-mp3' },
  { name: 'Fluid', url: 'https://ice1.somafm.com/fluid-128-mp3' },
  { name: 'Beat Blender', url: 'https://ice1.somafm.com/beatblender-128-mp3' },
  { name: 'Secret Agent', url: 'https://ice1.somafm.com/secretagent-128-mp3' },
  { name: 'Lush', url: 'https://ice1.somafm.com/lush-128-mp3' },
  { name: 'Drone Zone', url: 'https://ice1.somafm.com/dronezone-128-mp3' },
  { name: 'Deep Space', url: 'https://ice1.somafm.com/deepspaceone-128-mp3' },
  { name: 'Top 100', url: 'https://streams.ilovemusic.de/iloveradio9.mp3' },
  { name: 'PopTron', url: 'https://ice1.somafm.com/poptron-128-mp3' },
  { name: 'Indie Pop', url: 'https://ice1.somafm.com/indiepop-128-mp3' },
  { name: 'Hip Hop', url: 'https://streams.ilovemusic.de/iloveradio3.mp3' },
  { name: 'Dance', url: 'https://streams.ilovemusic.de/iloveradio2.mp3' },
  { name: 'Radio Paradise', url: 'https://stream.radioparadise.com/mp3-192' },
  { name: 'KEXP', url: 'https://kexp-mp3-128.streamguys1.com/kexp128.mp3' },
  { name: '80s', url: 'https://ice1.somafm.com/u80s-128-mp3' },
  { name: '70s', url: 'https://ice1.somafm.com/seventies-128-mp3' },
  { name: 'Jazz', url: 'https://stream.srg-ssr.ch/m/rsj/mp3_128' },
  { name: 'Nu Jazz', url: 'https://ice1.somafm.com/sonicuniverse-128-mp3' },
  { name: 'Electro Swing', url: 'https://jazz-wr04.ice.infomaniak.ch/jazz-wr04-128.mp3' },
  { name: 'Classical', url: 'https://stream.srg-ssr.ch/m/rsc_de/mp3_128' },
  { name: 'Reggae', url: 'https://ice1.somafm.com/reggae-128-mp3' },
  { name: 'Americana', url: 'https://ice1.somafm.com/bootliquor-128-mp3' },
  { name: 'Metal', url: 'https://ice1.somafm.com/metal-128-mp3' },
  { name: 'DEF CON', url: 'https://ice1.somafm.com/defcon-128-mp3' },
  { name: 'NTS', url: 'https://stream-relay-geo.ntslive.net/stream' },
];
let station = 0;
// Clawd stays hidden until the 🦀 at the end of the radio row shows it.
let crabShown = false;
// A three-bar equalizer marks the player's state; it bounces while one plays.
const EQ_FRAMES = ['▃▆▄', '▅▃▇', '▂▇▄', '▆▄▃', '▄▂▆', '▇▅▂'];
let eqFrame = 0;
let radio = 'off'; // off | tuning | on | error
let radioStream = null;
let radioGeneration = 0;
// A spawned child dies with the dispatch that spawned it, and a Button's comes
// from a render the host drops when the band redraws (as when a task ends).
// So ffplay runs in a worker under session.start; presses only post to it.
let radioWanted = false;
let wakeRadio = null;
let audioController = null;
let active = false;
let nowMs = 0;
let lastSoundAt = -Infinity;
let generation = 0;
let activityGeneration = 0;
let resting = false;
let currentTurnId = null;
// Columns the crab can walk in, as last drawn; motion is in real columns so the
// pace holds however narrow the lane beside the radio is.
let walkRoom = 80 - SPRITE_WIDTH;

export function register(on) {
  on('session.start', async ($, e, next) => {
    const mine = ++generation;
    activityGeneration += 1;
    active = false;
    stopAnimation();
    stopSound();
    stopRadio();
    wakeRadio?.();
    const result = await next(e);
    const time = await $.clock.now();
    // The last station chosen, by name so a reordered list still finds it.
    const saved = await $.store.get('station').catch(() => undefined);
    const shown = await $.store.get('crab').catch(() => undefined);
    if (mine !== generation) return result;
    const remembered = STATIONS.findIndex(({ name }) => name === saved);
    if (remembered >= 0) station = remembered;
    crabShown = shown === true;
    nowMs = time;
    // Rest until a task runs; walking only signals that Claude is working.
    motion = pauseMotion(createMotion(nowMs), nowMs, walkRoom);
    resting = true;
    currentTurnId = null;
    lastSoundAt = -Infinity;
    active = e.isInteractive;
    if (active) {
      void radioWorker($, mine);
      // The band may have been drawn before the session was ready.
      $.ui.invalidate('ui.render');
    }
    return result;
  }).catch(($, e, next) => next(e));

  on('session.end', ($, e, next) => {
    generation += 1;
    activityGeneration += 1;
    active = false;
    stopAnimation();
    stopSound();
    stopRadio();
    wakeRadio?.();
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
    const room = (props.maxRows ?? 12) - bandRows(previous, columns);
    // Don't hold the press for the stream's life.
    const notice = radio === 'error'
      && (STATIONS[station].youtube ? 'Needs yt-dlp and ffplay' : 'Needs ffplay, or offline');
    // A failure's reason takes room from the station list, as long as one station still fits.
    const reserve = notice && columns >= notice.length + 30 ? notice.length + 2 : 0;
    // The row's end keeps four columns for the 🦀 toggle and four for the
    // band's own [-] collapse mark, which shares the top row.
    const controls = radioControls(Text, Button, columns - reserve - 8, {
      toggle: () => toggleRadio($), pick: index => pick($, index), tune: delta => tune($, delta) });
    const lane = width => {
      walkRoom = Math.max(0, width - SPRITE_WIDTH);
      const { pixels, x: pixel } = lanePixels(motion, width);
      // On the terminal the whole lane takes the click, through a Client: a
      // lane-wide Button would invert under the pointer and the focus.
      if (e.surface === 'terminal') {
        return Client({ key: 'crab-lane', module: './lane.mjs', width, height: SPRITE_ROWS,
          props: { rows: quadrantRuns(pixels, 0, width) } });
      }
      const picture = (from, to) => Text({ children: quadrantRuns(pixels, from, to).flatMap((runs, row) =>
        [...(row ? ['\n'] : []), ...runs.map(({ text, ...colors }) => Text({ ...colors, children: text }))]) });
      // The crab may straddle half a cell; the Button covers every cell it touches.
      const [from, to] = [Math.floor(pixel / 2), Math.ceil(pixel / 2 + SPRITE_WIDTH)];
      const cells = [];
      if (from > 0) cells.push(picture(0, from));
      cells.push(Button({ key: 'whip', plain: true, onPress: () => whip($), children: picture(from, to) }));
      if (to < width) cells.push(picture(to, width));
      return Box({ key: 'crab-lane', flexDirection: 'row', width, height: SPRITE_ROWS, overflow: 'hidden', children: cells });
    };
    const children = [];
    if (crabShown && room - 1 >= SPRITE_ROWS && columns >= SPRITE_WIDTH) {
      // Stacked so the crab keeps the full width, even in narrow tab-style panes.
      children.push(lane(columns));
    }
    if (reserve) controls.push(Text({ dimColor: true, children: notice }));
    const toggle = Button({ key: 'crab', plain: true, label: crabShown ? 'Hide Clawd' : 'Show Clawd',
      onPress: () => toggleCrab($), children: Text({ children: '🦀' }) });
    children.push(Box({ key: 'radio-bar', flexDirection: 'row', justifyContent: 'space-between', width: Math.max(1, columns - 4),
      children: [Box({ flexDirection: 'row', gap: 2, children: controls }), toggle] }));
    return Box({ flexDirection: 'column', children: [previous,
      Box({ key: 'clawd-radio', flexDirection: 'column', children })] });
  }).catch(($, e, next) => next(e));
}

// The radio row: one emoji for the player's state, then the stations to pick
// from. Where they don't all fit, as many as fit around the selected one, with
// arrows at the ends to scroll.
function radioControls(Text, Button, columns, { toggle, pick, tune }) {
  // Silent, a solid gray block of the same size; tuning, a dimmer, lower one.
  const bars = { off: '▄▄▄', tuning: '▂▂▂', on: EQ_FRAMES[eqFrame % EQ_FRAMES.length], error: '⚠️' }[radio];
  const color = { off: { color: '#808080' }, on: { color: '#d77757' } }[radio] ?? { dimColor: true };
  const state = Button({ key: 'radio', plain: true, label: { off: 'Play', tuning: 'Tuning', on: 'Stop', error: 'Retry' }[radio],
    onPress: toggle, children: Text({ ...color, children: bars }) });
  const span = (from, to) => STATIONS.slice(from, to).reduce((sum, { name }) => sum + name.length + 2, 0);
  let [from, to] = [0, STATIONS.length];
  if (span(from, to) > columns - 4) {
    const room = columns - 10; // the state emoji and both arrows
    [from, to] = [station, station + 1];
    for (let grew = true; grew;) {
      grew = false;
      if (to < STATIONS.length && span(from, to + 1) <= room) [to, grew] = [to + 1, true];
      if (from > 0 && span(from - 1, to) <= room) [from, grew] = [from - 1, true];
    }
  }
  const items = [state];
  if (from > 0) items.push(Button({ key: 'station-prev', plain: true, label: '‹', onPress: () => tune(-1) }));
  for (let index = from; index < to; index += 1) {
    // The selected station at full strength, the rest dim until hovered.
    items.push(Button({ key: `station-${index}`, plain: true, label: STATIONS[index].name,
      ...(index === station ? {} : { dimColor: true }), onPress: () => pick(index) }));
  }
  if (to < STATIONS.length) items.push(Button({ key: 'station-next', plain: true, label: '›', onPress: () => tune(1) }));
  return items;
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
    // Motion keeps its time while Clawd is hidden; only drawing is skipped.
    if (crabShown) $.ui.invalidate('ui.render');
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

function toggleRadio($) {
  if (!active) return;
  if (radio === 'on' || radio === 'tuning') stopRadio();
  else requestRadio();
  $.ui.invalidate('ui.render');
}

function toggleCrab($) {
  if (!active) return;
  crabShown = !crabShown;
  void $.store.set('crab', crabShown).catch(() => {});
  $.ui.invalidate('ui.render');
}

// Picking a station plays it; picking the one playing stops it.
function pick($, index) {
  if (!active) return;
  if (index === station) return toggleRadio($);
  stopRadio();
  station = index;
  void $.store.set('station', STATIONS[station].name).catch(() => {});
  requestRadio();
  $.ui.invalidate('ui.render');
}

// Switching while playing retunes straight to the new station.
function tune($, delta) {
  if (!active) return;
  const playing = radio === 'on' || radio === 'tuning';
  stopRadio();
  station = (station + delta + STATIONS.length) % STATIONS.length;
  void $.store.set('station', STATIONS[station].name).catch(() => {});
  if (playing) requestRadio();
  $.ui.invalidate('ui.render');
}

function requestRadio() {
  radioWanted = true;
  radio = 'tuning';
  wakeRadio?.();
}

async function radioWorker($, mine) {
  while (mine === generation) {
    if (!radioWanted) await new Promise(resolve => { wakeRadio = resolve; });
    if (mine !== generation || !active) return;
    if (!radioWanted) continue;
    radioWanted = false;
    await playRadio($);
  }
}

async function playRadio($) {
  const mine = ++radioGeneration;
  const { url: page, youtube } = STATIONS[station];
  radio = 'tuning';
  try {
    let url = page;
    if (youtube) {
      const resolved = await $.process.run(['yt-dlp', '-g', '-f', 'bestaudio/best', page], { timeoutMs: 30000 });
      url = resolved.stdout.trim().split('\n').pop();
      if (mine !== radioGeneration || !active) return;
      if (resolved.exitCode !== 0 || !url) throw new Error('stream not resolved');
    }
    const stream = $.process.spawn({ argv: ['ffplay', '-nodisp', '-hide_banner', url] });
    radioStream = stream;
    radio = 'on';
    $.ui.invalidate('ui.render');
    // ffplay's stderr status line keeps this loop turning, so a stop is seen
    // promptly; it also paces the equalizer.
    let lastBeat = -Infinity;
    for await (const _ of stream) {
      if (radioStream !== stream) break;
      const time = await $.clock.now();
      if (time - lastBeat < 200) continue;
      lastBeat = time;
      eqFrame += 1;
      $.ui.invalidate('ui.render');
    }
    if (mine !== radioGeneration) return;
    radioStream = null;
    radio = 'off';
  } catch {
    if (mine !== radioGeneration) return;
    radioStream = null;
    radio = 'error';
  }
  if (active) $.ui.invalidate('ui.render');
}

function stopRadio() {
  radioGeneration += 1;
  radioWanted = false;
  const stream = radioStream;
  radioStream = null;
  radio = 'off';
  // Ending the stream kills ffplay; the loop's own break covers a pending pull.
  void stream?.return?.()?.catch?.(() => {});
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
