<?php

namespace RustixDev\Themes;

use Pterodactyl\Extensions\ExtensionProvider;
use Pterodactyl\Services\Extensions\ExtensionSettingDefinition;
use Pterodactyl\Services\Extensions\ExtensionSettingsDefinition;
use RustixDev\Themes\Services\PresetManager;
use RustixDev\Themes\Services\PresetState;

class ThemesProvider extends ExtensionProvider
{
    public function register(): void
    {
        $this->app->bind(PresetState::class, fn ($app): PresetState => new PresetState(
            $app->make('cache.store'),
            $this->settings(),
            (string) config('app.timezone', 'UTC'),
        ));
        $this->app->bind(PresetManager::class, fn ($app): PresetManager => new PresetManager($app->make(PresetState::class), $this->settings()));
    }

    public function boot(): void
    {
        $this->registerApiRoutes();
        $this->registerWebRoutes($this->extensionPath('routes', 'web.php'));

        $this->registerSettings(new ExtensionSettingsDefinition($this->settings(), [
            ExtensionSettingDefinition::make(PresetState::ALLOW_USER_CHOICE, PresetState::ALLOW_USER_CHOICE, false, ['boolean'])
                ->field('toggle')
                ->label('Let people pick their own preset')
                ->help('Adds a preset picker to the account menu. Presets, the default and schedules are under Admin > Theme Studio.')
                ->frontend()
                ->frontendType('boolean'),
        ]));
    }
}
