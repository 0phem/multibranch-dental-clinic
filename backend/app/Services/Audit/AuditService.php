<?php

namespace App\Services\Audit;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Request as RequestFacade;

class AuditService
{
    private const SENSITIVE_KEYS = [
        'password',
        'password_confirmation',
        'token',
        'access_token',
        'refresh_token',
        'secret',
        'otp',
        'pin',
        'authorization',
        'credit_card',
        'card_number',
        'cvv',
    ];

    /**
     * Core recording method.
     */
    public function record(array $attributes): AuditLog
    {
        $actor = array_key_exists('actor', $attributes) ? $attributes['actor'] : (auth()->check() ? auth()->user() : null);

        $actorUserId = $actor instanceof User ? $actor->id : ($attributes['actor_user_id'] ?? null);
        $actorRole = $attributes['actor_role'] ?? ($actor instanceof User ? $actor->role->value : 'system');
        $actorName = $attributes['actor_name'] ?? ($actor instanceof User ? ($actor->person ? "{$actor->person->first_name} {$actor->person->last_name}" : $actor->email) : 'System');

        $branchId = $attributes['branch_id'] ?? null;
        if (! $branchId && $actor instanceof User) {
            $branchId = $actor->staffProfile?->primary_branch_id
                ?? $actor->dentistProfile?->branches()->first()?->id
                ?? null;
        }

        $auditableType = null;
        $auditablePublicId = null;
        if (isset($attributes['target'])) {
            $target = $attributes['target'];
            if ($target instanceof Model) {
                $auditableType = class_basename($target);
                $auditablePublicId = $target->public_id ?? (string) $target->getKey();
            } elseif (is_string($target)) {
                $auditablePublicId = $target;
            }
        }

        if (isset($attributes['auditable_type'])) {
            $auditableType = $attributes['auditable_type'];
        }
        if (isset($attributes['auditable_public_id'])) {
            $auditablePublicId = $attributes['auditable_public_id'];
        }

        $ipAddress = $attributes['ip_address'] ?? RequestFacade::ip();
        $userAgent = $attributes['user_agent'] ?? substr((string) RequestFacade::userAgent(), 0, 500);

        $payload = $this->sanitizePayload($attributes['payload'] ?? []);

        return AuditLog::create([
            'actor_user_id' => $actorUserId,
            'actor_role' => $actorRole,
            'actor_name' => $actorName,
            'branch_id' => $branchId,
            'action' => $attributes['action'],
            'category' => $attributes['category'] ?? 'general',
            'severity' => $attributes['severity'] ?? 'info',
            'auditable_type' => $auditableType,
            'auditable_public_id' => $auditablePublicId,
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent,
            'payload' => $payload,
            'created_at' => CarbonImmutable::now('Asia/Manila'),
        ]);
    }

    public function recordAuth(string $action, ?User $user, array $payload = [], string $severity = 'info'): AuditLog
    {
        return $this->record([
            'action' => $action,
            'category' => 'security',
            'severity' => $severity,
            'actor' => $user,
            'target' => $user,
            'payload' => $payload,
        ]);
    }

    public function recordClinical(string $action, User $actor, mixed $target = null, array $payload = []): AuditLog
    {
        return $this->record([
            'action' => $action,
            'category' => 'clinical',
            'severity' => 'info',
            'actor' => $actor,
            'target' => $target,
            'payload' => $payload,
        ]);
    }

    public function recordFinancial(string $action, User $actor, mixed $target = null, array $payload = []): AuditLog
    {
        return $this->record([
            'action' => $action,
            'category' => 'financial',
            'severity' => 'info',
            'actor' => $actor,
            'target' => $target,
            'payload' => $payload,
        ]);
    }

    public function recordAdministrative(string $action, User $actor, mixed $target = null, array $payload = []): AuditLog
    {
        return $this->record([
            'action' => $action,
            'category' => 'administrative',
            'severity' => 'info',
            'actor' => $actor,
            'target' => $target,
            'payload' => $payload,
        ]);
    }

    public function recordSecurity(string $action, ?User $actor, array $payload = [], string $severity = 'warning'): AuditLog
    {
        return $this->record([
            'action' => $action,
            'category' => 'security',
            'severity' => $severity,
            'actor' => $actor,
            'payload' => $payload,
        ]);
    }

    public function recordAutomation(string $action, ?string $jobName, array $payload = [], string $severity = 'info'): AuditLog
    {
        return $this->record([
            'action' => $action,
            'category' => 'automation',
            'severity' => $severity,
            'actor_name' => $jobName ?: 'Automation Service',
            'actor_role' => 'system',
            'payload' => $payload,
        ]);
    }

    /**
     * Recursively scrubs sensitive credentials, passwords, tokens and secrets from payload.
     */
    public function sanitizePayload(mixed $data): mixed
    {
        if (! is_array($data)) {
            return $data;
        }

        $cleaned = [];
        foreach ($data as $key => $val) {
            $lowerKey = strtolower((string) $key);
            $isSensitive = false;
            foreach (self::SENSITIVE_KEYS as $sensitive) {
                if (str_contains($lowerKey, $sensitive)) {
                    $isSensitive = true;
                    break;
                }
            }

            if ($isSensitive) {
                $cleaned[$key] = '[REDACTED]';
            } elseif (is_array($val)) {
                $cleaned[$key] = $this->sanitizePayload($val);
            } else {
                $cleaned[$key] = $val;
            }
        }

        return $cleaned;
    }
}
