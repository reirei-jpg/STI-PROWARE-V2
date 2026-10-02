<?php

use App\Services\Stock\Units;

test('a quantity is written with its unit', function (int $quantity, string $unitName, string $expected) {
    expect(Units::count($quantity, $unitName))->toBe($expected);
})->with([
    'one piece' => [1, 'Piece', '1 pc'],
    'pieces' => [450, 'Piece', '450 pcs'],
    'thousands of pieces' => [1500, 'Piece', '1,500 pcs'],
    'one pack' => [1, 'Pack', '1 Pack'],
    'packs' => [2, 'Pack', '2 Packs'],
    'boxes' => [3, 'Box', '3 Boxes'],
]);

test('a delivery shows how it becomes pieces', function (int $units, string $unitName, int $piecesPerUnit, string $expected) {
    expect(Units::conversion($units, $unitName, $piecesPerUnit))->toBe($expected);
})->with([
    'by the pack' => [2, 'Pack', 50, '2 Packs × 50 = 100 pcs'],
    'by the piece' => [20, 'Piece', 1, '20 pcs'],
]);
