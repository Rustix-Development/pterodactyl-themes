<?php

namespace RustixDev\Themes\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A preset. Built-in rows (slug set, builtin true) keep their colours in resources/presets.json
 * and store only the admin's overrides in `colors`; custom rows store every colour.
 *
 * @property int $id
 * @property string|null $slug
 * @property string $name
 * @property bool $builtin
 * @property array{dark?: array<string, string|null>, light?: array<string, string|null>} $colors
 * @property string $effect
 */
class Preset extends Model
{
    protected $table = 'ext_themes_presets';

    protected $guarded = ['id'];

    protected $casts = ['builtin' => 'boolean', 'colors' => 'array'];

    public function schedules(): HasMany
    {
        return $this->hasMany(Schedule::class, 'preset_id');
    }
}
