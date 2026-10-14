<?php

use Illuminate\Support\Facades\Route;
use RustixDev\Themes\Http\Controllers\AdminController;

// Admin > Theme Studio: /api/admin/extensions/themes/...
Route::get('/overview', [AdminController::class, 'index']);
Route::post('/presets', [AdminController::class, 'store']);
Route::put('/presets/{preset}', [AdminController::class, 'update'])->whereNumber('preset');
Route::post('/presets/{preset}/reset', [AdminController::class, 'reset'])->whereNumber('preset');
Route::post('/presets/{preset}/duplicate', [AdminController::class, 'duplicate'])->whereNumber('preset');
Route::delete('/presets/{preset}', [AdminController::class, 'destroy'])->whereNumber('preset');
Route::put('/default', [AdminController::class, 'setDefault']);
Route::put('/options', [AdminController::class, 'options']);
Route::post('/schedules', [AdminController::class, 'storeSchedule']);
Route::put('/schedules/{schedule}', [AdminController::class, 'updateSchedule'])->whereNumber('schedule');
Route::delete('/schedules/{schedule}', [AdminController::class, 'destroySchedule'])->whereNumber('schedule');
