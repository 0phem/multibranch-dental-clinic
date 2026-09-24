<?php

namespace App\Enums;

// The four canonical top-level system roles (see AGENTS.md's four product experiences: Patient, Staff, Dentist,
// Owner/Admin). A Staff account's displayed duty-focus title (users.title, e.g. "Receptionist") is never part of
// this enum and is never consulted for authorization — see App\Http\Middleware\EnsureUserHasRole.
enum Role: string
{
    case Patient = 'patient';
    case Staff = 'staff';
    case Dentist = 'dentist';
    case Owner = 'owner';
}
