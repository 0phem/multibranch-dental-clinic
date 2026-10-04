<?php

namespace App\Services\Audit;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Request as RequestFacade;
use InvalidArgumentException;

class AuditService
{
    /** Words that mark a payload key as a secret (matched as whole words of the key, never as substrings). */
    private const SENSITIVE_WORDS = [
        'password', 'passwd', 'secret', 'token', 'otp', 'pin', 'cookie', 'session', 'authorization', 'cvv', 'cvc', 'signature',
        'credential', 'credentials', 'apikey', 'bearer',
    ];

    /** Multi-word secrets, matched against the normalized key. */
    private const SENSITIVE_PHRASES = ['api_key', 'access_token', 'refresh_token', 'credit_card', 'card_number', 'private_key', 'client_secret'];

    /** Stable machine-readable event key: a lowercase domain, then dotted identifier segments (e.g. patient.profile.updated). */
    private const ACTION_PATTERN = '/^[a-z][a-z0-9_]*(\.[A-Za-z0-9_]+)+$/';

    private const MAX_PAYLOAD_BYTES = 8192;

    private const MAX_STRING = 500;

    /**
     * Core recording method. The ONLY writer of audit rows. Every column is set here from the server's own context: the actor
     * is the authenticated user (or an explicit system actor), the timestamp is the server clock, and the target is referenced
     * by its public id. Unknown categories/severities, malformed event keys and non-array metadata are refused.
     */
    public function record(array $attributes): AuditLog
    {
        $action = (string) ($attributes['action'] ?? '');
        if (! preg_match(self::ACTION_PATTERN, $action) || strlen($action) > 100) {
            throw new InvalidArgumentException("Invalid audit event key '{$action}'. Use a stable dotted key such as patient.profile.updated.");
        }
        $category = $attributes['category'] ?? 'general';
        $severity = $attributes['severity'] ?? 'info';
        if (! in_array($category, AuditLog::CATEGORIES, true) || ! in_array($severity, AuditLog::SEVERITIES, true)) {
            throw new InvalidArgumentException("Invalid audit category '{$category}' or severity '{$severity}'.");
        }
        $payload = $attributes['payload'] ?? [];
        if (! is_array($payload)) {
            throw new InvalidArgumentException('Audit metadata must be an array of safe fields.');
        }

        $actor = array_key_exists('actor', $attributes) ? $attributes['actor'] : (auth()->check() ? auth()->user() : null);
        $actorUserId = $actor instanceof User ? $actor->id : null;
        // No actor at all (for example a failed public login) is "anonymous"; automation passes its own explicit system actor.
        $actorRole = $attributes['actor_role'] ?? ($actor instanceof User ? $actor->role->value : 'anonymous');
        $actorName = $attributes['actor_name'] ?? ($actor instanceof User ? ($actor->person ? "{$actor->person->first_name} {$actor->person->last_name}" : $actor->email) : 'Anonymous');

        // The branch is the event's own context, passed by the emitter. It is never guessed from where the actor happens to
        // work (operational assignment is not event context).
        $branchId = $attributes['branch_id'] ?? null;

        $auditableType = null;
        $auditablePublicId = null;
        $target = $attributes['target'] ?? null;
        if ($target instanceof Model) {
            $auditableType = class_basename($target);
            // Public identifier only: a model without one is recorded by type alone, never by its internal bigint key.
            $auditablePublicId = $target->public_id ?? null;
        } elseif (is_string($target)) {
            $auditablePublicId = $target;
        }
        $auditableType = $attributes['auditable_type'] ?? $auditableType;
        $auditablePublicId = $attributes['auditable_public_id'] ?? $auditablePublicId;

        $log = new AuditLog;
        $log->forceFill([
            'actor_user_id' => $actorUserId,
            'actor_role' => $actorRole,
            'actor_name' => $actorName,
            'branch_id' => $branchId,
            'action' => $action,
            'category' => $category,
            'severity' => $severity,
            'auditable_type' => $auditableType,
            'auditable_public_id' => $auditablePublicId,
            'ip_address' => $attributes['ip_address'] ?? RequestFacade::ip(),
            'user_agent' => $attributes['user_agent'] ?? substr((string) RequestFacade::userAgent(), 0, 500),
            'payload' => $this->boundPayload($this->sanitizePayload($payload)),
            // created_at is deliberately NOT set here: the database assigns its own transaction time (a timestamptz DEFAULT), so the
            // authoritative event time is server-generated, cannot be supplied by a caller, and does not depend on the PHP clock,
            // the app timezone or the PostgreSQL session timezone.
        ])->save();

        return $log->refresh();
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
            // A system actor: never attributed to whichever human request happened to trigger the rule.
            'actor' => null,
            'actor_name' => $jobName ?: 'Automation Service',
            'actor_role' => 'system',
            'payload' => $payload,
        ]);
    }

    /**
     * Recursively scrubs credentials, tokens and secrets from metadata by KEY. Keys are matched as whole words (so
     * "mapping" or "footprint" are not mistaken for "pin"/"otp"). Emitters must still pass only minimal safe fields
     * (field names, states, public ids): this is a safety net, not permission to log content.
     */
    public function sanitizePayload(mixed $data): mixed
    {
        if (! is_array($data)) {
            return $data;
        }

        $cleaned = [];
        foreach ($data as $key => $val) {
            if ($this->isSensitiveKey((string) $key)) {
                $cleaned[$key] = '[REDACTED]';
            } elseif (is_array($val)) {
                $cleaned[$key] = $this->sanitizePayload($val);
            } elseif (is_string($val) && mb_strlen($val) > self::MAX_STRING) {
                $cleaned[$key] = mb_substr($val, 0, self::MAX_STRING).'…[truncated]';
            } else {
                $cleaned[$key] = $val;
            }
        }

        return $cleaned;
    }

    private function isSensitiveKey(string $key): bool
    {
        // camelCase / snake_case / kebab-case -> lowercase words
        $normalized = strtolower((string) preg_replace('/([a-z0-9])([A-Z])/', '$1_$2', $key));
        $normalized = (string) preg_replace('/[^a-z0-9]+/', '_', $normalized);
        foreach (self::SENSITIVE_PHRASES as $phrase) {
            if (str_contains($normalized, $phrase)) {
                return true;
            }
        }

        return count(array_intersect(explode('_', trim($normalized, '_')), self::SENSITIVE_WORDS)) > 0;
    }

    /** A payload larger than the bound is replaced by a marker listing its top-level keys (the event itself is still kept). */
    private function boundPayload(mixed $payload): mixed
    {
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json !== false && strlen($json) <= self::MAX_PAYLOAD_BYTES) {
            return $payload;
        }

        return ['payload_truncated' => true, 'keys' => is_array($payload) ? array_slice(array_map('strval', array_keys($payload)), 0, 20) : []];
    }
}
