<?php

namespace RustixDev\Themes\Services;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Pterodactyl\Services\Extensions\ExtensionSettings;
use RustixDev\Themes\Models\Preset;
use RustixDev\Themes\Models\Schedule;
use RustixDev\Themes\Support\Color;
use RustixDev\Themes\Support\Palette;

/** Every change an admin makes in Theme Studio, validated, and clearing the cached state. */
class PresetManager
{
    public const int MAX_PRESETS = 50;

    public const int MAX_SCHEDULES = 50;

    private const string HEX = 'regex:/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/';

    private const string TIME = 'regex:/^([01][0-9]|2[0-3]):[0-5][0-9]$/';

    public function __construct(private readonly PresetState $state, private readonly ExtensionSettings $settings) {}

    /** @param array<string, mixed> $input */
    public function create(array $input): Preset
    {
        if (Preset::query()->where('builtin', false)->count() >= self::MAX_PRESETS) {
            throw ValidationException::withMessages(['name' => 'At most '.self::MAX_PRESETS.' presets of your own can be made. Delete one first.']);
        }
        $data = $this->validateCustom($input);
        $preset = Preset::query()->create(['name' => $data['name'], 'builtin' => false, 'effect' => $data['effect'], 'colors' => $data['colors']]);
        $this->state->clear();

        return $preset;
    }

    /**
     * A preset of your own: name, effect and every colour. A built-in: only its primary and
     * secondary colours, which are stored as overrides on top of its own.
     *
     * @param  array<string, mixed>  $input
     */
    public function update(Preset $preset, array $input): Preset
    {
        if ($preset->builtin) {
            $data = Validator::make($input, [
                'name' => ['prohibited'],
                'effect' => ['prohibited'],
                'colors' => ['required', 'array:dark,light'],
                'colors.*' => ['array:'.implode(',', Palette::BUILTIN_FIELDS)],
                'colors.*.primary' => ['nullable', 'string', self::HEX],
                'colors.*.secondary' => ['nullable', 'string', self::HEX],
            ], [
                'name.prohibited' => 'Built-in presets cannot be renamed. Duplicate it to make a copy you can rename.',
                'effect.prohibited' => 'The effect of a built-in preset cannot be changed. Duplicate it to make a copy with another effect.',
            ])->validate();

            $overrides = [];
            foreach (Palette::SCHEMES as $scheme) {
                foreach (Palette::BUILTIN_FIELDS as $field) {
                    if (($color = Color::normalize($data['colors'][$scheme][$field] ?? null)) !== null) {
                        $overrides[$scheme][$field] = $color;
                    }
                }
            }
            $preset->colors = $overrides;
        } else {
            $data = $this->validateCustom($input, $preset->id);
            $preset->fill(['name' => $data['name'], 'effect' => $data['effect'], 'colors' => $data['colors']]);
        }
        $preset->save();
        $this->state->clear();

        return $preset;
    }

    /** Puts a built-in's own colours back. */
    public function reset(Preset $preset): Preset
    {
        if (! $preset->builtin) {
            throw ValidationException::withMessages(['preset' => 'Only built-in presets can be reset.']);
        }
        $preset->colors = [];
        $preset->save();
        $this->state->clear();

        return $preset;
    }

    /** A copy of any preset, colours and effect included, that can be edited and deleted. */
    public function duplicate(Preset $preset, ?string $name = null): Preset
    {
        $described = PresetState::describe($preset);
        $name = trim((string) $name) !== '' ? trim((string) $name) : $this->copyName($preset->name);

        return $this->create(['name' => $name, 'effect' => $described['effect'], 'colors' => $described['colors']]);
    }

    public function delete(Preset $preset): void
    {
        if ($preset->builtin) {
            throw ValidationException::withMessages(['preset' => 'Built-in presets cannot be deleted.']);
        }
        if ($this->state->state()['default'] === $preset->id) {
            throw ValidationException::withMessages(['preset' => 'This is the default preset. Make another preset the default first.']);
        }
        DB::transaction(function () use ($preset): void {
            Schedule::query()->where('preset_id', $preset->id)->delete();
            $preset->delete();
        });
        $this->state->clear();
    }

    public function setDefault(mixed $id): void
    {
        $data = Validator::make(['preset_id' => $id], ['preset_id' => ['required', 'integer', Rule::exists(Preset::class, 'id')]])->validate();
        $this->settings->set(PresetState::DEFAULT, (int) $data['preset_id']);
        $this->state->clear();
    }

    /** @param array<string, mixed> $input */
    public function options(array $input): void
    {
        $data = Validator::make($input, ['allow_user_choice' => ['required', 'boolean']])->validate();
        $this->settings->set(PresetState::ALLOW_USER_CHOICE, (bool) $data['allow_user_choice']);
        $this->state->clear();
    }

    /** @param array<string, mixed> $input */
    public function createSchedule(array $input): Schedule
    {
        if (Schedule::query()->count() >= self::MAX_SCHEDULES) {
            throw ValidationException::withMessages(['preset_id' => 'At most '.self::MAX_SCHEDULES.' schedules can be made. Delete one first.']);
        }
        $schedule = Schedule::query()->create($this->validateSchedule($input));
        $this->state->clear();

        return $schedule;
    }

    /** @param array<string, mixed> $input */
    public function updateSchedule(Schedule $schedule, array $input): Schedule
    {
        $schedule->fill($this->validateSchedule($input))->save();
        $this->state->clear();

        return $schedule;
    }

    public function deleteSchedule(Schedule $schedule): void
    {
        $schedule->delete();
        $this->state->clear();
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array{name: string, effect: string, colors: array{dark: array<string, string|null>, light: array<string, string|null>}}
     */
    private function validateCustom(array $input, ?int $ignore = null): array
    {
        $rules = [
            'name' => ['required', 'string', 'max:40'],
            'effect' => ['required', 'string', Rule::in(Palette::EFFECTS)],
            'colors' => ['required', 'array:dark,light'],
            'colors.dark' => ['required', 'array:'.implode(',', Palette::FIELDS)],
            'colors.light' => ['required', 'array:'.implode(',', Palette::FIELDS)],
        ];
        foreach (Palette::SCHEMES as $scheme) {
            foreach (Palette::FIELDS as $field) {
                $required = in_array($field, Palette::REQUIRED, true) ? 'required' : 'nullable';
                $rules["colors.{$scheme}.{$field}"] = [$required, 'string', self::HEX];
            }
        }
        $data = Validator::make($input, $rules, [
            'colors.*.*.regex' => 'Enter a colour as a hex code, like #2563eb.',
            'colors.*.*.required' => 'This colour is required.',
        ])->validate();

        $name = trim($data['name']);
        if ($name === '') {
            throw ValidationException::withMessages(['name' => 'Give the preset a name.']);
        }
        $taken = Preset::query()->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->when($ignore, fn ($q) => $q->whereKeyNot($ignore))->exists();
        if ($taken) {
            throw ValidationException::withMessages(['name' => 'Another preset already has this name.']);
        }

        $colors = [];
        foreach (Palette::SCHEMES as $scheme) {
            foreach (Palette::FIELDS as $field) {
                $colors[$scheme][$field] = Color::normalize($data['colors'][$scheme][$field] ?? null);
            }
        }

        return ['name' => $name, 'effect' => $data['effect'], 'colors' => $colors];
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private function validateSchedule(array $input): array
    {
        $data = Validator::make($input, [
            'preset_id' => ['required', 'integer', Rule::exists(Preset::class, 'id')],
            'label' => ['nullable', 'string', 'max:60'],
            'repeat' => ['required', Rule::in(['yearly', 'once'])],
            'start_year' => ['exclude_unless:repeat,once', 'required', 'integer', 'between:2000,2100'],
            'end_year' => ['exclude_unless:repeat,once', 'required', 'integer', 'between:2000,2100'],
            'start_month' => ['required', 'integer', 'between:1,12'],
            'start_day' => ['required', 'integer', 'between:1,31'],
            'end_month' => ['required', 'integer', 'between:1,12'],
            'end_day' => ['required', 'integer', 'between:1,31'],
            'start_time' => ['nullable', 'string', self::TIME],
            'end_time' => ['nullable', 'string', self::TIME],
            'timezone' => ['nullable', 'string', 'timezone:all'],
            'priority' => ['sometimes', 'integer', 'between:-100,100'],
            'enabled' => ['sometimes', 'boolean'],
        ], [
            'start_time.regex' => 'Enter a time as HH:MM, like 18:00.',
            'end_time.regex' => 'Enter a time as HH:MM, like 18:00.',
        ])->validate();

        $once = $data['repeat'] === 'once';
        // Any year for a yearly rule: a leap year, so 29 February is allowed.
        foreach (['start', 'end'] as $side) {
            $year = $once ? (int) $data["{$side}_year"] : 2000;
            if (! checkdate((int) $data["{$side}_month"], (int) $data["{$side}_day"], $year)) {
                throw ValidationException::withMessages(["{$side}_day" => 'That day is not in the month.']);
            }
        }

        $rule = [
            'preset_id' => (int) $data['preset_id'],
            'label' => isset($data['label']) && trim($data['label']) !== '' ? trim($data['label']) : null,
            'start_year' => $once ? (int) $data['start_year'] : null,
            'start_month' => (int) $data['start_month'],
            'start_day' => (int) $data['start_day'],
            'end_year' => $once ? (int) $data['end_year'] : null,
            'end_month' => (int) $data['end_month'],
            'end_day' => (int) $data['end_day'],
            'start_time' => ($data['start_time'] ?? null) ?: null,
            'end_time' => ($data['end_time'] ?? null) ?: null,
            'timezone' => ($data['timezone'] ?? null) ?: null,
            'priority' => (int) ($data['priority'] ?? 0),
            'enabled' => (bool) ($data['enabled'] ?? true),
        ];

        $sameDay = [$rule['start_month'], $rule['start_day']] === [$rule['end_month'], $rule['end_day']];
        if ($once) {
            $windows = $this->state->resolver()->windows($rule, CarbonImmutable::create(1999), CarbonImmutable::create(2102));
            if ($windows === []) {
                throw ValidationException::withMessages(['end_day' => 'The schedule ends before it starts.']);
            }
        } elseif ($sameDay && $rule['start_time'] !== null && $rule['end_time'] !== null && $rule['end_time'] <= $rule['start_time']) {
            throw ValidationException::withMessages(['end_time' => 'On a one-day schedule the end time must be after the start time.']);
        }

        return $rule;
    }

    private function copyName(string $name): string
    {
        $base = mb_substr($name, 0, 33).' copy';
        $candidate = $base;
        for ($i = 2; Preset::query()->whereRaw('LOWER(name) = ?', [mb_strtolower($candidate)])->exists(); $i++) {
            $candidate = "{$base} {$i}";
        }

        return $candidate;
    }
}
