<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** In-app notifications for the scheduled automations (each written only when its real event happens). */
return new class extends Migration
{
    private const BEFORE = "'appointment_booked','appointment_rescheduled','appointment_cancelled','invoice_issued','payment_received','message_received'";

    private const ADDED = "'appointment_reminder','no_show_rebook','invoice_overdue','recall_due','waitlist_opening'";

    public function up(): void
    {
        DB::statement('ALTER TABLE user_notifications DROP CONSTRAINT user_notifications_kind_check');
        DB::statement('ALTER TABLE user_notifications ADD CONSTRAINT user_notifications_kind_check CHECK (kind IN ('.self::BEFORE.','.self::ADDED.'))');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE user_notifications DROP CONSTRAINT user_notifications_kind_check');
        DB::statement('ALTER TABLE user_notifications ADD CONSTRAINT user_notifications_kind_check CHECK (kind IN ('.self::BEFORE.'))');
    }
};
