// Small colour helpers for building and checking the palettes: hex, OKLab and WCAG contrast.
// The stylesheet mixes colours with color-mix(in oklab, …), so mix() does the same sum here.

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp = (v) => Math.min(1, Math.max(0, v));

export function parseHex(hex) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) throw new Error(`Not a #rrggbb colour: ${hex}`);
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
}

export function toHex(rgb) {
    return '#' + rgb.map((v) => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('');
}

export function toOklab(hex) {
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

export function fromOklab([L, a, b]) {
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

/** color-mix(in oklab, a p%, b): p is the share of a, 0 to 1. */
export function mix(a, b, p) {
    const A = toOklab(a);
    const B = toOklab(b);
    return fromOklab(A.map((v, i) => v * p + B[i] * (1 - p)));
}

export function luminance(hex) {
    const [r, g, b] = parseHex(hex).map(toLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
}

/** Near white or near black, whichever reads better on the colour. */
export function onColor(hex, light = '#ffffff', dark = '#14110f') {
    return contrast(hex, light) >= contrast(hex, dark) ? light : dark;
}
