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
 * she enters the actual count on the shelf. Other needs a note. A count
 * higher than the stock needs the added pieces' eStore price per piece.
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
            // Free uniforms are recorded on the Free Uniforms page now.
            'reason' => ['required', Rule::enum(StockCorrectionReason::class)->except([StockCorrectionReason::GivenFree])],
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
            // Pesos per piece, for a count that adds pieces (checked below).
            'unit_cost' => ['nullable', 'numeric', 'min:0.01', 'max:'.SaveProductRequest::MAX_PRICE_PESOS],
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
            'reason.enum' => 'Choose one of the reasons. Free uniforms are recorded on the Free Uniforms page.',
            'pieces_to_remove.required' => 'Enter how many pieces to take out of stock.',
            'pieces_to_remove.integer' => 'Enter a whole number of pieces.',
            'pieces_to_remove.min' => 'Take out at least 1 piece.',
            'actual_count.required' => 'Enter how many pieces are actually on the shelf.',
            'actual_count.integer' => 'Enter a whole number of pieces.',
            'actual_count.min' => 'The count cannot be below 0.',
            'note.required' => 'Write what happened, since the reason is Other.',
            'unit_cost.numeric' => 'Enter the eStore price per piece, e.g. 250 or 18.50.',
            'unit_cost.min' => 'Enter the eStore price per piece, e.g. 250 or 18.50.',
            'unit_cost.max' => 'The eStore price per piece cannot be more than ₱100,000.00.',
        ];
    }

    /**
     * The correction must change the stock, cannot take out more pieces than
     * are in stock, and cannot leave fewer on the shelf than are held for
     * students' open orders (cancel those orders first).
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

                $variant = $this->variant();
                $stock = $variant->stock_on_hand;
                $field = $this->reason()->removesPieces() ? 'pieces_to_remove' : 'actual_count';
                $after = $this->reason()->removesPieces() ? $stock - $this->integer('pieces_to_remove') : $this->integer('actual_count');

                if ($this->reason()->removesPieces() && $this->integer('pieces_to_remove') > $stock) {
                    $validator->errors()->add('pieces_to_remove', "Only {$stock} pcs are in stock.");
                } elseif (! $this->reason()->removesPieces() && $after === $stock) {
                    $validator->errors()->add('actual_count', "The stock is already {$stock} pcs, so nothing would change.");
                } elseif ($after < $variant->held_pieces) {
                    $validator->errors()->add($field, "{$variant->held_pieces} pcs are held for students' orders, so the shelf cannot have fewer. Cancel those orders first, or count again.");
                } elseif ($after > $stock && $this->centavosPerPiece() === null) {
                    $validator->errors()->add('unit_cost', 'Enter the eStore price per piece of the '.($after - $stock).' pcs you are adding, so every piece has a cost.');
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
     * The eStore price per piece in centavos; null when not given.
     */
    public function centavosPerPiece(): ?int
    {
        return $this->filled('unit_cost') ? (int) round((float) $this->input('unit_cost') * 100) : null;
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
