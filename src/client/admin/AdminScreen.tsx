import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Copy, Lock, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Dialog, httpErrorToHuman, Icon, PageContentBlock, Select, Spinner, Switch, toast } from '@pterodactyl/sdk';
import { adminApi, fieldErrors, overviewQuery, type Overview, type PresetInput, type PresetRow, type ScheduleInput, type ScheduleRow } from '../api.ts';
import { BUILTINS, FALLBACK } from '../lib/builtins.ts';
import { refreshPreset } from '../lib/live.ts';
import { EFFECTS, SCHEMES } from '../lib/palette.ts';
import { describeDates, formatMoment } from './format.ts';
import PresetEditor from './PresetEditor.tsx';
import { Swatches } from './PresetPreview.tsx';
import ScheduleForm, { blankSchedule } from './ScheduleForm.tsx';

function Section({ title, description, action, children }: { title: string; description?: ReactNode; action?: ReactNode; children: ReactNode }) {
    return (
        <section className='mb-8 min-w-0'>
            <div className='mb-3 flex flex-wrap items-end justify-between gap-3'>
                <div className='min-w-0'>
                    <h2 className='m-0 text-lg font-medium'>{title}</h2>
                    {description && <p className='m-0 text-sm text-muted-foreground'>{description}</p>}
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

const SOURCE = { schedule: 'By schedule', default: 'The default', user: 'Picked by you' } as const;

function PresetCard({
    preset,
    data,
    busy,
    onEdit,
    onDuplicate,
    onDelete,
    onDefault,
}: {
    preset: PresetRow;
    data: Overview;
    busy: boolean;
    onEdit: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    onDefault: () => void;
}) {
    const isDefault = data.default_id === preset.id;
    const active = data.active.preset_id === preset.id;
    const customised = preset.builtin && SCHEMES.some((s) => preset.overrides?.[s]?.primary || preset.overrides?.[s]?.secondary);

    return (
        <li className='flex min-w-0 flex-col gap-3 rounded-md border border-border bg-card p-3 text-card-foreground' data-testid={`preset-${preset.slug ?? preset.id}`}>
            <div className='flex gap-2'>
                {SCHEMES.map((scheme) => (
                    <Swatches key={scheme} scheme={scheme} colors={preset.colors[scheme]} />
                ))}
            </div>
            <div className='min-w-0'>
                <div className='flex min-w-0 items-center gap-1.5'>
                    {preset.builtin && <Icon icon={Lock} className='size-3.5 shrink-0 text-muted-foreground' aria-label='Built-in' />}
                    <h3 className='m-0 truncate text-base font-medium'>{preset.name}</h3>
                </div>
                <div className='mt-1.5 flex flex-wrap gap-1.5'>
                    {active && (
                        <Badge tone='success' size='sm'>
                            On now
                        </Badge>
                    )}
                    {isDefault && (
                        <Badge tone='accent' size='sm'>
                            Default
                        </Badge>
                    )}
                    <Badge tone='neutral' size='sm' variant='soft'>
                        {preset.builtin ? 'Built-in' : 'Custom'}
                    </Badge>
                    {customised && (
                        <Badge tone='neutral' size='sm' variant='soft'>
                            Customised
                        </Badge>
                    )}
                    {preset.effect !== 'none' && (
                        <Badge tone='neutral' size='sm' variant='soft'>
                            {EFFECTS[preset.effect]}
                        </Badge>
                    )}
                    {preset.schedules > 0 && (
                        <Badge tone='neutral' size='sm' variant='soft'>
                            {preset.schedules === 1 ? '1 schedule' : `${preset.schedules} schedules`}
                        </Badge>
                    )}
                </div>
            </div>
            <div className='mt-auto flex flex-wrap items-center gap-2'>
                <Button size='small' isSecondary disabled={busy} onClick={onEdit}>
                    <Icon icon={Pencil} /> {preset.builtin ? 'Customise' : 'Edit'}
                </Button>
                <Button size='small' isSecondary disabled={busy} onClick={onDuplicate} aria-label={`Duplicate ${preset.name}`} title='Duplicate'>
                    <Icon icon={Copy} />
                </Button>
                {!isDefault && (
                    <Button size='small' isSecondary disabled={busy} onClick={onDefault} aria-label={`Make ${preset.name} the default`} title='Make default'>
                        <Icon icon={Star} />
                    </Button>
                )}
                {!preset.builtin && (
                    <Button.Danger size='small' disabled={busy || isDefault} onClick={onDelete} aria-label={`Delete ${preset.name}`} title={isDefault ? 'Make another preset the default first' : 'Delete'}>
                        <Icon icon={Trash2} />
                    </Button.Danger>
                )}
            </div>
        </li>
    );
}

function ScheduleItem({
    schedule,
    data,
    busy,
    onEdit,
    onToggle,
    onDelete,
}: {
    schedule: ScheduleRow;
    data: Overview;
    busy: boolean;
    onEdit: () => void;
    onToggle: (enabled: boolean) => void;
    onDelete: () => void;
}) {
    const preset = data.presets.find((p) => p.id === schedule.preset_id);
    const on = data.active.source === 'schedule' && data.active.rule_id === schedule.id;

    return (
        <li className='flex min-w-0 flex-col gap-3 rounded-md border border-border bg-card p-3 text-card-foreground sm:flex-row sm:items-center' data-testid={`schedule-${schedule.id}`}>
            <div className='min-w-0 flex-1'>
                <div className='flex flex-wrap items-center gap-1.5'>
                    <h3 className='m-0 text-base font-medium'>{schedule.label || preset?.name || 'Schedule'}</h3>
                    {on && (
                        <Badge tone='success' size='sm'>
                            On now
                        </Badge>
                    )}
                    {!schedule.enabled && (
                        <Badge tone='neutral' size='sm' variant='soft'>
                            Disabled
                        </Badge>
                    )}
                </div>
                <p className='m-0 mt-0.5 text-sm text-muted-foreground'>
                    {preset?.name ?? 'Unknown preset'} · {describeDates(schedule)}
                    {schedule.timezone ? ` · ${schedule.timezone}` : ''}
                    {schedule.priority ? ` · priority ${schedule.priority}` : ''}
                </p>
            </div>
            <div className='flex flex-wrap items-center gap-2'>
                <Switch checked={schedule.enabled} disabled={busy} onChange={onToggle} aria-label={`Enable ${schedule.label || preset?.name || 'schedule'}`} />
                <Button size='small' isSecondary disabled={busy} onClick={onEdit}>
                    <Icon icon={Pencil} /> Edit
                </Button>
                <Button.Danger size='small' disabled={busy} onClick={onDelete} aria-label={`Delete ${schedule.label || 'schedule'}`}>
                    <Icon icon={Trash2} />
                </Button.Danger>
            </div>
        </li>
    );
}

type Editing = { preset: PresetRow | null } | null;

/** Admin > Theme Studio: presets, the default, schedules, and whether people pick their own. */
export default function AdminScreen() {
    const client = useQueryClient();
    const { data, error } = useQuery(overviewQuery());
    const [editing, setEditing] = useState<Editing>(null);
    const [scheduling, setScheduling] = useState<ScheduleRow | ScheduleInput | null>(null);
    const [removing, setRemoving] = useState<PresetRow | null>(null);
    const [removingSchedule, setRemovingSchedule] = useState<ScheduleRow | null>(null);
    const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

    // The editor replaces the list: start it, and the list again, at the top of the page.
    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, [editing]);

    const mutation = useMutation({
        mutationFn: async ({ run }: { run: () => Promise<Overview>; done?: string; after?: () => void }) => run(),
        onMutate: () => setServerErrors({}),
        onSuccess: (overview, { done, after }) => {
            client.setQueryData(overviewQuery().queryKey, overview);
            if (done) toast.success(done);
            after?.();
            // The preset on now may have changed; show it without a reload.
            void refreshPreset().catch(() => undefined);
        },
        onError: (err) => {
            const fields = fieldErrors(err);
            setServerErrors(fields);
            toast.error(httpErrorToHuman(err));
        },
    });
    const run = (fn: () => Promise<Overview>, done?: string, after?: () => void) => mutation.mutate({ run: fn, done, after });
    const busy = mutation.isPending;

    if (!data) {
        return <PageContentBlock title='Theme Studio'>{error ? <Alert type='danger'>{httpErrorToHuman(error)}</Alert> : <Spinner centered />}</PageContentBlock>;
    }

    const byId = new Map(data.presets.map((p) => [p.id, p]));
    const active = data.active.preset_id !== null ? byId.get(data.active.preset_id) : undefined;
    const activeRule = data.schedules.find((s) => s.id === data.active.rule_id);
    const graphite = data.presets.find((p) => p.slug === FALLBACK);
    const start = graphite?.colors ?? { dark: BUILTINS[FALLBACK].dark, light: BUILTINS[FALLBACK].light };

    if (editing) {
        const preset = editing.preset;
        return (
            <PageContentBlock title='Theme Studio'>
                <div className='mb-4'>
                    <Button.Text size='small' onClick={() => setEditing(null)}>
                        ← All presets
                    </Button.Text>
                    <h2 className='m-0 mt-1 text-lg font-medium'>{preset ? (preset.builtin ? `Customise ${preset.name}` : `Edit ${preset.name}`) : 'New preset'}</h2>
                </div>
                <PresetEditor
                    key={preset?.id ?? 'new'}
                    preset={preset}
                    start={start}
                    pending={busy}
                    serverErrors={serverErrors}
                    onCancel={() => setEditing(null)}
                    onReset={preset ? () => run(() => adminApi.reset(preset.id), `${preset.name} is back to its own colours.`, () => setEditing(null)) : undefined}
                    onSave={(input) =>
                        preset
                            ? run(() => adminApi.update(preset.id, input), `${preset.name} saved.`, () => setEditing(null))
                            : run(() => adminApi.create(input as PresetInput), `${(input as PresetInput).name} created.`, () => setEditing(null))
                    }
                />
            </PageContentBlock>
        );
    }

    return (
        <PageContentBlock title='Theme Studio'>
            <section className='mb-8 grid gap-4 rounded-md border border-border bg-card p-4 text-card-foreground md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' data-testid='now'>
                <div className='min-w-0'>
                    <p className='m-0 text-sm text-muted-foreground'>On now</p>
                    <p className='m-0 text-xl font-medium' data-testid='active-name'>
                        {active?.name ?? 'Graphite'}
                    </p>
                    <p className='m-0 text-sm text-muted-foreground'>
                        {SOURCE[data.active.source]}
                        {activeRule ? `: ${activeRule.label || active?.name}` : ''}
                        {data.active.until ? `, until ${formatMoment(data.active.until)}` : ''}
                    </p>
                    {active && (
                        <div className='mt-3 flex max-w-sm gap-2'>
                            {SCHEMES.map((scheme) => (
                                <Swatches key={scheme} scheme={scheme} colors={active.colors[scheme]} />
                            ))}
                        </div>
                    )}
                </div>
                <div className='flex min-w-0 flex-col gap-4'>
                    <div className='min-w-0'>
                        <label htmlFor='ts-default' className='mb-1 block text-sm font-medium'>
                            Default preset
                        </label>
                        <Select
                            id='ts-default'
                            value={data.default_id}
                            disabled={busy}
                            options={data.presets.map((p) => ({ value: p.id, label: p.name }))}
                            onChange={(value) => run(() => adminApi.setDefault(Number(value)), 'Default preset saved.')}
                        />
                        <p className='mt-1 mb-0 text-xs text-muted-foreground'>On whenever no schedule is.</p>
                    </div>
                    <Switch
                        checked={data.allow_user_choice}
                        disabled={busy}
                        onChange={(allowed) => run(() => adminApi.options(allowed), allowed ? 'People can pick their own preset.' : 'Everyone gets the panel’s preset.')}
                        label='Let people pick their own preset'
                        description='Adds a Theme preset card to their account page. Their pick beats the schedule.'
                    />
                </div>
            </section>

            <Section
                title='Presets'
                description='Built-in presets cannot be renamed or deleted, but their primary and secondary colours can be changed. Duplicate any preset to make one you can change completely.'
                action={
                    <Button disabled={busy} onClick={() => setEditing({ preset: null })}>
                        <Icon icon={Plus} /> New preset
                    </Button>
                }
            >
                <ul className='m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3' data-testid='presets'>
                    {data.presets.map((preset) => (
                        <PresetCard
                            key={preset.id}
                            preset={preset}
                            data={data}
                            busy={busy}
                            onEdit={() => setEditing({ preset })}
                            onDuplicate={() =>
                                run(
                                    () => adminApi.duplicate(preset.id),
                                    `Copied ${preset.name}.`,
                                )
                            }
                            onDelete={() => setRemoving(preset)}
                            onDefault={() => run(() => adminApi.setDefault(preset.id), `${preset.name} is the default.`)}
                        />
                    ))}
                </ul>
            </Section>

            <Section
                title='Schedules'
                description={`Turn a preset on for some dates, every year or once. Times are in the panel's timezone (${data.timezone}) unless a schedule sets its own.`}
                action={
                    <Button disabled={busy || data.presets.length === 0} onClick={() => setScheduling(blankSchedule(data.presets[0].id))}>
                        <Icon icon={CalendarClock} /> Add schedule
                    </Button>
                }
            >
                {data.schedules.length === 0 ? (
                    <p className='m-0 text-sm text-muted-foreground'>No schedules. The default preset is always on.</p>
                ) : (
                    <ul className='m-0 flex list-none flex-col gap-2 p-0' data-testid='schedules'>
                        {data.schedules.map((schedule) => (
                            <ScheduleItem
                                key={schedule.id}
                                schedule={schedule}
                                data={data}
                                busy={busy}
                                onEdit={() => setScheduling(schedule)}
                                onToggle={(enabled) => run(() => adminApi.updateSchedule(schedule.id, { ...schedule, enabled }), enabled ? 'Schedule enabled.' : 'Schedule disabled.')}
                                onDelete={() => setRemovingSchedule(schedule)}
                            />
                        ))}
                    </ul>
                )}

                <h3 className='m-0 mt-5 mb-2 text-base font-medium'>Coming up</h3>
                {data.upcoming.length === 0 ? (
                    <p className='m-0 text-sm text-muted-foreground'>No switches in the next year.</p>
                ) : (
                    <ol className='m-0 flex list-none flex-col gap-1 p-0 text-sm' data-testid='upcoming'>
                        {data.upcoming.map((change) => {
                            const preset = change.preset_id !== null ? byId.get(change.preset_id) : undefined;
                            const rule = data.schedules.find((s) => s.id === change.rule_id);
                            return (
                                <li key={change.at} className='flex flex-wrap gap-x-2 border-b border-border py-1.5 last:border-b-0'>
                                    <span className='tabular-nums text-muted-foreground'>{formatMoment(change.at)}</span>
                                    <span>
                                        {preset?.name ?? 'Default'}
                                        <span className='text-muted-foreground'>{rule ? ` (${rule.label || 'schedule'})` : ' (default)'}</span>
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </Section>

            <Dialog open={scheduling !== null} onClose={() => setScheduling(null)} title={scheduling && 'id' in scheduling ? 'Edit schedule' : 'Add a schedule'}>
                {scheduling && (
                    <ScheduleForm
                        schedule={scheduling}
                        presets={data.presets}
                        timezone={data.timezone}
                        pending={busy}
                        serverErrors={serverErrors}
                        onCancel={() => setScheduling(null)}
                        onSubmit={(input) =>
                            'id' in scheduling
                                ? run(() => adminApi.updateSchedule(scheduling.id, input), 'Schedule saved.', () => setScheduling(null))
                                : run(() => adminApi.createSchedule(input), 'Schedule added.', () => setScheduling(null))
                        }
                    />
                )}
            </Dialog>

            <Dialog.Confirm
                open={removing !== null}
                onClose={() => setRemoving(null)}
                title={`Delete ${removing?.name ?? ''}?`}
                confirm='Delete'
                onConfirmed={() => removing && run(() => adminApi.remove(removing.id), `${removing.name} deleted.`, () => setRemoving(null))}
            >
                {removing && removing.schedules > 0
                    ? `Its ${removing.schedules === 1 ? 'schedule is' : `${removing.schedules} schedules are`} deleted with it. Anyone who picked it gets the panel's preset again.`
                    : 'Anyone who picked it gets the panel’s preset again.'}
            </Dialog.Confirm>

            <Dialog.Confirm
                open={removingSchedule !== null}
                onClose={() => setRemovingSchedule(null)}
                title='Delete this schedule?'
                confirm='Delete'
                onConfirmed={() => removingSchedule && run(() => adminApi.removeSchedule(removingSchedule.id), 'Schedule deleted.', () => setRemovingSchedule(null))}
            >
                {removingSchedule ? `${describeDates(removingSchedule)}. To keep it for later, disable it instead.` : null}
            </Dialog.Confirm>
        </PageContentBlock>
    );
}
