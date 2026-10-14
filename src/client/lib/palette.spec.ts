// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { CSS_OUTPUT, FIXTURE_OUTPUT, renderCss, renderFixture } from '../../../palettes/build.ts';
import { BUILTINS, FALLBACK } from './builtins.ts';
import { contrast, mix, normalizeHex, onColor, readable } from './color.ts';
import { contrastIssues, contrastReport, EFFECTS, SCHEMES, seeds } from './palette.ts';

describe('built-in presets', () => {
    const ids = Object.keys(BUILTINS);

    test('are the ten the admin page locks, Graphite first', () => {
        expect(ids).toEqual(['graphite', 'oled', 'midnight', 'slate', 'forest', 'ocean', 'crimson', 'rustix', 'halloween', 'christmas']);
        expect(ids[0]).toBe(FALLBACK);
    });

    test('Halloween and Christmas keep their effects', () => {
        expect(BUILTINS.halloween.effect).toBe('bats');
        expect(BUILTINS.christmas.effect).toBe('snow');
        for (const id of ids) expect(Object.keys(EFFECTS)).toContain(BUILTINS[id].effect);
    });

    test.each(ids.flatMap((id) => SCHEMES.map((scheme) => [id, scheme] as const)))('%s %s passes WCAG AA', (id, scheme) => {
        for (const row of contrastReport(BUILTINS[id][scheme], scheme)) {
            expect(row.ratio, `${row.label}: ${row.ratio.toFixed(2)} < ${row.min}`).toBeGreaterThanOrEqual(row.min);
        }
    });
});

describe('generated files', () => {
    test('src/client/palettes.css is up to date (run npm run palettes)', () => {
        expect(readFileSync(CSS_OUTPUT, 'utf8')).toBe(renderCss());
    });

    test('tests/fixtures/seeds.json is up to date (run npm run palettes)', () => {
        expect(readFileSync(FIXTURE_OUTPUT, 'utf8')).toBe(renderFixture());
    });
});

describe('seeds', () => {
    const base = { background: '#101010', surface: '#1a1a1a', text: '#f0f0f0', primary: '#9b3735' };

    test('without a secondary, links are the primary made readable', () => {
        const s = seeds(base, 'dark');
        expect(s.link).not.toBe(base.primary);
        expect(contrast(s.link, base.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(s.link, base.surface)).toBeGreaterThanOrEqual(4.5);
        // And in menus, for every scheme and for a primary that reads badly at first.
        for (const scheme of SCHEMES) {
            for (const primary of ['#9b3735', '#c2410c', '#2563eb']) {
                const issues = contrastIssues({ ...base, ...(scheme === 'light' ? { background: '#faf6f1', surface: '#ffffff', text: '#231a14' } : {}), primary }, scheme);
                expect(issues.filter((i) => i.label.startsWith('Secondary')), `${scheme} ${primary}`).toEqual([]);
            }
        }
    });

    test('a secondary is used as it is', () => {
        expect(seeds({ ...base, secondary: '#e9c46a' }, 'dark').link).toBe('#e9c46a');
    });

    test('text on a fill is black or white, whichever reads', () => {
        expect(onColor('#ffff00')).toBe('#14110f');
        expect(onColor('#1d4ed8')).toBe('#ffffff');
        for (const fill of ['#2563eb', '#16a34a', '#d0303a', '#f59e0b', '#7c3aed', '#0d9488']) {
            expect(contrast(onColor(fill), fill)).toBeGreaterThanOrEqual(4.5);
        }
    });

    test('status colours are only set when the preset sets them', () => {
        const s = seeds(base, 'light');
        expect([s.success, s.warning, s.destructive, s.danger]).toEqual([null, null, null, null]);
        const t = seeds({ ...base, danger: '#ff0000' }, 'dark');
        expect(t.destructive).toBe('#ff0000');
        expect(contrast(t.danger!, base.background)).toBeGreaterThanOrEqual(4.5);
    });
});

describe('contrast warnings', () => {
    test('a preset that reads badly is flagged', () => {
        const issues = contrastIssues({ background: '#777777', surface: '#808080', text: '#999999', primary: '#888888', secondary: '#7a7a7a' }, 'dark');
        expect(issues.map((i) => i.label)).toEqual(expect.arrayContaining(['Text on the page', 'Secondary (links) on cards']));
        for (const issue of issues) expect(issue.ratio).toBeLessThan(issue.min);
    });

    test('a good one is not', () => {
        expect(contrastIssues(BUILTINS.graphite.dark, 'dark')).toEqual([]);
    });
});

describe('colour maths', () => {
    test('contrast matches WCAG for black and white', () => {
        expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
        expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    });

    test('mixing in oklab keeps the ends', () => {
        expect(mix('#2563eb', '#111317', 1)).toBe('#2563eb');
        expect(mix('#2563eb', '#111317', 0)).toBe('#111317');
    });

    test('hex codes are normalised', () => {
        expect(normalizeHex('#ABC')).toBe('#aabbcc');
        expect(normalizeHex(' #2563EB ')).toBe('#2563eb');
        expect(normalizeHex('blue')).toBeNull();
        expect(normalizeHex('#12345')).toBeNull();
    });

    test('readable moves a colour until it reads', () => {
        const out = readable('#1d4ed8', ['#111317'], true);
        expect(contrast(out, '#111317')).toBeGreaterThanOrEqual(4.5);
    });
});

describe('stylesheet', () => {
    const css = ['theme.css', 'palettes.css'].map((f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).join('\n');

    test('is flat: no gradients and no glows', () => {
        expect(css).not.toMatch(/gradient\(/);
        expect(css).not.toMatch(/drop-shadow|blur\(/);
    });

    test('keeps the effects layer out of the way', () => {
        expect(css).toMatch(/\.ts-effects \{[^}]*pointer-events: none/);
        expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.ts-effects \{\s*display: none/);
    });
});

describe('console command line', () => {
    // Mirrors palettes.css: the terminal and the command line's text and placeholder.
    const terminal = (c: { background: string; text: string }, scheme: 'dark' | 'light') =>
        scheme === 'dark' ? mix(c.background, '#000000', 0.7) : mix(c.text, c.background, 0.94);
    const ids = Object.keys(BUILTINS);

    test.each(ids.flatMap((id) => SCHEMES.map((scheme) => [id, scheme] as const)))('%s %s reads on the terminal', (id, scheme) => {
        const bg = terminal(BUILTINS[id][scheme], scheme);
        expect(contrast('#d4d4d4', bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(mix('#d4d4d4', bg, 0.7), bg)).toBeGreaterThanOrEqual(3);
    });

    test('the stylesheet gives the command line the terminal colours', () => {
        const css = readFileSync(new URL('../theme.css', import.meta.url), 'utf8');
        expect(css).toContain("input[aria-label='Console command input.'] + div");
        expect(css).toMatch(/::placeholder \{\s*color: color-mix\(in oklab, var\(--terminal-foreground\) 70%, var\(--terminal-background\)\);/);
    });
});
