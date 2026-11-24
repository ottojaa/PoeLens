/**
 * Finds colours and fonts written outside `src/theme/`. Colours and fonts are theme data: a literal in a component
 * would not change when the theme does. `theme.test.ts` runs this over every source file.
 */

const PALETTE = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';

const COLOR_UTILITY_PREFIX =
    '(?:bg|text|border(?:-[xytrblse])?|ring(?:-offset)?|fill|stroke|from|via|to|outline|divide|shadow|decoration|caret|accent|placeholder)';

const RULES: { name: string; pattern: RegExp }[] = [
    { name: 'hex colour', pattern: /#[0-9a-fA-F]{3,8}\b/g },
    { name: 'colour function', pattern: /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color-mix)\(/g },
    {
        name: 'Tailwind palette utility',
        pattern: new RegExp(`\\b${COLOR_UTILITY_PREFIX}-(?:white|black|(?:${PALETTE})-\\d{2,3})\\b`, 'g'),
    },
    { name: 'arbitrary colour value', pattern: new RegExp(`\\b${COLOR_UTILITY_PREFIX}-\\[(?:#|rgb|hsl|oklch|color)`, 'g') },
    { name: 'font family', pattern: /font-family|fontFamily|\bfont-\[/g },
];

/** The offending snippets in one file's source, labelled by rule. Empty when the file is clean. */
export function findThemeViolations(source: string): string[] {
    return RULES.flatMap(({ name, pattern }) => Array.from(source.matchAll(pattern), (match) => name + ': ' + match[0]));
}
