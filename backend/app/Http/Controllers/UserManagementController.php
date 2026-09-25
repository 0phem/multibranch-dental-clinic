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
            return User::create([
                'person_id' => $person->id,
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
                'role' => Role::Patient,
                'account_status' => 'Active',
            ])->load('person');
        });

        return new UserAccountResource($user);
    }

    public function update(UpdateUserRequest $request, User $user): UserAccountResource
    {
        $data = $request->validated();
        DB::transaction(function () use ($data, $user) {
            $personData = array_intersect_key($data, array_flip(['first_name', 'last_name', 'phone']));
            if (array_key_exists('email', $data)) {
                $personData['email'] = $data['email'];
                $user->email = $data['email'];
            }
            if ($personData) $user->person()->update($personData);
            if ($user->isDirty()) $user->save();
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
        $user->delete();
        return response()->noContent();
    }

    private function nextPatientCode(): string
    {
        return 'PAT-'.str_pad((string) (Patient::count() + 1), 4, '0', STR_PAD_LEFT);
    }
}
