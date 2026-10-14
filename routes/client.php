<?php

use Illuminate\Support\Facades\Route;
use RustixDev\Themes\Http\Controllers\PreferenceController;

// The account menu's preset picker, when an admin allows it: /api/client/extensions/themes/...
Route::get('/presets', [PreferenceController::class, 'index']);
Route::put('/preset', [PreferenceController::class, 'update']);
