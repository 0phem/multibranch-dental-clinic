<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * F8 HMO information only (R2-16), no claims and no coverage calculation. The Owner keeps an "Accepted HMOs" list per branch
 * (branch_id NULL = every branch); only rows the clinic verified are shown to patients (landing page, FAQ, assistant). The list
 * the clinic sent contains web-citation markers, so it is loaded unverified for the Owner to confirm. A Patient may add an
 * HMO provider and member number to their own profile for the front desk to check at the visit (the number is encrypted).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accepted_hmos', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->restrictOnDelete();
            $table->string('name', 120);
            $table->string('note', 200)->nullable();
            $table->boolean('verified_by_clinic')->default(false);
            $table->foreignId('verified_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('verified_at')->nullable();
            $table->boolean('active')->default(true);
            $table->unsignedInteger('revision')->default(1);
            $table->foreignId('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();
        });
        DB::statement('ALTER TABLE accepted_hmos ADD CONSTRAINT accepted_hmos_verified_check CHECK (verified_by_clinic = (verified_at IS NOT NULL))');
        DB::statement('CREATE UNIQUE INDEX accepted_hmos_one_name ON accepted_hmos (COALESCE(branch_id, 0), lower(name))');
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION accepted_hmos_no_delete() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'accepted_hmos rows are never deleted; switch the row off instead';
            END;
            $$ LANGUAGE plpgsql;
            CREATE TRIGGER accepted_hmos_no_delete BEFORE DELETE ON accepted_hmos
                FOR EACH ROW EXECUTE FUNCTION accepted_hmos_no_delete();
        SQL);
        Schema::table('patients', function (Blueprint $table) {
            $table->string('hmo_provider_name', 120)->nullable();
            $table->text('hmo_member_number')->nullable(); // encrypted cast
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accepted_hmos');
        DB::unprepared('DROP FUNCTION IF EXISTS accepted_hmos_no_delete();');
        Schema::table('patients', fn (Blueprint $table) => $table->dropColumn(['hmo_provider_name', 'hmo_member_number']));
    }
};
