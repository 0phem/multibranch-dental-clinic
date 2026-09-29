<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Models\Patient;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

// Minimal M4 read foundation for Staff/Owner Patient selection (e.g. front-desk booking). Not the full M4 Patient
// record: it returns only what a person needs to pick the right Patient — public_id, patient_code, name, phone and
// date of birth — never internal bigint ids, clinical history or account data. Patients are clinic-wide records (the
// existing front-desk workflow may book any registered Patient at a branch the Staff member is authorized for), so a
// Staff member needs at least one authorization branch scope; an unscoped Staff account is refused. Patient and
// Dentist accounts have no directory (route middleware).
class PatientDirectoryController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        abort_if($user->role === Role::Staff && ! $user->branchScopes()->exists(), 403, 'Forbidden.');

        $validated = $request->validate([
            'search' => ['nullable', 'string', 'min:2', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);
        $search = isset($validated['search']) ? mb_strtolower(trim($validated['search'])) : null;

        $patients = Patient::query()->with('person')
            ->when($search, function (Builder $query, string $term) {
                $like = '%'.addcslashes($term, '%_\\').'%';
                $query->where(fn (Builder $q) => $q->whereRaw('lower(patient_code) like ?', [$like])
                    ->orWhereHas('person', fn (Builder $p) => $p->whereRaw("lower(first_name || ' ' || last_name) like ?", [$like])
                        ->orWhereRaw('lower(phone) like ?', [$like])));
            })
            ->join('persons', 'persons.id', '=', 'patients.person_id')
            ->orderBy('persons.last_name')->orderBy('persons.first_name')->orderBy('patients.id')
            ->select('patients.*')
            ->paginate($validated['per_page'] ?? 25)->withQueryString();

        return response()->json([
            'data' => $patients->getCollection()->map(fn (Patient $patient) => [
                'id' => $patient->public_id,
                'code' => $patient->patient_code,
                'name' => $patient->person?->fullName(),
                'first_name' => $patient->person?->first_name,
                'last_name' => $patient->person?->last_name,
                'phone' => $patient->person?->phone,
                'date_of_birth' => $patient->person?->date_of_birth?->toDateString(),
            ])->values(),
            'meta' => ['current_page' => $patients->currentPage(), 'last_page' => $patients->lastPage(), 'total' => $patients->total()],
        ]);
    }
}
