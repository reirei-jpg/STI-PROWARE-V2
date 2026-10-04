<?php

use App\Enums\PushResult;
use App\Models\DeviceToken;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Notifications\OrderCancelled;
use App\Notifications\OrderPlaced;
use App\Notifications\OrderReady;
use App\Notifications\PreorderArrived;
use App\Services\FcmClient;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/*
 * A throwaway RSA key used only by these tests to sign the request to
 * Firebase (copied from V1's tests). It belongs to no real account.
 */
const PUSH_TEST_PRIVATE_KEY = <<<'PEM'
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDa0vINZ3R1lng4
veltsiiDfVnugoBuO2fCc3z84C5fAId0OYX8M8qNtHZKQBCHvhgbWNwGRLfz4kcG
uQev45+CZ2VzN8oHZ20kPyp9dRAYOr8nQBk2ZqL7Y+B9fyM5dlYJWVswBIFkklxa
FzZs+CYW8PDQZRGrEA6wbxOj62NNXItdbUyBjC1LaMe67viEhlyduMPVvzwFP6vK
ppZVi9oNCDRuOI/frff+1Ddwz3HyLhNSntASN0nrrfCmCcsjGbAKstDtjLGMRaIt
fkfcaitluHeSmy+/y4/REESUgCShjiUrmS5UCy81p6IEPnctORqbjWOaPOYmiK3a
bzrRSB9HAgMBAAECggEAKLR6wFGRUVpXLL7vEC/G54bG1t5Bw7+bMonHI0cUeSmh
CNa2fM6pjCiYpIE8UfPjihrCewwHZ/+clLyQmIBwKJLRRViIZU4w+EAjyEihYNB0
xHlg90SqZrcSiGXBCKxhnsWXd9wusaWkNkIBJs4WT8gsE6fpXHfVM67F6YUc6MPJ
IKJ5+EX3+vhX9LJOiM4PxmUhpI8bwUWY9ooPjJaBdnjb8HNbC9M7Mcn+tTuNpEIB
o0lujLIKKTl6kjINDUtrC4DTsRXfssvhYnN8FgCHiLyWgnDC996lrtMb5I0Ef50h
7r2cJOFnk2Nr+PxnkpzLt6a4/SS9sdkA79m9CKLW4QKBgQD5Ogiwxu73Q9PrQdPn
NgB/eO4MVgxdoeXyj2EFOGCgKoS0bl9qosH1vr11DXxU9BuHPxSgLyNG21qqtThL
KS7ppazO8GZXqxNE98Q+LtWjRfHduy0UBSNIWIFEfMVw8JNAZ2pfmA35LO1v2veh
yK70ZaRMm+YOYOVMBwoqLPzKsQKBgQDgxWNrb7DMQimD8KXopm8BMIhGXLgsxQ1I
K2VbjXiLMZxKkjoLvcQ8cDxhGCnU6BKiI+WJXIuq943NTsa44GSwSMLpW9gHbFMZ
D5L33E+veIlSBiW8ocgPahg24vCAJXLkWVlaqXo1iNJme4BRPrvIwVXUqQErgQpd
wUeFjpAXdwKBgBgn18/KeD7fBBs5NiCiy0mPnwLzFB+/IVpxKyYmYLclZ9dVG0pq
nAIFirddpz9UqZZiNs2PxAuKFy+UgPBH/ZQHysgD5Od6XVPB7/NW9r3seZTUH3ph
RRot+dl5fmmD58HGRDkfs7sC78B3qKi1mr91WodSVOnv2kmUJRgRZC8BAoGAR9yz
6ZB/DP8GOOnCkXxMtyumFiDkvWOO2IkPUdMMPCxzVKAlsMVOLSiRFVXdYfWEp5Qk
eeM9wD5/dql9/XO4nWfV8Tfs/IqUksmY6mfkjixScwgGHqX2yX7ZGQs7ay0N65Xp
bIQMz3rcEengX5lX/lpZr7EM77TE9K6ryDaJOQcCgYEAp0sW/hgJxwRCM2A2BaFc
Yh0dCnS/UOp18HkD4V6gWFV65FzhxkW90AadPnVR93myzpQaz87l9GuX0UwOnOC0
/E/i7tCXgWWnXe5QjUmYsr9s+3AFIZaNvYYUqvGXTeInaR8VMJXvxYeMU4L2Ryev
A5FBwQ+4l4hnUPk47OlMOGw=
-----END PRIVATE KEY-----
PEM;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-04 10:00', 'Asia/Manila'));
});

/**
 * A phone signed in to the student: the plain Sanctum token the app sends.
 */
function pushPhone(User $student, string $name = 'Phone'): string
{
    return $student->createToken($name)->plainTextToken;
}

/**
 * Register a phone as the app does. The test client remembers the last
 * signed-in user, so it is forgotten first.
 */
function pushRegister($test, string $bearer, string $deviceToken = 'fcm-token-1', array $extra = [])
{
    app('auth')->forgetGuards();

    return $test->withToken($bearer)->putJson(route('api.v1.device-token.store'), ['token' => $deviceToken, ...$extra]);
}

/**
 * Point the Firebase client at a throwaway service-account file with a real
 * RSA key, so signing works exactly as with the real one.
 *
 * @return array{path: string, public_key: string}
 */
function pushFakeCredentials(): array
{
    $path = tempnam(sys_get_temp_dir(), 'fcm');
    file_put_contents($path, json_encode([
        'type' => 'service_account',
        'project_id' => 'test-project',
        'private_key' => PUSH_TEST_PRIVATE_KEY,
        'client_email' => 'push@test-project.iam.gserviceaccount.com',
        'token_uri' => 'https://oauth2.googleapis.com/token',
    ]));

    config(['services.fcm.credentials' => $path]);
    test()->beforeApplicationDestroyed(fn () => @unlink($path));

    return ['path' => $path, 'public_key' => openssl_pkey_get_details(openssl_pkey_get_private(PUSH_TEST_PRIVATE_KEY))['key']];
}

function pushFakeFirebase(): void
{
    Http::fake([
        'oauth2.googleapis.com/*' => Http::response(['access_token' => 'ya29.test-access', 'expires_in' => 3599]),
        'fcm.googleapis.com/*' => Http::response(['name' => 'projects/test-project/messages/1']),
    ]);
}

/**
 * @return list<array<string, mixed>> the FCM messages sent, in order
 */
function pushMessagesSent(): array
{
    return collect(Http::recorded())
        ->map(fn (array $pair) => $pair[0])
        ->filter(fn (Request $request) => str_contains($request->url(), 'fcm.googleapis.com'))
        ->map(fn (Request $request) => $request['message'])
        ->values()
        ->all();
}

test('registering a phone needs a signed-in student', function () {
    $this->putJson(route('api.v1.device-token.store'), ['token' => 'abc'])->assertUnauthorized();

    pushRegister($this, pushPhone(User::factory()->specialist()->create()))->assertForbidden();

    expect(DeviceToken::query()->count())->toBe(0);
});

test('a student registers their phone and it is tied to that sign-in', function () {
    $student = User::factory()->student()->create();
    $bearer = pushPhone($student);

    pushRegister($this, $bearer, 'fcm-token-1', ['device_name' => 'realme RMX3999'])
        ->assertOk()
        ->assertJsonPath('message', 'This phone will now receive notifications.');

    $device = DeviceToken::query()->sole();
    expect($device->user_id)->toBe($student->id)
        ->and($device->token)->toBe('fcm-token-1')
        ->and($device->device_name)->toBe('realme RMX3999')
        ->and($device->personal_access_token_id)->toBe($student->tokens()->sole()->id);
});

test('the phone token is required and cannot be huge', function (array $body) {
    app('auth')->forgetGuards();

    $this->withToken(pushPhone(User::factory()->student()->create()))
        ->putJson(route('api.v1.device-token.store'), $body)
        ->assertJsonValidationErrors('token');

    expect(DeviceToken::query()->count())->toBe(0);
})->with([
    'missing' => [[]],
    'longer than 512' => [['token' => str_repeat('a', 513)]],
]);

test('registering again keeps one row and a new token replaces the old one', function () {
    $bearer = pushPhone(User::factory()->student()->create());

    pushRegister($this, $bearer, 'fcm-token-1')->assertOk();
    pushRegister($this, $bearer, 'fcm-token-1')->assertOk();
    pushRegister($this, $bearer, 'fcm-token-2')->assertOk();

    expect(DeviceToken::query()->pluck('token')->all())->toBe(['fcm-token-2']);
});

test('a phone moves to the student who signs in on it last', function () {
    $second = User::factory()->student()->create();

    pushRegister($this, pushPhone(User::factory()->student()->create()), 'shared-phone')->assertOk();
    pushRegister($this, pushPhone($second), 'shared-phone')->assertOk();

    expect(DeviceToken::query()->sole()->user_id)->toBe($second->id);
});

test('a student stops pushes to one phone, and signing out does the same', function () {
    $student = User::factory()->student()->create();
    $phone = pushPhone($student);
    $tablet = pushPhone($student, 'Tablet');
    pushRegister($this, $phone, 'phone-token')->assertOk();
    pushRegister($this, $tablet, 'tablet-token')->assertOk();

    app('auth')->forgetGuards();
    $this->withToken($phone)->deleteJson(route('api.v1.device-token.destroy'))->assertOk();

    expect(DeviceToken::query()->pluck('token')->all())->toBe(['tablet-token']);

    app('auth')->forgetGuards();
    $this->withToken($tablet)->postJson(route('api.v1.auth.logout'))->assertOk();

    expect(DeviceToken::query()->count())->toBe(0);
});

test('an order that is ready is pushed through Firebase with the bell\'s words', function () {
    $credentials = pushFakeCredentials();
    pushFakeFirebase();
    $student = User::factory()->student()->create();
    DeviceToken::factory()->for($student)->create(['token' => 'fcm-token-1']);
    $order = Order::factory()->for($student, 'student')->create(['total_centavos' => 105000]);

    $student->notify(new OrderReady($order));

    expect($student->notifications()->count())->toBe(1);
    Http::assertSent(function (Request $request) use ($credentials) {
        if ($request->url() !== 'https://oauth2.googleapis.com/token') {
            return false;
        }

        [$header, $payload, $signature] = explode('.', $request['assertion']);
        $decode = fn (string $part) => base64_decode(strtr($part, '-_', '+/'));
        $claims = json_decode($decode($payload), true);

        return $claims['iss'] === 'push@test-project.iam.gserviceaccount.com'
            && $claims['scope'] === 'https://www.googleapis.com/auth/firebase.messaging'
            && openssl_verify("{$header}.{$payload}", $decode($signature), $credentials['public_key'], OPENSSL_ALGO_SHA256) === 1;
    });
    expect(pushMessagesSent())->toBe([[
        'token' => 'fcm-token-1',
        'notification' => [
            'title' => "Order {$order->number} is ready for pickup",
            'body' => 'Pick it up at the PROWARE office and pay ₱1,050.00 in cash by Oct 7, 2026.',
        ],
        'android' => ['priority' => 'HIGH', 'notification' => ['channel_id' => 'orders']],
        'data' => ['kind' => 'order_ready', 'order_id' => (string) $order->id],
    ]]);
});

test('a cancelled order and an arrived preorder are pushed with the bell\'s words', function (Closure $notice, string $title, string $body) {
    pushFakeCredentials();
    pushFakeFirebase();
    $student = User::factory()->student()->create();
    DeviceToken::factory()->for($student)->create();
    [$notification, $data] = $notice($student);

    $student->notify($notification);

    $message = pushMessagesSent()[0];
    expect($message['notification'])->toBe(['title' => $title, 'body' => $body])
        ->and($message['data'])->toBe($data);
})->with([
    'order cancelled' => [
        function (User $student): array {
            $order = Order::factory()->for($student, 'student')->create(['cancel_reason' => 'Not picked up by Oct 7, 2026.']);
            $order->forceFill(['number' => 'PW-0042'])->save();

            return [new OrderCancelled($order), ['kind' => 'order_cancelled', 'order_id' => (string) $order->id]];
        },
        'Order PW-0042 was cancelled',
        'Not picked up by Oct 7, 2026.',
    ],
    'preorder arrived' => [
        function (): array {
            $product = Product::factory()->create(['name' => 'STI Hoodie']);

            return [new PreorderArrived($product), ['kind' => 'preorder_arrived', 'product_id' => (string) $product->id]];
        },
        'Your preordered item is here: STI Hoodie',
        'You can now add it to your cart and order it. It is not held for you, so order soon.',
    ],
]);

test('every phone of the student gets the push and other students do not', function () {
    pushFakeCredentials();
    pushFakeFirebase();
    $student = User::factory()->student()->create();
    DeviceToken::factory()->for($student)->create(['token' => 'phone-token']);
    DeviceToken::factory()->for($student)->create(['token' => 'tablet-token']);
    DeviceToken::factory()->create(['token' => 'someone-elses-token']);

    $student->notify(new OrderReady(Order::factory()->for($student, 'student')->create()));

    expect(collect(pushMessagesSent())->pluck('token')->sort()->values()->all())->toBe(['phone-token', 'tablet-token']);
});

test('staff notices are not pushed to phones', function () {
    pushFakeCredentials();
    pushFakeFirebase();
    $specialist = User::factory()->specialist()->create();
    DeviceToken::factory()->for($specialist)->create();

    $specialist->notify(new OrderPlaced(Order::factory()->create()));

    Http::assertNothingSent();
});

test('a notice made inside work that is undone is not pushed', function () {
    pushFakeCredentials();
    pushFakeFirebase();
    $student = User::factory()->student()->create();
    DeviceToken::factory()->for($student)->create();
    $order = Order::factory()->for($student, 'student')->create();

    rescue(fn () => DB::transaction(function () use ($student, $order): void {
        $student->notify(new OrderReady($order));

        throw new RuntimeException('The Specialist\'s change failed.');
    }), report: false);

    Http::assertNothingSent();
    expect($student->notifications()->count())->toBe(0);
});

test('the Firebase access token is reused for later pushes', function () {
    pushFakeCredentials();
    pushFakeFirebase();
    $student = User::factory()->student()->create();
    DeviceToken::factory()->for($student)->create();
    $order = Order::factory()->for($student, 'student')->create();

    $student->notify(new OrderReady($order));
    $student->notify(new OrderCancelled($order));

    expect(collect(Http::recorded())->filter(fn (array $pair) => $pair[0]->url() === 'https://oauth2.googleapis.com/token'))->toHaveCount(1)
        ->and(pushMessagesSent())->toHaveCount(2);
});

test('nothing is sent when the student has no registered phone', function () {
    pushFakeCredentials();
    pushFakeFirebase();
    $student = User::factory()->student()->create();

    $student->notify(new OrderReady(Order::factory()->for($student, 'student')->create()));

    Http::assertNothingSent();
});

test('the notice is still saved when Firebase is not set up', function () {
    config(['services.fcm.credentials' => '/no/such/file.json']);
    Http::fake();
    $student = User::factory()->student()->create();
    DeviceToken::factory()->for($student)->create();

    $student->notify(new OrderReady(Order::factory()->for($student, 'student')->create()));

    Http::assertNothingSent();
    expect($student->notifications()->count())->toBe(1)
        ->and(DeviceToken::query()->count())->toBe(1);
});

test('a dead phone token is forgotten', function () {
    pushFakeCredentials();
    Http::fake([
        'oauth2.googleapis.com/*' => Http::response(['access_token' => 'ya29.test-access', 'expires_in' => 3599]),
        'fcm.googleapis.com/*' => Http::response(['error' => ['code' => 404, 'status' => 'NOT_FOUND', 'details' => [['errorCode' => 'UNREGISTERED']]]], 404),
    ]);
    $student = User::factory()->student()->create();
    DeviceToken::factory()->for($student)->create();

    $student->notify(new OrderReady(Order::factory()->for($student, 'student')->create()));

    expect(DeviceToken::query()->count())->toBe(0);
});

test('a Firebase or network failure keeps the phone and never loses the notice', function (Closure $fakeFirebase) {
    pushFakeCredentials();
    $fakeFirebase();
    $student = User::factory()->student()->create();
    DeviceToken::factory()->for($student)->create();

    $student->notify(new OrderReady(Order::factory()->for($student, 'student')->create()));

    expect($student->notifications()->count())->toBe(1)
        ->and(DeviceToken::query()->count())->toBe(1);
})->with([
    'Firebase error' => [fn () => Http::fake([
        'oauth2.googleapis.com/*' => Http::response(['access_token' => 'ya29.test-access', 'expires_in' => 3599]),
        'fcm.googleapis.com/*' => Http::response(['error' => ['code' => 500, 'status' => 'INTERNAL']], 500),
    ])],
    'no internet' => [fn () => Http::fake(fn () => throw new ConnectionException('Could not resolve host'))],
]);

test('a refused access token is dropped so the next push asks for a new one', function () {
    pushFakeCredentials();
    Http::fake([
        'oauth2.googleapis.com/*' => Http::response(['access_token' => 'ya29.stale', 'expires_in' => 3599]),
        'fcm.googleapis.com/*' => Http::response(['error' => ['code' => 401, 'status' => 'UNAUTHENTICATED']], 401),
    ]);
    $student = User::factory()->student()->create();
    DeviceToken::factory()->for($student)->create();

    $student->notify(new OrderReady(Order::factory()->for($student, 'student')->create()));

    expect(Cache::has('fcm.access_token'))->toBeFalse();
});

test('a push with no extra data leaves the data field out because Firebase rejects an empty list', function () {
    pushFakeCredentials();
    pushFakeFirebase();

    $result = app(FcmClient::class)->send('fcm-token-1', 'Title', 'Body');

    expect($result)->toBe(PushResult::Sent)
        ->and(pushMessagesSent()[0])->not->toHaveKey('data');
});
