import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Alert, Button, Icon, Input, Label, Select } from '@pterodactyl/sdk';
import type { PresetColors, PresetInput, PresetRow } from '../api.ts';
import { HEX, normalizeHex } from '../lib/color.ts';
import { contrastIssues, EFFECTS, SCHEMES, seeds, STATUS, type EffectKind, type Scheme, type SchemeColors } from '../lib/palette.ts';
import PresetPreview, { complete } from './PresetPreview.tsx';

type Field = keyof SchemeColors;

/** The colours of a scheme an admin sets, with what each one paints. */
export const FIELDS: { key: Field; label: string; hint: string; required: boolean }[] = [
    { key: 'background', label: 'Background', hint: 'The page behind everything.', required: true },
    { key: 'surface', label: 'Surface', hint: 'Cards, tables and menus.', required: true },
    { key: 'text', label: 'Text', hint: 'Body text and headings.', required: true },
    { key: 'primary', label: 'Primary', hint: 'Buttons and selected items.', required: true },
    { key: 'secondary', label: 'Secondary', hint: 'Links, highlights and focus rings. Empty: worked out from the primary.', required: false },
    { key: 'success', label: 'Success', hint: 'Running servers and confirmations. Empty: green.', required: false },
    { key: 'warning', label: 'Warning', hint: 'Starting servers and warnings. Empty: amber.', required: false },
    { key: 'danger', label: 'Danger', hint: 'Stop and delete buttons, errors. Empty: red.', required: false },
];

export const BUILTIN_FIELDS: Field[] = ['primary', 'secondary'];

/**
 * The chip beside a colour that is not set: the colour used instead, drawn faded behind a dashed
 * outline, or an empty chip with a line through it when there is none to show.
 */
export function UnsetSwatch({ fallback }: { fallback?: string | null }) {
    return (
        <span aria-hidden='true' data-testid='swatch-unset' className='pointer-events-none absolute inset-0 overflow-hidden rounded-md border border-dashed border-muted-foreground'>
            {fallback ? (
                <span className='absolute inset-1 rounded-sm opacity-35' style={{ background: fallback }} />
            ) : (
                <svg className='absolute inset-0 h-full w-full text-muted-foreground' viewBox='0 0 44 36' preserveAspectRatio='none'>
                    <line x1='6' y1='31' x2='38' y2='5' stroke='currentColor' strokeWidth='1.5' vectorEffect='non-scaling-stroke' />
                </svg>
            )}
        </span>
    );
}

/** A colour as a picker and a hex code; an optional colour can be left empty, and shows what is used instead. */
export function ColorField({
    id,
    label,
    hint,
    value,
    placeholder,
    fallback,
    required,
    error,
    onChange,
}: {
    id: string;
    label: string;
    hint?: string;
    value: string;
    placeholder?: string;
    /** What the panel uses while this colour is not set. */
    fallback?: string | null;
    required: boolean;
    error?: string | null;
    onChange: (value: string) => void;
}) {
    const set = HEX.test(normalizeHex(value) ?? '');
    const shown = normalizeHex(fallback) ?? normalizeHex(placeholder);
    const hintId = `${id}-hint`;
    return (
        <div className='min-w-0'>
            <Label htmlFor={id}>
                {label}
                {!required && <span className='font-normal text-muted-foreground'> (optional)</span>}
            </Label>
            <div className='flex items-center gap-2'>
                <span className='relative inline-flex h-9 w-11 shrink-0' title={set ? undefined : shown ? `Not set: uses ${shown}` : 'Not set'}>
                    <input
                        type='color'
                        aria-label={`${label}: pick a colour`}
                        className={`h-full w-full cursor-pointer rounded-md border border-border bg-transparent p-0.5 ${set ? '' : 'opacity-0'}`}
                        value={set ? normalizeHex(value)! : (shown ?? '#000000')}
                        onChange={(e) => onChange(e.target.value)}
                    />
                    {!set && <UnsetSwatch fallback={shown} />}
                </span>
                <Input
                    id={id}
                    value={value}
                    placeholder={placeholder ?? (required ? '#000000' : 'Not set')}
                    autoComplete='off'
                    spellCheck={false}
                    maxLength={7}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={hintId}
                    onChange={(e) => onChange(e.target.value.trim())}
                />
            </div>
            <p id={hintId} role={error ? 'alert' : undefined} className={`mt-1 mb-0 text-xs ${error ? 'text-(--ts-danger-text)' : 'text-muted-foreground'}`}>
                {error ?? hint}
            </p>
        </div>
    );
}

function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
    return (
        <section className='min-w-0 rounded-md border border-border bg-card p-4 text-card-foreground'>
            <h3 className='m-0 text-base font-medium'>{title}</h3>
            {description && <p className='m-0 mt-0.5 text-sm text-muted-foreground'>{description}</p>}
            <div className='mt-3'>{children}</div>
        </section>
    );
}

/** A scheme's colours as the form edits them: every field a string, empty when not set. */
function draftOf(colors: SchemeColors): Record<Field, string> {
    return Object.fromEntries(FIELDS.map(({ key }) => [key, colors[key] ?? ''])) as Record<Field, string>;
}

/** The form's strings as colours; optional ones that are empty are left out. */
export function toColors(draft: Record<Field, string>): SchemeColors {
    const value = (key: Field) => normalizeHex(draft[key]) ?? (draft[key] === '' ? null : draft[key]);
    return {
        background: value('background') ?? '',
        surface: value('surface') ?? '',
        text: value('text') ?? '',
        primary: value('primary') ?? '',
        secondary: value('secondary'),
        success: value('success'),
        warning: value('warning'),
        danger: value('danger'),
    };
}

/** What is wrong with the form, by field ("dark.primary"), before it is sent. */
export function draftProblems(drafts: Record<Scheme, Record<Field, string>>, fields: Field[], requireAll: boolean): Record<string, string> {
    const problems: Record<string, string> = {};
    for (const scheme of SCHEMES) {
        for (const { key, required } of FIELDS.filter((f) => fields.includes(f.key))) {
            const value = drafts[scheme][key];
            if (value === '') {
                if (required && requireAll) problems[`${scheme}.${key}`] = 'This colour is required.';
            } else if (!normalizeHex(value)) {
                problems[`${scheme}.${key}`] = 'Enter a hex code, like #2563eb.';
            }
        }
    }
    return problems;
}

export interface EditorProps {
    /** null for a new preset. */
    preset: PresetRow | null;
    /** The colours a new preset starts from. */
    start: PresetColors;
    pending: boolean;
    serverErrors: Record<string, string>;
    onCancel: () => void;
    onSave: (input: PresetInput | { colors: Partial<Record<Scheme, { primary: string | null; secondary: string | null }>> }) => void;
    onReset?: () => void;
}

/**
 * Creates or edits a preset, with a live preview of both schemes and a warning for colours that
 * are hard to read. A built-in preset only offers its primary and secondary colours.
 */
export default function PresetEditor({ preset, start, pending, serverErrors, onCancel, onSave, onReset }: EditorProps) {
    const id = useId();
    const builtin = preset?.builtin ?? false;
    const [name, setName] = useState(preset?.name ?? '');
    const [effect, setEffect] = useState<EffectKind>(preset?.effect ?? 'none');
    const [drafts, setDrafts] = useState<Record<Scheme, Record<Field, string>>>(() => {
        if (builtin && preset) {
            // The overrides only: empty means the built-in's own colour.
            const own = (scheme: Scheme) => ({ ...draftOf(preset.colors[scheme]), primary: preset.overrides?.[scheme]?.primary ?? '', secondary: preset.overrides?.[scheme]?.secondary ?? '' });
            return { dark: own('dark'), light: own('light') };
        }
        const from = preset?.colors ?? start;
        return { dark: draftOf(from.dark), light: draftOf(from.light) };
    });
    const [submitted, setSubmitted] = useState(false);

    const fields = builtin ? BUILTIN_FIELDS : FIELDS.map((f) => f.key);
    const problems = draftProblems(drafts, fields, !builtin);
    const nameProblem = !builtin && name.trim() === '' ? 'Give the preset a name.' : !builtin && name.trim().length > 40 ? 'At most 40 characters.' : null;

    /** The colours the preview and the contrast check use. */
    const colors = useMemo((): PresetColors => {
        const result = {} as PresetColors;
        for (const scheme of SCHEMES) {
            if (builtin && preset?.base) {
                const base = preset.base[scheme];
                const primary = normalizeHex(drafts[scheme].primary);
                const secondary = normalizeHex(drafts[scheme].secondary);
                // As the server does: a new primary without a secondary works the secondary out again.
                result[scheme] = { ...base, primary: primary ?? base.primary, secondary: secondary ?? (primary ? null : base.secondary) };
            } else {
                result[scheme] = toColors(drafts[scheme]);
            }
        }
        return result;
    }, [builtin, preset, drafts]);

    /** What each optional colour falls back to while it is empty, per scheme. */
    const fallbacks = useMemo(() => {
        const out = {} as Record<Scheme, Partial<Record<Field, string | null>>>;
        for (const scheme of SCHEMES) {
            const base = builtin ? preset?.base?.[scheme] : undefined;
            const c = colors[scheme];
            const link = complete(c) ? seeds(c, scheme).link : null;
            out[scheme] = base
                ? { primary: base.primary, secondary: normalizeHex(drafts[scheme].primary) ? link : base.secondary }
                : { secondary: link, success: STATUS[scheme].success, warning: STATUS[scheme].warning, danger: STATUS[scheme].danger };
        }
        return out;
    }, [builtin, preset, colors, drafts]);

    const issues = SCHEMES.flatMap((scheme) => (complete(colors[scheme]) ? contrastIssues(colors[scheme], scheme) : []));

    const set = (scheme: Scheme, key: Field, value: string) => setDrafts((d) => ({ ...d, [scheme]: { ...d[scheme], [key]: value } }));

    const error = (scheme: Scheme, key: Field) =>
        (submitted || drafts[scheme][key].length >= 7 ? problems[`${scheme}.${key}`] : null) ?? serverErrors[`colors.${scheme}.${key}`] ?? null;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        setSubmitted(true);
        if (Object.keys(problems).length || nameProblem) return;
        if (builtin) {
            const overrides = Object.fromEntries(
                SCHEMES.map((scheme) => [scheme, { primary: normalizeHex(drafts[scheme].primary), secondary: normalizeHex(drafts[scheme].secondary) }]),
            ) as Record<Scheme, { primary: string | null; secondary: string | null }>;
            onSave({ colors: overrides });
        } else {
            onSave({ name: name.trim(), effect, colors });
        }
    };

    const customised = builtin && SCHEMES.some((s) => preset?.overrides?.[s]?.primary || preset?.overrides?.[s]?.secondary);

    return (
        <form onSubmit={submit} noValidate className='flex flex-col gap-4'>
            <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]'>
                <div className='flex min-w-0 flex-col gap-4'>
                    <Section
                        title='Preset'
                        description={builtin ? 'Built-in presets keep their name and effect. Duplicate one to change everything.' : undefined}
                    >
                        <div className='grid gap-3 sm:grid-cols-2'>
                            <div className='min-w-0'>
                                <Label htmlFor={`${id}-name`}>Name</Label>
                                <Input
                                    id={`${id}-name`}
                                    value={name}
                                    disabled={builtin}
                                    maxLength={40}
                                    autoComplete='off'
                                    aria-invalid={(submitted && nameProblem) || serverErrors.name ? true : undefined}
                                    onChange={(e) => setName(e.target.value)}
                                />
                                {((submitted && nameProblem) || serverErrors.name) && (
                                    <p role='alert' className='mt-1 mb-0 text-xs text-(--ts-danger-text)'>
                                        {(submitted && nameProblem) || serverErrors.name}
                                    </p>
                                )}
                            </div>
                            <div className='min-w-0'>
                                <Label htmlFor={`${id}-effect`}>Effect</Label>
                                <Select
                                    id={`${id}-effect`}
                                    value={effect}
                                    disabled={builtin}
                                    options={Object.entries(EFFECTS).map(([value, label]) => ({ value, label }))}
                                    onChange={(value) => setEffect(value as EffectKind)}
                                />
                                <p className='mt-1 mb-0 text-xs text-muted-foreground'>How much of it shows is the Effects setting on the Themes page.</p>
                            </div>
                        </div>
                    </Section>

                    {SCHEMES.map((scheme) => (
                        <Section
                            key={scheme}
                            title={scheme === 'dark' ? 'Dark scheme' : 'Light scheme'}
                            description={builtin ? 'Leave a colour empty to keep the preset’s own.' : undefined}
                        >
                            <div className='grid gap-3 sm:grid-cols-2'>
                                {FIELDS.filter((f) => fields.includes(f.key)).map((field) => (
                                    <ColorField
                                        key={field.key}
                                        id={`${id}-${scheme}-${field.key}`}
                                        label={field.label}
                                        hint={builtin ? field.hint.split(' Empty:')[0] : field.hint}
                                        required={builtin ? false : field.required}
                                        value={drafts[scheme][field.key]}
                                        placeholder={builtin ? (preset?.base?.[scheme][field.key] ?? undefined) : undefined}
                                        fallback={fallbacks[scheme][field.key]}
                                        error={error(scheme, field.key)}
                                        onChange={(value) => set(scheme, field.key, value)}
                                    />
                                ))}
                            </div>
                        </Section>
                    ))}
                </div>

                <div className='flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto' data-testid='preview-column'>
                    <h3 className='m-0 text-base font-medium'>Preview</h3>
                    {SCHEMES.map((scheme) => (
                        <PresetPreview key={scheme} scheme={scheme} colors={colors[scheme]} effect={effect} name={name} />
                    ))}
                    {issues.length > 0 ? (
                        <Alert type='warning'>
                            <div className='min-w-0'>
                                <p className='m-0 font-medium'>Some colours are hard to read</p>
                                <ul className='m-0 mt-1 list-disc pl-4 text-sm' data-testid='contrast-issues'>
                                    {issues.map((issue) => (
                                        <li key={`${issue.scheme}-${issue.label}`}>
                                            {issue.scheme === 'dark' ? 'Dark' : 'Light'}: {issue.label.toLowerCase()} is {issue.ratio.toFixed(2)}:1, needs{' '}
                                            {issue.min}:1
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </Alert>
                    ) : (
                        SCHEMES.every((s) => complete(colors[s])) && <p className='m-0 text-sm text-muted-foreground'>Every colour pair passes WCAG AA.</p>
                    )}
                </div>
            </div>

            <div className='flex flex-wrap items-center gap-2 border-t border-border pt-4'>
                {builtin && onReset && (
                    <Button isSecondary type='button' disabled={pending || !customised} onClick={onReset}>
                        <Icon icon={RotateCcw} /> Reset to original
                    </Button>
                )}
                <div className='ml-auto flex flex-wrap gap-2'>
                    <Button isSecondary type='button' onClick={onCancel} disabled={pending}>
                        Cancel
                    </Button>
                    <Button type='submit' isLoading={pending}>
                        {preset ? 'Save' : 'Create preset'}
                    </Button>
                </div>
            </div>
        </form>
    );
}
