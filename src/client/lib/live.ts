import { notifyThemeChange } from '@pterodactyl/sdk/theme';

export const PRESET_URL = '/extensions/themes/preset.css';
export const PRESET_EVENT = 'ts:preset';

/** The stylesheet theme.css imports the preset from, when the browser exposes it. */
function importedSheet(): CSSStyleSheet | null {
    for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
            rules = sheet.cssRules;
        } catch {
            continue;
        }
        for (const rule of Array.from(rules)) {
            if (rule instanceof CSSImportRule && rule.href.includes(PRESET_URL) && rule.styleSheet) return rule.styleSheet;
        }
    }
    return null;
}

/** The rules of the server's preset stylesheet: one per line, after a comment. */
export function presetRules(css: string): string[] {
    return css
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith(':root'));
}

/**
 * Loads the preset that is on now and swaps it into the page without a reload, after an admin
 * saves or someone picks their own. The effect and anything reading the colours follow.
 */
export async function refreshPreset(): Promise<void> {
    const response = await fetch(PRESET_URL, { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) return;
    const rules = presetRules(await response.text());

    const sheet = importedSheet();
    if (sheet) {
        while (sheet.cssRules.length) sheet.deleteRule(0);
        rules.forEach((rule, index) => sheet.insertRule(rule, index));
    } else {
        let style = document.getElementById('ts-preset-live');
        if (!style) {
            style = document.createElement('style');
            style.id = 'ts-preset-live';
            document.head.appendChild(style);
        }
        style.textContent = rules.join('\n');
    }

    window.dispatchEvent(new Event(PRESET_EVENT));
    notifyThemeChange();
}
