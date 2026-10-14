<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** The built-in presets, as in resources/presets.json, in the order the admin page lists them. */
    private const array BUILTINS = [
        'graphite' => 'Graphite', 'oled' => 'OLED black', 'midnight' => 'Midnight', 'slate' => 'Slate', 'forest' => 'Forest',
        'ocean' => 'Ocean', 'crimson' => 'Crimson', 'rustix' => 'Rustix', 'halloween' => 'Halloween', 'christmas' => 'Christmas',
    ];

    public function up(): void
    {
        Schema::create('ext_themes_presets', function (Blueprint $table) {
            $table->id();
            // Built-in presets only; their colours live in the package and `colors` holds overrides.
            $table->string('slug', 32)->nullable()->unique();
            $table->string('name', 40);
            $table->boolean('builtin')->default(false);
            $table->json('colors');
            $table->string('effect', 16)->default('none');
            $table->timestamps();
        });

        Schema::create('ext_themes_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('preset_id')->constrained('ext_themes_presets')->cascadeOnDelete();
            $table->string('label', 60)->nullable();
            // No years: every year. Both years: once.
            $table->unsignedSmallInteger('start_year')->nullable();
            $table->unsignedTinyInteger('start_month');
            $table->unsignedTinyInteger('start_day');
            $table->unsignedSmallInteger('end_year')->nullable();
            $table->unsignedTinyInteger('end_month');
            $table->unsignedTinyInteger('end_day');
            // HH:MM; empty is the start of the first day and the end of the last.
            $table->string('start_time', 5)->nullable();
            $table->string('end_time', 5)->nullable();
            // Empty is the panel's timezone.
            $table->string('timezone', 64)->nullable();
            $table->smallInteger('priority')->default(0);
            $table->boolean('enabled')->default(true);
            $table->timestamps();
        });

        $now = now();
        $ids = [];
        foreach (self::BUILTINS as $slug => $name) {
            $ids[$slug] = DB::table('ext_themes_presets')->insertGetId([
                'slug' => $slug,
                'name' => $name,
                'builtin' => true,
                'colors' => '{}',
                'effect' => in_array($slug, ['halloween', 'christmas'], true) ? ($slug === 'halloween' ? 'bats' : 'snow') : 'none',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // The seasons, every year, which the admin can turn off or change.
        DB::table('ext_themes_schedules')->insert([
            ['preset_id' => $ids['halloween'], 'label' => 'Halloween', 'start_month' => 10, 'start_day' => 15, 'end_month' => 10, 'end_day' => 31, 'priority' => 10, 'enabled' => true, 'created_at' => $now, 'updated_at' => $now],
            ['preset_id' => $ids['christmas'], 'label' => 'Christmas', 'start_month' => 12, 'start_day' => 1, 'end_month' => 12, 'end_day' => 26, 'priority' => 10, 'enabled' => true, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('ext_themes_schedules');
        Schema::dropIfExists('ext_themes_presets');
    }
};
