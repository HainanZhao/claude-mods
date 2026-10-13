import { describe, expect, mock, test } from 'claude-code/testing';

const props = {
  hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 12 }, view: {},
};

describe('clawd', () => {
  const coreBand = () => ({ type: 'Box' as const, props: {}, children: [] });
  // The terminal lane is a Client, so its art is the pixel rows it is handed.
  const art = async (ui: { find: (q: { key: string }) => Promise<any> }) => {
    const lane = await ui.find({ key: 'crab-lane' });
    return lane?.type === 'Client' ? JSON.stringify(lane.props.props) : lane?.text;
  };
  // A click anywhere on the terminal's lane whips; elsewhere the crab is a Button.
  const whip = async (ui: any, surface = 'terminal') => surface === 'terminal'
    ? ui.pointer({ type: 'down', x: 40, y: 1, button: 'left', in: 'crab-lane' })
    : ui.press({ key: 'whip' });

  test('the live engine default band leaves room for the crab art', async ($, on) => {
    const clock = mock.clock(on);
    on('ui.render', () => ({ type: 'engine', ref: 0 }));
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('turn.start', ($, e) => ({ turnId: e.turnId }));
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd', surface: 'terminal',
      component: 'AbovePrompt', props: { ...props, bodyColumns: 75, maxRows: 10 } });
    await $.turn.start({ text: 'task', turnId: 'first' });
    const before = await art(ui);
    expect(before).toContain('█');
    await clock.advance(500);
    expect(await art(ui)).not.toBe(before);
  });

  test('an idle session rests until a task starts', async ($, on) => {
    const clock = mock.clock(on);
    on('ui.render', coreBand);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('turn.start', ($, e) => ({ turnId: e.turnId }));
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd', surface: 'terminal', component: 'AbovePrompt', props });
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
      const clips: unknown[] = [];
      on('session.start', ($, e) => ({ cwd: e.cwd }));
      on('audio.play', ($, e) => { clips.push(e); return { value: undefined }; });
      await $.session.start({ surface, isInteractive: true, cwd: '/work' });
      const ui = await $.ui.mount({ plugin: 'clawd', surface, component: 'AbovePrompt', props });
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
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('turn.start', ($, e) => ({ turnId: e.turnId }));
    on('audio.play', () => ({ value: undefined }));
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd', surface: 'terminal', component: 'AbovePrompt', props });
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

  test('failed sound playback keeps the click and animation working', async ($, on) => {
    const clock = mock.clock(on);
    on('ui.render', coreBand);
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('audio.play', () => { throw new Error('No audio device'); });
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd', surface: 'terminal', component: 'AbovePrompt', props });
    const idle = await art(ui);
    await whip(ui);
    await clock.advance(400);
    expect(await art(ui)).not.toBe(idle);
  });

  test('headless sessions do not schedule frame refreshes or draw anything', async ($, on) => {
    const clock = mock.clock(on);
    let redraws = 0;
    on('ui.render', coreBand);
    on('ui.invalidate', () => { redraws += 1; return { value: undefined }; });
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    await $.session.start({ surface: null, isInteractive: false, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd', surface: 'terminal', component: 'AbovePrompt', props });
    await clock.advance(1000);
    expect(redraws).toBe(0);
    expect(await ui.find({ key: 'crab-lane' })).toBeUndefined();
  });

  test('session end stops frame refreshes', async ($, on) => {
    const clock = mock.clock(on);
    let redraws = 0;
    on('ui.invalidate', () => { redraws += 1; return { value: undefined }; });
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
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd', surface: 'terminal', component: 'AbovePrompt', props });
    expect(await ui.find({ type: 'Text', text: 'Another mod' })).toBeDefined();
    await ui.redraw({ ...props, hasSurvey: true });
    expect(await ui.find({ type: 'Text', text: 'Another mod' })).toBeDefined();
    expect(await ui.find({ key: 'whip' })).toBeUndefined();
  });

  test('the art yields when another band consumes the remaining rows', async ($, on) => {
    mock.clock(on);
    on('ui.render', () => ({ type: 'Text', props: {}, children: ['Another mod'] }));
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd', surface: 'terminal',
      component: 'AbovePrompt', props: { ...props, maxRows: 2 } });
    expect(await ui.find({ type: 'Text', text: 'Another mod' })).toBeDefined();
    expect(await ui.find({ key: 'crab-lane' })).toBeUndefined();
  });

  const dimensionCases: Record<string, string | number>[] = [{ height: 3 }, { minHeight: 3 },
    { paddingTop: 2, paddingBottom: 1 }, { height: '100%' }];
  for (const previousProps of dimensionCases) {
    test(`artwork respects preceding box dimensions ${JSON.stringify(previousProps)}`, async ($, on) => {
      mock.clock(on);
      on('ui.render', () => ({ type: 'Box', props: previousProps, children: [] }));
      on('session.start', ($, e) => ({ cwd: e.cwd }));
      await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
      const ui = await $.ui.mount({ plugin: 'clawd', surface: 'terminal',
        component: 'AbovePrompt', props: { ...props, maxRows: 7 } });
      expect((await ui.find({ key: 'crab-lane' }))?.type).toBeUndefined();
    });
  }

  for (const reason of ['answer', 'aborted'] as const) {
    test(`${reason} stops the crab, and the next task starts it walking again`, async ($, on) => {
      const clock = mock.clock(on);
      on('ui.render', coreBand);
      on('session.start', ($, e) => ({ cwd: e.cwd }));
      on('turn.start', ($, e) => ({ turnId: e.turnId }));
      on('turn.complete', ($, e) => ({ text: e.answer }));
      await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
      const ui = await $.ui.mount({ plugin: 'clawd', surface: 'terminal', component: 'AbovePrompt', props });
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
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('session.end', () => ({ sessionId: 'test-session' }));
    on('turn.start', ($, e) => ({ turnId: e.turnId }));
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd', surface: 'terminal', component: 'AbovePrompt', props });
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
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    on('turn.complete', ($, e) => ({ text: e.answer }));
    on('turn.start', ($, e) => ({ turnId: e.turnId }));
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const ui = await $.ui.mount({ plugin: 'clawd', surface: 'terminal', component: 'AbovePrompt', props });
    await $.turn.start({ text: 'task', turnId: 'main' });
    const before = await art(ui);
    await $.turn.complete({ turnId: 'child', agentId: 'child-agent', answer: '', reason: 'answer', isAborted: false, durationMs: 0 });
    await clock.advance(500);
    expect(await art(ui)).not.toBe(before);
  });

  test('Clawd heads the band, above what other mods draw, and leaves a row below it', async ($, on) => {
    mock.clock(on);
    on('ui.render', () => ({ type: 'Text', props: {}, children: ['Another mod'] }));
    on('session.start', ($, e) => ({ cwd: e.cwd }));
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' });
    const fits = await $.ui.mount({ plugin: 'clawd', surface: 'terminal',
      component: 'AbovePrompt', props: { ...props, maxRows: 6 } });
    const band = await fits.find({ type: 'Box' });
    expect(band?.children[0]?.props.key).toBe('clawd');
    expect(await fits.find({ type: 'Text', text: 'Another mod' })).toBeDefined();
    const tight = await $.ui.mount({ plugin: 'clawd', surface: 'terminal',
      component: 'AbovePrompt', props: { ...props, maxRows: 5 } });
    expect(await tight.find({ key: 'crab-lane' })).toBeUndefined();
  });
});
