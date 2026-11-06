<?php

namespace App\Console\Commands;

use Illuminate\Foundation\Console\ServeCommand as FrameworkServeCommand;

/**
 * "php artisan serve", allowing the product photos PROWARE accepts: up to 6
 * photos of 10 MB each. It sets this only for this server, so the computer's
 * php.ini stays as it is.
 */
class ServeCommand extends FrameworkServeCommand
{
    /**
     * @return array<int, string>
     */
    protected function serverCommand(): array
    {
        $command = parent::serverCommand();

        array_splice($command, 1, 0, ['-d', 'upload_max_filesize=10M', '-d', 'post_max_size=70M']);

        return $command;
    }
}
