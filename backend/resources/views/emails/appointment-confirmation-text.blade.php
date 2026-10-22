@php($start = \App\Support\ClinicClock::local($appointment->starts_at))
@extends('emails.layout-text', ['branch' => $appointment->branch, 'reason' => 'You received this because an appointment was booked for your account at '.\App\Support\Brand::name().'.'])

@section('content')
Your appointment is confirmed

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

@if ($appointment->booking_payment_status === 'paid' && (float) ($appointment->booking_fee_php ?? 0) > 0)
Booking Payment & Deposit Receipt:
Receipt number: DEP-{!! $appointment->appointment_code !!}
Deposit paid: {!! \App\Support\Brand::money($appointment->booking_fee_php) !!}
Payment method: {!! $appointment->booking_payment_method ?: 'PayMongo (Online)' !!}
Payment reference: {!! $appointment->booking_payment_ref !!}
Payment status: Paid (Credited toward treatment)
A PDF copy of your Booking Deposit Receipt is attached.
@endif

View in your patient portal: {!! \App\Support\Brand::forEmail()['portal_url'] !!}
Need to reschedule? Manage your appointment in your patient portal or call your clinic branch.
@if ($policy = \App\Services\Automations\AttendancePolicy::summary()){!! $policy !!}
@endif
@endsection
