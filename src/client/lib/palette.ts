import { contrast, mix, onColor, readable } from './color.ts';

export type Scheme = 'dark' | 'light';
export const SCHEMES: Scheme[] = ['dark', 'light'];

/** One scheme of a preset as an admin sets it. Secondary and the status colours are optional. */
export interface SchemeColors {
    background: string;
    surface: string;
    text: string;
    primary: string;
    secondary?: string | null;
    success?: string | null;
    warning?: string | null;
    danger?: string | null;
}

export type EffectKind = 'none' | 'snow' | 'bats' | 'leaves' | 'confetti';
export const EFFECTS: Record<EffectKind, string> = {
    none: 'None',
    snow: 'Falling snow',
    bats: 'Bats',
    leaves: 'Autumn leaves',
    confetti: 'Confetti',
};

/** Shares of the first colour in the stylesheet's color-mix(in oklab, …) for the derived roles. */
export const DERIVED = {
    dark: { popover: 0.93, border: 0.84, muted: 0.5, mutedForeground: 0.64, selection: 0.45 },
    light: { popover: 0.93, border: 0.87, muted: 0.5, mutedForeground: 0.72, selection: 0.25 },
} as const;

/** The status colours a preset that sets none of its own gets. */
export const STATUS = {
    dark: { success: '#4ade80', warning: '#facc15', danger: '#dc2626', dangerText: '#f87171', caution: '#fb923c' },
    light: { success: '#166534', warning: '#854d0e', danger: '#b91c1c', dangerText: '#b91c1c', caution: '#c2410c' },
} as const;

/** What the server writes for one scheme of a preset: the seeds the stylesheet derives the rest from. */
export interface Seeds {
    bg: string;
    surface: string;
    text: string;
    primary: string;
    primaryFg: string;
    link: string;
    linkFg: string;
    success: string | null;
    successFg: string | null;
    warning: string | null;
    warningFg: string | null;
    destructive: string | null;
    destructiveFg: string | null;
    danger: string | null;
}

/**
 * The seeds of one scheme. Text on the primary is black or white, whichever reads; without a
 * secondary, the primary is lightened (dark) or darkened (light) until it reads as text; and a
 * danger colour gets a text version that reads on the page.
 */
export function seeds(colors: SchemeColors, scheme: Scheme): Seeds {
    const dark = scheme === 'dark';
    // Links and danger text must read on the page, on cards and in menus.
    const pages = [colors.background, colors.surface, mix(dark ? colors.surface : colors.background, colors.text, DERIVED[scheme].popover)];
    const link = colors.secondary || readable(colors.primary, pages, dark);
    const fill = (c?: string | null) => (c ? c : null);

    return {
        bg: colors.background,
        surface: colors.surface,
        text: colors.text,
        primary: colors.primary,
        primaryFg: onColor(colors.primary),
        link,
        linkFg: onColor(link),
        success: fill(colors.success),
        successFg: colors.success ? onColor(colors.success) : null,
        warning: fill(colors.warning),
        warningFg: colors.warning ? onColor(colors.warning) : null,
        destructive: fill(colors.danger),
        destructiveFg: colors.danger ? onColor(colors.danger) : null,
        danger: colors.danger ? readable(colors.danger, pages, dark) : null,
    };
}

/** Every colour role the page ends up with, as the stylesheet derives it from the seeds. */
export function roles(s: Seeds, scheme: Scheme) {
    const d = DERIVED[scheme];
    const status = STATUS[scheme];
    const success = s.success ?? status.success;
    const warning = s.warning ?? status.warning;
    const destructive = s.destructive ?? status.danger;
    return {
        background: s.bg,
        foreground: s.text,
        card: s.surface,
        popover: mix(scheme === 'dark' ? s.surface : s.bg, s.text, d.popover),
        border: mix(s.surface, s.text, d.border),
        muted: mix(s.surface, s.bg, d.muted),
        mutedForeground: mix(s.text, s.surface, d.mutedForeground),
        primary: s.primary,
        primaryForeground: s.primaryFg,
        accent: s.link,
        accentForeground: s.linkFg,
        success,
        successForeground: s.successFg ?? onColor(success),
        warning,
        warningForeground: s.warningFg ?? onColor(warning),
        destructive,
        destructiveForeground: s.destructiveFg ?? onColor(destructive),
        danger: s.danger ?? status.dangerText,
        caution: status.caution,
        cautionForeground: onColor(status.caution),
    };
}

export type Roles = ReturnType<typeof roles>;

const TEXT = 4.5;
const FILL = 3;

/** [what reads badly, foreground role, background role, minimum ratio] */
export const PAIRS: [string, keyof Roles, keyof Roles, number][] = [
    ...(['background', 'card', 'popover'] as const).flatMap((bg) => [
        [`Text on ${bg === 'card' ? 'cards' : bg === 'popover' ? 'menus' : 'the page'}`, 'foreground', bg, TEXT] as [string, keyof Roles, keyof Roles, number],
        [`Muted text on ${bg === 'card' ? 'cards' : bg === 'popover' ? 'menus' : 'the page'}`, 'mutedForeground', bg, TEXT] as [string, keyof Roles, keyof Roles, number],
        [`Secondary (links) on ${bg === 'card' ? 'cards' : bg === 'popover' ? 'menus' : 'the page'}`, 'accent', bg, TEXT] as [string, keyof Roles, keyof Roles, number],
    ]),
    ...(['background', 'card'] as const).flatMap((bg) => [
        [`Success text on ${bg === 'card' ? 'cards' : 'the page'}`, 'success', bg, TEXT] as [string, keyof Roles, keyof Roles, number],
        [`Warning text on ${bg === 'card' ? 'cards' : 'the page'}`, 'warning', bg, TEXT] as [string, keyof Roles, keyof Roles, number],
        [`Danger text on ${bg === 'card' ? 'cards' : 'the page'}`, 'danger', bg, TEXT] as [string, keyof Roles, keyof Roles, number],
        [`Primary buttons against ${bg === 'card' ? 'cards' : 'the page'}`, 'primary', bg, FILL] as [string, keyof Roles, keyof Roles, number],
    ]),
    ['Text on primary buttons', 'primaryForeground', 'primary', TEXT],
    ['Text on secondary', 'accentForeground', 'accent', TEXT],
    ['Text on success', 'successForeground', 'success', TEXT],
    ['Text on warning', 'warningForeground', 'warning', TEXT],
    ['Text on danger buttons', 'destructiveForeground', 'destructive', TEXT],
];

export interface ContrastIssue {
    scheme: Scheme;
    label: string;
    ratio: number;
    min: number;
}

/** Every pair of one scheme that falls short of WCAG AA (4.5:1 for text, 3:1 for buttons). */
export function contrastIssues(colors: SchemeColors, scheme: Scheme): ContrastIssue[] {
    const r = roles(seeds(colors, scheme), scheme);
    return PAIRS.map(([label, fg, bg, min]) => ({ scheme, label, ratio: contrast(r[fg], r[bg]), min })).filter((i) => i.ratio < i.min);
}

/** Every pair of one scheme with its ratio, for the built-in palette checks. */
export function contrastReport(colors: SchemeColors, scheme: Scheme) {
    const r = roles(seeds(colors, scheme), scheme);
    return PAIRS.map(([label, fg, bg, min]) => ({ label, ratio: contrast(r[fg], r[bg]), min }));
}
