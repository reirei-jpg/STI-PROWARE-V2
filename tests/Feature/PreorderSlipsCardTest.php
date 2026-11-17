<?php

use App\Enums\PreorderStatus;
use App\Enums\ProductStatus;
use App\Models\Preorder;
use App\Models\PreorderSlip;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-11-17 10:00', 'Asia/Manila'));
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);

    $this->hoodie = Product::factory()->create([
        'name' => 'STI Pullover Hoodie', 'status' => ProductStatus::Preorder, 'price_centavos' => 85000,
        'preorder_pay_from' => '2026-11-16', 'preorders_close_on' => '2026-11-20',
    ]);
    $this->large = ProductVariant::factory()->for($this->hoodie)->create(['combination' => 'Size: L', 'choices' => [['option' => 'Size', 'choice' => 'L']]]);
});

/**
 * A preorder with its slip, placed by $buyer.
 */
function slipFor(User $buyer, ProductVariant $variant, int $pieces, PreorderStatus $status = PreorderStatus::Active): PreorderSlip
{
    $preorder = Preorder::factory()->forVariant($variant)->for($buyer, 'student')->create([
        'quantity' => $pieces, 'status' => $status, 'price_centavos' => 85000,
    ]);

    return PreorderSlip::forBatch($preorder);
}

test('the Preorders card counts the slips still waiting for their items, unpaid ones to verify', function () {
    $juan = User::factory()->student()->create(['name' => 'Juan Dela Cruz']);
    $teresita = User::factory()->employee()->create(['name' => 'Teresita Lim']);

    $unpaid = slipFor($juan, $this->large, 2);
    $paid = slipFor($teresita, $this->large, 1);
    $paid->forceFill(['paid_at' => now(), 'paid_centavos' => 85000])->save();
    $readyToPickUp = slipFor($juan, $this->large, 1, PreorderStatus::Held);
    $readyToPickUp->forceFill(['paid_at' => now(), 'paid_centavos' => 255000])->save();
    // The rest of that paid size is still on its way: one line, not two.
    Preorder::factory()->forVariant($this->large)->for($juan, 'student')->create(['quantity' => 2, 'batch' => $readyToPickUp->batch]);
    // Neither waits for its items any more: not counted.
    slipFor($juan, $this->large, 1, PreorderStatus::Cancelled);
    slipFor($juan, $this->large, 1, PreorderStatus::Arrived);

    $this->actingAs($this->specialist)->get(route('dashboard'))->assertInertia(fn (Assert $page) => $page
        ->where('stockCards.preorder_slips', ['to_verify' => 1, 'paid' => 2, 'all' => 3]));

    // To verify: one card per buyer, with their unpaid slips.
    $this->getJson(route('preorder-slips.index'))
        ->assertOk()
        ->assertJsonPath('total', 1)
        ->assertJsonPath('data.0.buyer_name', 'Juan Dela Cruz')
        ->assertJsonPath('data.0.unpaid_slips', 1)
        ->assertJsonPath('data.0.unpaid_centavos', 170000)
        ->assertJsonPath('data.0.slips', [[
            'slip_id' => $unpaid->id, 'number' => $unpaid->number, 'buyer_name' => 'Juan Dela Cruz',
            'buyer_id_number' => $juan->idNumber(), 'is_staff' => false, 'product_name' => 'STI Pullover Hoodie',
            'items' => 'L × 2', 'pieces' => 2, 'amount_centavos' => 170000, 'paid' => false, 'paid_on' => null,
            'pay_from' => '2026-11-16', 'pay_until' => '2026-11-20',
        ]]);

    // All: Juan's two slips together (the unpaid one first), then Teresita.
    $this->getJson(route('preorder-slips.index', ['tab' => 'all']))
        ->assertJsonPath('data.*.buyer_name', ['Juan Dela Cruz', 'Teresita Lim'])
        ->assertJsonPath('data.0.slips.*.number', [$unpaid->number, $readyToPickUp->number])
        ->assertJsonPath('data.0.slips.1.items', 'L × 3')
        ->assertJsonPath('data.0.slips.1.amount_centavos', 255000)
        ->assertJsonPath('data.1.is_staff', true)
        ->assertJsonPath('data.1.unpaid_slips', 0)
        ->assertJsonPath('data.1.slips.0.paid_on', '2026-11-17');

    // Found by buyer name or slip number.
    $this->getJson(route('preorder-slips.index', ['tab' => 'all', 'search' => 'teresita']))
        ->assertJsonPath('data.*.buyer_name', ['Teresita Lim']);
    $this->getJson(route('preorder-slips.index', ['tab' => 'all', 'search' => strtolower((string) $readyToPickUp->number)]))
        ->assertJsonPath('data.*.buyer_name', ['Juan Dela Cruz']);

    // The phone gets the same list.
    Sanctum::actingAs($this->specialist);
    $this->getJson(route('api.v1.specialist.preorder-slips.index', ['tab' => 'paid']))
        ->assertOk()
        ->assertJsonPath('counts', ['to_verify' => 1, 'paid' => 2, 'all' => 3])
        ->assertJsonPath('data.*.buyer_name', ['Teresita Lim', 'Juan Dela Cruz'])
        ->assertJsonPath('data.1.slips.*.number', [$readyToPickUp->number]);
    $this->getJson(route('api.v1.specialist.tasks'))
        ->assertJsonPath('stock_cards.preorder_slips.to_verify', 1);
});

test('an unknown tab is refused and only the Specialist sees the slips', function () {
    $this->actingAs($this->specialist)
        ->getJson(route('preorder-slips.index', ['tab' => 'cancelled']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('tab');

    $this->actingAs(User::factory()->student()->create())
        ->getJson(route('preorder-slips.index'))
        ->assertForbidden();
});
