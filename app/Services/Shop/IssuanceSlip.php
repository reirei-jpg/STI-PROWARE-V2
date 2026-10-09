<?php

namespace App\Services\Shop;

use App\Models\Order;
use App\Models\OrderItem;
use BaconQrCode\Renderer\Color\Rgb;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\Fill;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;

/**
 * An order's issuance slip, as on STI College-Ormoc's paper form: the
 * school's name and address, No. (the order number), Date, Student Name,
 * Section, each item with QTY / ITEM / UNIT PRICE / AMOUNT, the Total
 * Amount, and once released, the date received and who issued it. The QR
 * holds the order's random slip code, which the Specialist scans to find
 * the order (website and phone app). Expects the items, student and
 * handler to be loaded.
 */
final class IssuanceSlip
{
    public const SCHOOL = 'STI COLLEGE-ORMOC, INC.';

    public const ADDRESS_LINES = ['Ormoc Centrum Bldg., Barangay South 6541', 'Ormoc City, Leyte Philippines'];

    /**
     * @return array{school: string, address_lines: list<string>, order_id: int, number: string|null, date: string|null, student_name: string, section: string|null, items: list<array{quantity: int, item: string, unit_price_centavos: int, amount_centavos: int}>, total_centavos: int, status: string, status_label: string, pick_up_by: string, released_on: string|null, issued_by: string|null, qr_svg: string|null}
     */
    public static function of(Order $order): array
    {
        return [
            'school' => self::SCHOOL,
            'address_lines' => self::ADDRESS_LINES,
            'order_id' => $order->id,
            'number' => $order->number,
            'date' => $order->created_at?->toDateString(),
            'student_name' => $order->student->name,
            'section' => $order->student_section,
            'items' => array_values($order->items->map(fn (OrderItem $item): array => [
                'quantity' => $item->quantity,
                'item' => self::itemName($item),
                'unit_price_centavos' => $item->unit_price_centavos,
                'amount_centavos' => $item->line_total_centavos,
            ])->all()),
            'total_centavos' => $order->total_centavos,
            'status' => $order->status->value,
            'status_label' => $order->status->label(),
            'pick_up_by' => $order->pick_up_by->toDateString(),
            'released_on' => $order->picked_up_at?->toDateString(),
            'issued_by' => $order->picked_up_at !== null ? $order->handler?->name : null,
            'qr_svg' => $order->slip_code === null ? null : self::qrSvg($order->slip_code),
        ];
    }

    /**
     * The QR as an SVG picture of the slip code, without the XML header so
     * it can be placed straight into a page.
     */
    public static function qrSvg(string $code): string
    {
        $svg = (new Writer(new ImageRenderer(
            new RendererStyle(240, 1, null, null, Fill::uniformColor(new Rgb(255, 255, 255), new Rgb(15, 23, 42))),
            new SvgImageBackEnd,
        )))->writeString($code);

        return trim(substr($svg, (int) strpos($svg, "\n") + 1));
    }

    /**
     * "STI Hoodie (M)", "STI Ballpen · Box of 12".
     */
    private static function itemName(OrderItem $item): string
    {
        $name = $item->product_name.($item->variant_label ? " ({$item->variant_label})" : '');

        return $item->pieces_per_unit > 1 ? "{$name} · {$item->unit_name} of {$item->pieces_per_unit}" : $name;
    }
}
