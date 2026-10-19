<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Account claims (security follow-up).
 *  users.pending_claim        an account made by a claim that is not verified yet: it can be activated ONLY through
 *                             /api/account/claim/verify (the sign-up verification and resend refuse it).
 *  email_verification_otps    a separate purpose 'account_claim' for claim codes.
 *  account_claim_invites      a one-time claim link issued by staff (after checking the ID in person, with the email they
 *                             confirmed with the patient) or by a guardian for a dependent of 18+. Only the token's hash is
 *                             stored; single use; expires (Owner setting, default 24 hours).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->boolean('pending_claim')->default(false));
        DB::statement('ALTER TABLE email_verification_otps DROP CONSTRAINT email_verification_otps_purpose_check');
        DB::statement("ALTER TABLE email_verification_otps ADD CONSTRAINT email_verification_otps_purpose_check CHECK (purpose IN ('email_verification','password_reset','email_change','account_claim'))");
        Schema::create('account_claim_invites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained('patients')->restrictOnDelete();
            $table->string('email', 255);
            $table->char('token_hash', 64)->unique();
            $table->string('issued_by_kind', 10);
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('expires_at');
            $table->timestampTz('used_at')->nullable();
            $table->timestampTz('created_at')->default(DB::raw('now()'));
            $table->index(['patient_id', 'used_at']);
        });
        DB::statement("ALTER TABLE account_claim_invites ADD CONSTRAINT account_claim_invites_kind_check CHECK (issued_by_kind IN ('staff','guardian'))");
        DB::table('automation_settings')->where('key', 'intake')->update(['settings' => DB::raw("settings || '{\"claim_link_hours\": 24}'::jsonb")]);
    }

    public function down(): void
    {
        Schema::dropIfExists('account_claim_invites');
        DB::statement('ALTER TABLE email_verification_otps DROP CONSTRAINT email_verification_otps_purpose_check');
        DB::statement("ALTER TABLE email_verification_otps ADD CONSTRAINT email_verification_otps_purpose_check CHECK (purpose IN ('email_verification','password_reset','email_change'))");
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('pending_claim'));
    }
};
