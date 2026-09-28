<?php

namespace App\Services\Scheduling;

use App\Models\Branch;
use App\Models\DentistProfile;
use App\Models\Patient;
use App\Models\Service;

// One proposed appointment slot, as evaluated by SchedulingService. `patientRules` selects the Patient online
// scheduling rules (booking window + hourly start grid); Staff/Owner requests use the Staff rules.
final class SlotRequest
{
    public function __construct(
        public readonly ?Patient $patient,
        public readonly ?Branch $branch,
        public readonly ?Service $service,
        public readonly ?DentistProfile $dentist,
        public readonly mixed $date,
        public readonly mixed $startTime,
        public readonly bool $patientRules,
        public readonly ?int $ignoreAppointmentId = null,
        // An availability search may run before a Patient is chosen (Staff front desk); commands always require one.
        public readonly bool $requirePatient = true,
    ) {}

    public function withDentist(?DentistProfile $dentist): self
    {
        return new self($this->patient, $this->branch, $this->service, $dentist, $this->date, $this->startTime, $this->patientRules, $this->ignoreAppointmentId, $this->requirePatient);
    }

    public function at(string $date, string $startTime): self
    {
        return new self($this->patient, $this->branch, $this->service, $this->dentist, $date, $startTime, $this->patientRules, $this->ignoreAppointmentId, $this->requirePatient);
    }
}
