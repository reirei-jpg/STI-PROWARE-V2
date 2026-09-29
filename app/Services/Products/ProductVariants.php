<?php

namespace App\Services\Products;

/**
 * Turns a product's options into its variants: every combination of the
 * choices, e.g. Color (Blue, Black) × Capacity (22 oz, 32 oz) gives four
 * variants. A product without options has one variant with an empty
 * combination. The same rules run in the browser so the form shows the
 * variants as the Specialist types.
 */
final class ProductVariants
{
    /**
     * @param  list<array{name: string, choices: list<string>}>  $options
     * @return list<array{combination: string, choices: list<array{option: string, choice: string}>}>
     */
    public static function combinations(array $options): array
    {
        /** @var list<list<array{option: string, choice: string}>> $rows */
        $rows = [[]];

        foreach ($options as $option) {
            $next = [];

            foreach ($rows as $row) {
                foreach ($option['choices'] as $choice) {
                    $next[] = [...$row, ['option' => $option['name'], 'choice' => $choice]];
                }
            }

            $rows = $next;
        }

        return array_map(fn (array $choices): array => [
            'combination' => self::key($choices),
            'choices' => $choices,
        ], $rows);
    }

    /**
     * "Color: Blue | Capacity: 22 oz"; an empty string for no options.
     *
     * @param  list<array{option: string, choice: string}>  $choices
     */
    public static function key(array $choices): string
    {
        return implode(' | ', array_map(
            fn (array $choice): string => "{$choice['option']}: {$choice['choice']}",
            $choices,
        ));
    }
}
