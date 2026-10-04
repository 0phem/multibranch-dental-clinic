<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Http\Requests\User\StoreUserRequest;
use App\Http\Requests\User\UpdateUserRequest;
use App\Http\Resources\UserAccountResource;
use App\Models\Patient;
use App\Models\Person;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class UserManagementController extends Controller
{
    public function index()
    {
        return UserAccountResource::collection(User::query()->with('person')->orderBy('id')->get());
    }

    public function store(StoreUserRequest $request): UserAccountResource
    {
        $data = $request->validated();
        $user = DB::transaction(function () use ($data) {
            DB::statement('LOCK TABLE patients IN SHARE ROW EXCLUSIVE MODE');
            if (User::withTrashed()->where('email', $data['email'])->exists() || Person::where('email', $data['email'])->exists()) {
                throw ValidationException::withMessages(['email' => 'This email address is already registered.']);
            }
            $person = Person::create([
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
            ]);
            $patient = Patient::create([
                'person_id' => $person->id,
                'patient_code' => $this->nextPatientCode(),
                'consent' => false,
            ]);
            $user = User::create([
                'person_id' => $person->id,
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
                'role' => Role::Patient,
                'account_status' => 'Active',
            ])->load('person');
            app(\App\Services\Audit\AuditService::class)->recordAdministrative('account.provisioned', auth()->user(), $user);
            return $user;
        });

        return new UserAccountResource($user);
    }

    public function update(UpdateUserRequest $request, User $user): UserAccountResource
    {
        $data = $request->validated();
        DB::transaction(function () use ($data, $user) {
            $user = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            $personData = array_intersect_key($data, array_flip(['first_name', 'last_name', 'phone']));
            if (array_key_exists('email', $data)) {
                $personData['email'] = $data['email'];
                $user->email = $data['email'];
            }
            if ($personData) $user->person()->update($personData);
            if ($user->isDirty('email')) {
                $user->email_verified_at = null;
                \App\Models\EmailVerificationOtp::where('user_id', $user->id)->whereNull('consumed_at')->update(['consumed_at' => now()]);
                DB::table('sessions')->where('user_id', $user->id)->delete();
                $user->tokens()->delete();
            }
            // Field NAMES only: no personal value is copied into the audit payload.
            $changedFields = array_values(array_unique(array_merge(array_keys($personData), array_keys($user->getDirty()))));
            if ($user->isDirty()) $user->save();
            app(\App\Services\Audit\AuditService::class)->recordAdministrative('account.updated', auth()->user(), $user, ['fields' => $changedFields]);
        });

        return new UserAccountResource($user->fresh()->load('person'));
    }

    public function destroy(Request $request, User $user)
    {
        $actor = $request->user();
        if ($actor->is($user)) {
            throw ValidationException::withMessages(['user' => 'You cannot delete the account you are using.']);
        }
        if ($user->role === Role::Owner && User::query()->where('role', Role::Owner)->count() <= 1) {
            throw ValidationException::withMessages(['user' => 'The last Owner account cannot be deleted.']);
        }
        DB::transaction(function () use ($user, $actor) {
            // Serialize Owner deletions before checking the last remaining account.
            $owners = User::where('role', Role::Owner)->orderBy('id')->lockForUpdate()->get();
            if ($user->role === Role::Owner && $owners->count() <= 1) {
                throw ValidationException::withMessages(['user' => 'The last Owner account cannot be deleted.']);
            }
            $user->delete();
            DB::table('sessions')->where('user_id', $user->id)->delete();
            $user->tokens()->delete();
            app(\App\Services\Audit\AuditService::class)->recordAdministrative('account.disabled', $actor, $user);
        });
        return response()->noContent();
    }

    private function nextPatientCode(): string
    {
        return 'PAT-'.str_pad((string) (Patient::count() + 1), 4, '0', STR_PAD_LEFT);
    }
}
