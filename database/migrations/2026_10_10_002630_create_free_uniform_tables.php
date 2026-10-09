<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Free uniforms from the enrollment promo (students who enroll together
     * in a group each get one set for free):
     * - uniform_sets: what one course's set is made of: a top (blouse for
     *   female students, polo for male students) and pants, each a product;
     * - free_uniform_groups: a group of students who enrolled together;
     * - free_uniform_students: each student of a group, with the set and
     *   sizes they got. A piece not given yet (out of stock) has no stock
     *   movement: it is still to give.
     */
    public function up(): void
    {
        Schema::create('uniform_sets', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60)->unique();
            $table->foreignId('blouse_product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->foreignId('polo_product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->foreignId('pants_product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('free_uniform_groups', function (Blueprint $table) {
            $table->id();
            $table->date('enrolled_on')->index();
            $table->string('note', 200)->nullable();
            $table->foreignId('recorded_by')->constrained('users');
            $table->timestamps();
        });

        Schema::create('free_uniform_students', function (Blueprint $table) {
            $table->id();
            $table->foreignId('free_uniform_group_id')->constrained()->cascadeOnDelete();
            $table->foreignId('uniform_set_id')->constrained();
            $table->string('name', 120);
            $table->string('enrollment_form_number', 40)->unique();
            $table->string('course_section', 60)->nullable();
            $table->string('top_kind', 10);
            $table->foreignId('top_variant_id')->constrained('product_variants');
            $table->foreignId('pants_variant_id')->constrained('product_variants');
            $table->foreignId('top_movement_id')->nullable()->constrained('stock_movements')->nullOnDelete();
            $table->foreignId('pants_movement_id')->nullable()->constrained('stock_movements')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('free_uniform_students');
        Schema::dropIfExists('free_uniform_groups');
        Schema::dropIfExists('uniform_sets');
    }
};
