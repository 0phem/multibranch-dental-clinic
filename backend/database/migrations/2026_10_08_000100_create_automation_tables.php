<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\Uid\Ulid;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workflow_rules', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->string('rule_code', 50)->unique();
            $table->string('name', 150);
            $table->string('trigger_event', 100)->index();
            $table->json('target_domains');
            $table->text('condition_description');
            $table->text('action_description');
            $table->string('owner_domain', 50);
            $table->boolean('is_active')->default(true)->index();
            $table->boolean('is_system_protected')->default(true);
            $table->timestamps();
        });

        Schema::create('system_events', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->string('event_type', 100)->index();
            $table->string('idempotency_key', 150)->unique();
            $table->string('domain', 50)->index();
            $table->string('aggregate_type', 50)->nullable()->index();
            $table->string('aggregate_id', 100)->nullable()->index();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('payload')->nullable();
            $table->timestampTz('occurred_at')->useCurrent()->index();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::create('automated_actions', function (Blueprint $table) {
            $table->id();
            $table->char('public_id', 26)->unique();
            $table->foreignId('workflow_rule_id')->constrained('workflow_rules')->cascadeOnDelete();
            $table->foreignId('system_event_id')->nullable()->constrained('system_events')->nullOnDelete();
            $table->string('idempotency_key', 150)->unique();
            $table->string('status', 30)->index(); // Success, Warning, Failed
            $table->text('result_summary');
            $table->json('details')->nullable();
            $table->timestampTz('executed_at')->useCurrent()->index();
            $table->timestampTz('created_at')->useCurrent();
        });

        // Seed initial approved system rules
        $now = now();
        $rules = [
            [
                'rule_code' => 'R1_APPT_LIFECYCLE',
                'name' => 'Appointment created / moved / cancelled',
                'trigger_event' => 'appointment.lifecycle.changed',
                'target_domains' => json_encode(['appointment', 'notification']),
                'condition_description' => 'Valid appointment lifecycle change',
                'action_description' => 'Reserve or release slot; update calendar; notify patient',
                'owner_domain' => 'Scheduling',
                'is_active' => true,
                'is_system_protected' => true,
            ],
            [
                'rule_code' => 'R2_HMO_FOLLOWUP_REMINDER',
                'name' => 'HMO pending timer updated',
                'trigger_event' => 'hmo.pending.timer.updated',
                'target_domains' => json_encode(['hmo']),
                'condition_description' => 'Pending > 12 hours',
                'action_description' => 'Create follow-up task and notify HMO coordinator',
                'owner_domain' => 'HMO',
                'is_active' => true,
                'is_system_protected' => true,
            ],
            [
                'rule_code' => 'R3_CAPACITY_ALERT',
                'name' => 'Queue or capacity updated',
                'trigger_event' => 'patientflow.capacity.updated',
                'target_domains' => json_encode(['capacity']),
                'condition_description' => 'Estimated wait > 35 min OR branch load > threshold',
                'action_description' => 'Alert front desk/owner and show cross-branch capacity',
                'owner_domain' => 'Patient Flow',
                'is_active' => true,
                'is_system_protected' => true,
            ],
            [
                'rule_code' => 'R4_TREATMENT_DOWNSTREAM',
                'name' => 'Treatment completed',
                'trigger_event' => 'clinical.treatment.completed',
                'target_domains' => json_encode(['billing', 'prescription', 'followup']),
                'condition_description' => 'Dentist marks prescription/follow-up required',
                'action_description' => 'Create billing, prescription, or follow-up task as applicable',
                'owner_domain' => 'Clinical',
                'is_active' => true,
                'is_system_protected' => true,
            ],
            [
                'rule_code' => 'R5_MESSAGE_ROUTING',
                'name' => 'New patient message',
                'trigger_event' => 'communication.message.received',
                'target_domains' => json_encode(['messaging']),
                'condition_description' => 'Patient or inquiry matched',
                'action_description' => 'Route to responsible staff queue',
                'owner_domain' => 'Communication',
                'is_active' => true,
                'is_system_protected' => true,
            ],
            [
                'rule_code' => 'R6_USER_PROFILE_SYNC',
                'name' => 'User account created / role updated',
                'trigger_event' => 'access.user.changed',
                'target_domains' => json_encode(['personnel']),
                'condition_description' => 'Role is Dentist or clinic Staff',
                'action_description' => 'Create or synchronize linked STAFF_PROFILES record',
                'owner_domain' => 'Administration',
                'is_active' => true,
                'is_system_protected' => true,
            ],
        ];

        foreach ($rules as $rule) {
            DB::table('workflow_rules')->insert(array_merge($rule, [
                'public_id' => strtolower((string) Ulid::generate()),
                'created_at' => $now,
                'updated_at' => $now,
            ]));
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('automated_actions');
        Schema::dropIfExists('system_events');
        Schema::dropIfExists('workflow_rules');
    }
};
