import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Button, Dialog, Input, Label, Select, Switch } from '@pterodactyl/sdk';
import type { PresetRow, Repeat, ScheduleInput, ScheduleRow } from '../api.ts';
import { MONTHS, scheduleProblems, timezones } from './format.ts';

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string | null; hint?: string; children: ReactNode }) {
    return (
        <div className='min-w-0'>
            <Label htmlFor={id}>{label}</Label>
            {children}
            {error ? (
                <p role='alert' className='mt-1 mb-0 text-xs text-(--ts-danger-text)'>
                    {error}
                </p>
            ) : (
                hint && <p className='mt-1 mb-0 text-xs text-muted-foreground'>{hint}</p>
            )}
        </div>
    );
}

const MONTH_OPTIONS = MONTHS.map((label, index) => ({ value: index + 1, label }));

/** A blank schedule: a week from today, every year, for the first preset. */
export function blankSchedule(presetId: number, now = new Date()): ScheduleInput {
    const end = new Date(now.getTime() + 6 * 86_400_000);
    return {
        preset_id: presetId,
        label: null,
        repeat: 'yearly',
        start_year: null,
        start_month: now.getMonth() + 1,
        start_day: now.getDate(),
        end_year: null,
        end_month: end.getMonth() + 1,
        end_day: end.getDate(),
        start_time: null,
        end_time: null,
        timezone: null,
        priority: 0,
        enabled: true,
    };
}

/**
 * Adds or edits a schedule: a preset and the dates it is on, every year or once, with optional
 * times, a timezone and a priority for when schedules overlap.
 */
export default function ScheduleForm({
    schedule,
    presets,
    timezone,
    pending,
    serverErrors,
    onCancel,
    onSubmit,
}: {
    schedule: ScheduleRow | ScheduleInput;
    presets: PresetRow[];
    timezone: string;
    pending: boolean;
    serverErrors: Record<string, string>;
    onCancel: () => void;
    onSubmit: (input: ScheduleInput) => void;
}) {
    const id = useId();
    const thisYear = new Date().getFullYear();
    const [input, setInput] = useState<ScheduleInput>(() => ({ ...schedule }));
    const [submitted, setSubmitted] = useState(false);
    const zones = useMemo(() => [{ value: '', label: `Panel timezone (${timezone})` }, ...timezones().map((zone) => ({ value: zone, label: zone }))], [timezone]);

    const update = (patch: Partial<ScheduleInput>) => setInput((current) => ({ ...current, ...patch }));
    const problems = scheduleProblems(input);
    const error = (key: string) => (submitted ? problems[key] : null) ?? serverErrors[key] ?? null;

    const setRepeat = (repeat: Repeat) =>
        update(
            repeat === 'once'
                ? { repeat, start_year: input.start_year ?? thisYear, end_year: input.end_year ?? (input.end_month < input.start_month ? thisYear + 1 : thisYear) }
                : { repeat, start_year: null, end_year: null },
        );

    const submit = (event: FormEvent) => {
        event.preventDefault();
        setSubmitted(true);
        if (Object.keys(problems).length) return;
        onSubmit({ ...input, label: input.label?.trim() || null });
    };

    const date = (side: 'start' | 'end') => (
        <fieldset className='m-0 min-w-0 border-0 p-0'>
            <legend className='mb-1 p-0 text-sm font-medium'>{side === 'start' ? 'Starts' : 'Ends'}</legend>
            <div className='grid grid-cols-[minmax(0,1fr)_5rem] gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_6rem]'>
                <Field id={`${id}-${side}-month`} label='Month'>
                    <Select id={`${id}-${side}-month`} value={input[`${side}_month`]} options={MONTH_OPTIONS} onChange={(v) => update({ [`${side}_month`]: Number(v) })} />
                </Field>
                <Field id={`${id}-${side}-day`} label='Day' error={error(`${side}_day`)}>
                    <Input
                        id={`${id}-${side}-day`}
                        type='number'
                        inputMode='numeric'
                        min={1}
                        max={31}
                        value={String(input[`${side}_day`])}
                        onChange={(e) => update({ [`${side}_day`]: Number(e.target.value) })}
                    />
                </Field>
                {input.repeat === 'once' && (
                    <Field id={`${id}-${side}-year`} label='Year' error={error(`${side}_year`)}>
                        <Input
                            id={`${id}-${side}-year`}
                            type='number'
                            inputMode='numeric'
                            min={2000}
                            max={2100}
                            value={String(input[`${side}_year`] ?? '')}
                            onChange={(e) => update({ [`${side}_year`]: e.target.value === '' ? null : Number(e.target.value) })}
                        />
                    </Field>
                )}
                <Field
                    id={`${id}-${side}-time`}
                    label='Time'
                    error={error(`${side}_time`)}
                    hint={side === 'start' ? 'Empty: the start of the day.' : 'Empty: the end of the day.'}
                >
                    <Input id={`${id}-${side}-time`} type='time' value={input[`${side}_time`] ?? ''} onChange={(e) => update({ [`${side}_time`]: e.target.value || null })} />
                </Field>
            </div>
        </fieldset>
    );

    return (
        <form onSubmit={submit} noValidate className='flex flex-col gap-4'>
            <div className='grid gap-3 sm:grid-cols-2'>
                <Field id={`${id}-preset`} label='Preset' error={error('preset_id')}>
                    <Select
                        id={`${id}-preset`}
                        value={input.preset_id}
                        options={presets.map((preset) => ({ value: preset.id, label: preset.name }))}
                        onChange={(v) => update({ preset_id: Number(v) })}
                    />
                </Field>
                <Field id={`${id}-label`} label='Label (optional)' error={error('label')}>
                    <Input id={`${id}-label`} value={input.label ?? ''} maxLength={60} placeholder='Winter sale' onChange={(e) => update({ label: e.target.value })} />
                </Field>
                <Field id={`${id}-repeat`} label='Repeats'>
                    <Select
                        id={`${id}-repeat`}
                        value={input.repeat}
                        options={[
                            { value: 'yearly', label: 'Every year' },
                            { value: 'once', label: 'Once' },
                        ]}
                        onChange={(v) => setRepeat(v as Repeat)}
                    />
                </Field>
                <Field id={`${id}-priority`} label='Priority' error={error('priority')} hint='When schedules overlap, the highest wins.'>
                    <Input
                        id={`${id}-priority`}
                        type='number'
                        inputMode='numeric'
                        min={-100}
                        max={100}
                        value={String(input.priority)}
                        onChange={(e) => update({ priority: Number(e.target.value) })}
                    />
                </Field>
            </div>
            {date('start')}
            {date('end')}
            <Field id={`${id}-timezone`} label='Timezone' error={error('timezone')} hint='The dates and times are in this timezone.'>
                <Select id={`${id}-timezone`} value={input.timezone ?? ''} options={zones} onChange={(v) => update({ timezone: v === '' ? null : String(v) })} />
            </Field>
            <Switch checked={input.enabled} onChange={(enabled) => update({ enabled })} label='Enabled' description='A disabled schedule is kept but never applies.' />
            <Dialog.Footer>
                <Button isSecondary type='button' onClick={onCancel} disabled={pending}>
                    Cancel
                </Button>
                <Button type='submit' isLoading={pending}>
                    {'id' in schedule ? 'Save' : 'Add schedule'}
                </Button>
            </Dialog.Footer>
        </form>
    );
}
