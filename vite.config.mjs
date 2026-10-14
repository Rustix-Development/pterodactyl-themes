import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { defineThemeConfig } from '@pterodactyl/sdk/vite';

/**
 * The active preset's colours are served by the panel at /extensions/themes/preset.css. Tailwind
 * would try to read that path from disk, so the @import is added to the built stylesheet instead,
 * where CSS requires it: before every other rule.
 */
const PRESET_IMPORT = "@import url('/extensions/themes/preset.css');\n";

function presetImport() {
    return {
        name: 'themes-preset-import',
        enforce: 'post',
        closeBundle() {
            const file = 'dist/theme.css';
            if (!existsSync(file)) return;
            const css = readFileSync(file, 'utf8');
            if (!css.startsWith(PRESET_IMPORT)) writeFileSync(file, PRESET_IMPORT + css);
        },
    };
}

const config = defineThemeConfig({ entry: 'src/client/theme.tsx', stylesheet: 'src/client/theme.css' });

export default { ...config, plugins: [...(config.plugins ?? []), presetImport()] };
