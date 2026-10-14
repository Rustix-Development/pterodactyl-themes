// Colour maths shared by the editor, the palette build and the tests; src/Support/Color.php is
// the same for the server. Colours are #rrggbb; mixes are in OKLab, like the stylesheet's
// color-mix(in oklab, …), and contrast is WCAG 2's.

export type Rgb = [number, number, number];
export type Lab = [number, number, number];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp = (v: number) => Math.min(1, Math.max(0, v));

export const HEX = /^#[0-9a-f]{6}$/;

/** `#abc`, `#AABBCC` and ` #aabbcc ` as `#aabbcc`, or null when it is not a colour. */
export function normalizeHex(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    let hex = value.trim().toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(hex)) hex = '#' + [...hex.slice(1)].map((c) => c + c).join('');
    return HEX.test(hex) ? hex : null;
}

export function parseHex(hex: string): Rgb {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function toHex(rgb: Rgb | number[]): string {
    return '#' + rgb.map((v) => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('');
}

export function toOklab(hex: string): Lab {
    const [r, g, b] = parseHex(hex).map(toLinear);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
        0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
}

export function fromOklab([L, a, b]: Lab | number[]): string {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return toHex(
        [
            4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
        ].map((v) => toGamma(clamp(v))),
    );
}

/** color-mix(in oklab, a p, b): `p` is the share of `a`, 0 to 1. */
export function mix(a: string, b: string, p: number): string {
    const A = toOklab(a);
    const B = toOklab(b);
    return fromOklab(A.map((v, i) => v * p + B[i] * (1 - p)));
}

export function luminance(hex: string): number {
    const [r, g, b] = parseHex(hex).map(toLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
}

export const WHITE = '#ffffff';
export const INK = '#14110f';

/** White or near-black text, whichever reads better on the colour (always 4.5:1 or more). */
export function onColor(hex: string): string {
    return contrast(hex, WHITE) >= contrast(hex, INK) ? WHITE : INK;
}

/**
 * The colour, made lighter (`lighten`) or darker until it reads at `min` on every background, in
 * steps of OKLab lightness that keep its hue. Unchanged when it already reads.
 */
export function readable(hex: string, backgrounds: string[], lighten: boolean, min = 4.5): string {
    const passes = (c: string) => backgrounds.every((bg) => contrast(c, bg) >= min);
    if (passes(hex)) return hex;
    const [L, a, b] = toOklab(hex);
    for (let step = 1; step <= 100; step++) {
        const next = lighten ? Math.min(1, L + step * 0.01) : Math.max(0, L - step * 0.01);
        const candidate = fromOklab([next, a, b]);
        if (passes(candidate)) return candidate;
    }
    return lighten ? WHITE : '#000000';
}
