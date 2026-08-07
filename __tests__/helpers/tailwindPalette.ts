const paletteNames = [
  'white',
  'black',
  'gray',
  'grey',
  'slate',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
].join('|');

const tailwindPaletteColorUtility = new RegExp(
  `\\b(?:bg|text|border)-(?:${paletteNames})(?:-\\d{2,3})?(?=[/\\s"'<>]|$)`,
  'g',
);

export function findTailwindPaletteColorUtilities(markup: string): string[] {
  return markup.match(tailwindPaletteColorUtility) ?? [];
}
