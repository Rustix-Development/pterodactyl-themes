import type { ScheduleInput } from '../api.ts';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Days in a month; any year for a yearly rule, so 29 February is allowed. */
export function daysIn(month: number, year: number | null): number {
    return new Date(Date.UTC(year ?? 2000, month, 0)).getUTCDate();
}

const day = (month: number, d: number, year: number | null) => `${d} ${MONTHS[month - 1].slice(0, 3)}${year ? ` ${year}` : ''}`;

/** "15 Oct to 31 Oct, every year" / "20 Dec 2026, 18:00 to 5 Jan 2027" */
export function describeDates(rule: Pick<ScheduleInput, 'start_year' | 'start_month' | 'start_day' | 'end_year' | 'end_month' | 'end_day' | 'start_time' | 'end_time'>): string {
    const once = rule.start_year !== null;
    const start = day(rule.start_month, rule.start_day, rule.start_year) + (rule.start_time ? `, ${rule.start_time}` : '');
    const end = day(rule.end_month, rule.end_day, rule.end_year) + (rule.end_time ? `, ${rule.end_time}` : '');
    return `${start} to ${end}${once ? '' : ', every year'}`;
}

/** A moment from the server, in the viewer's own time. */
export function formatMoment(iso: string, timeZone?: string): string {
    try {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(iso));
    } catch {
        return new Date(iso).toLocaleString();
    }
}

/** Every IANA timezone the browser knows, or a short list on old browsers. */
export function timezones(): string[] {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    try {
        const zones = intl.supportedValuesOf?.('timeZone');
        if (zones?.length) return zones.includes('UTC') ? zones : ['UTC', ...zones];
    } catch {
        // fall through
    }
    return ['UTC', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'Asia/Tokyo', 'Australia/Sydney'];
}

/** Problems with a schedule before it is sent; the server checks the same. */
export function scheduleProblems(input: ScheduleInput): Record<string, string> {
    const problems: Record<string, string> = {};
    const once = input.repeat === 'once';
    if (once) {
        if (!input.start_year || input.start_year < 2000 || input.start_year > 2100) problems.start_year = 'Enter a year between 2000 and 2100.';
        if (!input.end_year || input.end_year < 2000 || input.end_year > 2100) problems.end_year = 'Enter a year between 2000 and 2100.';
    }
    if (input.start_day < 1 || input.start_day > daysIn(input.start_month, once ? input.start_year : null)) problems.start_day = 'That day is not in the month.';
    if (input.end_day < 1 || input.end_day > daysIn(input.end_month, once ? input.end_year : null)) problems.end_day = 'That day is not in the month.';
    const time = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
    if (input.start_time && !time.test(input.start_time)) problems.start_time = 'Enter a time as HH:MM.';
    if (input.end_time && !time.test(input.end_time)) problems.end_time = 'Enter a time as HH:MM.';
    if (!Number.isInteger(input.priority) || input.priority < -100 || input.priority > 100) problems.priority = 'Enter a whole number from -100 to 100.';
    if (Object.keys(problems).length) return problems;

    const key = (y: number | null, m: number, d: number, t: string | null) => `${String(y ?? 0).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${t ?? ''}`;
    if (once) {
        const start = key(input.start_year, input.start_month, input.start_day, input.start_time ?? '00:00');
        const end = key(input.end_year, input.end_month, input.end_day, input.end_time ?? '24:00');
        if (end <= start) problems.end_day = 'The schedule ends before it starts.';
    } else if (input.start_month === input.end_month && input.start_day === input.end_day && input.start_time && input.end_time && input.end_time <= input.start_time) {
        problems.end_time = 'On a one-day schedule the end time must be after the start time.';
    }
    return problems;
}
