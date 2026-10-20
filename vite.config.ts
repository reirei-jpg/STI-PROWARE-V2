import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import { networkInterfaces } from 'node:os';
import { defineConfig, lazyPlugins } from 'vite-plus';

/**
 * The laptop's Wi-Fi (or cable) address, e.g. 192.168.8.50, or undefined
 * when it is offline. Pages then load their design from it, so the site
 * also looks right when opened by that address from the laptop, a phone or
 * another computer on the same Wi-Fi.
 */
function networkAddress(): string | undefined {
    const candidates = Object.entries(networkInterfaces())
        .filter(
            ([name]) => !/vethernet|virtual|vmware|wsl|loopback/i.test(name),
        )
        .sort(
            ([a], [b]) =>
                Number(/wi-?fi|wlan/i.test(b)) - Number(/wi-?fi|wlan/i.test(a)),
        )
        .flatMap(([, addresses]) => addresses ?? []);

    return candidates.find(
        (address) => address.family === 'IPv4' && !address.internal,
    )?.address;
}

const lanAddress = networkAddress();

export default defineConfig({
    plugins: lazyPlugins(() => [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
            fonts: [
                bunny('Instrument Sans', {
                    weights: [400, 500, 600],
                }),
            ],
        }),
        inertia(),
        react(),
        babel({
            presets: [reactCompilerPreset()],
        }),
        tailwindcss(),
        wayfinder({
            formVariants: true,
        }),
    ]),
    server: {
        // Reachable on the Wi-Fi, not only as localhost, and for pages
        // opened by any address (only while developing).
        host: '0.0.0.0',
        cors: true,
        hmr: lanAddress ? { host: lanAddress } : undefined,
        watch: {
            ignored: [
                '**/.agents/**',
                '**/.claude/**',
                '**/.cursor/**',
                '**/.junie/**',
                '**/vendor/**',
                '**/mobile/**',
            ],
        },
    },
    lint: {
        ignorePatterns: [
            'vendor/**',
            'node_modules/**',
            'mobile/**',
            'public/**',
            'bootstrap/ssr/**',
            'tailwind.config.js',
            'resources/js/actions/**',
            'resources/js/components/ui/*',
            'resources/js/routes/**',
            'resources/js/wayfinder/**',
        ],
        options: {
            denyWarnings: true,
            typeAware: true,
        },
    },
    fmt: {
        printWidth: 80,
        tabWidth: 4,
        singleQuote: true,
        semi: true,
        singleAttributePerLine: false,
        htmlWhitespaceSensitivity: 'css',
        ignorePatterns: [
            '.github/**',
            'composer.json',
            'mobile/**',
            'resources/js/components/ui/*',
            'resources/views/mail/*',
        ],
        sortTailwindcss: {
            functions: ['clsx', 'cn', 'cva'],
            stylesheet: 'resources/css/app.css',
        },
    },
});
