<?php

namespace App\Services;

use App\Enums\PushResult;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Sends push notifications through Firebase Cloud Messaging (HTTP v1).
 *
 * Firebase wants a short-lived access token, which is obtained by signing a
 * request with the service account's private key. That is a few lines of
 * OpenSSL, so no extra package is needed. The private key and the phones'
 * tokens are never written to the log.
 */
class FcmClient
{
    private const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

    private const TOKEN_CACHE_KEY = 'fcm.access_token';

    /**
     * True when the service-account file is present and readable.
     */
    public function isConfigured(): bool
    {
        return $this->credentials() !== null;
    }

    /**
     * Send one notification to one phone.
     *
     * @param  array<string, scalar|null>  $data  Extra values the app receives with the notification.
     */
    public function send(string $deviceToken, string $title, string $body, array $data = []): PushResult
    {
        $credentials = $this->credentials();

        if ($credentials === null) {
            return PushResult::Failed;
        }

        try {
            $accessToken = $this->accessToken($credentials);

            $message = [
                'token' => $deviceToken,
                'notification' => ['title' => $title, 'body' => $body],
                'android' => [
                    'priority' => 'HIGH',
                    'notification' => ['channel_id' => config('services.fcm.channel_id')],
                ],
            ];

            // Firebase wants "data" to be a map of strings, and rejects an
            // empty list, so leave it out when there is nothing to send.
            $data = array_map(
                fn ($value): string => (string) $value,
                array_filter($data, fn ($value): bool => $value !== null),
            );

            if ($data !== []) {
                $message['data'] = $data;
            }

            $response = $this->http()
                ->withToken($accessToken)
                ->post(
                    "https://fcm.googleapis.com/v1/projects/{$credentials['project_id']}/messages:send",
                    ['message' => $message],
                );
        } catch (Throwable $exception) {
            Log::warning('Push notification could not be sent.', ['reason' => $exception->getMessage()]);

            return PushResult::Failed;
        }

        return $this->resultFrom($response);
    }

    private function resultFrom(Response $response): PushResult
    {
        if ($response->successful()) {
            return PushResult::Sent;
        }

        $status = $response->json('error.status');
        $message = (string) $response->json('error.message');
        $details = $response->json('error.details');
        $errorCodes = is_array($details) ? array_column($details, 'errorCode') : [];

        if (
            $response->status() === 404
            || in_array('UNREGISTERED', $errorCodes, true)
            || ($status === 'INVALID_ARGUMENT' && str_contains($message, 'registration token'))
        ) {
            return PushResult::InvalidToken;
        }

        if ($response->status() === 401) {
            // The cached access token was refused: get a fresh one next time.
            Cache::forget(self::TOKEN_CACHE_KEY);
        }

        Log::warning('Push notification was refused by Firebase.', [
            'http_status' => $response->status(),
            'status' => $status,
        ]);

        return PushResult::Failed;
    }

    /**
     * @param  array<string, string>  $credentials
     */
    private function accessToken(array $credentials): string
    {
        return Cache::remember(self::TOKEN_CACHE_KEY, now()->addMinutes(50), function () use ($credentials): string {
            $issuedAt = time();

            $assertion = $this->signedJwt([
                'iss' => $credentials['client_email'],
                'scope' => self::SCOPE,
                'aud' => $credentials['token_uri'],
                'iat' => $issuedAt,
                'exp' => $issuedAt + 3600,
            ], $credentials['private_key']);

            $response = $this->http()->asForm()->post($credentials['token_uri'], [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $assertion,
            ]);

            $accessToken = $response->json('access_token');

            if (! $response->successful() || ! is_string($accessToken)) {
                throw new \RuntimeException('Firebase did not give an access token (HTTP '.$response->status().').');
            }

            return $accessToken;
        });
    }

    /**
     * @param  array<string, mixed>  $claims
     */
    private function signedJwt(array $claims, string $privateKey): string
    {
        $encode = fn (string $value): string => rtrim(strtr(base64_encode($value), '+/', '-_'), '=');

        $unsigned = $encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT'], JSON_THROW_ON_ERROR))
            .'.'
            .$encode(json_encode($claims, JSON_THROW_ON_ERROR));

        if (! openssl_sign($unsigned, $signature, $privateKey, OPENSSL_ALGO_SHA256)) {
            throw new \RuntimeException('The Firebase private key could not be used to sign.');
        }

        return $unsigned.'.'.$encode($signature);
    }

    private function http(): PendingRequest
    {
        $bundle = config('services.fcm.ca_bundle');

        return Http::timeout(10)->when(
            filled($bundle),
            fn (PendingRequest $request) => $request->withOptions(['verify' => $bundle]),
        );
    }

    /**
     * @return array{project_id: string, client_email: string, private_key: string, token_uri: string}|null
     */
    private function credentials(): ?array
    {
        $path = config('services.fcm.credentials');

        if (! is_string($path) || ! is_readable($path)) {
            return null;
        }

        $decoded = json_decode((string) file_get_contents($path), true);

        foreach (['project_id', 'client_email', 'private_key', 'token_uri'] as $key) {
            if (! is_array($decoded) || ! filled($decoded[$key] ?? null)) {
                return null;
            }
        }

        return [
            'project_id' => $decoded['project_id'],
            'client_email' => $decoded['client_email'],
            'private_key' => $decoded['private_key'],
            'token_uri' => $decoded['token_uri'],
        ];
    }
}
