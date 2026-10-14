import type { CSSProperties } from 'react';
import { EFFECTS, roles, seeds, type EffectKind, type Scheme, type SchemeColors } from '../lib/palette.ts';
import { HEX } from '../lib/color.ts';

/** Whether every required colour of a scheme is a complete hex code. */
export function complete(colors: SchemeColors): boolean {
    return [colors.background, colors.surface, colors.text, colors.primary].every((c) => HEX.test(c ?? '')) &&
        [colors.secondary, colors.success, colors.warning, colors.danger].every((c) => !c || HEX.test(c));
}

/**
 * The seeds of a scheme as inline custom properties. The status colours are always set, so a
 * preset without its own does not pick up the page's.
 */
export function previewStyle(colors: SchemeColors, scheme: Scheme): CSSProperties {
    const s = seeds(colors, scheme);
    const r = roles(s, scheme);
    return {
        '--ts-bg': s.bg,
        '--ts-surface': s.surface,
        '--ts-text': s.text,
        '--ts-primary': s.primary,
        '--ts-primary-fg': s.primaryFg,
        '--ts-link': s.link,
        '--ts-link-fg': s.linkFg,
        '--ts-success': r.success,
        '--ts-success-fg': r.successForeground,
        '--ts-warning': r.warning,
        '--ts-warning-fg': r.warningForeground,
        '--ts-destructive': r.destructive,
        '--ts-destructive-fg': r.destructiveForeground,
        '--ts-danger': r.danger,
    } as CSSProperties;
}

/** A few colour chips of a preset, for the cards. */
export function Swatches({ colors, scheme }: { colors: SchemeColors; scheme: Scheme }) {
    const s = seeds(colors, scheme);
    return (
        <div className='ts-preview flex h-10 min-w-0 flex-1 items-center gap-1.5 border border-border px-2' data-scheme={scheme} style={previewStyle(colors, scheme)}>
            <span className='sr-only'>{scheme === 'dark' ? 'Dark' : 'Light'}</span>
            <span className='h-5 flex-1 rounded-sm border border-border bg-card' title='Surface' />
            <span className='h-5 flex-1 rounded-sm' style={{ background: s.primary }} title='Primary' />
            <span className='h-5 flex-1 rounded-sm' style={{ background: s.link }} title='Secondary' />
            <span className='text-sm font-medium text-foreground' aria-hidden='true'>
                Aa
            </span>
        </div>
    );
}

/** A small page in a scheme of the preset: what buttons, links, cards and statuses will look like. */
export default function PresetPreview({ colors, scheme, effect, name }: { colors: SchemeColors; scheme: Scheme; effect?: EffectKind; name?: string }) {
    if (!complete(colors)) {
        return (
            <div className='flex min-h-48 items-center justify-center border border-dashed border-border p-4 text-center text-sm text-muted-foreground'>
                Fill in the {scheme} colours to see the preview.
            </div>
        );
    }

    return (
        <div className='ts-preview overflow-hidden rounded-md border border-border' data-scheme={scheme} style={previewStyle(colors, scheme)} data-testid={`preview-${scheme}`}>
            <div className='flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-2'>
                <span className='truncate text-sm font-medium text-foreground'>{name || 'Preview'}</span>
                <span className='text-xs text-muted-foreground'>
                    {scheme === 'dark' ? 'Dark' : 'Light'}
                    {effect && effect !== 'none' ? ` · ${EFFECTS[effect]}` : ''}
                </span>
            </div>
            <div className='flex flex-col gap-3 p-3'>
                <div className='rounded-md border border-border bg-card p-3 text-card-foreground'>
                    <p className='m-0 text-sm font-medium'>my-survival-server</p>
                    <p className='m-0 text-xs text-muted-foreground'>4 GB memory · 2 players online</p>
                    <p className='m-0 mt-1 text-xs'>
                        <span className='text-accent underline'>Open the console</span>
                    </p>
                </div>
                <div className='flex flex-wrap gap-2'>
                    <span className='rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'>Start</span>
                    <span className='rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground'>Restart</span>
                    <span className='rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground'>Stop</span>
                </div>
                <div className='flex flex-wrap gap-3 text-xs font-medium'>
                    <span className='text-success'>Running</span>
                    <span className='text-warning'>Starting</span>
                    <span className='text-(--ts-danger-text)'>Offline</span>
                </div>
            </div>
        </div>
    );
}
