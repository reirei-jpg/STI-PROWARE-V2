<?php

use App\Enums\StockMovementType;
use App\Models\FreeUniformGroup;
use App\Models\FreeUniformStudent;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\UniformSet;
use App\Models\User;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-10 09:00', 'Asia/Manila'));
    $this->specialist = User::factory()->specialist()->create(['name' => 'Carlo Mendoza']);
});

/**
 * A product with a Size option and this many pieces of each size.
 *
 * @param  array<string, int>  $stock
 */
function sizedProduct(string $name, array $stock): Product
{
    $product = Product::factory()->create(['name' => $name, 'price_centavos' => 50000, 'low_stock_alert_at' => 0]);

    foreach (array_keys($stock) as $position => $size) {
        ProductVariant::factory()->for($product)->create([
            'combination' => "Size: {$size}",
            'choices' => [['option' => 'Size', 'choice' => $size]],
            'stock_on_hand' => $stock[$size],
            'position' => $position,
        ]);
    }

    return $product;
}

/**
 * The BSIT set: BSIT Blouse, BSIT Polo and BSIT Pants with this stock.
 *
 * @param  array<string, int>  $tops  stock of each size of the blouse and of the polo
 * @param  array<string, int>  $pants
 */
function bsitSet(array $tops = ['S' => 10, 'M' => 10], array $pants = ['28' => 10, '30' => 10]): UniformSet
{
    return UniformSet::factory()->create([
        'name' => 'BSIT',
        'blouse_product_id' => sizedProduct('BSIT Blouse', $tops)->id,
        'polo_product_id' => sizedProduct('BSIT Polo', $tops)->id,
        'pants_product_id' => sizedProduct('BSIT Pants', $pants)->id,
    ]);
}

function uniformSize(?int $productId, string $size): ProductVariant
{
    return ProductVariant::query()->where('product_id', $productId)->where('combination', "Size: {$size}")->sole();
}

/**
 * $count students of the set, each with a polo M and pants 30 unless changed.
 *
 * @param  array<string, mixed>  $overrides  for every student
 * @return list<array<string, mixed>>
 */
function freeStudents(UniformSet $set, int $count, array $overrides = []): array
{
    return array_map(fn (int $number): array => array_merge([
        'name' => "Student {$number}",
        'enrollment_form_number' => "2026-0{$number}",
        'course_section' => 'BSIT 1A',
        'uniform_set_id' => $set->id,
        'top_kind' => 'polo',
        'top_variant_id' => $overrides['top_variant_id'] ?? uniformSize($set->polo_product_id, 'M')->id,
        'pants_variant_id' => uniformSize($set->pants_product_id, '30')->id,
    ], $overrides), range(1, $count));
}

test('a group of 5 who enrolled together each get one set, which leaves stock as Free (promo)', function () {
    $set = bsitSet();
    $students = freeStudents($set, 5);
    $students[0] = array_merge($students[0], ['name' => 'Maria Santos', 'top_kind' => 'blouse', 'top_variant_id' => uniformSize($set->blouse_product_id, 'S')->id]);

    $this->actingAs($this->specialist)
        ->post(route('free-uniforms.store'), ['enrolled_on' => '2026-10-09', 'note' => 'Barkada of five', 'students' => $students])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast', ['type' => 'success', 'message' => 'Group of 5 recorded. 10 pieces given.']);

    $group = FreeUniformGroup::sole();

    expect($group)
        ->enrolled_on->toDateString()->toBe('2026-10-09')
        ->recorded_by->toBe($this->specialist->id)
        ->and($group->students()->count())->toBe(5)
        ->and(FreeUniformStudent::query()->stillOwed()->count())->toBe(0)
        ->and(uniformSize($set->blouse_product_id, 'S')->stock_on_hand)->toBe(9)
        ->and(uniformSize($set->polo_product_id, 'M')->stock_on_hand)->toBe(6)
        ->and(uniformSize($set->pants_product_id, '30')->stock_on_hand)->toBe(5)
        ->and(StockMovement::query()->where('type', StockMovementType::FreePromo)->count())->toBe(10);

    $this->get(route('products.stock', $set->blouse_product_id))->assertInertia(fn (Assert $page) => $page
        ->where('movements.data.0.type_label', 'Free (promo)')
        ->where('movements.data.0.quantity', -1)
        ->where('movements.data.0.note', "To Maria Santos · Enrollment form #2026-01 · BSIT set · Free uniform group #{$group->id}"));
});

test('a piece out of stock is still to give, and is given when it arrives, in another size if needed', function () {
    $set = bsitSet(tops: ['S' => 0, 'M' => 4], pants: ['28' => 10, '30' => 10]);
    $this->actingAs($this->specialist);

    $this->post(route('free-uniforms.store'), ['enrolled_on' => '2026-10-10', 'students' => freeStudents($set, 5)])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast', ['type' => 'warning', 'message' => 'Group of 5 recorded. 9 pieces given. Still to give (out of stock): Student 5: Polo M. Give them from the group\'s details when they arrive.']);

    $owed = FreeUniformStudent::query()->stillOwed()->sole();
    expect($owed->name)->toBe('Student 5')
        ->and($owed->pants_movement_id)->not->toBeNull();

    $this->post(route('free-uniforms.give', $owed))
        ->assertSessionHasErrors(['pieces' => 'Still out of stock: Polo M. Choose another size, or give it when it arrives.']);

    uniformSize($set->polo_product_id, 'S')->forceFill(['stock_on_hand' => 3])->save();
    $this->post(route('free-uniforms.give', $owed), ['top_variant_id' => uniformSize($set->polo_product_id, 'S')->id])
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('toast', ['type' => 'success', 'message' => '1 piece given to Student 5.']);

    expect($owed->refresh()->isStillOwed())->toBeFalse()
        ->and($owed->topVariant->label())->toBe('S')
        ->and(uniformSize($set->polo_product_id, 'S')->stock_on_hand)->toBe(2);

    $this->post(route('free-uniforms.give', $owed))
        ->assertSessionHasErrors(['pieces' => 'Student 5 already got the whole set.']);
});

test('pieces held for students\' orders are not given away', function () {
    $set = bsitSet(tops: ['S' => 5, 'M' => 5]);
    uniformSize($set->polo_product_id, 'M')->forceFill(['held_pieces' => 5])->save();

    $this->actingAs($this->specialist)
        ->post(route('free-uniforms.store'), ['enrolled_on' => '2026-10-10', 'students' => freeStudents($set, 5)])
        ->assertSessionHasNoErrors();

    expect(uniformSize($set->polo_product_id, 'M')->stock_on_hand)->toBe(5)
        ->and(FreeUniformStudent::query()->stillOwed()->count())->toBe(5);
});

test('the group form explains what is wrong', function (Closure $payload, string $field, string $message) {
    $set = bsitSet();

    $this->actingAs($this->specialist)
        ->post(route('free-uniforms.store'), $payload($set))
        ->assertSessionHasErrors([$field => $message]);

    expect(FreeUniformGroup::count())->toBe(0)
        ->and(StockMovement::count())->toBe(0);
})->with([
    'fewer than 5 students' => [
        fn (UniformSet $set) => ['enrolled_on' => '2026-10-10', 'students' => freeStudents($set, 4)],
        'students', 'Add at least 5 students. The promo is for groups of at least 5 who enroll together.',
    ],
    'enrolled in the future' => [
        fn (UniformSet $set) => ['enrolled_on' => '2026-10-11', 'students' => freeStudents($set, 5)],
        'enrolled_on', 'The enrollment date cannot be in the future.',
    ],
    'the same form # twice' => [
        function (UniformSet $set) {
            $students = freeStudents($set, 5);
            $students[1]['enrollment_form_number'] = ' 2026-01 ';

            return ['enrolled_on' => '2026-10-10', 'students' => $students];
        },
        'students.1.enrollment_form_number', 'This Enrollment Form # is typed twice in this group.',
    ],
    'a size of another product' => [
        fn (UniformSet $set) => ['enrolled_on' => '2026-10-10', 'students' => freeStudents($set, 5, ['top_variant_id' => uniformSize($set->blouse_product_id, 'M')->id])],
        'students.0.top_variant_id', 'Choose the size of the polo.',
    ],
    'no name' => [
        fn (UniformSet $set) => ['enrolled_on' => '2026-10-10', 'students' => freeStudents($set, 5, ['name' => ''])],
        'students.0.name', 'Enter the student\'s name.',
    ],
]);

test('one free set per Enrollment Form #', function () {
    $set = bsitSet();
    FreeUniformStudent::factory()->create(['enrollment_form_number' => '2026-03']);

    $students = freeStudents($set, 5);
    $students[2]['enrollment_form_number'] = '2026-03 ';

    $this->actingAs($this->specialist)
        ->post(route('free-uniforms.store'), ['enrolled_on' => '2026-10-10', 'students' => $students])
        ->assertSessionHasErrors(['students.2.enrollment_form_number' => 'Enrollment Form # 2026-03 already got a free set.']);
});

test('a set without a polo cannot give a polo', function () {
    $set = bsitSet();
    $set->update(['polo_product_id' => null]);

    $this->actingAs($this->specialist)
        ->post(route('free-uniforms.store'), ['enrolled_on' => '2026-10-10', 'students' => freeStudents($set, 5, ['top_variant_id' => uniformSize($set->blouse_product_id, 'M')->id])])
        ->assertSessionHasErrors(['students.0.top_kind' => 'The BSIT set has no polo. Choose the other top, or add it to the set.']);
});

test('the Specialist changes how many students a group needs in Maintenance', function () {
    $set = bsitSet();
    $this->actingAs($this->specialist);

    $this->patch(route('maintenance.promo-group-size'), ['group_size' => 11])
        ->assertSessionHasErrors(['group_size' => 'Choose 2 to 10 students.']);
    $this->patch(route('maintenance.promo-group-size'), ['group_size' => 3])->assertSessionHasNoErrors();

    $this->get(route('maintenance.index'))->assertInertia(fn (Assert $page) => $page
        ->where('promoGroupSize.value', 3)
        ->where('promoGroupSize.changed_by', 'Carlo Mendoza'));

    $this->post(route('free-uniforms.store'), ['enrolled_on' => '2026-10-10', 'students' => freeStudents($set, 3)])
        ->assertSessionHasNoErrors();
});

test('uniform sets are added and changed, with at least one top and the pants', function () {
    $blouse = Product::factory()->create(['name' => 'BSHM Blouse']);
    $polo = Product::factory()->create(['name' => 'BSHM Polo']);
    $pants = Product::factory()->create(['name' => 'BSHM Pants']);
    $this->actingAs($this->specialist);

    $this->post(route('uniform-sets.store'), ['name' => 'BSHM', 'pants_product_id' => $pants->id])
        ->assertSessionHasErrors(['blouse_product_id' => 'Choose the blouse, the polo, or both.']);
    $this->post(route('uniform-sets.store'), ['name' => '', 'blouse_product_id' => $blouse->id])
        ->assertSessionHasErrors(['name' => 'Enter the course, e.g. BSIT.', 'pants_product_id' => 'Choose the pants product.']);

    $this->post(route('uniform-sets.store'), ['name' => ' BSHM ', 'blouse_product_id' => $blouse->id, 'pants_product_id' => $pants->id])
        ->assertSessionHasNoErrors();
    $set = UniformSet::sole();

    $this->post(route('uniform-sets.store'), ['name' => 'BSHM', 'blouse_product_id' => $blouse->id, 'pants_product_id' => $pants->id])
        ->assertSessionHasErrors(['name' => 'There is already a BSHM set.']);

    $this->put(route('uniform-sets.update', $set), ['name' => 'BSHM', 'blouse_product_id' => $blouse->id, 'polo_product_id' => $polo->id, 'pants_product_id' => $pants->id])
        ->assertSessionHasNoErrors();

    expect($set->refresh())
        ->name->toBe('BSHM')
        ->polo_product_id->toBe($polo->id);
});

test('the page lists groups, finds a student, shows who is still owed, and a group\'s details', function () {
    $set = bsitSet(tops: ['S' => 10, 'M' => 4]);
    $this->actingAs($this->specialist);
    $this->post(route('free-uniforms.store'), ['enrolled_on' => '2026-10-01', 'students' => freeStudents($set, 5)]);
    $owedGroup = FreeUniformGroup::query()->latest('id')->firstOrFail();

    $others = freeStudents($set, 5, ['top_variant_id' => uniformSize($set->polo_product_id, 'S')->id]);
    foreach ($others as $index => $student) {
        $others[$index]['enrollment_form_number'] = "2026-1{$index}";
    }
    $others[0]['name'] = 'Maria Santos';
    $this->post(route('free-uniforms.store'), ['enrolled_on' => '2026-10-08', 'students' => $others]);

    $this->get(route('free-uniforms.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('free-uniforms/index')
        ->has('groups.data', 2)
        ->where('groups.data.0.enrolled_on', '2026-10-08')
        ->where('groups.data.0.names', ['Maria Santos', 'Student 2'])
        ->where('groups.data.0.more_names', 3)
        ->where('groups.data.0.sets', 'BSIT × 5')
        ->where('groups.data.1.still_to_give', 1)
        ->where('summary', ['this_month' => 10, 'students' => 10, 'groups' => 2, 'still_to_give' => 1, 'group_size' => 5])
        ->where('sets.0.name', 'BSIT')
        ->where('sets.0.polo.sizes.1', ['id' => uniformSize($set->polo_product_id, 'M')->id, 'label' => 'M', 'free_to_sell' => 0]));

    $this->get(route('free-uniforms.index', ['search' => 'maria']))
        ->assertInertia(fn (Assert $page) => $page->has('groups.data', 1)->where('groups.data.0.names.0', 'Maria Santos'));
    $this->get(route('free-uniforms.index', ['show' => 'still_to_give']))
        ->assertInertia(fn (Assert $page) => $page->has('groups.data', 1)->where('groups.data.0.id', $owedGroup->id));

    $this->get(route('free-uniforms.index', ['details' => $owedGroup->id]))->assertInertia(fn (Assert $page) => $page
        ->missing('details')
        ->reloadOnly('details', fn (Assert $reload) => $reload
            ->where('details.students.4.name', 'Student 5')
            ->where('details.students.4.top.size', 'M')
            ->where('details.students.4.top.given', false)
            ->has('details.students.4.top.sizes', 2)
            ->where('details.students.4.pants.given', true)));
});

test('the list downloads as a CSV for Excel', function () {
    $set = bsitSet();
    $this->actingAs($this->specialist)
        ->post(route('free-uniforms.store'), ['enrolled_on' => '2026-10-09', 'students' => freeStudents($set, 5)]);

    $csv = $this->get(route('free-uniforms.export'))->assertOk()->streamedContent();

    expect($csv)->toContain('"Group #","Date Enrolled",Student,"Enrollment Form #","Course / Section",Set,Top,"Top Given",Pants,"Pants Given","Recorded By"')
        ->toContain('2026-10-09,"Student 1",2026-01,"BSIT 1A",BSIT,"Polo M",Given,"Pants 30",Given,"Carlo Mendoza"');
});

test('only the Specialist records free uniforms', function () {
    $set = bsitSet();
    $this->actingAs(User::factory()->schoolAdmin()->create());

    $this->get(route('free-uniforms.index'))->assertForbidden();
    $this->post(route('free-uniforms.store'), ['enrolled_on' => '2026-10-10', 'students' => freeStudents($set, 5)])->assertForbidden();
    $this->post(route('uniform-sets.store'), [])->assertForbidden();
});
