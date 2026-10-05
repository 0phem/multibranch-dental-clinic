<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// M16 Social Media & External Inquiry Management — server authority for manually captured pre-booking inquiries.
//   * `source` is the channel REPORTED BY STAFF (Facebook, Instagram, Website). `capture_method` is always 'staff_manual': no
//     social-platform integration, webhook or synchronization exists, and the database says so.
//   * An inquiry starts unlinked from any Patient. patient_id and appointment_id are set only by the explicit convert command
//     (an existing, non-cancelled appointment in the inquiry's branch); nothing matches or creates Patients from names/contacts.
//   * Assignment is the capturing Staff account (no routing rule exists); a technical visibility boundary, not clinic policy.
//   * Statuses mirror the existing prototype: Open -> Responded | Closed | Converted; Responded -> Closed | Converted;
//     Closed and Converted are terminal. 'Responded' only records that Staff responded outside this system — nothing is sent.
// INQUIRY_HISTORY is append-only, ENFORCED BY THE DATABASE (a BEFORE UPDATE OR DELETE trigger raises; tested through the Eloquent model,
// query builder and raw SQL). It is not tamper-proof against a database owner who drops the trigger. It is
// append-only (trigger) and stores actions/status changes only, never inquiry text.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inquiries', function (Blueprint $table) {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->string('source');
            $table->string('capture_method')->default('staff_manual');
            $table->string('contact_name', 120);
            $table->string('contact_detail', 200)->nullable();
            $table->string('topic', 500);
            $table->foreignId('branch_id')->constrained('branches')->restrictOnDelete();
            $table->foreignId('assigned_user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('created_by_user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('patient_id')->nullable()->constrained('patients')->restrictOnDelete();
            $table->foreignId('appointment_id')->nullable()->constrained('appointments')->restrictOnDelete();
            $table->string('status')->default('Open');
            $table->unsignedInteger('revision')->default(1);
            $table->timestampTz('received_at');
            $table->timestampTz('responded_at')->nullable();
            $table->timestampTz('closed_at')->nullable();
            $table->timestampTz('converted_at')->nullable();
            $table->timestampsTz();

            $table->index(['assigned_user_id', 'branch_id', 'id']);
            $table->index(['status', 'id']);
        });
        DB::statement("ALTER TABLE inquiries ADD CONSTRAINT inquiries_source_check CHECK (source IN ('Facebook','Instagram','Website'))");
        DB::statement("ALTER TABLE inquiries ADD CONSTRAINT inquiries_capture_check CHECK (capture_method = 'staff_manual')");
        DB::statement("ALTER TABLE inquiries ADD CONSTRAINT inquiries_status_check CHECK (status IN ('Open','Responded','Closed','Converted'))");
        DB::statement("ALTER TABLE inquiries ADD CONSTRAINT inquiries_converted_check CHECK ((status = 'Converted') = (appointment_id IS NOT NULL AND patient_id IS NOT NULL AND converted_at IS NOT NULL))");
        DB::statement("ALTER TABLE inquiries ADD CONSTRAINT inquiries_closed_check CHECK ((status = 'Closed') = (closed_at IS NOT NULL))");

        Schema::create('inquiry_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inquiry_id')->constrained('inquiries')->restrictOnDelete();
            $table->string('event');
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->unsignedInteger('revision');
            // RESTRICT, not SET NULL: a SET NULL would be an UPDATE of an append-only row. Deleting an account that wrote inquiry history is
            // refused; no retention/deletion policy exists (RETENTION POLICY REQUIRED), so records are preserved conservatively.
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('actor_role')->nullable();
            $table->timestampTz('occurred_at');
            $table->index(['inquiry_id', 'id']);
        });

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION inquiry_history_append_only() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'inquiry_history is append-only';
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER inquiry_history_no_update_delete
                BEFORE UPDATE OR DELETE ON inquiry_history
                FOR EACH ROW EXECUTE FUNCTION inquiry_history_append_only();

            CREATE OR REPLACE FUNCTION inquiries_guard() RETURNS trigger AS $$
            BEGIN
                IF TG_OP = 'DELETE' THEN
                    RAISE EXCEPTION 'inquiries are never deleted';
                END IF;
                IF OLD.status IN ('Closed','Converted') THEN
                    RAISE EXCEPTION 'a % inquiry is final', OLD.status;
                END IF;
                IF NEW.public_id <> OLD.public_id OR NEW.source <> OLD.source OR NEW.contact_name <> OLD.contact_name
                    OR NEW.contact_detail IS DISTINCT FROM OLD.contact_detail OR NEW.topic <> OLD.topic OR NEW.branch_id <> OLD.branch_id
                    OR NEW.assigned_user_id <> OLD.assigned_user_id OR NEW.created_by_user_id <> OLD.created_by_user_id
                    OR NEW.received_at <> OLD.received_at THEN
                    RAISE EXCEPTION 'an inquiry''s captured details are immutable';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER inquiries_guard
                BEFORE UPDATE OR DELETE ON inquiries
                FOR EACH ROW EXECUTE FUNCTION inquiries_guard();
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('inquiry_history');
        Schema::dropIfExists('inquiries');
        DB::unprepared('DROP FUNCTION IF EXISTS inquiry_history_append_only(); DROP FUNCTION IF EXISTS inquiries_guard();');
    }
};
