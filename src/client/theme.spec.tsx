import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { Button } from '@pterodactyl/sdk';
import { preloadTheme, renderView, renderWithTheme, type RenderedView } from '@pterodactyl/sdk/testing';
import { PresetEffect, readEffectColors } from './effects/Effects';
import { createScene, particleCount } from './effects/particles';
import { presetRules } from './lib/live';
import theme from './theme';

const themes = [theme];
let rendered: RenderedView | undefined;

beforeAll(() => preloadTheme(themes));
afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

/** jsdom has no canvas; a stub context lets the effect run its frames. */
function stubCanvas() {
    const ctx = new Proxy({}, { get: (target: Record<string, unknown>, key: string) => (key in target ? target[key] : () => undefined), set: (target, key: string, value) => ((target[key] = value), true) });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
}

function setupContext(config: Record<string, unknown>) {
    const screens: string[] = [];
    const slots: string[] = [];
    theme.setup?.({
        meta: { id: 'themes' },
        config: config as never,
        views: { override: () => undefined },
        slots: { register: (name: string) => void slots.push(name) },
        screens: { register: (id: string) => void screens.push(id) },
        columns: { register: () => undefined },
        forms: { extend: () => undefined },
    } as never);
    return { screens, slots };
}

describe('layouts', () => {
    test('keep classic and the slots of the app layout', () => {
        rendered = renderView('layout.app', {
            themes,
            fixture: 'serverArea',
            slots: {
                'nav.items.before': () => <span>before slot</span>,
                'nav.items.after': () => <span>after slot</span>,
            },
        });

        expect(rendered.container.querySelector('main')).not.toBeNull();
        expect(rendered.container.textContent).toContain('before slot');
        expect(rendered.container.textContent).toContain('after slot');
    });

    test('keep the sign-in layout', () => {
        rendered = renderView('layout.auth', { themes, fixture: 'default' });

        expect(rendered.container.firstElementChild).not.toBeNull();
    });

    test('leave the UI kit to classic', () => {
        rendered = renderWithTheme(<Button>Save</Button>, { themes });

        expect(rendered.container.querySelector('button[data-ui="button"]')?.textContent).toBe('Save');
    });
});

describe('setup', () => {
    test('registers the admin screen', () => {
        expect(setupContext({}).screens).toEqual(['admin']);
    });

    test('adds the account picker only when the admin allows it', () => {
        expect(setupContext({ allow_user_choice: false }).slots).toEqual([]);
        expect(setupContext({ allow_user_choice: true }).slots).toEqual(['account.overview.after']);
    });
});

describe('effects', () => {
    test.each(['snow', 'bats', 'leaves', 'confetti'] as const)('%s draws on a canvas out of the way', (kind) => {
        stubCanvas();
        const view = render(<PresetEffect kind={kind} amount='subtle' />);
        const canvas = view.container.querySelector('canvas.ts-effects');
        expect(canvas?.getAttribute('data-ts-effect')).toBe(kind);
        expect(canvas?.getAttribute('aria-hidden')).toBe('true');
        view.unmount();
    });

    test('nothing without an effect, or with effects off', () => {
        expect(render(<PresetEffect kind={null} amount='full' />).container.innerHTML).toBe('');
        expect(render(<PresetEffect kind='snow' amount='off' />).container.innerHTML).toBe('');
    });

    test('nothing when the device asks for less motion', () => {
        vi.stubGlobal('matchMedia', (query: string) => ({
            matches: query.includes('reduce'),
            media: query,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
        }));

        expect(render(<PresetEffect kind='snow' amount='full' />).container.innerHTML).toBe('');
    });

    test('stops drawing while the tab is hidden', () => {
        stubCanvas();
        const raf = vi.fn(() => 1);
        const cancel = vi.fn();
        vi.stubGlobal('requestAnimationFrame', raf);
        vi.stubGlobal('cancelAnimationFrame', cancel);

        const view = render(<PresetEffect kind='snow' amount='subtle' />);
        expect(raf).toHaveBeenCalled();

        const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        act(() => void document.dispatchEvent(new Event('visibilitychange')));
        expect(cancel).toHaveBeenCalled();

        raf.mockClear();
        hidden.mockReturnValue(false);
        act(() => void document.dispatchEvent(new Event('visibilitychange')));
        expect(raf).toHaveBeenCalled();
        view.unmount();
    });

    test('reads its colours from the preset, white without one', () => {
        expect(readEffectColors()).toEqual(['#ffffff']);
        document.documentElement.style.setProperty('--ts-effect', '#f97316 #dc2626');
        expect(readEffectColors()).toEqual(['#f97316', '#dc2626']);
        document.documentElement.style.removeProperty('--ts-effect');
    });
});

describe('particles', () => {
    test('scale with the screen and stay capped', () => {
        const phone = particleCount('snow', 'full', { width: 390, height: 844 });
        const desktop = particleCount('snow', 'full', { width: 1920, height: 1080 });
        const huge = particleCount('snow', 'full', { width: 7680, height: 4320 });

        expect(phone).toBeLessThan(desktop);
        expect(huge).toBe(140);
        expect(particleCount('snow', 'subtle', { width: 7680, height: 4320 })).toBe(60);
        for (const kind of ['bats', 'leaves', 'confetti'] as const) {
            expect(particleCount(kind, 'full', { width: 390, height: 844 })).toBeLessThanOrEqual(particleCount(kind, 'full', { width: 1400, height: 900 }));
            expect(particleCount(kind, 'full', { width: 7680, height: 4320 })).toBeLessThanOrEqual(140);
        }
    });

    test('a scene follows a resize', () => {
        const scene = createScene('snow', 'full', { width: 390, height: 844 });
        const before = scene.count;
        scene.resize({ width: 1920, height: 1080 });

        expect(scene.count).toBeGreaterThan(before);
    });
});

describe('live preset swap', () => {
    test('takes the rules of the server stylesheet and nothing else', () => {
        const css = '/* Theme Studio: Ocean (default) */\n:root:root{--ts-effect-kind:none;}\n:root:root.dark{--ts-bg:#0b1620;}\n:root:root.light{--ts-bg:#f1f6f9;}\n';
        expect(presetRules(css)).toEqual([':root:root{--ts-effect-kind:none;}', ':root:root.dark{--ts-bg:#0b1620;}', ':root:root.light{--ts-bg:#f1f6f9;}']);
    });
});
