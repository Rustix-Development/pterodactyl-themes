<?php

namespace RustixDev\Themes\Http\Controllers;

use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RustixDev\Themes\Models\Preset;
use RustixDev\Themes\Models\Schedule;
use RustixDev\Themes\Services\PresetManager;
use RustixDev\Themes\Services\PresetState;

/** Admin > Theme Studio. Every action answers with the whole overview, so the page redraws from it. */
class AdminController
{
    public function __construct(private readonly PresetState $state, private readonly PresetManager $manager) {}

    public function index(): JsonResponse
    {
        return new JsonResponse($this->overview());
    }

    public function store(Request $request): JsonResponse
    {
        $preset = $this->manager->create($request->all());

        return new JsonResponse($this->overview(['created' => $preset->id]), 201);
    }

    public function update(Request $request, int $preset): JsonResponse
    {
        $this->manager->update(Preset::query()->findOrFail($preset), $request->all());

        return new JsonResponse($this->overview());
    }

    public function reset(int $preset): JsonResponse
    {
        $this->manager->reset(Preset::query()->findOrFail($preset));

        return new JsonResponse($this->overview());
    }

    public function duplicate(Request $request, int $preset): JsonResponse
    {
        $request->validate(['name' => ['nullable', 'string', 'max:40']]);
        $copy = $this->manager->duplicate(Preset::query()->findOrFail($preset), $request->input('name'));

        return new JsonResponse($this->overview(['created' => $copy->id]), 201);
    }

    public function destroy(int $preset): JsonResponse
    {
        $this->manager->delete(Preset::query()->findOrFail($preset));

        return new JsonResponse($this->overview());
    }

    public function setDefault(Request $request): JsonResponse
    {
        $this->manager->setDefault($request->input('preset_id'));

        return new JsonResponse($this->overview());
    }

    public function options(Request $request): JsonResponse
    {
        $this->manager->options($request->all());

        return new JsonResponse($this->overview());
    }

    public function storeSchedule(Request $request): JsonResponse
    {
        $this->manager->createSchedule($request->all());

        return new JsonResponse($this->overview(), 201);
    }

    public function updateSchedule(Request $request, int $schedule): JsonResponse
    {
        $this->manager->updateSchedule(Schedule::query()->findOrFail($schedule), $request->all());

        return new JsonResponse($this->overview());
    }

    public function destroySchedule(int $schedule): JsonResponse
    {
        $this->manager->deleteSchedule(Schedule::query()->findOrFail($schedule));

        return new JsonResponse($this->overview());
    }

    /**
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    private function overview(array $extra = []): array
    {
        $state = $this->state->state();
        $now = CarbonImmutable::now();
        $active = $this->state->active(null, $now);
        $counts = Schedule::query()->selectRaw('preset_id, COUNT(*) as total')->groupBy('preset_id')->pluck('total', 'preset_id');

        $presets = [];
        foreach ($state['presets'] as $preset) {
            unset($preset['css']);
            $preset['schedules'] = (int) ($counts[$preset['id']] ?? 0);
            $presets[] = $preset;
        }

        $schedules = [];
        foreach (Schedule::query()->orderByDesc('enabled')->orderByDesc('priority')->orderBy('start_month')->orderBy('start_day')->orderBy('id')->get() as $schedule) {
            $schedules[] = [...PresetState::rule($schedule), 'label' => $schedule->label, 'repeat' => $schedule->start_year === null ? 'yearly' : 'once'];
        }

        $upcoming = [];
        foreach ($this->state->resolver()->upcoming($state['rules'], $now) as $switch) {
            $upcoming[] = ['at' => $switch['at']->toIso8601String(), 'preset_id' => $switch['preset_id'] ?? $state['default'], 'rule_id' => $switch['rule_id']];
        }

        return [
            'presets' => $presets,
            'schedules' => $schedules,
            'default_id' => $state['default'],
            'active' => [
                'preset_id' => $active['preset']['id'],
                'source' => $active['source'],
                'rule_id' => $active['rule_id'],
                'until' => $active['until']?->toIso8601String(),
            ],
            'upcoming' => $upcoming,
            'allow_user_choice' => $this->state->allowsUserChoice(),
            'timezone' => $this->state->timezone(),
            'now' => $now->toIso8601String(),
            ...$extra,
        ];
    }
}
