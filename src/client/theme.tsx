import { lazy } from 'react';
import { defineTheme } from '@pterodactyl/sdk/theme';
import { AppLayout, AuthLayout } from './views/Layouts';

const PresetPicker = lazy(() => import('./account/PresetPicker'));

/**
 * Colours, fonts and shapes are all in theme.css, and the active preset's colours come from the
 * server before the first paint. The layouts only add the preset's effect, so every view, slot
 * and extension renders as it does under classic.
 */
export default defineTheme({
    views: {
        'layout.app': AppLayout,
        'layout.auth': AuthLayout,
    },
    setup({ screens, slots, config }) {
        screens.register('admin', () => import('./admin/AdminScreen'));
        if (config.allow_user_choice === true) {
            slots.register('account.overview.after', PresetPicker);
        }
    },
});
