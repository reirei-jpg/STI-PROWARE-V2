<?php

namespace Database\Seeders;

use App\Actions\Sales\PutOnSale;
use App\Actions\Stock\CorrectStock;
use App\Enums\ProductStatus;
use App\Enums\StockCorrectionReason;
use App\Enums\UserRole;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Demo products so every storefront section has items to look at: Preorder
 * items under Coming Soon and On Sale items (with stock, ending on
 * different days). Each gets a plain generated "Demo photo". Products that
 * already exist by name are left alone, so running it again adds nothing.
 *
 * Run: php artisan db:seed --class=DemoStorefrontSeeder
 */
class DemoStorefrontSeeder extends Seeder
{
    /**
     * @var list<array{name: string, price: int, sizes?: list<string>, colors?: list<string>, color: array{int<0, 255>, int<0, 255>, int<0, 255>}}>
     */
    private const COMING_SOON = [
        ['name' => '42nd Anniversary Shirt', 'price' => 35000, 'sizes' => ['S/M', 'M/L', 'L/XL', 'XL/2XL'], 'color' => [13, 110, 253]],
        ['name' => 'Intramurals Jersey', 'price' => 45000, 'sizes' => ['S', 'M', 'L', 'XL'], 'color' => [220, 38, 38]],
        ['name' => 'STI Tote Bag', 'price' => 18000, 'color' => [245, 158, 11]],
        ['name' => 'STI Cap', 'price' => 22000, 'colors' => ['Blue', 'Yellow'], 'color' => [30, 64, 175]],
        ['name' => 'STI Notebook Set', 'price' => 12000, 'color' => [5, 150, 105]],
        ['name' => 'STI Mug', 'price' => 20000, 'color' => [124, 58, 237]],
    ];

    /**
     * @var list<array{name: string, price: int, sale: int, stock: int, days: int, color: array{int<0, 255>, int<0, 255>, int<0, 255>}, box?: array{pieces: int, price: int, sale: int}}>
     */
    private const ON_SALE = [
        ['name' => 'STI Lanyard', 'price' => 8000, 'sale' => 6000, 'stock' => 25, 'days' => 3, 'color' => [13, 110, 253]],
        ['name' => 'STI Ballpen', 'price' => 1500, 'sale' => 1000, 'stock' => 120, 'days' => 5, 'color' => [15, 23, 42], 'box' => ['pieces' => 12, 'price' => 15000, 'sale' => 10000]],
        ['name' => 'STI ID Holder', 'price' => 5000, 'sale' => 3500, 'stock' => 4, 'days' => 7, 'color' => [234, 88, 12]],
        ['name' => 'STI Sticker Pack', 'price' => 4000, 'sale' => 2500, 'stock' => 30, 'days' => 10, 'color' => [219, 39, 119]],
        ['name' => 'STI Pin Set', 'price' => 9000, 'sale' => 6000, 'stock' => 15, 'days' => 2, 'color' => [202, 138, 4]],
    ];

    public function run(PutOnSale $putOnSale, CorrectStock $correctStock): void
    {
        $specialist = User::query()->where('role', UserRole::Specialist)->first();

        foreach (self::COMING_SOON as $item) {
            if (Product::query()->where('name', $item['name'])->exists()) {
                continue;
            }

            $product = Product::query()->create([
                'name' => $item['name'],
                'sold_by_piece' => true,
                'price_centavos' => $item['price'],
                'status' => ProductStatus::Preorder,
                'low_stock_alert_at' => 5,
                'preorders_close_on' => now()->addDays(14)->toDateString(),
            ]);
            $this->addPhoto($product, $item['color']);
            $this->addVariants($product, $item);
        }

        if ($specialist === null) {
            $this->command->warn('No Specialist account, so the On Sale demo items (which need stock) were skipped.');

            return;
        }

        foreach (self::ON_SALE as $item) {
            if (Product::query()->where('name', $item['name'])->exists()) {
                continue;
            }

            $product = Product::query()->create([
                'name' => $item['name'],
                'sold_by_piece' => true,
                'price_centavos' => $item['price'],
                'status' => ProductStatus::Available,
                'low_stock_alert_at' => 5,
            ]);
            $this->addPhoto($product, $item['color']);
            $variant = $product->variants()->create(['combination' => '', 'choices' => [], 'position' => 0]);

            $packSalePrices = [];

            if (isset($item['box'])) {
                $box = $product->packs()->create([
                    'name' => 'Box',
                    'pieces' => $item['box']['pieces'],
                    'sold_to_students' => true,
                    'price_centavos' => $item['box']['price'],
                    'position' => 0,
                ]);
                $packSalePrices[$box->id] = $item['box']['sale'];
            }

            $correctStock->handle($variant, $specialist, StockCorrectionReason::Recount, $item['stock'], 'Demo stock for trying the storefront.');
            $putOnSale->handle($product->load('packs'), $item['sale'], [], $packSalePrices, $item['days']);
        }
    }

    /**
     * Sizes or colors become one option with a variant per choice; otherwise
     * one variant without options.
     *
     * @param  array{sizes?: list<string>, colors?: list<string>}  $item
     */
    private function addVariants(Product $product, array $item): void
    {
        $optionName = isset($item['sizes']) ? 'Size' : (isset($item['colors']) ? 'Color' : null);
        $choices = $item['sizes'] ?? $item['colors'] ?? [];

        if ($optionName === null) {
            $product->variants()->create(['combination' => '', 'choices' => [], 'position' => 0]);

            return;
        }

        $product->options()->create(['name' => $optionName, 'choices' => $choices, 'position' => 0]);

        foreach ($choices as $position => $choice) {
            $product->variants()->create([
                'combination' => "{$optionName}: {$choice}",
                'choices' => [['option' => $optionName, 'choice' => $choice]],
                'position' => $position,
            ]);
        }
    }

    /**
     * A plain square picture with the product's name, marked as a demo.
     *
     * @param  array{int<0, 255>, int<0, 255>, int<0, 255>}  $rgb
     */
    private function addPhoto(Product $product, array $rgb): void
    {
        $path = 'products/demo-'.Str::slug($product->name).'.png';
        Storage::disk('public')->put($path, $this->picture($product->name, $rgb));

        $product->photos()->create(['path' => $path, 'label' => 'Demo photo', 'position' => 0]);
    }

    /**
     * @param  array{int<0, 255>, int<0, 255>, int<0, 255>}  $rgb
     */
    private function picture(string $name, array $rgb): string
    {
        $size = 800;
        $image = imagecreatetruecolor($size, $size);

        if ($image === false) {
            return '';
        }

        $background = (int) imagecolorallocate($image, ...$rgb);
        $white = (int) imagecolorallocate($image, 255, 255, 255);
        $faint = (int) imagecolorallocatealpha($image, 255, 255, 255, 80);
        imagefill($image, 0, 0, $background);
        imagefilledellipse($image, 640, 160, 420, 420, $faint);
        imagefilledellipse($image, 140, 700, 360, 360, $faint);

        $font = $this->fontPath();

        if ($font === null) {
            imagestring($image, 5, 40, 380, $name, $white);
        } else {
            $lines = explode("\n", wordwrap($name, 14));
            $top = 400 - (count($lines) - 1) * 45;

            foreach ($lines as $index => $line) {
                $box = imagettfbbox(64, 0, $font, $line);
                $width = $box === false ? 0 : $box[2] - $box[0];
                imagettftext($image, 64, 0, (int) (($size - $width) / 2), $top + $index * 90, $white, $font, $line);
            }

            imagettftext($image, 24, 0, 40, 760, $white, $font, 'STI PROWARE · Demo photo');
        }

        ob_start();
        imagepng($image);

        return (string) ob_get_clean();
    }

    private function fontPath(): ?string
    {
        foreach (['C:\\Windows\\Fonts\\arialbd.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'] as $path) {
            if (is_file($path)) {
                return $path;
            }
        }

        return null;
    }
}
