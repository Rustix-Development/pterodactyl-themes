<?php

namespace RustixDev\Themes\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Pterodactyl\Facades\Extensions;
use RustixDev\Themes\Services\PresetState;

/** The account menu's preset picker. Only answers while an admin allows people to pick. */
class PreferenceController
{
    public function __construct(private readonly PresetState $state) {}

    public function index(Request $request): JsonResponse
    {
        if (! $this->state->allowsUserChoice()) {
            return new JsonResponse(['allowed' => false, 'choice' => null, 'presets' => []]);
        }

        $presets = [];
        foreach ($this->state->state()['presets'] as $preset) {
            $presets[] = ['id' => $preset['id'], 'name' => $preset['name'], 'swatch' => [
                'dark' => [$preset['colors']['dark']['background'], $preset['colors']['dark']['primary']],
                'light' => [$preset['colors']['light']['background'], $preset['colors']['light']['primary']],
            ]];
        }

        return new JsonResponse(['allowed' => true, 'choice' => $this->state->userChoice($request->user()), 'presets' => $presets]);
    }

    public function update(Request $request): JsonResponse
    {
        abort_unless($this->state->allowsUserChoice(), 403, 'Picking your own preset is turned off.');
        $data = $request->validate(['preset_id' => ['present', 'nullable', 'integer', Rule::in(array_keys($this->state->state()['presets']))]]);

        $settings = Extensions::settings('themes')->forUser($request->user());
        if ($data['preset_id'] === null) {
            $settings->forget(PresetState::USER_PRESET);
        } else {
            $settings->set(PresetState::USER_PRESET, (int) $data['preset_id']);
        }

        return $this->index($request);
    }
}
