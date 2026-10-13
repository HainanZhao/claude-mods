// The host statically reads literal on(...) and $.noun.method(...) calls, so
// every helper using $ stays in this file.
const STREAMTHEWORLD = 'https://playerservices.streamtheworld.com/api/livestream-redirect/';
// Claude FM is the live stream /radio opens in a browser. YouTube streams need
// yt-dlp to find today's audio URL; the rest are direct streams ffplay reads.
const CATALOG = [
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
  { name: 'US Rap', url: 'https://streams.ilovemusic.de/iloveradio13.mp3' },
  { name: 'Old School', url: 'https://listen.181fm.com/181-oldschool_128k.mp3' },
  { name: 'Radio Paradise', url: 'https://stream.radioparadise.com/mp3-192' },
  { name: 'KEXP', url: 'https://kexp-mp3-128.streamguys1.com/kexp128.mp3' },
  { name: 'Rock Mix', url: 'https://stream.radioparadise.com/rock-192' },
  { name: 'Classic Rock', url: 'https://stream.rockantenne.de/classic-perlen/stream/mp3' },
  { name: 'Hard Rock', url: 'https://listen.181fm.com/181-hardrock_128k.mp3' },
  { name: 'Metal', url: 'https://ice1.somafm.com/metal-128-mp3' },
  { name: 'Alt Rock', url: 'https://listen.181fm.com/181-90salt_128k.mp3' },
  { name: 'Punk', url: 'https://stream.rockantenne.de/punkrock/stream/mp3' },
  { name: '80s', url: 'https://ice1.somafm.com/u80s-128-mp3' },
  { name: '70s', url: 'https://ice1.somafm.com/seventies-128-mp3' },
  { name: 'Jazz', url: 'https://stream.srg-ssr.ch/m/rsj/mp3_128' },
  { name: 'Nu Jazz', url: 'https://ice1.somafm.com/sonicuniverse-128-mp3' },
  { name: 'Electro Swing', url: 'https://jazz-wr04.ice.infomaniak.ch/jazz-wr04-128.mp3' },
  { name: 'Classical', url: 'https://stream.srg-ssr.ch/m/rsc_de/mp3_128' },
  { name: 'Reggae', url: 'https://ice1.somafm.com/reggae-128-mp3' },
  { name: 'Country', url: 'https://listen.181fm.com/181-kickincountry_128k.mp3' },
  { name: 'Country Mix', url: 'https://strm112.1.fm/country_mobile_mp3' },
  { name: 'Americana', url: 'https://ice1.somafm.com/bootliquor-128-mp3' },
  { name: 'Folk', url: 'https://ice1.somafm.com/folkfwd-128-mp3' },
  { name: 'DEF CON', url: 'https://ice1.somafm.com/defcon-128-mp3' },
  { name: 'NTS', url: 'https://stream-relay-geo.ntslive.net/stream' },
  // Singapore's Mediacorp and SPH stations, in English, Chinese, Malay and Tamil.
  { name: 'Class 95', url: STREAMTHEWORLD + 'CLASS95AAC.aac', singapore: true },
  { name: '987', url: STREAMTHEWORLD + '987FMAAC.aac', singapore: true },
  { name: 'Kiss92', url: STREAMTHEWORLD + 'KISS_92AAC.aac', singapore: true },
  { name: 'ONE FM 91.3', url: STREAMTHEWORLD + 'ONE_FM_913AAC.aac', singapore: true },
  { name: 'Gold 905', url: STREAMTHEWORLD + 'GOLD905AAC.aac', singapore: true },
  { name: 'CNA 938', url: STREAMTHEWORLD + '938NOWAAC.aac', singapore: true },
  { name: 'Money 89.3', url: STREAMTHEWORLD + 'MONEY_893AAC.aac', singapore: true },
  { name: 'Symphony 924', url: STREAMTHEWORLD + 'SYMPHONY924AAC.aac', singapore: true },
  { name: 'YES 933', url: STREAMTHEWORLD + 'YES933AAC.aac', singapore: true },
  { name: 'Love 972', url: STREAMTHEWORLD + 'LOVE972FMAAC.aac', singapore: true },
  { name: 'Capital 958', url: STREAMTHEWORLD + 'CAPITAL958FMAAC.aac', singapore: true },
  { name: 'UFM 100.3', url: STREAMTHEWORLD + 'UFM_1003AAC.aac', singapore: true },
  { name: 'Hao 96.3', url: STREAMTHEWORLD + 'HAO_963AAC.aac', singapore: true },
  { name: 'Ria 897', url: STREAMTHEWORLD + 'RIA897FMAAC.aac', singapore: true },
  { name: 'Warna 942', url: STREAMTHEWORLD + 'WARNA942FMAAC.aac', singapore: true },
  { name: 'Oli 968', url: STREAMTHEWORLD + 'OLI968FMAAC.aac', singapore: true },
];
// The `stations` setting narrows the catalog: all, singapore, or international.
let STATIONS = CATALOG;
let station = 0;
// The first station in view once the arrows have scrolled; null centres the
// view on the selected station. `shown` is the window last drawn.
let viewFrom = null;
let shown = null;
let radio = 'off'; // off | tuning | on | error
let radioStream = null;
let radioGeneration = 0;
// A spawned child dies with the dispatch that spawned it, and a Button's comes
// from a render the host drops when the band redraws (as when a task ends).
// So ffplay runs in a worker under session.start; presses only post to it.
let radioWanted = false;
let wakeRadio = null;
let active = false;
let generation = 0;

export function register(on, options = {}) {
  const only = options.stations;
  STATIONS = only === 'singapore' ? CATALOG.filter(({ singapore }) => singapore)
    : only === 'international' ? CATALOG.filter(({ singapore }) => !singapore)
      : CATALOG;
  on('session.start', async ($, e, next) => {
    const mine = ++generation;
    active = false;
    stopRadio();
    wakeRadio?.();
    const result = await next(e);
    // The last station chosen, by name so a reordered list still finds it.
    const saved = await $.store.get('station').catch(() => undefined);
    if (mine !== generation) return result;
    const remembered = STATIONS.findIndex(({ name }) => name === saved);
    if (remembered >= 0) station = remembered;
    viewFrom = null;
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
    active = false;
    stopRadio();
    wakeRadio?.();
    return next(e);
  });

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const props = e.props ?? e;
    const previous = await next(e);
    if (!active || props.hasSurvey) return previous;
    const { Box, Text, Button } = $.ui.resolve(e);
    const columns = Math.max(1, Math.min(240, props.bodyColumns ?? e.viewport?.columns ?? 80));
    // The band's [-] collapse mark sits at the end of its top row; when nothing
    // is drawn above the radio, that row is ours, so we stop short of it.
    const alone = !previous || previous.type === 'engine' || (previous.children ?? []).length === 0;
    const width = Math.max(1, columns - (alone ? 4 : 0));
    // A column of padding at each end keeps the buttons off the pane's edges.
    const [left, right] = radioControls(Text, Button, width - 2, {
      toggle: () => toggleRadio($), pick: index => pick($, index), scroll: direction => scroll($, direction) });
    // The radio closes the band, below whatever other mods draw. The play button
    // and ‹ hold the left end and › the right, so neither moves as the view pages.
    return Box({ flexDirection: 'column', children: [previous,
      Box({ key: 'radio-bar', flexDirection: 'row', justifyContent: 'space-between', width,
        paddingLeft: 1, paddingRight: 1, children: [
          Box({ flexDirection: 'row', gap: 2, children: left }), Box({ flexDirection: 'row', gap: 2, children: right })] })] });
  }).catch(($, e, next) => next(e));
}

const ORANGE = '#d77757';

// The radio row, laid out like a click wheel: play/pause, then the stations as
// a carousel centred on the selected one.
function radioControls(Text, Button, columns, { toggle, pick, scroll }) {
  const playing = radio === 'on';
  // A play/pause button, two columns in every state so nothing beside it moves.
  const glyph = { off: '▶ ', error: '▶ ', tuning: '⋯ ', on: '❚❚' }[radio];
  const tone = playing ? { color: ORANGE } : radio === 'tuning' ? { dimColor: true } : {};
  const state = Button({ key: 'radio', plain: true, label: { off: 'Play', tuning: 'Tuning', on: 'Pause', error: 'Retry' }[radio],
    onPress: toggle, children: Text({ ...tone, children: glyph }) });
  const reason = radio === 'error' && (STATIONS[station].youtube ? 'Needs yt-dlp and ffplay' : 'Station unreachable');
  // The right end only explains a station that can't play.
  const status = reason ? (columns >= reason.length + 30 ? `⚠ ${reason}` : '⚠') : '';
  const right = status ? [Text({ key: 'radio-status', dimColor: true, children: status })] : [];
  // Room for station names: the button, both arrows, the right end, and the gaps.
  const room = columns - 2 - 2 * 3 - status.length - 4;
  let [from, to] = [0, STATIONS.length];
  if (span(from, to) > room + 6 && viewFrom !== null) {
    // Scrolled: fill forward from where the arrows left the view, and back
    // from the end so the last page is full.
    from = Math.max(0, Math.min(STATIONS.length - 1, viewFrom));
    to = from + 1;
    while (to < STATIONS.length && span(from, to + 1) <= room) to += 1;
    while (to === STATIONS.length && from > 0 && span(from - 1, to) <= room) from -= 1;
  } else if (span(from, to) > room + 6) {
    // Grow out from the selected station a step at a time, left then right,
    // so it stays near the centre as the list scrolls.
    [from, to] = [station, station + 1];
    for (let grew = true; grew;) {
      grew = false;
      if (from > 0 && span(from - 1, to) <= room) [from, grew] = [from - 1, true];
      if (to < STATIONS.length && span(from, to + 1) <= room) [to, grew] = [to + 1, true];
    }
  }
  const items = [state];
  // An arrow with nothing past it still holds its place, so the carousel never shifts.
  shown = { from, to, room };
  const arrow = (key, label, direction, visible) => (visible
    ? Button({ key, plain: true, label, onPress: () => scroll(direction), children: Text({ dimColor: true, children: label }) })
    : Text({ children: ' ' }));
  if (from > 0 || to < STATIONS.length) items.push(arrow('station-prev', '‹', -1, from > 0));
  for (let index = from; index < to; index += 1) {
    const chosen = index === station;
    // The selected station stands out in bold, orange while it plays; the rest recede.
    items.push(Button({ key: `station-${index}`, plain: true, label: STATIONS[index].name,
      ...(chosen ? {} : { dimColor: true }), onPress: () => pick(index),
      children: Text({ ...(chosen ? { bold: true, ...(playing ? { color: ORANGE } : {}) } : { dimColor: true }),
        children: STATIONS[index].name }) }));
  }
  if (from > 0 || to < STATIONS.length) right.push(arrow('station-next', '›', 1, to < STATIONS.length));
  return [items, right];
}

function toggleRadio($) {
  if (!active) return;
  if (radio === 'on' || radio === 'tuning') stopRadio();
  else requestRadio();
  $.ui.invalidate('ui.render');
}

// Picking a station plays it; picking the one playing stops it.
function pick($, index) {
  if (!active) return;
  if (index === station) return toggleRadio($);
  // The view holds still, so the row doesn't recentre under the click.
  if (viewFrom === null && shown) viewFrom = shown.from;
  stopRadio();
  station = index;
  void $.store.set('station', STATIONS[station].name).catch(() => {});
  requestRadio();
  $.ui.invalidate('ui.render');
}

// The arrows page through the stations without touching the selection.
function scroll($, direction) {
  if (!active || !shown) return;
  const { from, to, room } = shown;
  if (direction > 0) {
    if (to >= STATIONS.length) return;
    viewFrom = to;
  } else {
    if (from <= 0) return;
    let start = from - 1;
    while (start > 0 && span(start - 1, from) <= room) start -= 1;
    viewFrom = start;
  }
  $.ui.invalidate('ui.render');
}

const span = (from, to) => STATIONS.slice(from, to).reduce((sum, { name }) => sum + name.length + 2, 0);

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
    // ffplay's stderr status line keeps this loop turning, so a stop is seen promptly.
    for await (const _ of stream) {
      if (radioStream !== stream) break;
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
