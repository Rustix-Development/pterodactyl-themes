<?php

namespace RustixDev\Themes\Services;

use Carbon\CarbonImmutable;
use DateTimeZone;
use Throwable;

/**
 * Works out which scheduled preset is on at a moment, and when the next switches happen.
 *
 * A rule is a plain array with the columns of ext_themes_schedules. It covers the time from its
 * start date (at start_time, or the start of the day) to its end date (until end_time, or the
 * end of the day) in its timezone. With no years it repeats every year, and a start after the
 * end runs over new year (20 Dec to 5 Jan). When rules overlap the highest priority wins, then
 * the one that started last, then the oldest rule.
 */
final class ScheduleResolver
{
    public function __construct(private readonly string $timezone = 'UTC') {}

    /**
     * @param  array<string, mixed>  $rule
     * @return list<array{0: CarbonImmutable, 1: CarbonImmutable}> windows in UTC that overlap [$from, $to)
     */
    public function windows(array $rule, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $tz = self::zone($rule['timezone'] ?? null, $this->timezone);
        $years = ($rule['start_year'] ?? null) === null
            ? range($from->setTimezone($tz)->year - 1, $to->setTimezone($tz)->year)
            : [(int) $rule['start_year']];

        $windows = [];
        foreach ($years as $year) {
            $wraps = [(int) $rule['start_month'], (int) $rule['start_day']] > [(int) $rule['end_month'], (int) $rule['end_day']];
            $endYear = ($rule['end_year'] ?? null) !== null ? (int) $rule['end_year'] : $year + ($wraps ? 1 : 0);
            $start = self::at($tz, $year, (int) $rule['start_month'], (int) $rule['start_day'], $rule['start_time'] ?? null);
            $end = self::at($tz, $endYear, (int) $rule['end_month'], (int) $rule['end_day'], $rule['end_time'] ?? null, end: true);
            if ($end > $start && $start < $to && $end > $from) {
                $windows[] = [$start->utc(), $end->utc()];
            }
        }

        return $windows;
    }

    /**
     * The rule that is on at $at, with the start of its current window.
     *
     * @param  iterable<array<string, mixed>>  $rules
     * @return array{rule: array<string, mixed>, since: CarbonImmutable, until: CarbonImmutable}|null
     */
    public function active(iterable $rules, CarbonImmutable $at): ?array
    {
        $best = null;
        foreach ($rules as $rule) {
            if (! ($rule['enabled'] ?? true)) {
                continue;
            }
            foreach ($this->windows($rule, $at, $at->addSecond()) as [$start, $end]) {
                if ($start > $at || $end <= $at) {
                    continue;
                }
                $candidate = ['rule' => $rule, 'since' => $start, 'until' => $end];
                if ($best === null || self::outranks($candidate, $best)) {
                    $best = $candidate;
                }
            }
        }

        return $best;
    }

    /**
     * The moments in the next $days days when the scheduled preset changes. preset_id is null
     * when no rule is on from then, and the default preset applies.
     *
     * @param  iterable<array<string, mixed>>  $rules
     * @return list<array{at: CarbonImmutable, preset_id: int|null, rule_id: int|null}>
     */
    public function upcoming(iterable $rules, CarbonImmutable $now, int $days = 400, int $limit = 8): array
    {
        $rules = array_values(array_filter(is_array($rules) ? $rules : iterator_to_array($rules), fn (array $rule): bool => (bool) ($rule['enabled'] ?? true)));
        $to = $now->addDays($days);
        $moments = [];
        foreach ($rules as $rule) {
            foreach ($this->windows($rule, $now, $to) as [$start, $end]) {
                foreach ([$start, $end] as $moment) {
                    if ($moment > $now && $moment < $to) {
                        $moments[$moment->getTimestamp()] = $moment;
                    }
                }
            }
        }
        ksort($moments);

        $current = $this->active($rules, $now)['rule']['preset_id'] ?? null;
        $switches = [];
        foreach ($moments as $moment) {
            $active = $this->active($rules, $moment);
            $preset = $active === null ? null : (int) $active['rule']['preset_id'];
            if ($preset !== $current) {
                $switches[] = ['at' => $moment, 'preset_id' => $preset, 'rule_id' => $active === null ? null : (int) $active['rule']['id']];
                $current = $preset;
                if (count($switches) >= $limit) {
                    break;
                }
            }
        }

        return $switches;
    }

    /** A valid timezone name, or $fallback. */
    public static function zone(?string $name, string $fallback): DateTimeZone
    {
        try {
            return new DateTimeZone($name !== null && $name !== '' ? $name : $fallback);
        } catch (Throwable) {
            return new DateTimeZone('UTC');
        }
    }

    /** @param array{rule: array<string, mixed>, since: CarbonImmutable} $a @param array{rule: array<string, mixed>, since: CarbonImmutable} $b */
    private static function outranks(array $a, array $b): bool
    {
        return [(int) ($a['rule']['priority'] ?? 0), $a['since']->getTimestamp(), -(int) ($a['rule']['id'] ?? 0)]
            > [(int) ($b['rule']['priority'] ?? 0), $b['since']->getTimestamp(), -(int) ($b['rule']['id'] ?? 0)];
    }

    /** A day and time in $tz; 29 February is the 28th in other years. $end without a time is the next midnight. */
    private static function at(DateTimeZone $tz, int $year, int $month, int $day, ?string $time, bool $end = false): CarbonImmutable
    {
        $date = CarbonImmutable::create($year, $month, 1, 0, 0, 0, $tz);
        $date = $date->setDay(min($day, $date->daysInMonth));
        if ($time !== null && $time !== '') {
            [$hour, $minute] = array_map('intval', explode(':', $time));

            return $date->setTime($hour, $minute);
        }

        return $end ? $date->addDay() : $date;
    }
}
