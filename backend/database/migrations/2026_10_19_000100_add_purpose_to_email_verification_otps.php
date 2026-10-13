<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// M1 one-time codes beyond registration: the same hashed, single-use, 10-minute code now also serves password reset and
// account email change. Existing rows are registration codes (the default). `new_email` is the address an email-change
// code was sent to (the code proves control of it); it is empty for every other purpose.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('email_verification_otps', function (Blueprint $table) {
            $table->string('purpose', 30)->default('email_verification');
            $table->string('new_email', 255)->nullable();
            $table->index(['user_id', 'purpose', 'consumed_at']);
        });
        DB::statement("ALTER TABLE email_verification_otps ADD CONSTRAINT email_verification_otps_purpose_check CHECK (purpose IN ('email_verification','password_reset','email_change'))");
        DB::statement("ALTER TABLE email_verification_otps ADD CONSTRAINT email_verification_otps_new_email_check CHECK ((purpose = 'email_change') = (new_email IS NOT NULL))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE email_verification_otps DROP CONSTRAINT IF EXISTS email_verification_otps_new_email_check');
        DB::statement('ALTER TABLE email_verification_otps DROP CONSTRAINT IF EXISTS email_verification_otps_purpose_check');
        Schema::table('email_verification_otps', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'purpose', 'consumed_at']);
            $table->dropColumn(['purpose', 'new_email']);
        });
    }
};
