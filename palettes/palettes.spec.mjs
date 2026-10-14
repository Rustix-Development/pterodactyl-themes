// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { render, OUTPUT } from './build.mjs';
import { checkAll } from './checks.mjs';
import { contrast, mix } from './color.mjs';
import { PRESETS, SEASONS } from './presets.mjs';

describe('palettes', () => {
    test('src/palettes.css is up to date (run npm run palettes)', () => {
        expect(readFileSync(OUTPUT, 'utf8')).toBe(render());
    });

    test.each(checkAll().map((r) => [`${r.id} ${r.scheme}: ${r.label}`, r]))('%s', (_, r) => {
        expect(r.ratio, `${r.ratio.toFixed(2)} < ${r.min}`).toBeGreaterThanOrEqual(r.min);
    });

    test('every preset and season has both schemes', () => {
        for (const palette of [...Object.values(PRESETS), ...Object.values(SEASONS)]) {
            expect(Object.keys(palette.dark)).toEqual(expect.arrayContaining(['bg', 'surface', 'text', 'primary', 'link']));
            expect(Object.keys(palette.light)).toEqual(expect.arrayContaining(['bg', 'surface', 'text', 'primary', 'link']));
        }
    });

    test('the select setting offers every preset', () => {
        const manifest = JSON.parse(readFileSync(new URL('../extension.json', import.meta.url), 'utf8'));
        expect(Object.keys(manifest.theme.settings.preset.options)).toEqual(Object.keys(PRESETS));
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
});

describe('stylesheet', () => {
    const css = ['theme.css', 'palettes.css'].map((f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')).join('\n');

    test('is flat: no gradients and no glows', () => {
        expect(css).not.toMatch(/gradient\(/);
        expect(css).not.toMatch(/drop-shadow|blur\(/);
    });

    test('keeps the effects layer out of the way', () => {
        expect(css).toMatch(/\.ts-effects \{[^}]*pointer-events: none/);
        expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.ts-effects \{\s*display: none/);
    });
});
