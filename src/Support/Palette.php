<?php

namespace RustixDev\Themes\Support;

/**
 * Turns a preset's colours into the stylesheet the panel imports before its own colours apply.
 * seeds() matches seeds() in src/client/lib/palette.ts; tests/fixtures/seeds.json holds what
 * the editor computes, and the PHP tests check that this class writes the same.
 */
final class Palette
{
    public const array SCHEMES = ['dark', 'light'];

    /** The colours of one scheme; the first four are required. */
    public const array FIELDS = ['background', 'surface', 'text', 'primary', 'secondary', 'success', 'warning', 'danger'];

    public const array REQUIRED = ['background', 'surface', 'text', 'primary'];

    /** The colours a built-in preset lets an admin change ("light customisation"). */
    public const array BUILTIN_FIELDS = ['primary', 'secondary'];

    public const array EFFECTS = ['none', 'snow', 'bats', 'leaves', 'confetti'];

    /** Used when a preset sets no status colour of its own (the stylesheet has the same). */
    public const array STATUS = [
        'dark' => ['success' => '#4ade80', 'warning' => '#facc15'],
        'light' => ['success' => '#166534', 'warning' => '#854d0e'],
    ];

    /**
     * @param  array<string, string|null>  $colors  one scheme
     * @return array<string, string|null>
     */
    public static function seeds(array $colors, string $scheme): array
    {
        $dark = $scheme === 'dark';
        // Links and danger text must read on the page, on cards and in menus (popover share as in the editor).
        $pages = [$colors['background'], $colors['surface'], Color::mix($dark ? $colors['surface'] : $colors['background'], $colors['text'], 0.93)];
        $link = ($colors['secondary'] ?? null) ?: Color::readable($colors['primary'], $pages, $dark);
        $success = ($colors['success'] ?? null) ?: null;
        $warning = ($colors['warning'] ?? null) ?: null;
        $danger = ($colors['danger'] ?? null) ?: null;

        return [
            'bg' => $colors['background'],
            'surface' => $colors['surface'],
            'text' => $colors['text'],
            'primary' => $colors['primary'],
            'primaryFg' => Color::on($colors['primary']),
            'link' => $link,
            'linkFg' => Color::on($link),
            'success' => $success,
            'successFg' => $success ? Color::on($success) : null,
            'warning' => $warning,
            'warningFg' => $warning ? Color::on($warning) : null,
            'destructive' => $danger,
            'destructiveFg' => $danger ? Color::on($danger) : null,
            'danger' => $danger ? Color::readable($danger, $pages, $dark) : null,
        ];
    }

    /**
     * The colours an effect draws with in one scheme.
     *
     * @param  array<string, string|null>  $colors
     * @param  list<string>|null  $own  colours a built-in preset sets for its effect
     * @return list<string>
     */
    public static function effectColors(string $effect, array $colors, string $scheme, ?array $own = null): array
    {
        if ($own) {
            return $own;
        }
        $dark = $scheme === 'dark';
        $seeds = self::seeds($colors, $scheme);

        return match ($effect) {
            'snow' => [$dark ? '#ffffff' : '#9fb3c8'],
            'bats' => [Color::mix($seeds['text'], $seeds['bg'], $dark ? 0.4 : 0.85)],
            'leaves' => $dark ? ['#f97316', '#f59e0b', '#dc2626', '#ca8a04'] : ['#c2410c', '#b45309', '#991b1b', '#a16207'],
            'confetti' => [$seeds['primary'], $seeds['link'], $seeds['success'] ?? self::STATUS[$scheme]['success'], $seeds['warning'] ?? self::STATUS[$scheme]['warning'], $dark ? '#f472b6' : '#be185d'],
            default => [],
        };
    }

    /**
     * The preset's stylesheet: its seeds for each scheme on :root:root, which outranks the
     * stylesheet's own default seeds, and its effect.
     *
     * @param  array{effect: string, colors: array{dark: array<string, string|null>, light: array<string, string|null>}, effectColors?: array{dark: list<string>, light: list<string>}|null}  $preset
     */
    public static function css(array $preset): string
    {
        $effect = in_array($preset['effect'], self::EFFECTS, true) ? $preset['effect'] : 'none';
        $css = ":root:root{--ts-effect-kind:{$effect};}\n";
        foreach (self::SCHEMES as $scheme) {
            $s = self::seeds($preset['colors'][$scheme], $scheme);
            $lines = [
                '--ts-bg' => $s['bg'],
                '--ts-surface' => $s['surface'],
                '--ts-text' => $s['text'],
                '--ts-primary' => $s['primary'],
                '--ts-primary-fg' => $s['primaryFg'],
                '--ts-link' => $s['link'],
                '--ts-link-fg' => $s['linkFg'],
                '--ts-success' => $s['success'],
                '--ts-success-fg' => $s['successFg'],
                '--ts-warning' => $s['warning'],
                '--ts-warning-fg' => $s['warningFg'],
                '--ts-destructive' => $s['destructive'],
                '--ts-destructive-fg' => $s['destructiveFg'],
                '--ts-danger' => $s['danger'],
            ];
            $colors = self::effectColors($effect, $preset['colors'][$scheme], $scheme, $preset['effectColors'][$scheme] ?? null);
            if ($colors !== []) {
                $lines['--ts-effect'] = implode(' ', $colors);
            }
            $declarations = '';
            foreach ($lines as $property => $value) {
                // Every value is a colour this class or Color::normalize() produced, so it is safe in a rule.
                if ($value !== null && preg_match('/^#[0-9a-f]{6}( #[0-9a-f]{6})*$/', $value)) {
                    $declarations .= "{$property}:{$value};";
                }
            }
            $css .= ":root:root.{$scheme}{{$declarations}}\n";
        }

        return $css;
    }
}
