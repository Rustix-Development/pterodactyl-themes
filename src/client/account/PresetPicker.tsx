import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { httpErrorToHuman, Select, toast } from '@pterodactyl/sdk';
import { useTheme } from '@pterodactyl/sdk/theme';
import { choicesQuery, userApi } from '../api.ts';
import { refreshPreset } from '../lib/live.ts';

/**
 * A card on the account page for picking your own preset, when an admin allows it. "The panel's
 * choice" follows the default and the schedules.
 */
export default function PresetPicker() {
    const client = useQueryClient();
    const { scheme } = useTheme();
    const { data } = useQuery(choicesQuery());
    const choose = useMutation({
        mutationFn: userApi.choose,
        onSuccess: (choices) => {
            client.setQueryData(choicesQuery().queryKey, choices);
            void refreshPreset().catch(() => undefined);
            toast.success('Theme preset saved.');
        },
        onError: (error) => toast.error(httpErrorToHuman(error)),
    });

    if (!data?.allowed) return null;

    const swatchScheme = scheme === 'light' ? 'light' : 'dark';
    const options = [
        { value: 0, label: 'The panel’s choice', textLabel: 'The panel’s choice' },
        ...data.presets.map((preset) => ({
            value: preset.id,
            textLabel: preset.name,
            label: (
                <span className='flex items-center gap-2'>
                    <span className='flex shrink-0 overflow-hidden rounded-sm border border-border' aria-hidden='true'>
                        <span className='size-3.5' style={{ background: preset.swatch[swatchScheme][0] }} />
                        <span className='size-3.5' style={{ background: preset.swatch[swatchScheme][1] }} />
                    </span>
                    {preset.name}
                </span>
            ),
        })),
    ];

    return (
        <section className='mt-6 rounded-md border border-border bg-card p-4 text-card-foreground' data-testid='preset-picker'>
            <h2 className='m-0 text-lg font-medium'>Theme preset</h2>
            <p className='m-0 mb-3 text-sm text-muted-foreground'>The colours of the panel for you. Dark or light is still yours to switch from the account menu.</p>
            <div className='max-w-sm'>
                <label htmlFor='ts-own-preset' className='sr-only'>
                    Theme preset
                </label>
                <Select id='ts-own-preset' value={data.choice ?? 0} disabled={choose.isPending} options={options} onChange={(value) => choose.mutate(Number(value) || null)} />
            </div>
        </section>
    );
}
