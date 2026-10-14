<?php

// Checks for the preset manager: colours, the stylesheet, presets, schedules and the resolver.
// Runs against a Pterodactyl v2 panel checkout for Laravel, on an in-memory SQLite database,
// without touching the panel's own:
//   PANEL=/var/www/pterodactyl php tests/themes.php

use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Pterodactyl\Models\User;
use Pterodactyl\Services\Extensions\ExtensionSettings;
use RustixDev\Themes\Http\Controllers\StylesheetController;
use RustixDev\Themes\Models\Preset;
use RustixDev\Themes\Models\Schedule;
use RustixDev\Themes\Services\PresetManager;
use RustixDev\Themes\Services\PresetState;
use RustixDev\Themes\Services\ScheduleResolver;
use RustixDev\Themes\Support\Builtins;
use RustixDev\Themes\Support\Color;
use RustixDev\Themes\Support\Palette;

$panel = getenv('PANEL') ?: '/var/www/pterodactyl';
if (! is_file($panel.'/vendor/autoload.php')) {
    fwrite(STDERR, "Set PANEL to a Pterodactyl v2 panel folder.\n");
    exit(2);
}

// This checkout's classes win over an installed copy of the extension.
$autoload = function (string $class): void {
    $prefix = 'RustixDev\\Themes\\';
    if (str_starts_with($class, $prefix) && is_file($file = __DIR__.'/../src/'.str_replace('\\', '/', substr($class, strlen($prefix))).'.php')) {
        require $file;
    }
};
spl_autoload_register($autoload, true, true);
require $panel.'/vendor/autoload.php';
$app = require $panel.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
spl_autoload_unregister($autoload);
spl_autoload_register($autoload, true, true);

$failures = 0;
function check(string $label, bool $ok, string $detail = ''): void
{
    global $failures;
    echo ($ok ? 'ok   ' : 'FAIL ').$label.($ok || $detail === '' ? '' : "\n     ".$detail)."\n";
    $failures += $ok ? 0 : 1;
}
/** The validation message for $field when $fn is refused, or null when it is not. */
function refused(callable $fn, ?string $field = null): ?string
{
    try {
        $fn();
    } catch (ValidationException $exception) {
        $errors = $exception->errors();

        return $field === null ? (string) array_values($errors)[0][0] : ($errors[$field][0] ?? null);
    }

    return null;
}

/** Extension settings kept in memory, per user too, in place of the extension_settings table. */
final class MemorySettings extends ExtensionSettings
{
    /** @var array<string, array<string, mixed>> */
    public static array $values = [];

    public function __construct(private readonly string $scope = 'global')
    {
        parent::__construct('themes');
    }

    public function forUser(User $user): ExtensionSettings
    {
        return new self('user:'.$user->id);
    }

    public function get(string $key, mixed $default = null): mixed
    {
        return self::$values[$this->scope][$key] ?? $default;
    }

    public function set(string $key, mixed $value): void
    {
        self::$values[$this->scope][$key] = $value;
    }

    public function forget(string $key): void
    {
        unset(self::$values[$this->scope][$key]);
    }
}

config(['cache.default' => 'array']);
config(['database.connections.themes_test' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true]]);
DB::setDefaultConnection('themes_test');
(require __DIR__.'/../database/migrations/2026_10_14_000001_create_ext_themes_tables.php')->up();

$settings = new MemorySettings;
$state = new PresetState(app('cache.store'), $settings, 'UTC');
$manager = new PresetManager($state, $settings);
$at = fn (string $time, string $tz = 'UTC') => CarbonImmutable::parse($time, $tz);

// --- Colours: the server writes what the editor computes ------------------------------
$fixture = json_decode(file_get_contents(__DIR__.'/fixtures/seeds.json'), true, flags: JSON_THROW_ON_ERROR);
foreach ($fixture as $id => $entry) {
    foreach (Palette::SCHEMES as $scheme) {
        $php = Palette::seeds($entry['colors'][$scheme], $scheme);
        check("seeds: {$id} {$scheme} match the editor", $php === $entry['seeds'][$scheme], json_encode(array_diff_assoc(array_map('strval', $php), array_map('strval', $entry['seeds'][$scheme]))));
    }
}
check('colour: contrast of black on white is 21', abs(Color::contrast('#000000', '#ffffff') - 21) < 1e-9);
check('colour: text on a fill reads', Color::on('#ffff00') === '#14110f' && Color::on('#1d4ed8') === '#ffffff');
check('colour: hex codes are normalised', Color::normalize('#ABC') === '#aabbcc' && Color::normalize('red') === null && Color::normalize('#12345') === null);

// --- Migration --------------------------------------------------------------------------
$builtins = Preset::query()->where('builtin', true)->orderBy('id')->pluck('slug')->all();
check('migration: the ten built-ins', $builtins === array_keys(Builtins::all()), implode(',', $builtins));
$seasonal = Schedule::query()->with('preset')->orderBy('id')->get();
check('migration: Halloween 15-31 Oct and Christmas 1-26 Dec every year',
    $seasonal->count() === 2
    && $seasonal[0]->preset->slug === 'halloween' && [$seasonal[0]->start_month, $seasonal[0]->start_day, $seasonal[0]->end_month, $seasonal[0]->end_day] === [10, 15, 10, 31]
    && $seasonal[1]->preset->slug === 'christmas' && [$seasonal[1]->start_month, $seasonal[1]->start_day, $seasonal[1]->end_month, $seasonal[1]->end_day] === [12, 1, 12, 26]
    && $seasonal[0]->start_year === null && $seasonal[0]->enabled);
$ids = Preset::query()->pluck('id', 'slug')->all();

// --- The stylesheet --------------------------------------------------------------------
$graphite = PresetState::describe(Preset::query()->find($ids['graphite']));
check('css: Graphite seeds for both schemes',
    str_contains($graphite['css'], ':root:root{--ts-effect-kind:none;}')
    && str_contains($graphite['css'], ':root:root.dark{--ts-bg:#111317;--ts-surface:#1b1e24;--ts-text:#e7e9ec;--ts-primary:#2563eb;--ts-primary-fg:#ffffff;--ts-link:#7aa7ff;--ts-link-fg:#14110f;}')
    && str_contains($graphite['css'], ':root:root.light{--ts-bg:#f3f4f6;'), $graphite['css']);
$halloween = PresetState::describe(Preset::query()->find($ids['halloween']));
check('css: Halloween brings its bats and their colour', str_contains($halloween['css'], '--ts-effect-kind:bats') && str_contains($halloween['css'], '--ts-effect:#6a5487;'), $halloween['css']);
$christmas = PresetState::describe(Preset::query()->find($ids['christmas']));
check('css: Christmas brings snow', str_contains($christmas['css'], '--ts-effect-kind:snow') && str_contains($christmas['css'], '--ts-effect:#ffffff;'));
$evil = Palette::css(['effect' => 'none;}body{display:none', 'colors' => ['dark' => ['background' => '#000000;}body{x:y', 'surface' => '#111111', 'text' => '#ffffff', 'primary' => '#2563eb'], 'light' => $fixture['graphite']['colors']['light']]]);
check('css: only colours make it into the stylesheet', ! str_contains($evil, 'body') && str_contains($evil, '--ts-effect-kind:none;') && ! str_contains($evil, '--ts-bg:#000000'), $evil);
$confetti = Palette::css(['effect' => 'confetti', 'colors' => ['dark' => $fixture['graphite']['colors']['dark'], 'light' => $fixture['graphite']['colors']['light']]]);
check('css: confetti in the preset’s own colours', preg_match('/:root:root\.dark\{[^}]*--ts-effect:#2563eb #7aa7ff #[0-9a-f]{6} #[0-9a-f]{6} #[0-9a-f]{6};/', $confetti) === 1, $confetti);

// --- Built-ins are locked ----------------------------------------------------------------
$ocean = Preset::query()->find($ids['ocean']);
check('built-in: cannot be deleted', refused(fn () => $manager->delete($ocean), 'preset') === 'Built-in presets cannot be deleted.');
check('built-in: cannot be renamed', refused(fn () => $manager->update($ocean, ['name' => 'Sea', 'colors' => []]), 'name') !== null);
check('built-in: its effect cannot change', refused(fn () => $manager->update(Preset::query()->find($ids['christmas']), ['effect' => 'none', 'colors' => []]), 'effect') !== null);
check('built-in: only primary and secondary', refused(fn () => $manager->update($ocean, ['colors' => ['dark' => ['background' => '#000000']]])) !== null);
check('built-in: a bad colour is refused', refused(fn () => $manager->update($ocean, ['colors' => ['dark' => ['primary' => 'blue']]]), 'colors.dark.primary') !== null);
$manager->update($ocean, ['colors' => ['dark' => ['primary' => '#E11D48', 'secondary' => null], 'light' => ['primary' => null, 'secondary' => '#0F766E']]]);
$described = PresetState::describe($ocean->fresh());
check('built-in: overrides stored as given', $ocean->fresh()->colors === ['dark' => ['primary' => '#e11d48'], 'light' => ['secondary' => '#0f766e']], json_encode($ocean->fresh()->colors));
check('built-in: a new primary works the secondary out again', $described['colors']['dark']['primary'] === '#e11d48' && $described['colors']['dark']['secondary'] === null
    && Palette::seeds($described['colors']['dark'], 'dark')['link'] !== Builtins::get('ocean')['dark']['secondary']);
check('built-in: the rest stays its own', $described['colors']['dark']['background'] === Builtins::get('ocean')['dark']['background'] && $described['colors']['light']['primary'] === Builtins::get('ocean')['light']['primary'] && $described['colors']['light']['secondary'] === '#0f766e');
check('built-in: name and slug unchanged', $ocean->fresh()->name === 'Ocean' && $ocean->fresh()->slug === 'ocean' && $ocean->fresh()->builtin);
$manager->reset($ocean);
check('built-in: reset to its own colours', $ocean->fresh()->colors === [] && PresetState::describe($ocean->fresh())['colors']['dark'] === Builtins::get('ocean')['dark']);

// --- Presets of your own -----------------------------------------------------------------
$colors = ['dark' => ['background' => '#0f0f12', 'surface' => '#18181c', 'text' => '#ededed', 'primary' => '#EA580C'], 'light' => ['background' => '#FAFAF9', 'surface' => '#ffffff', 'text' => '#1c1917', 'primary' => '#c2410c', 'success' => '#15803D']];
$sunset = $manager->create(['name' => '  Sunset ', 'effect' => 'leaves', 'colors' => $colors]);
check('custom: created, trimmed and normalised', $sunset->name === 'Sunset' && ! $sunset->builtin && $sunset->slug === null && $sunset->effect === 'leaves'
    && $sunset->colors['dark']['primary'] === '#ea580c' && $sunset->colors['dark']['secondary'] === null && $sunset->colors['light']['success'] === '#15803d');
check('custom: name required', refused(fn () => $manager->create(['name' => '', 'effect' => 'none', 'colors' => $colors]), 'name') !== null);
check('custom: name at most 40', refused(fn () => $manager->create(['name' => str_repeat('a', 41), 'effect' => 'none', 'colors' => $colors]), 'name') !== null);
check('custom: names are unique', refused(fn () => $manager->create(['name' => 'sunset', 'effect' => 'none', 'colors' => $colors]), 'name') === 'Another preset already has this name.');
check('custom: built-in names are taken too', refused(fn () => $manager->create(['name' => 'Graphite', 'effect' => 'none', 'colors' => $colors]), 'name') !== null);
check('custom: unknown effect', refused(fn () => $manager->create(['name' => 'X', 'effect' => 'fireworks', 'colors' => $colors]), 'effect') !== null);
check('custom: required colour missing', refused(fn () => $manager->create(['name' => 'X', 'effect' => 'none', 'colors' => ['dark' => array_diff_key($colors['dark'], ['text' => 1]), 'light' => $colors['light']]]), 'colors.dark.text') !== null);
check('custom: broken colour', refused(fn () => $manager->create(['name' => 'X', 'effect' => 'none', 'colors' => ['dark' => [...$colors['dark'], 'warning' => 'url(x)'], 'light' => $colors['light']]]), 'colors.dark.warning') !== null);
check('custom: unknown colour key', refused(fn () => $manager->create(['name' => 'X', 'effect' => 'none', 'colors' => ['dark' => [...$colors['dark'], 'glow' => '#ffffff'], 'light' => $colors['light']]])) !== null);
check('custom: one scheme missing', refused(fn () => $manager->create(['name' => 'X', 'effect' => 'none', 'colors' => ['dark' => $colors['dark']]]), 'colors.light') !== null);
$manager->update($sunset, ['name' => 'Sunset 2', 'effect' => 'confetti', 'colors' => $colors]);
check('custom: renamed and effect changed', $sunset->fresh()->name === 'Sunset 2' && $sunset->fresh()->effect === 'confetti');
check('custom: keeps its own name on save', refused(fn () => $manager->update($sunset->fresh(), ['name' => 'Sunset 2', 'effect' => 'none', 'colors' => $colors])) === null);
$copy = $manager->duplicate(Preset::query()->find($ids['halloween']));
$copied = PresetState::describe($copy);
check('duplicate: a built-in becomes an editable copy with its effect', $copy->name === 'Halloween copy' && ! $copy->builtin && $copy->effect === 'bats'
    && $copied['colors']['dark']['background'] === Builtins::get('halloween')['dark']['background']);
check('duplicate: names do not clash', $manager->duplicate(Preset::query()->find($ids['halloween']))->name === 'Halloween copy 2');
$copy->delete();
Preset::query()->where('name', 'Halloween copy 2')->delete();

// --- Default -----------------------------------------------------------------------------
$state->clear();
check('default: Graphite until one is picked', $state->defaultPreset()['slug'] === 'graphite');
$manager->setDefault($sunset->id);
check('default: picked', $state->defaultPreset()['id'] === $sunset->id && $settings->get(PresetState::DEFAULT) === $sunset->id);
check('default: cannot be deleted', refused(fn () => $manager->delete($sunset->fresh()), 'preset') !== null);
check('default: must exist', refused(fn () => $manager->setDefault(9999), 'preset_id') !== null && refused(fn () => $manager->setDefault('abc'), 'preset_id') !== null);

// --- Schedules: validation ---------------------------------------------------------------
$rule = ['preset_id' => $ids['christmas'], 'repeat' => 'yearly', 'start_month' => 12, 'start_day' => 20, 'end_month' => 1, 'end_day' => 5];
check('schedule: 31 April is not a day', refused(fn () => $manager->createSchedule([...$rule, 'start_month' => 4, 'start_day' => 31]), 'start_day') !== null);
check('schedule: 29 February every year is allowed', refused(fn () => $manager->createSchedule([...$rule, 'start_month' => 2, 'start_day' => 29, 'end_month' => 3, 'end_day' => 1, 'enabled' => false])) === null);
check('schedule: 29 February 2027 is not', refused(fn () => $manager->createSchedule([...$rule, 'repeat' => 'once', 'start_year' => 2027, 'end_year' => 2027, 'start_month' => 2, 'start_day' => 29, 'end_month' => 3, 'end_day' => 1]), 'start_day') !== null);
check('schedule: once needs years', refused(fn () => $manager->createSchedule([...$rule, 'repeat' => 'once']), 'start_year') !== null);
check('schedule: once must end after it starts', refused(fn () => $manager->createSchedule([...$rule, 'repeat' => 'once', 'start_year' => 2026, 'end_year' => 2026]), 'end_day') !== null);
check('schedule: a one-day rule ends after it starts', refused(fn () => $manager->createSchedule([...$rule, 'end_month' => 12, 'end_day' => 20, 'start_time' => '18:00', 'end_time' => '09:00']), 'end_time') !== null);
check('schedule: times are HH:MM', refused(fn () => $manager->createSchedule([...$rule, 'start_time' => '7pm']), 'start_time') !== null && refused(fn () => $manager->createSchedule([...$rule, 'start_time' => '24:00']), 'start_time') !== null);
check('schedule: timezone must exist', refused(fn () => $manager->createSchedule([...$rule, 'timezone' => 'Mars/Olympus']), 'timezone') !== null);
check('schedule: priority is bounded', refused(fn () => $manager->createSchedule([...$rule, 'priority' => 1000]), 'priority') !== null);
check('schedule: preset must exist', refused(fn () => $manager->createSchedule([...$rule, 'preset_id' => 9999]), 'preset_id') !== null);
check('schedule: repeat is yearly or once', refused(fn () => $manager->createSchedule([...$rule, 'repeat' => 'weekly']), 'repeat') !== null);
Schedule::query()->where('start_month', 2)->delete();

// --- The resolver --------------------------------------------------------------------------
$resolver = new ScheduleResolver('UTC');
$halloweenRule = ['id' => 1, 'preset_id' => 9, 'start_year' => null, 'start_month' => 10, 'start_day' => 15, 'end_year' => null, 'end_month' => 10, 'end_day' => 31, 'start_time' => null, 'end_time' => null, 'timezone' => null, 'priority' => 10, 'enabled' => true];
$christmasRule = [...$halloweenRule, 'id' => 2, 'preset_id' => 10, 'start_month' => 12, 'start_day' => 1, 'end_month' => 12, 'end_day' => 26];
$rules = [$halloweenRule, $christmasRule];
$on = fn (array $rules, string $time, string $tz = 'UTC') => $resolver->active($rules, $at($time, $tz))['rule']['id'] ?? null;
check('resolver: before Halloween', $on($rules, '2026-10-14 23:59:59') === null);
check('resolver: Halloween from the 15th', $on($rules, '2026-10-15 00:00:00') === 1 && $on($rules, '2026-10-31 23:59:59') === 1);
check('resolver: Halloween over on 1 November', $on($rules, '2026-11-01 00:00:00') === null);
check('resolver: Christmas through the 26th', $on($rules, '2026-12-01 00:00') === 2 && $on($rules, '2026-12-26 23:59:59') === 2 && $on($rules, '2026-12-27 00:00') === null);
check('resolver: every year', $on($rules, '2031-10-20 12:00') === 1);
$wrap = [...$halloweenRule, 'id' => 3, 'start_month' => 12, 'start_day' => 20, 'end_month' => 1, 'end_day' => 5];
check('resolver: over new year (20 Dec to 5 Jan)', $on([$wrap], '2026-12-19 23:59') === null && $on([$wrap], '2026-12-20 00:00') === 3 && $on([$wrap], '2027-01-01 12:00') === 3
    && $on([$wrap], '2027-01-05 23:59') === 3 && $on([$wrap], '2027-01-06 00:00') === null && $on([$wrap], '2026-01-03 00:00') === 3);
$auckland = [...$christmasRule, 'id' => 4, 'timezone' => 'Pacific/Auckland'];
check('resolver: dates are in the rule’s timezone', $on([$auckland], '2026-11-30 12:00') === 4 && $on([$christmasRule], '2026-11-30 12:00') === null
    && $on([$auckland], '2026-12-26 12:00') === null);
check('resolver: or the panel’s', (new ScheduleResolver('America/New_York'))->active([$christmasRule], $at('2026-12-01 03:00'))=== null
    && (new ScheduleResolver('America/New_York'))->active([$christmasRule], $at('2026-12-01 06:00'))['rule']['id'] === 2);
$evening = [...$halloweenRule, 'id' => 5, 'start_month' => 10, 'start_day' => 31, 'start_time' => '18:00', 'end_month' => 11, 'end_day' => 1, 'end_time' => '06:00'];
check('resolver: start and end times', $on([$evening], '2026-10-31 17:59') === null && $on([$evening], '2026-10-31 18:00') === 5 && $on([$evening], '2026-11-01 05:59') === 5 && $on([$evening], '2026-11-01 06:00') === null);
check('resolver: the higher priority wins an overlap', $on([$halloweenRule, [...$evening, 'priority' => 20]], '2026-10-31 20:00') === 5 && $on([$halloweenRule, [...$evening, 'priority' => 0]], '2026-10-31 20:00') === 1);
check('resolver: on a tie the later start wins', $on([$halloweenRule, [...$evening, 'priority' => 10]], '2026-10-31 20:00') === 5);
check('resolver: on a full tie the older rule wins', $on([[...$halloweenRule, 'id' => 7], [...$halloweenRule, 'id' => 6]], '2026-10-20') === 6);
check('resolver: disabled rules never apply', $on([[...$halloweenRule, 'enabled' => false]], '2026-10-20') === null);
$once = [...$halloweenRule, 'id' => 8, 'start_year' => 2026, 'end_year' => 2026, 'start_month' => 11, 'start_day' => 27, 'end_month' => 11, 'end_day' => 30];
check('resolver: a one-off happens once', $on([$once], '2026-11-28') === 8 && $on([$once], '2027-11-28') === null);
$leap = [...$halloweenRule, 'id' => 9, 'start_month' => 2, 'start_day' => 29, 'end_month' => 3, 'end_day' => 1];
check('resolver: 29 February is the 28th in other years', $on([$leap], '2027-02-28 12:00') === 9 && $on([$leap], '2028-02-28 12:00') === null && $on([$leap], '2028-02-29 12:00') === 9);
$upcoming = $resolver->upcoming($rules, $at('2026-10-14 12:00'));
$summary = array_map(fn (array $s): string => $s['at']->format('Y-m-d H:i').'='.($s['preset_id'] ?? 'default'), $upcoming);
check('resolver: the coming switches', array_slice($summary, 0, 4) === ['2026-10-15 00:00=9', '2026-11-01 00:00=default', '2026-12-01 00:00=10', '2026-12-27 00:00=default'], implode(', ', $summary));
$summary = array_map(fn (array $s): string => $s['at']->format('Y-m-d H:i').'='.($s['preset_id'] ?? 'default'), $resolver->upcoming([$halloweenRule, [...$evening, 'priority' => 20, 'preset_id' => 3]], $at('2026-10-20')));
check('resolver: switches inside an overlap', array_slice($summary, 0, 3) === ['2026-10-31 18:00=3', '2026-11-01 06:00=default', '2027-10-15 00:00=9'], implode(', ', $summary));

// --- What applies ------------------------------------------------------------------------
$state->clear();
CarbonImmutable::setTestNow('2026-12-10 12:00:00');
$active = $state->active();
check('active: the Christmas schedule in December', $active['source'] === 'schedule' && $active['preset']['slug'] === 'christmas' && $active['until']?->format('Y-m-d') === '2026-12-27');
CarbonImmutable::setTestNow('2026-12-28 12:00:00');
check('active: the default after it', $state->active()['source'] === 'default' && $state->active()['preset']['id'] === $sunset->id);
$christmasSchedule = Schedule::query()->where('preset_id', $ids['christmas'])->first();
$manager->updateSchedule($christmasSchedule, [...PresetState::rule($christmasSchedule), 'repeat' => 'yearly', 'enabled' => false]);
CarbonImmutable::setTestNow('2026-12-10 12:00:00');
check('active: a disabled schedule gives way to the default (cache cleared on save)', $state->active()['source'] === 'default');
$manager->updateSchedule($christmasSchedule->fresh(), [...PresetState::rule($christmasSchedule), 'repeat' => 'yearly', 'enabled' => true]);
$manager->createSchedule(['preset_id' => $sunset->id, 'label' => 'Launch', 'repeat' => 'once', 'start_year' => 2026, 'start_month' => 12, 'start_day' => 9, 'end_year' => 2026, 'end_month' => 12, 'end_day' => 11, 'priority' => 50]);
check('active: a higher one-off beats Christmas', $state->active()['preset']['id'] === $sunset->id && $state->active()['source'] === 'schedule');

$user = new User;
$user->id = 42;
$state->clear();
$settings->forUser($user)->set(PresetState::USER_PRESET, $ids['forest']);
check('user: their pick is ignored until allowed', $state->active($user)['source'] === 'schedule');
$manager->options(['allow_user_choice' => true]);
check('user: their pick wins once allowed', $state->active($user)['source'] === 'user' && $state->active($user)['preset']['slug'] === 'forest');
check('user: others still follow the schedule', $state->active(null)['source'] === 'schedule');
check('options: must be a boolean', refused(fn () => $manager->options(['allow_user_choice' => 'maybe']), 'allow_user_choice') !== null);

// --- Delete ------------------------------------------------------------------------------
$manager->setDefault($ids['graphite']);
$scheduled = Schedule::query()->where('preset_id', $sunset->id)->count();
$manager->delete($sunset->fresh());
check('delete: a custom preset goes, with its schedules', Preset::query()->find($sunset->id) === null && $scheduled === 1 && Schedule::query()->where('preset_id', $sunset->id)->count() === 0);
check('delete: the state follows', ! isset($state->state()['presets'][$sunset->id]) && $state->active(null)['preset']['slug'] === 'christmas');
$settings->forUser($user)->set(PresetState::USER_PRESET, 9999);
check('user: a pick that no longer exists is ignored', $state->active($user)['source'] === 'schedule');

// --- The stylesheet route -----------------------------------------------------------------
$response = (new StylesheetController)(Request::create('/extensions/themes/preset.css'), $state);
$etag = $response->headers->get('ETag');
check('route: CSS, revalidated every load', $response->getStatusCode() === 200 && str_starts_with($response->headers->get('Content-Type'), 'text/css')
    && str_contains($response->headers->get('Cache-Control'), 'no-cache') && $etag !== null && str_contains($response->getContent(), '--ts-effect-kind:snow'));
$request = Request::create('/extensions/themes/preset.css');
$request->headers->set('If-None-Match', $etag);
check('route: 304 when unchanged', (new StylesheetController)($request, $state)->getStatusCode() === 304);
$manager->update(Preset::query()->find($ids['christmas']), ['colors' => ['dark' => ['primary' => '#15803d']]]);
$request = Request::create('/extensions/themes/preset.css');
$request->headers->set('If-None-Match', $etag);
$response = (new StylesheetController)($request, $state);
check('route: a saved change is served at once', $response->getStatusCode() === 200 && str_contains($response->getContent(), '--ts-primary:#15803d'));
$named = Palette::css(['effect' => 'none', 'colors' => $fixture['graphite']['colors']]);
check('route: a preset name cannot break out of the comment', ! str_contains((string) (new ReflectionMethod(StylesheetController::class, 'comment'))->invoke(new StylesheetController, 'a */ body{}'), '*/') && $named !== '');

CarbonImmutable::setTestNow();
echo $failures === 0 ? "\nAll checks passed.\n" : "\n{$failures} check(s) failed.\n";
exit($failures === 0 ? 0 : 1);
