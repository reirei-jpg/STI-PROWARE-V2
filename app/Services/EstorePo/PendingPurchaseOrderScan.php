<?php

namespace App\Services\EstorePo;

use Illuminate\Contracts\Session\Session;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Keeps the file the Specialist just scanned (privately, on the server) until
 * they save or discard it. Saving scans this stored file again, so what gets
 * saved is exactly what was read from the document.
 *
 * Each user has at most one pending scan; scanning a new file replaces it.
 */
class PendingPurchaseOrderScan
{
    private const SESSION_KEY = 'purchase_order_scan';

    private const FOLDER = 'purchase-orders/pending';

    /** Shown in place of a file name when the order was pasted. */
    public const PASTED_EMAIL = 'Pasted email';

    public function put(Session $session, UploadedFile $file): void
    {
        $this->discard($session);

        $session->put(self::SESSION_KEY, [
            'path' => $file->store(self::FOLDER, 'local'),
            'file_name' => $file->getClientOriginalName(),
        ]);
    }

    /**
     * Keep pasted email text the same way as an uploaded file.
     */
    public function putText(Session $session, string $text): void
    {
        $this->discard($session);

        $path = self::FOLDER.'/'.Str::uuid()->toString().'.txt';
        Storage::disk('local')->put($path, $text);

        $session->put(self::SESSION_KEY, [
            'path' => $path,
            'file_name' => self::PASTED_EMAIL,
        ]);
    }

    /**
     * @return array{path: string, file_name: string}|null
     */
    public function get(Session $session): ?array
    {
        $pending = $session->get(self::SESSION_KEY);
        $path = is_array($pending) ? ($pending['path'] ?? null) : null;
        $fileName = is_array($pending) ? ($pending['file_name'] ?? null) : null;

        if (! is_string($path) || ! is_string($fileName) || ! Storage::disk('local')->exists($path)) {
            $session->forget(self::SESSION_KEY);

            return null;
        }

        return ['path' => $path, 'file_name' => $fileName];
    }

    public function absolutePath(string $path): string
    {
        return Storage::disk('local')->path($path);
    }

    /**
     * Move the pending file into permanent storage and clear the pending scan.
     *
     * @param  array{path: string, file_name: string}  $pending
     */
    public function keep(Session $session, array $pending, string $destination): void
    {
        Storage::disk('local')->move($pending['path'], $destination);

        $session->forget(self::SESSION_KEY);
    }

    public function discard(Session $session): void
    {
        $pending = $session->pull(self::SESSION_KEY);

        if (is_array($pending)) {
            Storage::disk('local')->delete($pending['path']);
        }
    }
}
