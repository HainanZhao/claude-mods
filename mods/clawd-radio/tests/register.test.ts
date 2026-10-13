import { describe, expect, mock, test } from 'claude-code/testing';

const props = {
  hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 12 }, view: {},
};

describe('clawd radio', () => {
  const coreBand = () => ({ type: 'Box' as const, props: {}, children: [] });

  // The station picked: the one station button drawn at full strength.
  const selected = async (ui: any) => (await ui.findAll({ type: 'Button' }))
    .find((button: any) => /^station-\d+$/.test(button.props.key) && !button.props.dimColor)?.props.label;
  const stations = async (ui: any) => (await ui.findAll({ type: 'Button' }))
    .filter((button: any) => /^station-/.test(button.props.key)).map((button: any) => button.props.label);
  // ffplay's status line: one piece each time the test ticks.
  const player = (on: any, spawned: (readonly string[])[], onKill: () => void) => {
    const ticks: (() => void)[] = [];
    on('process.spawn', async function* ($: unknown, e: { argv: readonly string[] }) {
      spawned.push(e.argv);
      try {
        while (true) {
          yield { stream: 'stderr' as const, text: 'A: 1.0\r' };
          await new Promise<void>(resolve => { ticks.push(resolve); });
        }
      } finally { onKill(); }
    });
    return () => ticks.splice(0).forEach(tick => tick());
  };
  const settle = () => new Promise(resolve => setTimeout(resolve, 10));
  // A playing radio keeps working, so each press waits out the harness's settle
  // bound; tests that play get more than the default five seconds.

  test('play and pause control the selected station', { timeoutMs: 15000 }, async ($, on) => {
    mock.clock(on);
    on('ui.render', coreBand);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    const runs: (readonly string[])[] = [];
    const spawned: (readonly string[])[] = [];
    let killed = false;
    on('process.run', ($, e) => { runs.push(e.argv); return { value: { exitCode: 0, stdout: 'https://stream.example/live.m3u8\n', stderr: '' } }; });
    const tick = player(on, spawned, () => { killed = true; });
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-radio', surface: 'terminal', component: 'AbovePrompt', props });
    expect(await selected(ui)).toBe('Claude FM');
    const button = async () => (await ui.find({ key: 'radio' }))?.text;
    expect((await ui.find({ key: 'radio' }))?.props.label).toBe('Play');
    expect(await button()).toBe('▶ ');
    await ui.press({ key: 'radio' });
    await settle();
    expect(runs[0]?.[0]).toBe('yt-dlp');
    expect(spawned[0]).toEqual(['ffplay', '-nodisp', '-hide_banner', 'https://stream.example/live.m3u8']);
    await ui.redraw();
    expect((await ui.find({ key: 'radio' }))?.props.label).toBe('Pause');
    expect(await button()).toBe('❚❚');
    // Nothing else on the row animates: the orange button and name say it's playing.
    expect(await ui.find({ key: 'radio-status' })).toBeUndefined();
    await ui.press({ key: 'radio' });
    tick();
    await settle();
    expect(killed).toBe(true);
    expect((await ui.find({ key: 'radio' }))?.props.label).toBe('Play');
  });

  test('the radio keeps playing when a task finishes', { timeoutMs: 15000 }, async ($, on) => {
    mock.clock(on);
    on('ui.render', coreBand);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('turn.start', ($, e) => ({ turnId: e.turnId }));
    on('turn.complete', ($, e) => ({ text: e.answer }));
    let killed = false;
    on('process.run', () => ({ value: { exitCode: 0, stdout: 'https://stream.example/live.m3u8\n', stderr: '' } }));
    const tick = player(on, [], () => { killed = true; });
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-radio', surface: 'terminal', component: 'AbovePrompt', props });
    await $.turn.start({ text: 'task', turnId: 'first' });
    await ui.press({ key: 'radio' });
    await settle();
    await $.turn.complete({ turnId: 'first', answer: '', reason: 'answer', isAborted: false, durationMs: 0 });
    tick();
    await settle();
    expect(killed).toBe(false);
    await ui.redraw();
    expect((await ui.find({ key: 'radio' }))?.props.label).toBe('Pause');
  });

  test('the view centres on the selected station, and the arrows page it without changing the selection', async ($, on) => {
    mock.clock(on);
    on('ui.render', coreBand);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    const store = new Map<string, unknown>([['station', 'Top 100']]);
    on('store.get', ($, e) => ({ value: store.get(e.key) }));
    on('store.set', ($, e) => { store.set(e.key, e.value); return { value: undefined }; });
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-radio', surface: 'terminal', component: 'AbovePrompt', props });
    const centred = await stations(ui);
    expect(centred[0]).toBe('‹');
    expect(centred.at(-1)).toBe('›');
    // Centred: about as many stations before the selected one as after it.
    const at = centred.indexOf('Top 100');
    expect(Math.abs(at - (centred.length - 1 - at))).toBeLessThanOrEqual(2);
    await ui.press({ key: 'station-next' });
    const next = await stations(ui);
    expect(next).not.toContain('Top 100');
    // A full page on: none of the stations from before are still in view.
    expect(next.filter(name => !'‹›'.includes(name) && centred.includes(name))).toEqual([]);
    expect(await selected(ui)).toBeUndefined();
    expect(store.get('station')).toBe('Top 100');
    await ui.press({ key: 'station-prev' });
    expect(await stations(ui)).toContain('Top 100');
    expect(await selected(ui)).toBe('Top 100');
    for (let pages = 0; (await stations(ui)).includes('›') && pages < 20; pages += 1) {
      await ui.press({ key: 'station-next' });
    }
    const last = await stations(ui);
    expect(last.at(-1)).toBe('Oli 968');
    expect(last[0]).toBe('‹');
  });

  test('the selected station is bold, and orange while it plays', { timeoutMs: 15000 }, async ($, on) => {
    mock.clock(on);
    on('ui.render', coreBand);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('process.run', () => ({ value: { exitCode: 0, stdout: 'https://stream.example/live.m3u8\n', stderr: '' } }));
    player(on, [], () => {});
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-radio', surface: 'terminal', component: 'AbovePrompt', props });
    const name = async () => (await ui.findAll({ type: 'Text' })).find((text: any) => text.text === 'Claude FM');
    expect((await name())?.props.bold).toBe(true);
    expect((await name())?.props.color).toBeUndefined();
    await ui.press({ key: 'station-0' });
    await settle();
    await ui.redraw();
    expect((await name())?.props.color).toBe('#d77757');
  });

  test('picking a station plays it, picking another retunes, picking the playing one stops it', { timeoutMs: 15000 }, async ($, on) => {
    mock.clock(on);
    on('ui.render', coreBand);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('session.end', () => ({ sessionId: 'test-session' }));
    const runs: (readonly string[])[] = [];
    const spawned: (readonly string[])[] = [];
    let killed = 0;
    on('process.run', ($, e) => { runs.push(e.argv); return { value: { exitCode: 0, stdout: 'https://stream.example/live.m3u8\n', stderr: '' } }; });
    const tick = player(on, spawned, () => { killed += 1; });
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-radio', surface: 'terminal',
      component: 'AbovePrompt', props: { ...props, bodyColumns: 120 } });
    // SomaFM serves plain MP3, so ffplay plays it without yt-dlp.
    await ui.press({ key: 'station-3' });
    await settle();
    expect(runs).toHaveLength(0);
    expect(spawned[0]).toEqual(['ffplay', '-nodisp', '-hide_banner', 'https://ice1.somafm.com/groovesalad-128-mp3']);
    await ui.press({ key: 'station-4' });
    tick();
    await settle();
    expect(killed).toBe(1);
    expect(spawned[1]).toEqual(['ffplay', '-nodisp', '-hide_banner', 'https://ice1.somafm.com/fluid-128-mp3']);
    await ui.redraw();
    expect(await selected(ui)).toBe('Fluid');
    expect((await ui.find({ key: 'radio' }))?.props.label).toBe('Pause');
    await ui.press({ key: 'station-4' });
    tick();
    await settle();
    expect(killed).toBe(2);
    expect((await ui.find({ key: 'radio' }))?.props.label).toBe('Play');
    await ui.press({ key: 'station-7' });
    await settle();
    await $.session.end({ reason: 'prompt_input_exit', sessionId: 'test-session', resume: { id: 'test-session' } });
    tick();
    await settle();
    expect(killed).toBe(3);
  });

  test('the radio starts on the last station chosen, remembered by name across sessions', async ($, on) => {
    mock.clock(on);
    on('ui.render', coreBand);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('session.end', () => ({ sessionId: 'test-session' }));
    on('process.run', () => { throw new Error('offline'); });
    const store = new Map<string, unknown>();
    on('store.get', ($, e) => ({ value: store.get(e.key) }));
    on('store.set', ($, e) => { store.set(e.key, e.value); return { value: undefined }; });
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-radio', surface: 'terminal', component: 'AbovePrompt', props });
    await ui.press({ key: 'station-1' });
    await settle();
    expect(store.get('station')).toBe('Lofi Girl');
    store.set('station', 'PopTron');
    await $.session.end({ reason: 'prompt_input_exit', sessionId: 'test-session', resume: { id: 'test-session' } });
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    await ui.redraw();
    expect(await selected(ui)).toBe('PopTron');
  });

  test('the radio row says what it needs when yt-dlp is missing', async ($, on) => {
    mock.clock(on);
    on('ui.render', coreBand);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('process.run', () => { throw new Error('yt-dlp: not found'); });
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-radio', surface: 'terminal',
      component: 'AbovePrompt', props: { ...props, bodyColumns: 120 } });
    await ui.press({ key: 'radio' });
    await settle();
    await ui.redraw();
    expect((await ui.find({ key: 'radio' }))?.props.label).toBe('Retry');
    expect(await ui.find({ type: 'Text', text: '⚠ Needs yt-dlp and ffplay' })).toBeDefined();
  });

  for (const [choice, first, last] of [['all', 'Claude FM', 'Oli 968'], ['singapore', 'Class 95', 'Oli 968'],
    ['international', 'Claude FM', 'NTS']] as const) {
    test(`the stations setting "${choice}" picks which stations the radio offers`, { options: { stations: choice } }, async ($, on) => {
      mock.clock(on);
      on('ui.render', coreBand);
      on('session.start', ($, e) => ({ cwd: e.cwd }));
      await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
      const ui = await $.ui.mount({ plugin: 'clawd-radio', surface: 'terminal', component: 'AbovePrompt', props });
      expect(await selected(ui)).toBe(first);
      for (let pages = 0; (await stations(ui)).includes('›') && pages < 30; pages += 1) {
        await ui.press({ key: 'station-next' });
      }
      expect((await stations(ui)).at(-1)).toBe(last);
    });
  }

  test('the radio closes the band, below other mods, and headless sessions draw nothing', async ($, on) => {
    mock.clock(on);
    on('ui.render', () => ({ type: 'Text', props: {}, children: ['Another mod'] }));
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-radio', surface: 'terminal', component: 'AbovePrompt', props });
    const band = await ui.find({ type: 'Box' });
    expect(band?.children.at(-1)?.props.key).toBe('radio-bar');
    expect(await ui.find({ type: 'Text', text: 'Another mod' })).toBeDefined();
    await ui.redraw({ ...props, hasSurvey: true });
    expect(await ui.find({ key: 'radio' })).toBeUndefined();
    await $.session.start({ surface: null, isInteractive: false, cwd: '/work' });
    await ui.redraw();
    expect(await ui.find({ key: 'radio' })).toBeUndefined();
  });
});
