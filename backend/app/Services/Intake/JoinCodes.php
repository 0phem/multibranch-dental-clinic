<?php

namespace App\Services\Intake;

use App\Models\Branch;
use App\Models\BranchJoinCode;
use App\Models\User;
use App\Services\Audit\AuditService;
use App\Support\ClinicClock;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * The code on the front-desk screen for joining today's queue at a branch. It is valid only on the clinic date it was made for
 * (Asia/Manila), so it expires at midnight by itself, and staff can refresh it at any time (the old one stops working). A
 * patient must type what they see at the counter, so nobody can join the queue from home.
 */
final class JoinCodes
{
    private const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L

    public static function current(Branch $branch): BranchJoinCode
    {
        $today = ClinicClock::today();
        $row = BranchJoinCode::where('branch_id', $branch->id)->where('clinic_date', $today)->where('active', true)->first();
        if ($row) return $row;
        try {
            return BranchJoinCode::create(['branch_id' => $branch->id, 'clinic_date' => $today, 'code' => self::generate(), 'active' => true]);
        } catch (QueryException $e) {
            if ($e->getCode() !== '23505') throw $e; // another request created today's code first

            return BranchJoinCode::where('branch_id', $branch->id)->where('clinic_date', $today)->where('active', true)->firstOrFail();
        }
    }

    public static function refresh(Branch $branch, User $actor): BranchJoinCode
    {
        $row = DB::transaction(function () use ($branch, $actor) {
            BranchJoinCode::where('branch_id', $branch->id)->where('active', true)->update(['active' => false, 'updated_at' => now()->toIso8601String()]);

            return BranchJoinCode::create(['branch_id' => $branch->id, 'clinic_date' => ClinicClock::today(), 'code' => self::generate(), 'active' => true, 'created_by_user_id' => $actor->id]);
        });
        app(AuditService::class)->recordAdministrative('intake.join_code_refreshed', $actor, $branch, []);

        return $row;
    }

    /** True only for the branch's active code of TODAY (case and spaces ignored). */
    public static function valid(Branch $branch, ?string $code): bool
    {
        $code = strtoupper(preg_replace('/\s+/', '', (string) $code));
        if ($code === '') return false;
        $row = BranchJoinCode::where('branch_id', $branch->id)->where('clinic_date', ClinicClock::today())->where('active', true)->first();

        return $row !== null && hash_equals($row->code, $code);
    }

    private static function generate(): string
    {
        $out = '';
        for ($i = 0; $i < 6; $i++) $out .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];

        return $out;
    }
}
