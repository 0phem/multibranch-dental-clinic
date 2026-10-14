@php($start = \App\Support\ClinicClock::local($appointment->starts_at))
@extends('emails.layout-text', ['branch' => $appointment->branch, 'reason' => 'You received this because an appointment on your account at '.\App\Support\Brand::name().' changed.'])

@section('content')
{!! $change === 'cancelled' ? 'Your appointment was cancelled' : 'Your appointment was moved' !!}

Hi {!! $appointment->patient?->person?->first_name ?? 'there' !!},

Reference: {!! $appointment->appointment_code !!}
@if ($appointment->branch)Clinic branch: {!! $appointment->branch->name !!}
@endif
Date: {!! $start->format('F j, Y (l)') !!}
Time: {!! $start->format('g:i A') !!}
@if ($appointment->dentist?->person)Dentist: Dr. {!! $appointment->dentist->person->first_name !!} {!! $appointment->dentist->person->last_name !!}
@endif
@if ($appointment->service)Service: {!! $appointment->service->name !!}
@endif
Status: {!! $appointment->status !!}

View in your patient portal: {!! \App\Support\Brand::forEmail()['portal_url'] !!}
If this change is unexpected, contact your clinic branch.
@endsection
