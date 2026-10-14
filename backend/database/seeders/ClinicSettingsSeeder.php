<?php

namespace Database\Seeders;

use App\Models\ClinicSetting;
use App\Support\ClinicSettings;
use Illuminate\Database\Seeder;

/**
 * White-label settings (decision 12): stores the clinic's identity, contact details, design and colours from config/clinic.php
 * as editable settings, so the Owner sees and changes them in the settings screen. Only missing settings are written; anything the
 * Owner already changed is left as it is. Safe in production (it writes the clinic's own defaults, no demo data).
 */
class ClinicSettingsSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = array_intersect_key((array) config('clinic.brand'), array_flip(array_diff(ClinicSettings::KEYS, ['logo', 'sender_name'])));
        $written = 0;
        foreach ($defaults as $key => $value) {
            if (! is_string($value) || trim($value) === '' || ClinicSetting::whereKey($key)->exists()) continue;
            ClinicSetting::create(['key' => $key, 'value' => trim($value), 'updated_at' => now()]);
            $written++;
        }
        ClinicSettings::current()->flush();
        $this->command?->info("Clinic settings: {$written} default value(s) stored; existing settings unchanged.");
    }
}
