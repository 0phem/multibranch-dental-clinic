<?php

namespace Tests\Feature\Appointments;

use App\Models\Patient;
use App\Models\Person;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// The patients.public_id prerequisite: existing rows are backfilled with distinct ULIDs, the column is NOT NULL and
// UNIQUE afterwards, patient_code and the bigint id are untouched, and new Patients receive one automatically.
// PostgreSQL DDL is transactional, so the down/up cycle below runs inside RefreshDatabase's transaction.
class PatientPublicIdMigrationTest extends TestCase
{
    use RefreshDatabase;

    private function migration(): object
    {
        return require database_path('migrations/2026_09_28_000050_add_public_id_to_patients_table.php');
    }

    public function test_existing_patients_are_backfilled_with_unique_ulids(): void
    {
        $migration = $this->migration();
        $migration->down();

        $ids = [];
        foreach (['PAT-9001', 'PAT-9002', 'PAT-9003'] as $code) {
            $person = Person::factory()->create();
            $ids[$code] = DB::table('patients')->insertGetId(['person_id' => $person->id, 'patient_code' => $code, 'consent' => true, 'created_at' => now(), 'updated_at' => now()]);
        }

        $migration->up();

        $rows = DB::table('patients')->orderBy('id')->get(['id', 'patient_code', 'public_id']);
        $this->assertSame(array_values($ids), $rows->pluck('id')->all(), 'bigint ids unchanged');
        $this->assertSame(array_keys($ids), $rows->pluck('patient_code')->all(), 'patient_code unchanged');
        $this->assertCount(3, $rows->pluck('public_id')->filter()->unique());
        foreach ($rows as $row) {
            $this->assertMatchesRegularExpression('/^[0-9a-hjkmnp-tv-z]{26}$/', $row->public_id);
        }

        $column = DB::selectOne("select is_nullable from information_schema.columns where table_name = 'patients' and column_name = 'public_id'");
        $this->assertSame('NO', $column->is_nullable);
    }

    public function test_public_id_is_unique_and_filled_for_new_patients(): void
    {
        $a = Patient::create(['person_id' => Person::factory()->create()->id, 'patient_code' => 'PAT-9101', 'consent' => true]);
        $this->assertMatchesRegularExpression('/^[0-9a-hjkmnp-tv-z]{26}$/', $a->public_id);
        $this->assertIsInt($a->id, 'the primary key stays the internal bigint');

        $this->expectException(QueryException::class);
        DB::table('patients')->insert(['person_id' => Person::factory()->create()->id, 'patient_code' => 'PAT-9102', 'public_id' => $a->public_id, 'consent' => true]);
    }
}
