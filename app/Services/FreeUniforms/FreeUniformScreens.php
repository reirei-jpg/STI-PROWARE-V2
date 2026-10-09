<?php

namespace App\Services\FreeUniforms;

use App\Models\FreeUniformGroup;
use App\Models\FreeUniformStudent;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\UniformSet;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * What the Free Uniforms page shows: the groups recorded (newest first),
 * the numbers at the top, a group's students with their sets, and the
 * uniform sets with their sizes in stock.
 *
 * @phpstan-type SizeOption array{id: int, label: string, free_to_sell: int}
 * @phpstan-type SetPiece array{product_id: int, product_name: string, sizes: list<SizeOption>}
 * @phpstan-type GroupRow array{id: int, enrolled_on: string, note: string|null, students_count: int, names: list<string>, more_names: int, sets: string, still_to_give: int, recorded_by: string, recorded_at: string|null}
 */
final class FreeUniformScreens
{
    /**
     * Groups, newest enrollment date first; only those with a piece still
     * to give when asked; searchable by a student's name or form #.
     *
     * @return LengthAwarePaginator<int, GroupRow>
     */
    public static function groups(?string $search, string $show): LengthAwarePaginator
    {
        return FreeUniformGroup::query()
            ->with(['recorder', 'students.uniformSet'])
            ->withCount(['students', 'students as still_to_give_count' => fn (Builder $query) => self::whereStillOwed($query)])
            ->when($show === 'still_to_give', fn (Builder $query) => $query->whereHas('students', fn (Builder $students) => self::whereStillOwed($students)))
            ->when($search, fn (Builder $query, string $term) => $query->whereHas('students', fn (Builder $students) => $students
                ->whereLike('name', "%{$term}%")
                ->orWhereLike('enrollment_form_number', '%'.mb_strtoupper($term).'%')))
            ->latest('enrolled_on')
            ->latest('id')
            ->paginate(20)
            ->withQueryString()
            ->through(function (FreeUniformGroup $group): array {
                $names = $group->students->map(fn (FreeUniformStudent $student): string => $student->name);

                return [
                    'id' => $group->id,
                    'enrolled_on' => $group->enrolled_on->toDateString(),
                    'note' => $group->note,
                    'students_count' => (int) $group->getAttribute('students_count'),
                    'names' => array_values($names->take(2)->all()),
                    'more_names' => max(0, $names->count() - 2),
                    'sets' => $group->students
                        ->countBy(fn (FreeUniformStudent $student): string => $student->uniformSet->name)
                        ->map(fn (int $count, string $set): string => "{$set} × {$count}")
                        ->implode(' · '),
                    'still_to_give' => (int) $group->getAttribute('still_to_give_count'),
                    'recorded_by' => $group->recorder->name,
                    'recorded_at' => $group->created_at?->toIso8601String(),
                ];
            });
    }

    /**
     * The numbers at the top of the page.
     *
     * @return array{this_month: int, students: int, groups: int, still_to_give: int, group_size: int}
     */
    public static function summary(): array
    {
        return [
            'this_month' => FreeUniformStudent::query()
                ->whereHas('group', fn (Builder $query) => $query->whereDate('enrolled_on', '>=', now()->startOfMonth()->toDateString()))
                ->count(),
            'students' => FreeUniformStudent::query()->count(),
            'groups' => FreeUniformGroup::query()->count(),
            'still_to_give' => FreeUniformStudent::query()->stillOwed()->count(),
            'group_size' => PromoRules::groupSize(),
        ];
    }

    /**
     * One group for its details pop-up: each student with the set and sizes
     * they got, what is still to give, and the sizes in stock to give it.
     *
     * @return array<string, mixed>|null
     */
    public static function details(int $groupId): ?array
    {
        $group = FreeUniformGroup::query()
            ->with(['recorder', 'students.uniformSet', 'students.topVariant.product.variants', 'students.pantsVariant.product.variants'])
            ->find($groupId);

        if ($group === null) {
            return null;
        }

        return [
            'id' => $group->id,
            'enrolled_on' => $group->enrolled_on->toDateString(),
            'note' => $group->note,
            'recorded_by' => $group->recorder->name,
            'recorded_at' => $group->created_at?->toIso8601String(),
            'students' => array_values($group->students->map(fn (FreeUniformStudent $student): array => [
                'id' => $student->id,
                'name' => $student->name,
                'enrollment_form_number' => $student->enrollment_form_number,
                'course_section' => $student->course_section,
                'set_name' => $student->uniformSet->name,
                'top' => self::piece($student->topVariant, $student->top_kind->label(), $student->top_movement_id !== null),
                'pants' => self::piece($student->pantsVariant, 'Pants', $student->pants_movement_id !== null),
            ])->all()),
        ];
    }

    /**
     * Every uniform set with its products and their sizes in stock, for the
     * Record a group pop-up and the Uniform sets list.
     *
     * @return list<array{id: int, name: string, blouse: SetPiece|null, polo: SetPiece|null, pants: SetPiece|null, students_count: int}>
     */
    public static function sets(): array
    {
        return array_values(UniformSet::query()
            ->with(['blouseProduct.variants', 'poloProduct.variants', 'pantsProduct.variants'])
            ->withCount('students')
            ->orderBy('name')
            ->get()
            ->map(fn (UniformSet $set): array => [
                'id' => $set->id,
                'name' => $set->name,
                'blouse' => self::setPiece($set->blouseProduct),
                'polo' => self::setPiece($set->poloProduct),
                'pants' => self::setPiece($set->pantsProduct),
                'students_count' => (int) $set->getAttribute('students_count'),
            ])
            ->all());
    }

    /**
     * Every product, to choose a set's blouse, polo and pants from.
     *
     * @return list<array{id: int, name: string}>
     */
    public static function products(): array
    {
        return array_values(Product::query()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Product $product): array => ['id' => $product->id, 'name' => $product->name])
            ->all());
    }

    /**
     * Every student given a free set (matching the search), for the CSV.
     *
     * @return list<array{group_id: int, enrolled_on: string, name: string, enrollment_form_number: string, course_section: string|null, set_name: string, top: string, top_given: bool, pants: string, pants_given: bool, recorded_by: string}>
     */
    public static function allStudents(?string $search): array
    {
        return array_values(FreeUniformStudent::query()
            ->with(['group.recorder', 'uniformSet', 'topVariant', 'pantsVariant'])
            ->when($search, fn (Builder $query, string $term) => $query->where(fn (Builder $inner) => $inner
                ->whereLike('name', "%{$term}%")
                ->orWhereLike('enrollment_form_number', '%'.mb_strtoupper($term).'%')))
            ->join('free_uniform_groups', 'free_uniform_groups.id', '=', 'free_uniform_students.free_uniform_group_id')
            ->orderByDesc('free_uniform_groups.enrolled_on')
            ->orderByDesc('free_uniform_students.free_uniform_group_id')
            ->orderBy('free_uniform_students.id')
            ->select('free_uniform_students.*')
            ->get()
            ->map(fn (FreeUniformStudent $student): array => [
                'group_id' => $student->free_uniform_group_id,
                'enrolled_on' => $student->group->enrolled_on->toDateString(),
                'name' => $student->name,
                'enrollment_form_number' => $student->enrollment_form_number,
                'course_section' => $student->course_section,
                'set_name' => $student->uniformSet->name,
                'top' => FreeUniformStock::pieceName($student, 'top'),
                'top_given' => $student->top_movement_id !== null,
                'pants' => FreeUniformStock::pieceName($student, 'pants'),
                'pants_given' => $student->pants_movement_id !== null,
                'recorded_by' => $student->group->recorder->name,
            ])
            ->all());
    }

    /**
     * Students with the top or the pants still to give.
     *
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $students
     * @return Builder<TModel>
     */
    private static function whereStillOwed(Builder $students): Builder
    {
        return $students->where(fn (Builder $inner) => $inner->whereNull('top_movement_id')->orWhereNull('pants_movement_id'));
    }

    /**
     * A size's name: "M", or "One size" for a product without sizes.
     */
    public static function sizeLabel(ProductVariant $variant): string
    {
        return $variant->choices === [] ? 'One size' : $variant->label();
    }

    /**
     * A student's top or pants: its size, whether it was given, and (while
     * still to give) the sizes in stock to give it in.
     *
     * @return array{name: string, product_name: string, size: string, variant_id: int, given: bool, sizes: list<SizeOption>}
     */
    private static function piece(ProductVariant $variant, string $name, bool $given): array
    {
        return [
            'name' => $name,
            'product_name' => $variant->product->name,
            'size' => self::sizeLabel($variant),
            'variant_id' => $variant->id,
            'given' => $given,
            'sizes' => $given ? [] : self::sizes($variant->product),
        ];
    }

    /**
     * @return SetPiece|null
     */
    private static function setPiece(?Product $product): ?array
    {
        return $product === null ? null : [
            'product_id' => $product->id,
            'product_name' => $product->name,
            'sizes' => self::sizes($product),
        ];
    }

    /**
     * The product's sizes in their order, with how many are free to give.
     *
     * @return list<SizeOption>
     */
    private static function sizes(Product $product): array
    {
        return array_values($product->variants
            ->sortBy('position')
            ->map(fn (ProductVariant $variant): array => [
                'id' => $variant->id,
                'label' => self::sizeLabel($variant),
                'free_to_sell' => $variant->freeToSell(),
            ])
            ->all());
    }
}
