// The WCAG checks every palette must pass: 4.5:1 for text (AA), 3:1 for fills that mark a control.
import { contrast } from './color.mjs';
import { derive, PRESETS, SEASONS } from './presets.mjs';

const TEXT = 4.5;
const UI = 3;

/** [label, foreground role, background role, minimum ratio] */
export const PAIRS = [
    ...['background', 'card', 'popover'].flatMap((bg) => [
        [`text on ${bg}`, 'foreground', bg, TEXT],
        [`muted text on ${bg}`, 'mutedForeground', bg, TEXT],
        [`link on ${bg}`, 'accent', bg, TEXT],
    ]),
    ...['background', 'card'].flatMap((bg) => [
        [`success text on ${bg}`, 'success', bg, TEXT],
        [`warning text on ${bg}`, 'warning', bg, TEXT],
        [`danger text on ${bg}`, 'danger', bg, TEXT],
        [`primary fill against ${bg}`, 'primary', bg, UI],
    ]),
    ['text on primary', 'primaryForeground', 'primary', TEXT],
    ['text on accent', 'accentForeground', 'accent', TEXT],
    ['text on success', 'successForeground', 'success', TEXT],
    ['text on warning', 'warningForeground', 'warning', TEXT],
    ['text on destructive', 'destructiveForeground', 'destructive', TEXT],
    ['text on caution', 'cautionForeground', 'caution', TEXT],
];

/** Every palette and scheme with each pair's ratio and whether it passes. */
export function checkAll() {
    const results = [];
    for (const [group, palettes] of [['preset', PRESETS], ['season', SEASONS]]) {
        for (const [id, palette] of Object.entries(palettes)) {
            for (const scheme of ['dark', 'light']) {
                const roles = derive(palette[scheme], scheme);
                for (const [label, fg, bg, min] of PAIRS) {
                    const ratio = contrast(roles[fg], roles[bg]);
                    results.push({ group, id, scheme, label, ratio, min, pass: ratio >= min });
                }
            }
        }
    }
    return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const results = checkAll();
    const byPalette = Map.groupBy(results, (r) => `${r.id} ${r.scheme}`);
    for (const [key, rows] of byPalette) {
        const worstText = Math.min(...rows.filter((r) => r.min === TEXT).map((r) => r.ratio));
        const worstUi = Math.min(...rows.filter((r) => r.min === UI).map((r) => r.ratio));
        const failed = rows.filter((r) => !r.pass);
        console.log(
            `${key.padEnd(18)} lowest text ${worstText.toFixed(2)}  lowest fill ${worstUi.toFixed(2)}  ${failed.length ? 'FAIL: ' + failed.map((r) => `${r.label} ${r.ratio.toFixed(2)}`).join(', ') : 'ok'}`,
        );
    }
    process.exitCode = results.every((r) => r.pass) ? 0 : 1;
}
