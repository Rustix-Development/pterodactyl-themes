<?php

namespace RustixDev\Themes\Services;

use Carbon\CarbonImmutable;
use Illuminate\Contracts\Cache\Repository as Cache;
use Pterodactyl\Models\User;
use Pterodactyl\Services\Extensions\ExtensionSettings;
use RustixDev\Themes\Models\Preset;
use RustixDev\Themes\Models\Schedule;
use RustixDev\Themes\Support\Builtins;
use RustixDev\Themes\Support\Palette;

/**
 * The presets, schedules and default as one cached value, with each preset's stylesheet worked
 * out ahead. Everything that changes a preset, a schedule or the default calls clear().
 */
class PresetState
{
    public const string CACHE_KEY = 'ext_themes:state:v1';

    /** Extension setting: the id of the panel's default preset. */
    public const string DEFAULT = 'default_preset';

    /** Extension setting: people may pick their own preset from the account menu. */
    public const string ALLOW_USER_CHOICE = 'allow_user_choice';

    /** Per-user extension setting: the preset they picked. */
    public const string USER_PRESET = 'preset';

    /** @var array{presets: array<int, array<string, mixed>>, rules: list<array<string, mixed>>, default: int|null}|null */
    private ?array $state = null;

    public function __construct(
        private readonly Cache $cache,
        private readonly ExtensionSettings $settings,
        private readonly string $timezone,
    ) {}

    /** @return array{presets: array<int, array<string, mixed>>, rules: list<array<string, mixed>>, default: int|null} */
    public function state(): array
    {
        return $this->state ??= $this->cache->rememberForever(self::CACHE_KEY, fn (): array => $this->build());
    }

    public function clear(): void
    {
        $this->state = null;
        $this->cache->forget(self::CACHE_KEY);
    }

    public function resolver(): ScheduleResolver
    {
        return new ScheduleResolver($this->timezone);
    }

    public function timezone(): string
    {
        return $this->timezone;
    }

    public function allowsUserChoice(): bool
    {
        return (bool) $this->settings->get(self::ALLOW_USER_CHOICE, false);
    }

    /** The preset a user picked, if they may pick and it still exists. */
    public function userChoice(?User $user): ?int
    {
        if ($user === null || ! $this->allowsUserChoice()) {
            return null;
        }
        $id = $this->settings->forUser($user)->get(self::USER_PRESET);

        return is_int($id) && isset($this->state()['presets'][$id]) ? $id : null;
    }

    /**
     * The preset on for $user at $at: their own pick, else the schedule, else the default.
     *
     * @return array{preset: array<string, mixed>, source: 'user'|'schedule'|'default', rule_id: int|null, until: CarbonImmutable|null}
     */
    public function active(?User $user = null, ?CarbonImmutable $at = null): array
    {
        $state = $this->state();
        if (($id = $this->userChoice($user)) !== null) {
            return ['preset' => $state['presets'][$id], 'source' => 'user', 'rule_id' => null, 'until' => null];
        }

        $scheduled = $this->resolver()->active($state['rules'], $at ?? CarbonImmutable::now());
        if ($scheduled !== null && isset($state['presets'][(int) $scheduled['rule']['preset_id']])) {
            return ['preset' => $state['presets'][(int) $scheduled['rule']['preset_id']], 'source' => 'schedule', 'rule_id' => (int) $scheduled['rule']['id'], 'until' => $scheduled['until']];
        }

        return ['preset' => $this->defaultPreset(), 'source' => 'default', 'rule_id' => null, 'until' => null];
    }

    /** @return array<string, mixed> */
    public function defaultPreset(): array
    {
        $state = $this->state();

        return $state['presets'][$state['default']] ?? self::fallback();
    }

    /** @return array{presets: array<int, array<string, mixed>>, rules: list<array<string, mixed>>, default: int|null} */
    private function build(): array
    {
        $presets = [];
        foreach (Preset::query()->orderByDesc('builtin')->orderBy('id')->get() as $preset) {
            $presets[$preset->id] = self::describe($preset);
        }

        $rules = [];
        foreach (Schedule::query()->where('enabled', true)->orderBy('id')->get() as $rule) {
            if (isset($presets[$rule->preset_id])) {
                $rules[] = self::rule($rule);
            }
        }

        $default = $this->settings->get(self::DEFAULT);
        if (! is_int($default) || ! isset($presets[$default])) {
            $default = null;
            foreach ($presets as $id => $preset) {
                if ($preset['slug'] === Builtins::FALLBACK) {
                    $default = $id;
                }
            }
        }

        return ['presets' => $presets, 'rules' => $rules, 'default' => $default];
    }

    /**
     * A preset as the stylesheet and the admin page use it: its colours with any overrides
     * applied, the built-in colours they replace, and its stylesheet.
     *
     * @return array<string, mixed>
     */
    public static function describe(Preset $preset): array
    {
        $stored = is_array($preset->colors) ? $preset->colors : [];
        $base = null;
        $effectColors = null;
        if ($preset->builtin && ($builtin = Builtins::get((string) $preset->slug)) !== null) {
            $base = ['dark' => $builtin['dark'], 'light' => $builtin['light']];
            $effectColors = $builtin['effectColors'] ?? null;
            $colors = self::override($base, $stored);
            $effect = $builtin['effect'];
        } else {
            $colors = ['dark' => self::scheme($stored['dark'] ?? []), 'light' => self::scheme($stored['light'] ?? [])];
            $effect = in_array($preset->effect, Palette::EFFECTS, true) ? $preset->effect : 'none';
        }

        $described = [
            'id' => $preset->id,
            'slug' => $preset->slug,
            'name' => $preset->name,
            'builtin' => $preset->builtin,
            'effect' => $effect,
            'colors' => $colors,
            'base' => $base,
            'overrides' => $preset->builtin ? $stored : null,
            'effectColors' => $effectColors,
        ];
        $described['css'] = Palette::css($described);

        return $described;
    }

    /**
     * A built-in's colours with an admin's primary and secondary on top. A new primary without
     * a secondary drops the built-in's secondary, so links follow the new primary.
     *
     * @param  array{dark: array<string, string|null>, light: array<string, string|null>}  $base
     * @param  array<string, mixed>  $overrides
     * @return array{dark: array<string, string|null>, light: array<string, string|null>}
     */
    public static function override(array $base, array $overrides): array
    {
        foreach (Palette::SCHEMES as $scheme) {
            $own = is_array($overrides[$scheme] ?? null) ? $overrides[$scheme] : [];
            if (! empty($own['primary']) && empty($own['secondary'])) {
                $base[$scheme]['secondary'] = null;
            }
            foreach (Palette::BUILTIN_FIELDS as $field) {
                if (! empty($own[$field])) {
                    $base[$scheme][$field] = $own[$field];
                }
            }
        }

        return $base;
    }

    /** @return array<string, mixed> */
    public static function rule(Schedule $rule): array
    {
        return [
            'id' => $rule->id,
            'preset_id' => $rule->preset_id,
            'start_year' => $rule->start_year,
            'start_month' => $rule->start_month,
            'start_day' => $rule->start_day,
            'end_year' => $rule->end_year,
            'end_month' => $rule->end_month,
            'end_day' => $rule->end_day,
            'start_time' => $rule->start_time,
            'end_time' => $rule->end_time,
            'timezone' => $rule->timezone,
            'priority' => $rule->priority,
            'enabled' => $rule->enabled,
        ];
    }

    /**
     * @param  array<string, mixed>  $colors
     * @return array<string, string|null>
     */
    private static function scheme(array $colors): array
    {
        $scheme = [];
        foreach (Palette::FIELDS as $field) {
            $scheme[$field] = is_string($colors[$field] ?? null) ? $colors[$field] : null;
        }

        return $scheme;
    }

    /** Graphite, for a panel whose presets table is empty. */
    private static function fallback(): array
    {
        $builtin = Builtins::get(Builtins::FALLBACK);
        $preset = ['id' => null, 'slug' => Builtins::FALLBACK, 'name' => $builtin['name'], 'builtin' => true, 'effect' => 'none', 'colors' => ['dark' => $builtin['dark'], 'light' => $builtin['light']], 'base' => null, 'overrides' => null, 'effectColors' => null];
        $preset['css'] = Palette::css($preset);

        return $preset;
    }
}
