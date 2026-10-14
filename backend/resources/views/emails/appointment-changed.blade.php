@php($start = \App\Support\ClinicClock::local($appointment->starts_at))
@php($cancelled = $change === 'cancelled')
@extends('emails.v2.layout', [
    'subject' => ($cancelled ? 'Appointment Cancelled' : 'Appointment Rescheduled').' - '.$appointment->appointment_code, 'branch' => $appointment->branch,
    'preheader' => $cancelled ? 'Your appointment on '.$start->format('F j, Y').' was cancelled.' : 'Your appointment moved to '.$start->format('F j, Y').' at '.$start->format('g:i A').'.',
    'reason' => 'You received this because an appointment on your account at '.\App\Support\Brand::name().' changed.',
])

@section('content')
    <p style="margin:0 0 14px;">@include('emails.v2.partials.badge', $cancelled ? ['tone' => 'due', 'text' => 'Cancelled'] : ['tone' => 'info', 'text' => 'Rescheduled'])</p>
    @include('emails.v2.partials.heading', ['text' => $cancelled ? 'Your appointment was cancelled' : 'Your appointment was moved'])
    <p style="margin:0 0 4px;">Hi {{ $appointment->patient?->person?->first_name ?? 'there' }},</p>
    <p style="margin:0 0 18px;">{{ $cancelled ? 'The appointment below has been cancelled.' : 'Your appointment has a new date and time. These are the new details.' }}</p>
    @include('emails.v2.partials.details', ['title' => 'Appointment details', 'rows' => [
        ['Reference', $appointment->appointment_code],
        ['Clinic branch', $appointment->branch?->name],
        ['Date', $start->format('F j, Y (l)')],
        ['Time', $start->format('g:i A')],
        ['Dentist', $appointment->dentist?->person ? 'Dr. '.$appointment->dentist->person->first_name.' '.$appointment->dentist->person->last_name : null],
        ['Service', $appointment->service?->name],
        ['Status', $appointment->status],
    ]])
    @include('emails.v2.partials.button', ['url' => \App\Support\Brand::forEmail()['portal_url'], 'label' => 'View in your patient portal'])
    @include('emails.v2.partials.callout', ['tone' => 'info', 'text' => 'If this change is unexpected, contact your clinic branch.'])
@endsection
