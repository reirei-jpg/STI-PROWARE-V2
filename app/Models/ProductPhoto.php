<?php

namespace App\Models;

use Database\Factories\ProductPhotoFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * One photo of a product, e.g. its front, back or side. The photo with the
 * lowest position is the main photo.
 *
 * @property int $id
 * @property int $product_id
 * @property string $path
 * @property string|null $label
 * @property int $position
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['path', 'label', 'position'])]
class ProductPhoto extends Model
{
    /** @use HasFactory<ProductPhotoFactory> */
    use HasFactory;

    /**
     * @return BelongsTo<Product, $this>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * The photo's address on the address the page or phone app was opened
     * with (127.0.0.1, the laptop's Wi-Fi address, the school server), not
     * always APP_URL, so photos show wherever the system is opened from.
     */
    public function url(): string
    {
        return url(Storage::disk('public')->url($this->path));
    }
}
