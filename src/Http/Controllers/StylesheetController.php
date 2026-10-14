<?php

namespace RustixDev\Themes\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use RustixDev\Themes\Services\PresetState;

/**
 * The colours of the preset that is on now, for whoever asks. The theme's stylesheet imports
 * it first, so the page paints in these colours from the start. Browsers revalidate it on every
 * load (cheap: an ETag), so a schedule switching over shows on the next page load.
 */
class StylesheetController
{
    public function __invoke(Request $request, PresetState $state): Response
    {
        $active = $state->active($request->user());
        $css = "/* Theme Studio: {$this->comment($active['preset']['name'])} ({$active['source']}) */\n".$active['preset']['css'];
        $etag = '"'.hash('xxh128', $css).'"';

        $headers = [
            'Content-Type' => 'text/css; charset=utf-8',
            'Cache-Control' => 'private, no-cache',
            'ETag' => $etag,
            'X-Content-Type-Options' => 'nosniff',
        ];
        if (in_array($etag, array_map('trim', explode(',', (string) $request->header('If-None-Match'))), true)) {
            return new Response('', 304, $headers);
        }

        return new Response($css, 200, $headers);
    }

    /** A preset name that cannot end the comment it sits in. */
    private function comment(string $name): string
    {
        return str_replace(['*/', "\n", "\r"], ['* /', ' ', ' '], $name);
    }
}
