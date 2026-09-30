<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// M13 pricing foundation (the minimum M11 needs): Owner-confirmed, effective-dated service prices. This is the ONLY
// authoritative price source. `services.reference_fee_php` stays reference/demo/unconfirmed data: nothing here is copied
// from it and the resolver never reads it. The migration creates no prices — every Service starts with "No confirmed
// price" until the Owner enters one (decision D5).
//
// Versions are append-only. A version applies from `effective_from` (Asia/Manila business date) until the next
// non-retracted version at the SAME level begins; levels are the base level (branch_id NULL) and each branch. `kind`
// `ended` means "no price at this level from this date" (a branch falls back to the base; the base becomes unavailable).
//
// PostgreSQL enforces:
//   - one non-retracted version per service + level + effective_from (NULL-safe: NULLS NOT DISTINCT);
//   - priced <=> amount present, and a priced amount > 0 (zero/free pricing stays blocked by P9);
//   - source is server-assigned and limited to owner_confirmed;
//   - retracted_at and retracted_by_user_id are set together;
//   - rows are never deleted, and the only permitted UPDATE is a one-time retraction (all other columns unchanged).
// The "retract only a future version" rule is a business-date check done by PricingService under a row lock.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_prices', function (Blueprint $table) {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('service_id')->constrained('services')->restrictOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->restrictOnDelete();
            $table->string('kind');
            $table->decimal('amount', 12, 2)->nullable();
            $table->date('effective_from');
            $table->string('source');
            $table->timestampTz('retracted_at')->nullable();
            $table->foreignId('retracted_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->foreignId('created_by_user_id')->constrained('users')->restrictOnDelete();
            $table->timestampTz('created_at');

            $table->index(['service_id', 'branch_id', 'effective_from']);
        });

        DB::statement("ALTER TABLE service_prices ADD CONSTRAINT service_prices_kind_check CHECK (kind IN ('priced','ended'))");
        DB::statement("ALTER TABLE service_prices ADD CONSTRAINT service_prices_amount_check CHECK ((kind = 'priced') = (amount IS NOT NULL) AND (amount IS NULL OR amount > 0))");
        DB::statement("ALTER TABLE service_prices ADD CONSTRAINT service_prices_source_check CHECK (source IN ('owner_confirmed'))");
        DB::statement('ALTER TABLE service_prices ADD CONSTRAINT service_prices_retraction_check CHECK ((retracted_at IS NULL) = (retracted_by_user_id IS NULL))');
        DB::statement('CREATE UNIQUE INDEX service_prices_one_version_per_level_date ON service_prices (service_id, branch_id, effective_from) NULLS NOT DISTINCT WHERE retracted_at IS NULL');

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION service_prices_append_only() RETURNS trigger AS $$
            BEGIN
                IF TG_OP = 'DELETE' THEN
                    RAISE EXCEPTION 'service_prices is append-only';
                END IF;
                IF OLD.retracted_at IS NOT NULL
                    OR NEW.retracted_at IS NULL
                    OR NEW.id <> OLD.id OR NEW.public_id <> OLD.public_id OR NEW.service_id <> OLD.service_id
                    OR NEW.branch_id IS DISTINCT FROM OLD.branch_id OR NEW.kind <> OLD.kind
                    OR NEW.amount IS DISTINCT FROM OLD.amount OR NEW.effective_from <> OLD.effective_from
                    OR NEW.source <> OLD.source OR NEW.created_by_user_id <> OLD.created_by_user_id
                    OR NEW.created_at <> OLD.created_at THEN
                    RAISE EXCEPTION 'a service price version is immutable; only a one-time retraction is allowed';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER service_prices_append_only
                BEFORE UPDATE OR DELETE ON service_prices
                FOR EACH ROW EXECUTE FUNCTION service_prices_append_only();
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('service_prices');
        DB::unprepared('DROP FUNCTION IF EXISTS service_prices_append_only()');
    }
};
