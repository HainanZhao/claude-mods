// Surface module for the crab's lane on the terminal. A Client takes a click
// anywhere on the lane without a Button's focus and hover inversion; the press
// travels to the hooks module as a post. No key listener: one would hold the
// keyboard after a click and swallow the next prompt. `props.rows` are
// quadrantRuns rows.
export default function Lane(props, surface) {
  const { Text } = surface.elements;
  if (surface.state === undefined) {
    surface.onPointer(event => {
      if (event.type === 'down') surface.post({ whip: true });
    });
    surface.setState(true);
  }
  return Text({ children: (props?.rows ?? []).flatMap((runs, row) =>
    [...(row ? ['\n'] : []), ...runs.map(({ text, ...colors }) => Text({ ...colors, children: text }))]) });
}
