@extends('emails.layout', ['subject' => ($change === 'cancelled' ? 'Appointment Cancelled' : 'Appointment Rescheduled').' - Dr. Dana E. Roxas Dental Clinic'])

@section('content')
    <h2>{{ $change === 'cancelled' ? 'Appointment Cancelled' : 'Appointment Rescheduled' }}</h2>
    <p>Dear {{ $appointment->patient?->person?->first_name ?? 'Patient' }},</p>
    @if($change === 'cancelled')
        <p>Your appointment below has been cancelled.</p>
    @else
        <p>Your appointment has been moved. These are the new details:</p>
    @endif
    @php($start = \App\Support\ClinicClock::local($appointment->starts_at))
    <div class="card">
        <div class="detail-row"><span class="detail-label">Appointment Reference</span><span class="detail-value"><strong>{{ $appointment->appointment_code }}</strong></span></div>
        <div class="detail-row"><span class="detail-label">Clinic Branch</span><span class="detail-value">{{ $appointment->branch?->name }}</span></div>
        <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">{{ $start->format('F d, Y (l)') }}</span></div>
        <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">{{ $start->format('h:i A') }}</span></div>
        @if($appointment->dentist?->person)
        <div class="detail-row"><span class="detail-label">Dentist</span><span class="detail-value">Dr. {{ $appointment->dentist->person->first_name }} {{ $appointment->dentist->person->last_name }}</span></div>
        @endif
        @if($appointment->service)
        <div class="detail-row"><span class="detail-label">Service</span><span class="detail-value">{{ $appointment->service->name }}</span></div>
        @endif
        <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value">{{ $appointment->status }}</span></div>
    </div>
    <p style="font-size: 13px; color: #64748b; margin-top: 20px;">If this change is unexpected, contact your clinic branch.</p>
@endsection
