<?php

use Illuminate\Support\Facades\Route;
use RustixDev\Themes\Http\Controllers\StylesheetController;

// The active preset's colours, imported by the theme's stylesheet: /extensions/themes/preset.css
Route::get('/preset.css', StylesheetController::class);
