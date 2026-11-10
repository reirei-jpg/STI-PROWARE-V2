<?php

namespace App\Console\Commands;

use Illuminate\Foundation\Console\ServeCommand as FrameworkServeCommand;

/**
 * "php artisan serve", allowing the product photos PROWARE accepts: up to 6
 * photos of 10 MB each, and turning on PHP's zip extension when this PHP has
 * it but does not load it (a Word .docx eStore order is a zip file). It sets
 * this only for this server, so the computer's php.ini stays as it is.
 */
class ServeCommand extends FrameworkServeCommand
{
    /**
     * @return array<int, string>
     */
    protected function serverCommand(): array
    {
        $command = parent::serverCommand();

        $settings = ['-d', 'upload_max_filesize=10M', '-d', 'post_max_size=70M'];

        array_splice($command, 1, 0, [...$settings, ...self::zipSettings(extension_loaded('zip'), self::zipExtensionFile())]);

        return $command;
    }

    /**
     * The setting that turns on the zip extension: only when it is not loaded
     * yet (loading it twice gives a warning) and its file is there (a missing
     * file would stop the server from starting).
     *
     * @return list<string>
     */
    public static function zipSettings(bool $zipLoaded, ?string $zipExtensionFile): array
    {
        if ($zipLoaded || $zipExtensionFile === null || ! is_file($zipExtensionFile)) {
            return [];
        }

        return ['-d', 'extension=zip'];
    }

    /**
     * Where this PHP keeps its zip extension file (php_zip.dll on Windows,
     * zip.so elsewhere), or null when the extension folder is not known.
     */
    private static function zipExtensionFile(): ?string
    {
        $folder = (string) ini_get('extension_dir');

        if ($folder === '') {
            return null;
        }

        // A relative folder (such as "ext") is next to the PHP program.
        if (! preg_match('/^([A-Za-z]:)?[\\\\\/]/', $folder)) {
            $folder = dirname(PHP_BINARY).DIRECTORY_SEPARATOR.$folder;
        }

        return $folder.DIRECTORY_SEPARATOR.(PHP_OS_FAMILY === 'Windows' ? 'php_zip.dll' : 'zip.so');
    }
}
