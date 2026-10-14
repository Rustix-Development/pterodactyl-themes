import type { ViewProps } from '@pterodactyl/sdk/theme';
import Effects from '../effects/Effects';

/** Classic's app layout, with the preset's effect over it. */
export function AppLayout({ Default }: ViewProps<'layout.app'>) {
    return (
        <>
            <Default />
            <Effects />
        </>
    );
}

/** Classic's sign-in layout, with the preset's effect over it. */
export function AuthLayout({ Default }: ViewProps<'layout.auth'>) {
    return (
        <>
            <Default />
            <Effects />
        </>
    );
}
