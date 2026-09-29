<?php

namespace App\Services\Treatments;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

// M5 cutover safety (decision Q-T8). Browser Treatment content is never uploaded and no empty server Treatment shell is
// fabricated, so the cutover may only run while NO Visit is In Treatment: such a Visit would be left without its clinical
// record. `blockers()` lists the Visits that stop the cutover (In Treatment with no server Treatment); the migration
// refuses to run while any exist, and `php artisan treatments:cutover-check` reports them before deployment.
final class TreatmentCutover
{
    /** @return list<array{visit:string,clinic_date:string,branch:?string}> */
    public static function blockers(): array
    {
        if (! Schema::hasTable('visits')) {
            return [];
        }
        $query = DB::table('visits')->leftJoin('branches', 'branches.id', '=', 'visits.branch_id')
            ->where('visits.status', 'In Treatment')
            ->select('visits.public_id', 'visits.clinic_date', 'branches.name as branch')
            ->orderBy('visits.id');
        if (Schema::hasTable('treatments')) {
            $query->whereNotExists(fn ($q) => $q->selectRaw('1')->from('treatments')->whereColumn('treatments.visit_id', 'visits.id'));
        }

        return $query->get()->map(fn ($row) => [
            'visit' => $row->public_id, 'clinic_date' => (string) $row->clinic_date, 'branch' => $row->branch,
        ])->all();
    }

    public static function assertReady(): void
    {
        $blockers = self::blockers();
        if ($blockers) {
            throw new RuntimeException(self::describe($blockers));
        }
    }

    /** @param list<array{visit:string,clinic_date:string,branch:?string}> $blockers */
    public static function describe(array $blockers): string
    {
        $lines = array_map(fn ($b) => "  - Visit {$b['visit']} ({$b['clinic_date']}, ".($b['branch'] ?? 'unknown branch').')', $blockers);

        return 'M5 Treatment cutover blocked: '.count($blockers)." Visit(s) are In Treatment without a server Treatment.\n"
            .implode("\n", $lines)
            ."\nFinish or resolve these encounters with the clinic and deploy outside active clinical treatment. No Treatment is fabricated.";
    }
}
