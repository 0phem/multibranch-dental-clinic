<?php

namespace App\Http\Resources;

use App\Models\Visit;

// The Patient-safe description of a Visit used by M26: its public id, clinic date and the service names recorded for it. Nothing about the
// Dentist, branch, appointment or clinical content.
final class FeedbackVisit
{
    public static function for(Visit $visit): array
    {
        $services = $visit->relationLoaded('treatment') && $visit->treatment
            ? $visit->treatment->procedures->pluck('service_name')->unique()->values()->all() : [];

        return ['id' => $visit->public_id, 'date' => $visit->clinic_date->format('Y-m-d'), 'services' => $services];
    }
}
