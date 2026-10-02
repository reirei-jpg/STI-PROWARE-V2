<?php

namespace App\Http\Requests;

use App\Enums\StockCorrectionReason;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * The Correct stock pop-up. For Damaged, Lost and Returned to Head Office
 * the Specialist enters how many pieces to take out; for Recount and Other
 * she enters the actual count on the shelf. Other needs a note.
 */
class CorrectStockRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $product = $this->route('product');
        $reason = StockCorrectionReason::tryFrom((string) $this->input('reason'));

        return [
            'product_variant_id' => [
                'required',
                'integer',
                Rule::exists('product_variants', 'id')->where('product_id', $product instanceof Product ? $product->id : 0),
            ],
            'reason' => ['required', Rule::enum(StockCorrectionReason::class)],
            'pieces_to_remove' => [
                Rule::requiredIf($reason?->removesPieces() === true),
                'nullable',
                'integer',
                'min:1',
                'max:1000000',
            ],
            'actual_count' => [
                Rule::requiredIf($reason?->removesPieces() === false),
                'nullable',
                'integer',
                'min:0',
                'max:1000000',
            ],
            'note' => [
                Rule::requiredIf($reason === StockCorrectionReason::Other),
                'nullable',
                'string',
                'max:200',
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'product_variant_id.required' => 'Choose the variant to correct.',
            'product_variant_id.exists' => 'Choose one of this product\'s variants.',
            'reason.required' => 'Choose why the stock is being corrected.',
            'pieces_to_remove.required' => 'Enter how many pieces to take out of stock.',
            'pieces_to_remove.integer' => 'Enter a whole number of pieces.',
            'pieces_to_remove.min' => 'Take out at least 1 piece.',
            'actual_count.required' => 'Enter how many pieces are actually on the shelf.',
            'actual_count.integer' => 'Enter a whole number of pieces.',
            'actual_count.min' => 'The count cannot be below 0.',
            'note.required' => 'Write what happened, since the reason is Other.',
        ];
    }

    /**
     * The correction must change the stock, and cannot take out more pieces
     * than are in stock.
     *
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $stock = $this->variant()->stock_on_hand;

                if ($this->reason()->removesPieces()) {
                    if ($this->integer('pieces_to_remove') > $stock) {
                        $validator->errors()->add('pieces_to_remove', "Only {$stock} pcs are in stock.");
                    }

                    return;
                }

                if ($this->integer('actual_count') === $stock) {
                    $validator->errors()->add('actual_count', "The stock is already {$stock} pcs, so nothing would change.");
                }
            },
        ];
    }

    public function variant(): ProductVariant
    {
        return ProductVariant::query()->findOrFail($this->integer('product_variant_id'));
    }

    public function reason(): StockCorrectionReason
    {
        return StockCorrectionReason::from((string) $this->input('reason'));
    }

    /**
     * The note, trimmed; null when left empty.
     */
    public function note(): ?string
    {
        $note = trim((string) $this->input('note'));

        return $note === '' ? null : $note;
    }
}
