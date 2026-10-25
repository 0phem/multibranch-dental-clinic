<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * M24: Referral & Loyalty Management Foundation.
 * Implements loyalty_accounts, referrals, append-only loyalty_ledger,
 * append-only loyalty_lot_consumptions, and loyalty_lot_balances view.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Loyalty Accounts
        Schema::create('loyalty_accounts', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('patient_id')->unique()->constrained('patients')->restrictOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->restrictOnDelete();
            $table->string('referral_code', 32)->unique();
            $table->integer('current_balance')->default(0);
            $table->timestampTz('created_at')->default(DB::raw('now()'));
            $table->timestampTz('updated_at')->default(DB::raw('now()'));
        });

        DB::statement('ALTER TABLE loyalty_accounts ADD CONSTRAINT loyalty_accounts_balance_non_negative CHECK (current_balance >= 0)');

        // 2. Referrals (One Referrer to Many Referrals; Each Referee Referred At Most Once)
        Schema::create('referrals', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('referrer_patient_id')->constrained('patients')->restrictOnDelete();
            $table->foreignId('referee_patient_id')->unique()->constrained('patients')->restrictOnDelete();
            $table->string('referral_code_used', 32);
            $table->string('status', 40)->default('Pending');
            $table->foreignId('qualifying_invoice_id')->nullable()->constrained('invoices')->restrictOnDelete();
            $table->timestampTz('qualified_at')->nullable();
            $table->timestampTz('rewarded_at')->nullable();
            $table->timestampTz('created_at')->default(DB::raw('now()'));
            $table->timestampTz('updated_at')->default(DB::raw('now()'));

            $table->index('referrer_patient_id');
        });

        DB::statement('ALTER TABLE referrals ADD CONSTRAINT referrals_no_self_referral CHECK (referrer_patient_id <> referee_patient_id)');
        DB::statement("ALTER TABLE referrals ADD CONSTRAINT referrals_status_check CHECK (status IN ('Pending', 'Qualified', 'Rewarded', 'Rejected'))");

        // 3. Loyalty Ledger (Append-Only)
        Schema::create('loyalty_ledger', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('loyalty_account_id')->constrained('loyalty_accounts')->restrictOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->restrictOnDelete();
            $table->integer('points');
            $table->string('entry_type', 30);
            $table->string('reason_code', 60);
            $table->foreignId('reverses_entry_id')->nullable()->constrained('loyalty_ledger')->restrictOnDelete();
            $table->foreignId('refund_id')->nullable()->constrained('invoice_refunds')->restrictOnDelete();
            $table->foreignId('invoice_id')->nullable()->constrained('invoices')->restrictOnDelete();
            $table->foreignId('visit_id')->nullable()->constrained('visits')->restrictOnDelete();
            $table->foreignId('referral_id')->nullable()->constrained('referrals')->restrictOnDelete();
            $table->string('idempotency_key', 120)->nullable()->unique();
            $table->timestampTz('expires_at')->nullable();
            $table->integer('unrecovered_points')->default(0);
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestampTz('created_at')->default(DB::raw('now()'));

            $table->index(['loyalty_account_id', 'created_at']);
            $table->index('reverses_entry_id');
        });

        DB::statement('ALTER TABLE loyalty_ledger ADD CONSTRAINT loyalty_ledger_points_nonzero CHECK (points <> 0 OR unrecovered_points > 0)');
        DB::statement("ALTER TABLE loyalty_ledger ADD CONSTRAINT loyalty_ledger_entry_type_check CHECK (entry_type IN ('earn', 'redeem', 'reverse', 'adjust', 'expire'))");
        DB::statement('ALTER TABLE loyalty_ledger ADD CONSTRAINT loyalty_ledger_unrecovered_non_negative CHECK (unrecovered_points >= 0)');
        DB::statement('CREATE UNIQUE INDEX loyalty_ledger_refund_reversal_unique ON loyalty_ledger (refund_id, reverses_entry_id) WHERE refund_id IS NOT NULL AND reverses_entry_id IS NOT NULL');

        // Guard blocking total reversals exceeding original earn lot
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION validate_ledger_reversal() RETURNS trigger AS $$
            DECLARE
                v_original_points integer;
                v_already_reversed integer;
            BEGIN
                IF NEW.entry_type = 'reverse' AND NEW.reverses_entry_id IS NOT NULL THEN
                    SELECT points INTO v_original_points
                    FROM loyalty_ledger
                    WHERE id = NEW.reverses_entry_id AND entry_type = 'earn'
                    FOR UPDATE;

                    IF v_original_points IS NULL THEN
                        RAISE EXCEPTION 'Cannot reverse entry %: target earn lot does not exist or is not an earn entry', NEW.reverses_entry_id;
                    END IF;

                    SELECT COALESCE(SUM(ABS(points)), 0) INTO v_already_reversed
                    FROM loyalty_ledger
                    WHERE entry_type = 'reverse' AND reverses_entry_id = NEW.reverses_entry_id;

                    IF (v_already_reversed + ABS(NEW.points)) > v_original_points THEN
                        RAISE EXCEPTION 'Cannot reverse % points: original earn lot had % points, and % points have already been reversed (max reversible: %)',
                            ABS(NEW.points), v_original_points, v_already_reversed, (v_original_points - v_already_reversed);
                    END IF;
                END IF;

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER check_ledger_reversal_limit
            BEFORE INSERT ON loyalty_ledger
            FOR EACH ROW EXECUTE FUNCTION validate_ledger_reversal();
        SQL);

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION loyalty_ledger_append_only() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'loyalty_ledger is append-only: modifications and deletions are forbidden';
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER loyalty_ledger_append_only
            BEFORE UPDATE OR DELETE ON loyalty_ledger
            FOR EACH ROW EXECUTE FUNCTION loyalty_ledger_append_only();
        SQL);

        // 4. Loyalty Lot Consumptions (Append-Only FIFO Consumption Tracking)
        Schema::create('loyalty_lot_consumptions', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('redeem_entry_id')->constrained('loyalty_ledger')->restrictOnDelete();
            $table->foreignId('earn_entry_id')->constrained('loyalty_ledger')->restrictOnDelete();
            $table->integer('points');
            $table->timestampTz('created_at')->default(DB::raw('now()'));

            $table->index(['earn_entry_id', 'redeem_entry_id']);
        });

        DB::statement('ALTER TABLE loyalty_lot_consumptions ADD CONSTRAINT loyalty_lot_consumptions_points_positive CHECK (points > 0)');

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION loyalty_lot_consumptions_append_only() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'loyalty_lot_consumptions is append-only: modifications and deletions are forbidden';
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER loyalty_lot_consumptions_append_only
            BEFORE UPDATE OR DELETE ON loyalty_lot_consumptions
            FOR EACH ROW EXECUTE FUNCTION loyalty_lot_consumptions_append_only();
        SQL);

        // 5. Loyalty Lot Balances View (Subtracts Consumptions AND Reversals)
        DB::unprepared(<<<'SQL'
            CREATE VIEW loyalty_lot_balances AS
            SELECT 
                e.id AS earn_entry_id,
                e.loyalty_account_id,
                e.points AS original_points,
                COALESCE(consumptions.points_consumed, 0) AS consumed_points,
                COALESCE(reversals.points_reversed, 0) AS reversed_points,
                (e.points - COALESCE(consumptions.points_consumed, 0) - COALESCE(reversals.points_reversed, 0)) AS remaining_points,
                e.expires_at,
                e.created_at
            FROM loyalty_ledger e
            LEFT JOIN (
                SELECT earn_entry_id, SUM(points) AS points_consumed
                FROM loyalty_lot_consumptions
                GROUP BY earn_entry_id
            ) consumptions ON consumptions.earn_entry_id = e.id
            LEFT JOIN (
                SELECT reverses_entry_id, SUM(ABS(points)) AS points_reversed
                FROM loyalty_ledger
                WHERE entry_type = 'reverse' AND reverses_entry_id IS NOT NULL
                GROUP BY reverses_entry_id
            ) reversals ON reversals.reverses_entry_id = e.id
            WHERE e.entry_type = 'earn';
        SQL);

        // 6. Enforce consumption limit via trigger with exclusive row-level locking
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION validate_lot_consumption() RETURNS trigger AS $$
            DECLARE
                v_available integer;
            BEGIN
                -- Exclusively lock the parent earn lot to serialize concurrent redemptions
                PERFORM 1 FROM loyalty_ledger WHERE id = NEW.earn_entry_id FOR UPDATE;

                SELECT remaining_points INTO v_available
                FROM loyalty_lot_balances
                WHERE earn_entry_id = NEW.earn_entry_id;

                IF v_available IS NULL OR v_available < NEW.points THEN
                    RAISE EXCEPTION 'Cannot consume % points: only % points remain unconsumed/unreversed on earn lot %',
                        NEW.points, COALESCE(v_available, 0), NEW.earn_entry_id;
                END IF;

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER check_lot_consumption_limit
            BEFORE INSERT ON loyalty_lot_consumptions
            FOR EACH ROW EXECUTE FUNCTION validate_lot_consumption();
        SQL);
    }

    public function down(): void
    {
        DB::unprepared('DROP TRIGGER IF EXISTS check_lot_consumption_limit ON loyalty_lot_consumptions;');
        DB::unprepared('DROP FUNCTION IF EXISTS validate_lot_consumption();');

        DB::unprepared('DROP VIEW IF EXISTS loyalty_lot_balances;');

        DB::unprepared('DROP TRIGGER IF EXISTS loyalty_lot_consumptions_append_only ON loyalty_lot_consumptions;');
        DB::unprepared('DROP FUNCTION IF EXISTS loyalty_lot_consumptions_append_only();');
        Schema::dropIfExists('loyalty_lot_consumptions');

        DB::unprepared('DROP TRIGGER IF EXISTS check_ledger_reversal_limit ON loyalty_ledger;');
        DB::unprepared('DROP FUNCTION IF EXISTS validate_ledger_reversal();');

        DB::unprepared('DROP TRIGGER IF EXISTS loyalty_ledger_append_only ON loyalty_ledger;');
        DB::unprepared('DROP FUNCTION IF EXISTS loyalty_ledger_append_only();');
        Schema::dropIfExists('loyalty_ledger');

        Schema::dropIfExists('referrals');
        Schema::dropIfExists('loyalty_accounts');
    }
};
