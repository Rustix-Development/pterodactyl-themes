import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createExtensionTestHost, type ExtensionTestHost } from '@pterodactyl/sdk/testing';
import type { PresetRow, ScheduleInput } from '../api.ts';
import { BUILTINS } from '../lib/builtins.ts';
import { describeDates, scheduleProblems } from './format.ts';
import PresetEditor, { draftProblems, toColors } from './PresetEditor.tsx';
import { previewStyle } from './PresetPreview.tsx';

let host: ExtensionTestHost | undefined;
afterEach(() => {
    cleanup();
    host?.dispose();
    host = undefined;
});

const start = { dark: BUILTINS.graphite.dark, light: BUILTINS.graphite.light };

async function editor(props: Partial<Parameters<typeof PresetEditor>[0]> = {}) {
    host = createExtensionTestHost({ extensionId: 'themes' });
    const onSave = vi.fn();
    const onReset = vi.fn();
    render(<PresetEditor preset={null} start={start} pending={false} serverErrors={{}} onCancel={() => undefined} onSave={onSave} onReset={onReset} {...props} />, {
        wrapper: host.Wrapper,
    });
    await screen.findByTestId('preview-dark');
    return { onSave, onReset };
}

const builtin: PresetRow = {
    id: 9,
    slug: 'christmas',
    name: 'Christmas',
    builtin: true,
    effect: 'snow',
    colors: { dark: BUILTINS.christmas.dark, light: BUILTINS.christmas.light },
    base: { dark: BUILTINS.christmas.dark, light: BUILTINS.christmas.light },
    overrides: {},
    schedules: 1,
};

describe('preset editor', () => {
    test('a new preset previews both schemes and passes contrast from the start', async () => {
        await editor();
        expect(screen.getByTestId('preview-dark')).toBeTruthy();
        expect(screen.getByTestId('preview-light')).toBeTruthy();
        expect(screen.queryByTestId('contrast-issues')).toBeNull();
        expect(screen.getByText('Every colour pair passes WCAG AA.')).toBeTruthy();
    });

    test('the preview takes the colours as they are typed', async () => {
        await editor();
        fireEvent.change(document.getElementById(screen.getAllByLabelText('Primary')[0].id)!, { target: { value: '#16a34a' } });
        const preview = screen.getByTestId('preview-dark');
        expect(preview.style.getPropertyValue('--ts-primary')).toBe('#16a34a');
        expect(preview.style.getPropertyValue('--ts-primary-fg')).toBe('#14110f');
    });

    test('warns about colours that are hard to read', async () => {
        await editor();
        fireEvent.change(screen.getAllByLabelText('Text')[0], { target: { value: '#2a2d33' } });
        const issues = screen.getByTestId('contrast-issues');
        expect(issues.textContent).toContain('Dark: text on the page');
    });

    test('will not save without a name or with a broken colour', async () => {
        const { onSave } = await editor();
        fireEvent.change(screen.getAllByLabelText('Surface')[1], { target: { value: '#12' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create preset' }));
        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByText('Give the preset a name.')).toBeTruthy();
        expect(screen.getByText('Enter a hex code, like #2563eb.')).toBeTruthy();
    });

    test('saves the name, the effect and both schemes', async () => {
        const { onSave } = await editor();
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Sunset  ' } });
        fireEvent.change(screen.getAllByLabelText('Primary')[0], { target: { value: '#EA580C' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create preset' }));
        expect(onSave).toHaveBeenCalledTimes(1);
        const input = onSave.mock.calls[0][0];
        expect(input.name).toBe('Sunset');
        expect(input.effect).toBe('none');
        expect(input.colors.dark.primary).toBe('#ea580c');
        expect(input.colors.light.background).toBe(BUILTINS.graphite.light.background);
        expect(input.colors.dark.success).toBeNull();
    });

    test('a built-in offers only primary and secondary, and can be reset', async () => {
        const { onSave, onReset } = await editor({ preset: { ...builtin, overrides: { dark: { primary: '#2563eb' } } } });
        expect((screen.getByLabelText('Name') as HTMLInputElement).disabled).toBe(true);
        expect(screen.queryAllByLabelText(/^Background/)).toHaveLength(0);
        expect(screen.getAllByLabelText('Primary (optional)')).toHaveLength(2);

        fireEvent.change(screen.getAllByLabelText('Secondary (optional)')[1], { target: { value: '#1d4ed8' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(onSave).toHaveBeenCalledWith({ colors: { dark: { primary: '#2563eb', secondary: null }, light: { primary: null, secondary: '#1d4ed8' } } });

        fireEvent.click(screen.getByRole('button', { name: /Reset to original/ }));
        expect(onReset).toHaveBeenCalled();
    });

    test('a built-in with a new primary and no secondary works the secondary out again', async () => {
        await editor({ preset: builtin });
        fireEvent.change(screen.getAllByLabelText('Primary (optional)')[0], { target: { value: '#2563eb' } });
        const link = screen.getByTestId('preview-dark').style.getPropertyValue('--ts-link');
        expect(link).not.toBe(BUILTINS.christmas.dark.secondary);
    });

    test('an optional colour left empty shows what is used instead, faded, not a black chip', async () => {
        await editor();
        const unset = screen.getAllByTestId('swatch-unset');
        // Success, warning and danger in both schemes (Graphite sets a secondary).
        expect(unset).toHaveLength(6);
        const faded = unset[0].querySelector('span') as HTMLElement;
        expect(faded.className).toContain('opacity-35');
        expect(faded.style.background).not.toBe('');
        const picker = screen.getAllByLabelText('Success: pick a colour')[0] as HTMLInputElement;
        expect(picker.className).toContain('opacity-0');
        expect(picker.value).not.toBe('#000000');

        fireEvent.change(screen.getAllByLabelText(/^Success/)[1], { target: { value: '#15803d' } });
        expect(screen.getAllByTestId('swatch-unset')).toHaveLength(5);
    });

    test('with nothing to fall back to, the chip is empty with a line through it', async () => {
        host = createExtensionTestHost({ extensionId: 'themes' });
        const { ColorField } = await import('./PresetEditor.tsx');
        render(<ColorField id='x' label='Accent' value='' required={false} onChange={() => undefined} />);
        expect(screen.getByTestId('swatch-unset').querySelector('svg line')).not.toBeNull();
    });

    test('shows the errors the server sends', async () => {
        await editor({ serverErrors: { name: 'Another preset already has this name.' } });
        expect(screen.getByText('Another preset already has this name.')).toBeTruthy();
    });
});

describe('editor helpers', () => {
    test('optional colours left empty are not set', () => {
        const colors = toColors({ background: '#000', surface: '#111111', text: '#eeeeee', primary: '#2563eb', secondary: '', success: '', warning: '', danger: '#DC2626' });
        expect(colors).toEqual({ background: '#000000', surface: '#111111', text: '#eeeeee', primary: '#2563eb', secondary: null, success: null, warning: null, danger: '#dc2626' });
    });

    test('a required colour must be there, an optional one only valid', () => {
        const draft = { background: '', surface: '#111111', text: '#eeeeee', primary: 'red', secondary: '', success: '#zzzzzz', warning: '', danger: '' };
        const problems = draftProblems({ dark: draft, light: draft }, ['background', 'surface', 'text', 'primary', 'secondary', 'success', 'warning', 'danger'], true);
        expect(Object.keys(problems).sort()).toEqual(['dark.background', 'dark.primary', 'dark.success', 'light.background', 'light.primary', 'light.success']);
    });

    test('the preview sets every status colour, so the page’s never leak in', () => {
        const style = previewStyle(BUILTINS.graphite.dark, 'dark') as Record<string, string>;
        for (const key of ['--ts-success', '--ts-warning', '--ts-destructive', '--ts-danger', '--ts-success-fg']) expect(style[key]).toMatch(/^#[0-9a-f]{6}$/);
    });
});

describe('schedules', () => {
    const rule = (patch: Partial<ScheduleInput>): ScheduleInput => ({
        preset_id: 1,
        label: null,
        repeat: 'yearly',
        start_year: null,
        start_month: 10,
        start_day: 15,
        end_year: null,
        end_month: 10,
        end_day: 31,
        start_time: null,
        end_time: null,
        timezone: null,
        priority: 0,
        enabled: true,
        ...patch,
    });

    test('are described in words', () => {
        expect(describeDates(rule({}))).toBe('15 Oct to 31 Oct, every year');
        expect(describeDates(rule({ start_year: 2026, end_year: 2027, start_month: 12, start_day: 20, end_month: 1, end_day: 5, start_time: '18:00' }))).toBe(
            '20 Dec 2026, 18:00 to 5 Jan 2027',
        );
    });

    test('a yearly rule can run over new year', () => {
        expect(scheduleProblems(rule({ start_month: 12, start_day: 20, end_month: 1, end_day: 5 }))).toEqual({});
    });

    test('29 February is fine every year but not in 2027', () => {
        expect(scheduleProblems(rule({ start_month: 2, start_day: 29, end_month: 3, end_day: 1 }))).toEqual({});
        expect(scheduleProblems(rule({ repeat: 'once', start_year: 2027, end_year: 2027, start_month: 2, start_day: 29, end_month: 3, end_day: 1 }))).toHaveProperty('start_day');
    });

    test('a one-off must end after it starts', () => {
        expect(scheduleProblems(rule({ repeat: 'once', start_year: 2026, end_year: 2026, start_month: 12, start_day: 20, end_month: 1, end_day: 5 }))).toHaveProperty('end_day');
        expect(scheduleProblems(rule({ repeat: 'once', start_year: 2026, end_year: 2027, start_month: 12, start_day: 20, end_month: 1, end_day: 5 }))).toEqual({});
    });

    test('times and priority are checked', () => {
        expect(scheduleProblems(rule({ start_time: '25:00' }))).toHaveProperty('start_time');
        expect(scheduleProblems(rule({ end_month: 10, end_day: 15, start_time: '18:00', end_time: '09:00' }))).toHaveProperty('end_time');
        expect(scheduleProblems(rule({ priority: 101 }))).toHaveProperty('priority');
    });
});
