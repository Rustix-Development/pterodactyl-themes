<?php

namespace RustixDev\Themes\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A rule that turns a preset on for a stretch of dates: every year (no years set) or once.
 *
 * @property int $id
 * @property int $preset_id
 * @property string|null $label
 * @property int|null $start_year
 * @property int $start_month
 * @property int $start_day
 * @property int|null $end_year
 * @property int $end_month
 * @property int $end_day
 * @property string|null $start_time
 * @property string|null $end_time
 * @property string|null $timezone
 * @property int $priority
 * @property bool $enabled
 */
class Schedule extends Model
{
    protected $table = 'ext_themes_schedules';

    protected $guarded = ['id'];

    protected $casts = [
        'preset_id' => 'integer',
        'start_year' => 'integer',
        'start_month' => 'integer',
        'start_day' => 'integer',
        'end_year' => 'integer',
        'end_month' => 'integer',
        'end_day' => 'integer',
        'priority' => 'integer',
        'enabled' => 'boolean',
    ];

    public function preset(): BelongsTo
    {
        return $this->belongsTo(Preset::class, 'preset_id');
    }
}
