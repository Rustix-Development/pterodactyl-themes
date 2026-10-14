// Every palette of the theme. Each scheme of a palette has five seeds; the stylesheet derives the
// other colour roles from them with the mixes in DERIVED, so a custom colour set by an admin gets
// the same treatment. `npm run palettes` writes src/palettes.css from this file, and the tests
// check every palette for WCAG AA contrast.
import { mix, onColor } from './color.mjs';

/**
 * Shares (0 to 1) of the first colour in color-mix(in oklab, …) for the derived roles. Raised fills
 * (menus, hover fills, stat tiles) mix text into the surface in dark, and into the page in light,
 * where the surface is white and the page already a shade darker.
 */
export const DERIVED = {
    dark: { popover: 0.93, border: 0.84, muted: 0.5, mutedForeground: 0.64, selection: 0.45 },
    light: { popover: 0.93, border: 0.87, muted: 0.5, mutedForeground: 0.72, selection: 0.25 },
};

/** Status colours, the same under every preset. Text roles are separate from fills where one colour cannot be both. */
export const STATUS = {
    dark: {
        success: '#4ade80',
        warning: '#facc15',
        destructive: '#dc2626',
        danger: '#f87171',
        caution: '#fb923c',
    },
    light: {
        success: '#166534',
        warning: '#854d0e',
        destructive: '#b91c1c',
        danger: '#b91c1c',
        caution: '#c2410c',
    },
};

// bg: the page, surface: cards, text: body text, primary: buttons and selected items (a fill),
// link: the brand colour as text (links, info badges, focus rings).
export const PRESETS = {
    graphite: {
        name: 'Graphite',
        dark: { bg: '#111317', surface: '#1b1e24', text: '#e7e9ec', primary: '#2563eb', link: '#7aa7ff' },
        light: { bg: '#f3f4f6', surface: '#ffffff', text: '#1a1d22', primary: '#2563eb', link: '#1d4ed8' },
    },
    oled: {
        name: 'OLED black',
        dark: { bg: '#000000', surface: '#0e0e10', text: '#ececec', primary: '#2563eb', link: '#7aa7ff' },
        light: { bg: '#fafafa', surface: '#ffffff', text: '#111111', primary: '#1f1f1f', link: '#1d4ed8' },
    },
    midnight: {
        name: 'Midnight',
        dark: { bg: '#0d1222', surface: '#151b30', text: '#e4e8f5', primary: '#5b5bd6', link: '#a5b4fc' },
        light: { bg: '#f2f3f9', surface: '#ffffff', text: '#161a2e', primary: '#4f46e5', link: '#4338ca' },
    },
    slate: {
        name: 'Slate',
        dark: { bg: '#181c23', surface: '#1f252e', text: '#e2e7ee', primary: '#1d74b8', link: '#7dd3fc' },
        light: { bg: '#edf0f4', surface: '#ffffff', text: '#1d2530', primary: '#0369a1', link: '#075985' },
    },
    forest: {
        name: 'Forest',
        dark: { bg: '#0f1712', surface: '#17221b', text: '#e3ece5', primary: '#15803d', link: '#6ee7a0' },
        light: { bg: '#f1f5f1', surface: '#ffffff', text: '#15241a', primary: '#166534', link: '#166534' },
    },
    ocean: {
        name: 'Ocean',
        dark: { bg: '#0a1620', surface: '#11212c', text: '#e0edf3', primary: '#0e7490', link: '#67e8f9' },
        light: { bg: '#eef5f7', surface: '#ffffff', text: '#10242c', primary: '#0e7490', link: '#155e75' },
    },
    crimson: {
        name: 'Crimson',
        dark: { bg: '#170f11', surface: '#22171a', text: '#f0e4e6', primary: '#c81e47', link: '#fda4b8' },
        light: { bg: '#f8f2f3', surface: '#ffffff', text: '#2a1419', primary: '#be123c', link: '#9f1239' },
    },
    rustix: {
        name: 'Rustix',
        dark: { bg: '#161212', surface: '#201a1a', text: '#efe7e6', primary: '#b8433f', link: '#f0a29d' },
        light: { bg: '#f7f3f2', surface: '#ffffff', text: '#241a19', primary: '#9b3735', link: '#9b3735' },
    },
};

/** Seasonal palettes win over the preset and the custom colours while their season is on. */
export const SEASONS = {
    halloween: {
        name: 'Halloween',
        dark: { bg: '#120e16', surface: '#1c1622', text: '#f3ebe0', primary: '#f97316', link: '#fdba74', effect: '#6a5487' },
        light: { bg: '#faf4ea', surface: '#fffdf8', text: '#24131f', primary: '#c2410c', link: '#9a3412', effect: '#2a1f33' },
    },
    christmas: {
        name: 'Christmas',
        dark: { bg: '#0b1913', surface: '#12241b', text: '#f2f0e8', primary: '#d0303a', link: '#e9c46a', effect: '#ffffff' },
        light: { bg: '#f5f8f5', surface: '#ffffff', text: '#13261c', primary: '#b91c1c', link: '#166534', effect: '#9fb3c8' },
    },
};

/** Every colour role the stylesheet ends up with for one scheme of a palette. */
export function derive(seeds, scheme) {
    const d = DERIVED[scheme];
    const status = STATUS[scheme];
    const popover = mix(scheme === 'dark' ? seeds.surface : seeds.bg, seeds.text, d.popover);

    return {
        background: seeds.bg,
        foreground: seeds.text,
        card: seeds.surface,
        popover,
        border: mix(seeds.surface, seeds.text, d.border),
        muted: mix(seeds.surface, seeds.bg, d.muted),
        mutedForeground: mix(seeds.text, seeds.surface, d.mutedForeground),
        primary: seeds.primary,
        primaryForeground: onColor(seeds.primary),
        accent: seeds.link,
        accentForeground: onColor(seeds.link),
        selection: mix(seeds.primary, seeds.bg, d.selection),
        ...Object.fromEntries(Object.entries(status).map(([k, v]) => [k, v])),
        successForeground: onColor(status.success),
        warningForeground: onColor(status.warning),
        destructiveForeground: onColor(status.destructive),
        cautionForeground: onColor(status.caution),
    };
}
