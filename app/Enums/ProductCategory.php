<?php

namespace App\Enums;

/**
 * A product's category, the same as on Head Office's eStore purchase orders
 * (panel revision C1, 24 Nov 2026). Required on Add / Edit Product.
 */
enum ProductCategory: string
{
    case ProwareMerchandise = 'proware_merchandise';

    case TertiaryUniform = 'tertiary_uniform';

    case ShsUniform = 'shs_uniform';

    case Marketing = 'marketing';

    public function label(): string
    {
        return match ($this) {
            self::ProwareMerchandise => 'PROWARE Merchandise',
            self::TertiaryUniform => 'Tertiary Uniform',
            self::ShsUniform => 'SHS Uniform',
            self::Marketing => 'Marketing',
        };
    }

    /**
     * The category written on an eStore purchase order ("PROWARE
     * MERCHANDISE", "PROWARE", "TERTIARY UNIFORM"…); null when unknown.
     */
    public static function fromEstore(?string $category): ?self
    {
        return match (mb_strtoupper(trim((string) $category))) {
            'PROWARE MERCHANDISE', 'PROWARE' => self::ProwareMerchandise,
            'TERTIARY UNIFORM' => self::TertiaryUniform,
            'SHS UNIFORM', 'SENIOR HIGH UNIFORM' => self::ShsUniform,
            'MARKETING' => self::Marketing,
            default => null,
        };
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $category): array => ['value' => $category->value, 'label' => $category->label()], self::cases());
    }
}
