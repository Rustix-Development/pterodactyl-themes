<?php

namespace RustixDev\Themes\Support;

/** The presets that ship with the theme, from resources/presets.json (the editor reads the same file). */
final class Builtins
{
    /** @var array<string, array{name: string, effect: string, dark: array<string, string>, light: array<string, string>, effectColors?: array{dark: list<string>, light: list<string>}}>|null */
    private static ?array $presets = null;

    /** The preset the stylesheet itself falls back to, and the default until an admin picks one. */
    public const string FALLBACK = 'graphite';

    /** @return array<string, array{name: string, effect: string, dark: array<string, string>, light: array<string, string>, effectColors?: array{dark: list<string>, light: list<string>}}> */
    public static function all(): array
    {
        return self::$presets ??= json_decode((string) file_get_contents(dirname(__DIR__, 2).'/resources/presets.json'), true, flags: JSON_THROW_ON_ERROR);
    }

    /** @return array{name: string, effect: string, dark: array<string, string>, light: array<string, string>, effectColors?: array{dark: list<string>, light: list<string>}}|null */
    public static function get(string $slug): ?array
    {
        return self::all()[$slug] ?? null;
    }
}
