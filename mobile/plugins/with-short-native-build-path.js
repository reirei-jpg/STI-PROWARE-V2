const { withAppBuildGradle } = require('expo/config-plugins');

/*
 * Windows cannot open paths longer than 260 characters, and the native build
 * of a release APK makes some very long ones inside this project (the
 * generated file names repeat the whole path of each library). Setting the
 * PROWARE_NATIVE_BUILD_DIR environment variable to a short folder such as
 * C:/cx when running `expo prebuild` moves the native build's temporary files
 * there. Without the variable this plugin does nothing.
 */
module.exports = function withShortNativeBuildPath(config) {
    const directory = process.env.PROWARE_NATIVE_BUILD_DIR;

    if (!directory) {
        return config;
    }

    // Gradle wants forward slashes.
    const gradlePath = directory.split(String.fromCharCode(92)).join('/');

    return withAppBuildGradle(config, (modConfig) => {
        const marker = 'buildStagingDirectory';

        if (!modConfig.modResults.contents.includes(marker)) {
            modConfig.modResults.contents = modConfig.modResults.contents.replace(
                'android {',
                [
                    'android {',
                    '    externalNativeBuild {',
                    '        cmake {',
                    `            ${marker} file("${gradlePath}")`,
                    '        }',
                    '    }',
                ].join('\n'),
            );
        }

        return modConfig;
    });
};
