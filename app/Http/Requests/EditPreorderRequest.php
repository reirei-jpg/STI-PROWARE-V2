<?php

namespace App\Http\Requests;

use App\Actions\Preorders\EditPreorderByStudent;
use App\Enums\PreorderStatus;
use App\Models\Preorder;
use App\Models\ProductVariant;
use App\Services\Shop\BuyerLimit;
use App\Services\Stock\Units;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * A buyer's change to their own waiting preorder: another size or color of
 * the same item (one that can be preordered) and how many.
 */
class EditPreorderRequest extends FormRequest
{
    /** Another buyer's preorder does not exist for them. */
    public function authorize(): bool
    {
        abort_unless($this->preorder()->user_id === $this->user()?->id, 404);

        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'product_variant_id' => ['required', 'integer', Rule::exists('product_variants', 'id')->where('product_id', $this->preorder()->product_id)],
            'quantity' => ['required', 'integer', 'min:1', 'max:'.BuyerLimit::for($this->user())],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'product_variant_id.required' => 'Choose the size or color you want.',
            'product_variant_id.integer' => 'Choose one of this item\'s sizes or colors.',
            'product_variant_id.exists' => 'Choose one of this item\'s sizes or colors.',
            'quantity.required' => 'Enter how many you want.',
            'quantity.integer' => 'Enter a whole number.',
            'quantity.min' => 'The quantity must be at least 1.',
            'quantity.max' => BuyerLimit::message(BuyerLimit::for($this->user())),
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $preorder = $this->preorder();
                $refusal = EditPreorderByStudent::refusal($preorder);

                if ($refusal !== null) {
                    $validator->errors()->add('preorder', $refusal);

                    return;
                }

                $variant = $this->variant();
                $quantity = $this->integer('quantity');

                if ($variant->id === $preorder->product_variant_id && $quantity === $preorder->quantity) {
                    $validator->errors()->add('quantity', 'Change the size, color or quantity first.');

                    return;
                }

                // A product for sale: only its sold-out sizes can be preordered.
                if ($variant->id !== $preorder->product_variant_id && ! $preorder->product->acceptsPreorders()) {
                    if ($variant->freeToSell() > 0) {
                        $validator->errors()->add('product_variant_id', "{$variant->displayName()} is in stock. Add it to your cart instead.");

                        return;
                    }

                    if (! $variant->canBePreordered()) {
                        $validator->errors()->add('product_variant_id', "{$variant->displayName()} will not be restocked, so it cannot be preordered.");

                        return;
                    }
                }

                // Another size of the same batch already waits: change that one instead.
                $sameInBatch = Preorder::query()
                    ->where('batch', $preorder->batch)
                    ->whereKeyNot($preorder->id)
                    ->where('product_variant_id', $variant->id)
                    ->whereIn('status', [PreorderStatus::Active, PreorderStatus::Held])
                    ->exists();

                if ($sameInBatch) {
                    $validator->errors()->add('product_variant_id', "This preorder already has {$variant->label()}. Change its quantity instead.");

                    return;
                }

                $limit = BuyerLimit::for($this->user());
                $already = (int) Preorder::query()
                    ->where('user_id', $preorder->user_id)
                    ->whereKeyNot($preorder->id)
                    ->where('product_variant_id', $variant->id)
                    ->where('status', PreorderStatus::Active)
                    ->sum('quantity');

                if ($already > 0 && $already + $quantity > $limit) {
                    $validator->errors()->add('quantity', 'You already preordered '.Units::count($already, 'Piece')." of {$variant->displayName()} in another preorder. You can get at most ".number_format($limit).' of one item in all. Contact the PROWARE office to get more.');
                }
            },
        ];
    }

    public function preorder(): Preorder
    {
        $preorder = $this->route('preorder');

        return $preorder instanceof Preorder ? $preorder : abort(404);
    }

    public function variant(): ProductVariant
    {
        return ProductVariant::query()->with('product')->findOrFail($this->integer('product_variant_id'));
    }
}
