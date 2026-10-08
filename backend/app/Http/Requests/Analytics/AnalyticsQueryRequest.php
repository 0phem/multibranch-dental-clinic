<?php

namespace App\Http\Requests\Analytics;

use App\Models\Branch;
use App\Support\ClinicClock;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

// M21 query contract. Authorization stays with the Owner-only route middleware and controller check; this class only
// validates input so that nothing silently falls back: an unknown period, a malformed or impossible date, a one-sided
// or reversed custom range, and an unknown/numeric branch are all 422s.
class AnalyticsQueryRequest extends FormRequest
{
    public const PERIODS = ['today', 'this week', 'week', 'this month', 'month', 'this year', 'year', 'all', 'all time'];

    private ?Branch $resolvedBranch = null;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $period = $this->input('period');
        $this->merge([
            'period' => is_string($period) ? strtolower(trim($period)) : $period,
        ]);
    }

    public function rules(): array
    {
        return [
            'period' => ['sometimes', 'nullable', 'string', 'in:'.implode(',', self::PERIODS)],
            'date_from' => ['nullable', 'string', 'max:10', 'required_with:date_to'],
            'date_to' => ['nullable', 'string', 'max:10', 'required_with:date_from'],
            'branch_id' => ['nullable', 'string', 'max:64'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            foreach (['date_from', 'date_to'] as $key) {
                $value = $this->input($key);
                if (is_string($value) && $value !== '' && ! ClinicClock::validDate($value)) {
                    $v->errors()->add($key, 'Use a real calendar date in YYYY-MM-DD format.');
                }
            }
            $from = $this->input('date_from');
            $to = $this->input('date_to');
            if (! $v->errors()->hasAny(['date_from', 'date_to']) && is_string($from) && is_string($to) && $from !== '' && $to !== '' && $from > $to) {
                $v->errors()->add('date_to', 'The end date must not be before the start date.');
            }
            $ref = $this->input('branch_id');
            if (is_string($ref) && $ref !== '' && strtolower($ref) !== 'all' && ! $this->resolveBranch($ref)) {
                $v->errors()->add('branch_id', 'Choose an existing branch.');
            }
        });
    }

    /** The selected branch, or null for All Branches (absent, empty or "all"). Valid only after validation. */
    public function branch(): ?Branch
    {
        $ref = $this->input('branch_id');
        if (! is_string($ref) || $ref === '' || strtolower($ref) === 'all') {
            return null;
        }

        return $this->resolveBranch($ref);
    }

    public function period(): string
    {
        $period = $this->input('period');

        return is_string($period) && $period !== '' ? $period : 'today';
    }

    public function dateFrom(): ?string
    {
        return $this->filled('date_from') ? (string) $this->input('date_from') : null;
    }

    public function dateTo(): ?string
    {
        return $this->filled('date_to') ? (string) $this->input('date_to') : null;
    }

    // The M2 reference contract: the public ULID, or the frozen transitional legacy_ref. The internal bigint id is
    // never accepted ("12" matches neither column), and an unknown value never widens the scope.
    private function resolveBranch(string $ref): ?Branch
    {
        if ($this->resolvedBranch && ($this->resolvedBranch->legacy_ref === $ref || strtolower($this->resolvedBranch->public_id) === strtolower($ref))) {
            return $this->resolvedBranch;
        }
        $query = Str::isUlid($ref)
            ? Branch::whereRaw('lower(public_id) = ?', [strtolower($ref)])
            : Branch::where('legacy_ref', $ref);

        return $this->resolvedBranch = $query->first();
    }
}
