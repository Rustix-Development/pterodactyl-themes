import data from '../../../resources/presets.json' with { type: 'json' };
import type { EffectKind, SchemeColors } from './palette.ts';

export interface BuiltinPreset {
    name: string;
    effect: EffectKind;
    dark: SchemeColors;
    light: SchemeColors;
    effectColors?: { dark: string[]; light: string[] };
}

/** The presets that ship with the theme, as resources/presets.json lists them (the server reads it too). */
export const BUILTINS = data as unknown as Record<string, BuiltinPreset>;

/** The preset the stylesheet falls back to when the server's preset stylesheet cannot load. */
export const FALLBACK = 'graphite';
