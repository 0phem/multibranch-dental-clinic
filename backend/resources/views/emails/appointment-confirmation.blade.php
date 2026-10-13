@extends('emails.layout', ['subject' => 'Appointment Confirmation - Dr. Dana E. Roxas Dental Clinic'])

@section('content')
    <h2>Appointment Confirmed</h2>
    <p>Dear {{ $appointment->patient?->person?->first_name ?? 'Valued Patient' }},</p>
    <p>Your dental appointment has been successfully scheduled and confirmed. Here are your visit details:</p>

    <div class="card">
        <div class="detail-row">
            <span class="detail-label">Appointment Reference</span>
            <span class="detail-value"><strong>{{ $appointment->appointment_code }}</strong></span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Clinic Branch</span>
            <span class="detail-value">{{ $appointment->branch?->name ?? 'Dental Clinic Branch' }}</span>
        </div>
        {{-- Clinic-local date and time of the booked slot (starts_at), never the time the email was rendered. --}}
        @php($start = \App\Support\ClinicClock::local($appointment->starts_at))
        <div class="detail-row">
            <span class="detail-label">Date</span>
            <span class="detail-value">{{ $start->format('F d, Y (l)') }}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Time</span>
            <span class="detail-value">{{ $start->format('h:i A') }}</span>
        </div>
        @if($appointment->dentist?->person)
        <div class="detail-row">
            <span class="detail-label">Attending Dentist</span>
            <span class="detail-value">Dr. {{ $appointment->dentist->person->first_name }} {{ $appointment->dentist->person->last_name }}</span>
        </div>
        @endif
        @if($appointment->service)
        <div class="detail-row">
            <span class="detail-label">Service</span>
            <span class="detail-value">{{ $appointment->service->name }}</span>
        </div>
        @endif
        <div class="detail-row">
            <span class="detail-label">Status</span>
            <span class="detail-value" style="color: #059669;">{{ $appointment->status }}</span>
        </div>
    </div>

    <p style="font-size: 13px; color: #64748b; margin-top: 20px;">
        Need to reschedule? You can manage your appointment through your online patient portal or call your clinic branch.
    </p>
@endsection
