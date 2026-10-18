<?php

namespace App\Services\Automations;

use App\Models\Patient;
use App\Models\User;

/** Who a scheduled email may go to. Only a Patient's own active account with a verified email; never a typed or stored copy. */
final class Recipient
{
    // RFC 2606 / 6761 names that can never receive mail (the demo's fictional patients use them).
    private const RESERVED = ['/\.(test|example|invalid|localhost)$/i', '/@example\.(com|net|org)$/i'];

    /** @return array{0:?User, 1:?string} [account, skip reason] — the account is also used for in-app notifications. */
    public static function patient(?Patient $patient): array
    {
        $user = $patient?->user;
        if (! $user || $user->account_status !== 'Active' || $user->deleted_at) return [null, 'no_patient_account'];
        if (! $user->email_verified_at) return [$user, 'email_not_verified'];
        if (! self::deliverable($user->email)) return [$user, 'undeliverable_address'];

        return [$user, null];
    }

    public static function deliverable(?string $email): bool
    {
        if (! $email || ! filter_var($email, FILTER_VALIDATE_EMAIL)) return false;
        foreach (self::RESERVED as $pattern) if (preg_match($pattern, $email)) return false;

        return true;
    }
}
