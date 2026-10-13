import { describe, expect, mock, test } from 'claude-code/testing';

const props = {
  hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 12 }, view: {},
};

describe('crab whip', () => {
  const coreBand = () => ({ type: 'Box' as const, props: {}, children: [] });
  // Clawd is hidden until shown; most tests start with it shown, as remembered.
  const crabOn = (on: any) => on('store.get', ($: unknown, e: { key: string }) =>
    ({ value: e.key === 'crab' ? true : undefined }));
  // The terminal lane is a Client, so its art is the pixel rows it is handed.
  const art = async (ui: { find: (q: { key: string }) => Promise<any> }) => {
    const lane = await ui.find({ key: 'crab-lane' });
    return lane?.type === 'Client' ? JSON.stringify(lane.props.props) : lane?.text;
  };
  // A click anywhere on the terminal's lane whips; elsewhere the crab is a Button.
  const whip = async (ui: any, surface = 'terminal') => surface === 'terminal'
    ? ui.pointer({ type: 'down', x: 40, y: 1, button: 'left', in: 'crab-lane' })
    : ui.press({ key: 'whip' });

  test('the live engine default band leaves room for the crab art and the radio bar', async ($, on) => {
    const clock = mock.clock(on);
    on('ui.render', () => ({ type: 'engine', ref: 0 }));
    crabOn(on);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('turn.start', ($, e) => ({ turnId: e.turnId }));
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-whip', surface: 'terminal',
      component: 'AbovePrompt', props: { ...props, bodyColumns: 75, maxRows: 10 } });
    expect(await ui.find({ key: 'radio' })).toBeDefined();
    await $.turn.start({ text: 'task', turnId: 'first' });
    const before = await art(ui);
    expect(before).toContain('█');
    await clock.advance(500);
    expect(await art(ui)).not.toBe(before);
  });

  test('an idle session rests until a task starts', async ($, on) => {
    const clock = mock.clock(on);
    on('ui.render', coreBand);
    crabOn(on);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('turn.start', ($, e) => ({ turnId: e.turnId }));
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-whip', surface: 'terminal', component: 'AbovePrompt', props });
    const idle = await art(ui);
    await clock.advance(2000);
    expect(await art(ui)).toBe(idle);
    await $.turn.start({ text: 'task', turnId: 'first' });
    await clock.advance(500);
    expect(await art(ui)).not.toBe(idle);
  });

  for (const surface of ['terminal', 'desktop'] as const) {
    test(`clicking the idle crab on ${surface} swings the whip, plays the crack, and jumps in place`, async ($, on) => {
      const clock = mock.clock(on);
      on('ui.render', coreBand);
      crabOn(on);
      const clips: unknown[] = [];
      on('session.start', ($, e) => ({ cwd: e.cwd }));
      on('audio.play', ($, e) => { clips.push(e); return { value: undefined }; });
      await $.session.start({ surface, isInteractive: true, cwd: '/work' });
      const ui = await $.ui.mount({ plugin: 'clawd-whip', surface, component: 'AbovePrompt', props });
      const idle = await art(ui);
      expect(await ui.find({ key: 'pause' })).toBeUndefined();
      expect(await ui.find({ key: 'mute' })).toBeUndefined();
      await whip(ui, surface);
      expect(clips).toHaveLength(1);
      expect(clips[0]).toMatchObject({ clip: { asset: 'assets/whip-crack.wav' } });
      const swing = await art(ui);
      expect(swing).not.toBe(idle);
      await clock.advance(600);
      const leap = await art(ui);
      expect(leap).not.toBe(swing);
      expect(leap).not.toBe(idle);
      await clock.advance(400);
      expect(await art(ui)).toBe(idle);
      await clock.advance(1000);
      expect(await art(ui)).toBe(idle);
    });
  }

  test('whipping during a task sprints, then the crab walks on', async ($, on) => {
    const clock = mock.clock(on);
    on('ui.render', coreBand);
    crabOn(on);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('turn.start', ($, e) => ({ turnId: e.turnId }));
    on('audio.play', () => ({ value: undefined }));
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-whip', surface: 'terminal', component: 'AbovePrompt', props });
    await $.turn.start({ text: 'task', turnId: 'first' });
    await whip(ui);
    await clock.advance(400);
    const sprint = await art(ui);
    await clock.advance(4000);
    const walking = await art(ui);
    expect(walking).not.toBe(sprint);
    await clock.advance(500);
    expect(await art(ui)).not.toBe(walking);
  });

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

  test('the equalizer plays and stops the selected station, bouncing while it plays', async ($, on) => {
    const clock = mock.clock(on);
    on('ui.render', coreBand);
    crabOn(on);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    const runs: (readonly string[])[] = [];
    const spawned: (readonly string[])[] = [];
    let killed = false;
    on('process.run', ($, e) => { runs.push(e.argv); return { value: { exitCode: 0, stdout: 'https://stream.example/live.m3u8\n', stderr: '' } }; });
    const tick = player(on, spawned, () => { killed = true; });
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-whip', surface: 'terminal', component: 'AbovePrompt', props });
    expect(await selected(ui)).toBe('Claude FM');
    const bars = async () => (await ui.find({ key: 'radio' }))?.text;
    expect((await ui.find({ key: 'radio' }))?.props.label).toBe('Play');
    expect(await bars()).toBe('▄▄▄');
    await ui.press({ key: 'radio' });
    await settle();
    expect(runs[0]?.[0]).toBe('yt-dlp');
    expect(spawned[0]).toEqual(['ffplay', '-nodisp', '-hide_banner', 'https://stream.example/live.m3u8']);
    await ui.redraw();
    expect((await ui.find({ key: 'radio' }))?.props.label).toBe('Stop');
    const playing = await bars();
    expect(playing).toMatch(/^[▁-█]{3}$/);
    await clock.advance(250);
    tick();
    await settle();
    await ui.redraw();
    expect(await bars()).not.toBe(playing);
    await ui.press({ key: 'radio' });
    tick();
    await settle();
    expect(killed).toBe(true);
    expect((await ui.find({ key: 'radio' }))?.props.label).toBe('Play');
  });

  test('the radio keeps playing when a task finishes', async ($, on) => {
    mock.clock(on);
    on('ui.render', coreBand);
    crabOn(on);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('turn.start', ($, e) => ({ turnId: e.turnId }));
    on('turn.complete', ($, e) => ({ text: e.answer }));
    let killed = false;
    on('process.run', () => ({ value: { exitCode: 0, stdout: 'https://stream.example/live.m3u8\n', stderr: '' } }));
    const tick = player(on, [], () => { killed = true; });
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-whip', surface: 'terminal', component: 'AbovePrompt', props });
    await $.turn.start({ text: 'task', turnId: 'first' });
    await ui.press({ key: 'radio' });
    await settle();
    await $.turn.complete({ turnId: 'first', answer: '', reason: 'answer', isAborted: false, durationMs: 0 });
    tick();
    await settle();
    expect(killed).toBe(false);
    await ui.redraw();
    expect((await ui.find({ key: 'radio' }))?.props.label).toBe('Stop');
  });

  test('the radio row lists every station that fits, scrolling around the selected one', async ($, on) => {
    mock.clock(on);
    on('ui.render', coreBand);
    crabOn(on);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const wide = await $.ui.mount({ plugin: 'clawd-whip', surface: 'terminal',
      component: 'AbovePrompt', props: { ...props, bodyColumns: 120 } });
    expect(await wide.find({ key: 'crab-lane' })).toBeDefined();
    const many = await stations(wide);
    expect(many.slice(0, 5)).toEqual(['Claude FM', 'Lofi Girl', 'Synthwave', 'Groove Salad', 'Fluid']);
    expect(many.length).toBeGreaterThan(8);
    expect(many.at(-1)).toBe('›');
    const standard = await $.ui.mount({ plugin: 'clawd-whip', surface: 'terminal', component: 'AbovePrompt', props });
    const shown = await stations(standard);
    expect(shown[0]).toBe('Claude FM');
    expect(shown.at(-1)).toBe('›');
    expect(shown.length).toBeGreaterThan(4);
    const tab = await $.ui.mount({ plugin: 'clawd-whip', surface: 'terminal',
      component: 'AbovePrompt', props: { ...props, bodyColumns: 30 } });
    expect(await tab.find({ key: 'crab-lane' })).toBeDefined();
    expect(await stations(tab)).toEqual(['Claude FM', '›']);
    await tab.press({ key: 'station-next' });
    await tab.press({ key: 'station-next' });
    expect(await stations(tab)).toEqual(['‹', 'Synthwave', '›']);
  });

  test('picking a station plays it, picking another retunes, picking the playing one stops it', async ($, on) => {
    mock.clock(on);
    on('ui.render', coreBand);
    crabOn(on);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('session.end', () => ({ sessionId: 'test-session' }));
    const runs: (readonly string[])[] = [];
    const spawned: (readonly string[])[] = [];
    let killed = 0;
    on('process.run', ($, e) => { runs.push(e.argv); return { value: { exitCode: 0, stdout: 'https://stream.example/live.m3u8\n', stderr: '' } }; });
    const tick = player(on, spawned, () => { killed += 1; });
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-whip', surface: 'terminal',
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
    expect((await ui.find({ key: 'radio' }))?.props.label).toBe('Stop');
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
    const ui = await $.ui.mount({ plugin: 'clawd-whip', surface: 'terminal', component: 'AbovePrompt', props });
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
    crabOn(on);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('process.run', () => { throw new Error('yt-dlp: not found'); });
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-whip', surface: 'terminal',
      component: 'AbovePrompt', props: { ...props, bodyColumns: 120 } });
    await ui.press({ key: 'radio' });
    await settle();
    await ui.redraw();
    expect((await ui.find({ key: 'radio' }))?.props.label).toBe('Retry');
    expect(await ui.find({ type: 'Text', text: 'Needs yt-dlp and ffplay' })).toBeDefined();
  });

  test('failed sound playback keeps the click and animation working', async ($, on) => {
    const clock = mock.clock(on);
    on('ui.render', coreBand);
    crabOn(on);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('audio.play', () => { throw new Error('No audio device'); });
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-whip', surface: 'terminal', component: 'AbovePrompt', props });
    const idle = await art(ui);
    await whip(ui);
    await clock.advance(400);
    expect(await art(ui)).not.toBe(idle);
  });

  test('Clawd is hidden until the 🦀 at the end of the radio row shows it, and is remembered', async ($, on) => {
    mock.clock(on);
    on('ui.render', coreBand);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    const store = new Map<string, unknown>();
    on('store.get', ($, e) => ({ value: store.get(e.key) }));
    on('store.set', ($, e) => { store.set(e.key, e.value); return { value: undefined }; });
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-whip', surface: 'terminal', component: 'AbovePrompt', props });
    expect(await ui.find({ key: 'crab-lane' })).toBeUndefined();
    const labels = (await ui.findAll({ type: 'Button' })).map(button => button.props.label);
    expect(labels[0]).toBe('Play');
    expect(labels.at(-1)).toBe('Show Clawd');
    expect((await ui.find({ key: 'crab' }))?.text).toBe('🦀');
    await ui.press({ key: 'crab' });
    expect(await ui.find({ key: 'crab-lane' })).toBeDefined();
    expect((await ui.find({ key: 'crab' }))?.props.label).toBe('Hide Clawd');
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(store.get('crab')).toBe(true);
    await ui.press({ key: 'crab' });
    expect(await ui.find({ key: 'crab-lane' })).toBeUndefined();
    expect(store.get('crab')).toBe(false);
  });

  test('a band too short for Clawd keeps the radio row and its toggle', async ($, on) => {
    mock.clock(on);
    on('ui.render', coreBand);
    crabOn(on);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-whip', surface: 'terminal',
      component: 'AbovePrompt', props: { ...props, bodyColumns: 24, maxRows: 1 } });
    expect(await ui.find({ key: 'crab-lane' })).toBeUndefined();
    const labels = (await ui.findAll({ type: 'Button' })).map(button => button.props.label);
    expect(labels).toEqual(['Play', 'Claude FM', '›', 'Hide Clawd']);
  });

  test('headless sessions do not schedule frame refreshes or draw anything', async ($, on) => {
    const clock = mock.clock(on);
    let redraws = 0;
    on('ui.render', coreBand);
    crabOn(on);
    on('ui.invalidate', () => { redraws += 1; return { value: undefined }; });
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    await $.session.start({ surface: null, isInteractive: false, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-whip', surface: 'terminal', component: 'AbovePrompt', props });
    await clock.advance(1000);
    expect(redraws).toBe(0);
    expect(await ui.find({ key: 'whip' })).toBeUndefined();
    expect(await ui.find({ key: 'radio' })).toBeUndefined();
  });

  test('session end stops frame refreshes', async ($, on) => {
    const clock = mock.clock(on);
    let redraws = 0;
    on('ui.invalidate', () => { redraws += 1; return { value: undefined }; });
    crabOn(on);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('session.end', () => ({ sessionId: 'test-session' }));
    on('turn.start', ($, e) => ({ turnId: e.turnId }));
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    await $.turn.start({ text: 'task', turnId: 'first' });
    redraws = 0;
    await clock.advance(300);
    expect(redraws).toBe(3);
    await $.session.end({ reason: 'prompt_input_exit', sessionId: 'test-session',
      resume: { id: 'test-session' } });
    await clock.advance(1000);
    expect(redraws).toBe(3);
  });

  test('surveys keep their own band, and other mods are composed above ours', async ($, on) => {
    mock.clock(on);
    on('ui.render', () => ({ type: 'Text', props: {}, children: ['Another mod'] }));
    crabOn(on);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-whip', surface: 'terminal', component: 'AbovePrompt', props });
    expect(await ui.find({ type: 'Text', text: 'Another mod' })).toBeDefined();
    await ui.redraw({ ...props, hasSurvey: true });
    expect(await ui.find({ type: 'Text', text: 'Another mod' })).toBeDefined();
    expect(await ui.find({ key: 'whip' })).toBeUndefined();
  });

  test('the art yields when another band consumes the remaining rows', async ($, on) => {
    mock.clock(on);
    on('ui.render', () => ({ type: 'Text', props: {}, children: ['Another mod'] }));
    crabOn(on);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-whip', surface: 'terminal',
      component: 'AbovePrompt', props: { ...props, maxRows: 2 } });
    expect(await ui.find({ type: 'Text', text: 'Another mod' })).toBeDefined();
    expect(await ui.find({ key: 'crab-lane' })).toBeUndefined();
    expect(await ui.find({ key: 'crab' })).toBeDefined();
    expect(await ui.find({ key: 'radio' })).toBeDefined();
  });

  const dimensionCases: Record<string, string | number>[] = [{ height: 3 }, { minHeight: 3 },
    { paddingTop: 2, paddingBottom: 1 }, { height: '100%' }];
  for (const previousProps of dimensionCases) {
    test(`artwork respects preceding box dimensions ${JSON.stringify(previousProps)}`, async ($, on) => {
      mock.clock(on);
      on('ui.render', () => ({ type: 'Box', props: previousProps, children: [] }));
      crabOn(on);
      on('session.start', ($, e) => ({ cwd: e.cwd }));
      await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
      const ui = await $.ui.mount({ plugin: 'clawd-whip', surface: 'terminal',
        component: 'AbovePrompt', props: { ...props, maxRows: 7 } });
      expect((await ui.find({ key: 'crab-lane' }))?.type).toBeUndefined();
      expect(await ui.find({ key: 'crab' })).toBeDefined();
    });
  }

  for (const reason of ['answer', 'aborted'] as const) {
    test(`${reason} stops the crab, and the next task starts it walking again`, async ($, on) => {
      const clock = mock.clock(on);
      on('ui.render', coreBand);
      crabOn(on);
      on('session.start', ($, e) => ({ cwd: e.cwd }));
      on('turn.start', ($, e) => ({ turnId: e.turnId }));
      on('turn.complete', ($, e) => ({ text: e.answer }));
      await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
      const ui = await $.ui.mount({ plugin: 'clawd-whip', surface: 'terminal', component: 'AbovePrompt', props });
      await $.turn.start({ text: 'task', turnId: 'first' });
      await clock.advance(700);
      await $.turn.complete({ turnId: 'first', answer: '', reason, isAborted: reason === 'aborted', durationMs: 700 });
      const stopped = await art(ui);
      await clock.advance(2000);
      expect(await art(ui)).toBe(stopped);
      await $.turn.start({ text: 'next task', turnId: 'second' });
      await clock.advance(500);
      expect(await art(ui)).not.toBe(stopped);
    });
  }

  test('session restart resets the crab to rest at the start of its lane', async ($, on) => {
    const clock = mock.clock(on);
    on('ui.render', coreBand);
    crabOn(on);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('session.end', () => ({ sessionId: 'test-session' }));
    on('turn.start', ($, e) => ({ turnId: e.turnId }));
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-whip', surface: 'terminal', component: 'AbovePrompt', props });
    const initial = await art(ui);
    await $.turn.start({ text: 'task', turnId: 'first' });
    await clock.advance(1000);
    await $.session.end({ reason: 'prompt_input_exit', sessionId: 'test-session', resume: { id: 'test-session' } });
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    await ui.redraw();
    expect(await art(ui)).toBe(initial);
    await clock.advance(500);
    expect(await art(ui)).toBe(initial);
  });

  test('a subagent finishing does not stop the main crab', async ($, on) => {
    const clock = mock.clock(on);
    on('ui.render', coreBand);
    crabOn(on);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('turn.complete', ($, e) => ({ text: e.answer }));
    on('turn.start', ($, e) => ({ turnId: e.turnId }));
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd-whip', surface: 'terminal', component: 'AbovePrompt', props });
    await $.turn.start({ text: 'task', turnId: 'main' });
    const before = await art(ui);
    await $.turn.complete({ turnId: 'child', agentId: 'child-agent', answer: '', reason: 'answer', isAborted: false, durationMs: 0 });
    await clock.advance(500);
    expect(await art(ui)).not.toBe(before);
  });
});
