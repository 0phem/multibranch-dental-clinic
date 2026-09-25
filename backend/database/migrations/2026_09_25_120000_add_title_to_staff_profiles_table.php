<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Bugfix discovered during real-browser Phase 2A QA: reusing the linked User's `title` column (as the
// original Phase 2A plan proposed) only works for the 1 of 5 staff roster members with a real backend
// User account (s1) — the other 4 (including the one actual Dental Assistant, s3) have no linked User at
// all (by design — see StaffProfileSeeder), so their job title/staffType was silently falling back to a
// generic 'Staff' string. This broke a real, previously-working feature: the dentist-edit Assistant
// dropdown filters by staffType==='Dental Assistant' and was left with nothing to show. Storing the title
// directly on staff_profiles — independent of whether a linked User exists — fixes this without depending
// on identity/account data the profile may not have.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('staff_profiles', function (Blueprint $table) {
            $table->string('title')->nullable()->after('legacy_user_ref');
        });
    }

    public function down(): void
    {
        Schema::table('staff_profiles', function (Blueprint $table) {
            $table->dropColumn('title');
        });
    }
};
