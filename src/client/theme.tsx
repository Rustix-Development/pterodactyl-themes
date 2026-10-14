import { defineTheme } from '@pterodactyl/sdk/theme';
import { AppLayout, AuthLayout } from './views/Layouts';

/**
 * Colours, fonts and shapes are all in theme.css. The layouts only add the preset's effect, so
 * every view, slot and extension renders as it does under classic.
 */
export default defineTheme({
    views: {
        'layout.app': AppLayout,
        'layout.auth': AuthLayout,
    },
});
