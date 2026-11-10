<?php

use App\Console\Commands\ServeCommand;

test('the server turns on the zip extension when this PHP has it but does not load it', function () {
    $file = tempnam(sys_get_temp_dir(), 'php_zip');

    expect(ServeCommand::zipSettings(zipLoaded: false, zipExtensionFile: $file))->toBe(['-d', 'extension=zip']);

    unlink($file);
});

test('the server adds nothing when zip is already loaded or its file is missing', function () {
    $file = tempnam(sys_get_temp_dir(), 'php_zip');

    expect(ServeCommand::zipSettings(zipLoaded: true, zipExtensionFile: $file))->toBe([])
        ->and(ServeCommand::zipSettings(zipLoaded: false, zipExtensionFile: sys_get_temp_dir().'/no-such-php_zip.dll'))->toBe([])
        ->and(ServeCommand::zipSettings(zipLoaded: false, zipExtensionFile: null))->toBe([]);

    unlink($file);
});
