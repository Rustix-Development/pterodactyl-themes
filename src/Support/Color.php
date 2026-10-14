<?php

namespace RustixDev\Themes\Support;

/**
 * Colour maths for the preset stylesheet, the same as src/client/lib/color.ts so the server
 * writes what the editor previews. Colours are #rrggbb; mixes are in OKLab and contrast is WCAG 2's.
 */
final class Color
{
    public const string WHITE = '#ffffff';

    public const string INK = '#14110f';

    /** `#abc`, `#AABBCC` or ` #aabbcc ` as `#aabbcc`; null for anything else. */
    public static function normalize(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }
        $hex = strtolower(trim($value));
        if (preg_match('/^#[0-9a-f]{3}$/', $hex)) {
            $hex = '#'.$hex[1].$hex[1].$hex[2].$hex[2].$hex[3].$hex[3];
        }

        return preg_match('/^#[0-9a-f]{6}$/', $hex) ? $hex : null;
    }

    /** @return array{float, float, float} */
    public static function rgb(string $hex): array
    {
        $n = hexdec(substr($hex, 1));

        return [(($n >> 16) & 255) / 255, (($n >> 8) & 255) / 255, ($n & 255) / 255];
    }

    /** @param array<int, float> $rgb */
    public static function hex(array $rgb): string
    {
        return '#'.implode('', array_map(fn (float $v): string => str_pad(dechex((int) round(self::clamp($v) * 255)), 2, '0', STR_PAD_LEFT), $rgb));
    }

    /** @return array{float, float, float} */
    public static function oklab(string $hex): array
    {
        [$r, $g, $b] = array_map(self::linear(...), self::rgb($hex));
        $l = self::cbrt(0.4122214708 * $r + 0.5363325363 * $g + 0.0514459929 * $b);
        $m = self::cbrt(0.2119034982 * $r + 0.6806995451 * $g + 0.1073969566 * $b);
        $s = self::cbrt(0.0883024619 * $r + 0.2817188376 * $g + 0.6299787005 * $b);

        return [
            0.2104542553 * $l + 0.793617785 * $m - 0.0040720468 * $s,
            1.9779984951 * $l - 2.428592205 * $m + 0.4505937099 * $s,
            0.0259040371 * $l + 0.7827717662 * $m - 0.808675766 * $s,
        ];
    }

    /** @param array<int, float> $lab */
    public static function fromOklab(array $lab): string
    {
        [$L, $a, $b] = $lab;
        $l = ($L + 0.3963377774 * $a + 0.2158037573 * $b) ** 3;
        $m = ($L - 0.1055613458 * $a - 0.0638541728 * $b) ** 3;
        $s = ($L - 0.0894841775 * $a - 1.291485548 * $b) ** 3;

        return self::hex(array_map(fn (float $v): float => self::gamma(self::clamp($v)), [
            4.0767416621 * $l - 3.3077115913 * $m + 0.2309699292 * $s,
            -1.2684380046 * $l + 2.6097574011 * $m - 0.3413193965 * $s,
            -0.0041960863 * $l - 0.7034186147 * $m + 1.707614701 * $s,
        ]));
    }

    /** color-mix(in oklab, $a $p, $b): $p is the share of $a, 0 to 1. */
    public static function mix(string $a, string $b, float $p): string
    {
        $A = self::oklab($a);
        $B = self::oklab($b);

        return self::fromOklab([$A[0] * $p + $B[0] * (1 - $p), $A[1] * $p + $B[1] * (1 - $p), $A[2] * $p + $B[2] * (1 - $p)]);
    }

    public static function luminance(string $hex): float
    {
        [$r, $g, $b] = array_map(self::linear(...), self::rgb($hex));

        return 0.2126 * $r + 0.7152 * $g + 0.0722 * $b;
    }

    public static function contrast(string $a, string $b): float
    {
        $x = self::luminance($a);
        $y = self::luminance($b);

        return (max($x, $y) + 0.05) / (min($x, $y) + 0.05);
    }

    /** White or near-black text, whichever reads better on the colour. */
    public static function on(string $hex): string
    {
        return self::contrast($hex, self::WHITE) >= self::contrast($hex, self::INK) ? self::WHITE : self::INK;
    }

    /**
     * The colour, lighter or darker in steps of OKLab lightness, until it reads at $min on every
     * background. Unchanged when it already reads.
     *
     * @param  list<string>  $backgrounds
     */
    public static function readable(string $hex, array $backgrounds, bool $lighten, float $min = 4.5): string
    {
        $passes = function (string $c) use ($backgrounds, $min): bool {
            foreach ($backgrounds as $bg) {
                if (self::contrast($c, $bg) < $min) {
                    return false;
                }
            }

            return true;
        };
        if ($passes($hex)) {
            return $hex;
        }
        [$L, $a, $b] = self::oklab($hex);
        for ($step = 1; $step <= 100; $step++) {
            $next = $lighten ? min(1, $L + $step * 0.01) : max(0, $L - $step * 0.01);
            $candidate = self::fromOklab([$next, $a, $b]);
            if ($passes($candidate)) {
                return $candidate;
            }
        }

        return $lighten ? self::WHITE : '#000000';
    }

    private static function linear(float $c): float
    {
        return $c <= 0.04045 ? $c / 12.92 : (($c + 0.055) / 1.055) ** 2.4;
    }

    private static function gamma(float $c): float
    {
        return $c <= 0.0031308 ? 12.92 * $c : 1.055 * $c ** (1 / 2.4) - 0.055;
    }

    private static function clamp(float $v): float
    {
        return min(1.0, max(0.0, $v));
    }

    private static function cbrt(float $v): float
    {
        return $v < 0 ? -((-$v) ** (1 / 3)) : $v ** (1 / 3);
    }
}
