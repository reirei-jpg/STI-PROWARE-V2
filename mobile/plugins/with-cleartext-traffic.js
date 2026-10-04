const { withAndroidManifest } = require('expo/config-plugins');

/*
 * Installed Android apps refuse plain http:// by default. During development
 * the server is the laptop on the home Wi-Fi (http://192.168.x.x:8001), so this
 * allows it. Remove this plugin once the server is online with https.
 */
module.exports = function withCleartextTraffic(config) {
    return withAndroidManifest(config, (modConfig) => {
        const application = modConfig.modResults.manifest.application?.[0];

        if (application) {
            application.$['android:usesCleartextTraffic'] = 'true';
        }

        return modConfig;
    });
};
