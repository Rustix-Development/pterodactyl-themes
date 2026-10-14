import { useEffect, useRef, useState } from 'react';
import { onThemeChange, readThemeToken, useThemeSettings } from '@pterodactyl/sdk/theme';
import { PRESET_EVENT } from '../lib/live';
import { createScene, type EffectAmount, type EffectKind } from './particles';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const KINDS: EffectKind[] = ['snow', 'bats', 'leaves', 'confetti'];

/** Whether the device asks for less motion, kept up to date as the setting changes. */
export function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia(REDUCED_MOTION).matches);

    useEffect(() => {
        if (typeof matchMedia !== 'function') return;
        const query = matchMedia(REDUCED_MOTION);
        const update = () => setReduced(query.matches);
        update();
        query.addEventListener?.('change', update);
        return () => query.removeEventListener?.('change', update);
    }, []);

    return reduced;
}

/** The effect of the active preset, which the server's preset stylesheet names in --ts-effect-kind. */
export function readEffectKind(): EffectKind | null {
    const kind = readThemeToken('--ts-effect-kind').trim() as EffectKind;
    return KINDS.includes(kind) ? kind : null;
}

/** The colours the effect draws with, from --ts-effect: one or more colours separated by spaces. */
export function readEffectColors(): string[] {
    const colors = readThemeToken('--ts-effect').trim().split(/\s+/).filter(Boolean);
    return colors.length ? colors : ['#ffffff'];
}

/**
 * Draws one effect on a canvas over the page. Frames stop while the tab is hidden, the canvas
 * follows the window's size and pixel ratio, and the colours follow the scheme.
 */
export function EffectCanvas({ kind, amount }: { kind: EffectKind; amount: EffectAmount }) {
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = ref.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });
        const scene = createScene(kind, amount, viewport());
        let colors = readEffectColors();
        let frame = 0;
        let last = 0;

        const resize = () => {
            const size = viewport();
            // Sharp on high-DPI screens, but no more than twice the pixels.
            const ratio = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.round(size.width * ratio);
            canvas.height = Math.round(size.height * ratio);
            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            scene.resize(size);
        };

        const tick = (now: number) => {
            // A long gap (a hidden tab, a slow frame) moves the particles on by one short step only.
            const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
            last = now;
            scene.step(ctx, dt, colors);
            frame = requestAnimationFrame(tick);
        };

        const start = () => {
            if (frame || document.hidden) return;
            last = 0;
            frame = requestAnimationFrame(tick);
        };

        const stop = () => {
            cancelAnimationFrame(frame);
            frame = 0;
        };

        const visibility = () => (document.hidden ? stop() : start());
        const offTheme = onThemeChange(() => {
            colors = readEffectColors();
        });

        resize();
        start();
        window.addEventListener('resize', resize);
        document.addEventListener('visibilitychange', visibility);

        return () => {
            stop();
            offTheme();
            window.removeEventListener('resize', resize);
            document.removeEventListener('visibilitychange', visibility);
        };
    }, [kind, amount]);

    return <canvas ref={ref} className='ts-effects' aria-hidden='true' data-ts-effect={kind} />;
}

/** The effect, unless it is turned off or the device asks for less motion. */
export function PresetEffect({ kind, amount }: { kind: EffectKind | null; amount: unknown }) {
    const reduced = useReducedMotion();
    if (!kind || reduced || (amount !== 'subtle' && amount !== 'full')) return null;

    return <EffectCanvas kind={kind} amount={amount} />;
}

/** The active preset's effect, at the level set on the Themes page. */
export default function Effects() {
    const { effects } = useThemeSettings<{ effects?: string }>();
    const [kind, setKind] = useState(readEffectKind);

    useEffect(() => {
        // A preset saved or picked without a reload can bring another effect.
        const update = () => setKind(readEffectKind());
        window.addEventListener(PRESET_EVENT, update);
        return () => window.removeEventListener(PRESET_EVENT, update);
    }, []);

    return <PresetEffect kind={kind} amount={effects ?? 'subtle'} />;
}
