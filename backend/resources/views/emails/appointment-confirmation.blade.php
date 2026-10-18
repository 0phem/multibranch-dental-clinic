@php($start = \App\Support\ClinicClock::local($appointment->starts_at))
@extends('emails.v2.layout', [
    'subject' => 'Appointment Confirmed - '.$appointment->appointment_code, 'branch' => $appointment->branch,
    'preheader' => 'Your visit on '.$start->format('F j, Y').' at '.$start->format('g:i A').' is confirmed.',
    'reason' => 'You received this because an appointment was booked for your account at '.\App\Support\Brand::name().'.',
])

@section('content')
    <p style="margin:0 0 14px;">@include('emails.v2.partials.badge', ['tone' => 'paid', 'text' => 'Confirmed'])</p>
    @include('emails.v2.partials.heading', ['text' => 'Your appointment is confirmed'])
    <p style="margin:0 0 4px;">Hi {{ $appointment->patient?->person?->first_name ?? 'there' }},</p>
    <p style="margin:0 0 18px;">Your dental appointment is booked. Here are your visit details.</p>
    {{-- Clinic-local date and time of the booked slot (starts_at), never the time the email was rendered. --}}
    @include('emails.v2.partials.amount', ['label' => 'Your visit', 'amount' => $start->format('M j, g:i A'), 'note' => $start->format('l, F j, Y')])
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
    <p class="t-muted" style="margin:0 0 8px; font-size:14px; line-height:21px; color:#5b6b7f;">Need to reschedule? Manage your appointment in your patient portal or call your clinic branch.</p>
    {{-- F4: the clinic's cancellation policy, as the Owner set it (shown only while it is switched on). --}}
    @if ($policy = \App\Services\Automations\AttendancePolicy::summary())<p class="t-muted" style="margin:0 0 8px; font-size:14px; line-height:21px; color:#5b6b7f;">{{ $policy }}</p>@endif
    @if ($appointment->status === 'Pending')<p style="margin:0 0 8px;">The front desk will confirm this booking.</p>@endif
@endsection
