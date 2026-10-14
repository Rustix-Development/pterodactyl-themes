import { queryOptions } from '@tanstack/react-query';
import { http } from '@pterodactyl/sdk';
import type { EffectKind, Scheme, SchemeColors } from './lib/palette.ts';

export type PresetColors = Record<Scheme, SchemeColors>;

export interface PresetRow {
    id: number;
    /** Built-in presets only. */
    slug: string | null;
    name: string;
    builtin: boolean;
    effect: EffectKind;
    /** The colours in use: a built-in's own with the admin's overrides on top. */
    colors: PresetColors;
    /** A built-in's own colours, before overrides. */
    base: PresetColors | null;
    /** A built-in's primary and secondary overrides. */
    overrides: Partial<Record<Scheme, { primary?: string; secondary?: string }>> | null;
    schedules: number;
}

export type Repeat = 'yearly' | 'once';

export interface ScheduleInput {
    preset_id: number;
    label: string | null;
    repeat: Repeat;
    start_year: number | null;
    start_month: number;
    start_day: number;
    end_year: number | null;
    end_month: number;
    end_day: number;
    start_time: string | null;
    end_time: string | null;
    timezone: string | null;
    priority: number;
    enabled: boolean;
}

export interface ScheduleRow extends ScheduleInput {
    id: number;
}

export interface Overview {
    presets: PresetRow[];
    schedules: ScheduleRow[];
    default_id: number | null;
    active: { preset_id: number | null; source: 'user' | 'schedule' | 'default'; rule_id: number | null; until: string | null };
    upcoming: { at: string; preset_id: number | null; rule_id: number | null }[];
    allow_user_choice: boolean;
    /** The panel's timezone, which schedules without their own use. */
    timezone: string;
    now: string;
    created?: number;
}

export interface PresetInput {
    name: string;
    effect: EffectKind;
    colors: PresetColors;
}

export interface Choices {
    allowed: boolean;
    choice: number | null;
    presets: { id: number; name: string; swatch: Record<Scheme, [string, string]> }[];
}

const admin = '/api/admin/extensions/themes';
const client = '/api/client/extensions/themes';

export const overviewQuery = () =>
    queryOptions({
        queryKey: ['themes', 'admin'],
        queryFn: async () => (await http.get<Overview>(`${admin}/overview`)).data,
    });

export const choicesQuery = () =>
    queryOptions({
        queryKey: ['themes', 'choices'],
        queryFn: async () => (await http.get<Choices>(`${client}/presets`)).data,
    });

export const adminApi = {
    create: async (input: PresetInput) => (await http.post<Overview>(`${admin}/presets`, input)).data,
    update: async (id: number, input: PresetInput | { colors: Partial<Record<Scheme, { primary: string | null; secondary: string | null }>> }) =>
        (await http.put<Overview>(`${admin}/presets/${id}`, input)).data,
    reset: async (id: number) => (await http.post<Overview>(`${admin}/presets/${id}/reset`)).data,
    duplicate: async (id: number) => (await http.post<Overview>(`${admin}/presets/${id}/duplicate`, {})).data,
    remove: async (id: number) => (await http.delete<Overview>(`${admin}/presets/${id}`)).data,
    setDefault: async (id: number) => (await http.put<Overview>(`${admin}/default`, { preset_id: id })).data,
    options: async (allowUserChoice: boolean) => (await http.put<Overview>(`${admin}/options`, { allow_user_choice: allowUserChoice })).data,
    createSchedule: async (input: ScheduleInput) => (await http.post<Overview>(`${admin}/schedules`, input)).data,
    updateSchedule: async (id: number, input: ScheduleInput) => (await http.put<Overview>(`${admin}/schedules/${id}`, input)).data,
    removeSchedule: async (id: number) => (await http.delete<Overview>(`${admin}/schedules/${id}`)).data,
};

export const userApi = {
    choose: async (id: number | null) => (await http.put<Choices>(`${client}/preset`, { preset_id: id })).data,
};

/** The messages of a 422, by field, for showing under the inputs. */
export function fieldErrors(error: unknown): Record<string, string> {
    const data = (error as { response?: { status?: number; data?: { errors?: unknown } } })?.response;
    const errors: Record<string, string> = {};
    const list = data?.data?.errors;
    if (Array.isArray(list)) {
        // The panel's API error shape: [{ code, status, detail, meta: { source_field } }]
        for (const item of list as { detail?: string; meta?: { source_field?: string } }[]) {
            const field = item.meta?.source_field;
            if (field && item.detail && !errors[field]) errors[field] = item.detail;
        }
    } else if (list && typeof list === 'object') {
        for (const [field, messages] of Object.entries(list as Record<string, string[]>)) {
            if (messages?.[0]) errors[field] = messages[0];
        }
    }
    return errors;
}
