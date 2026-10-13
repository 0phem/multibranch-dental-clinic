@extends('emails.layout', ['subject' => 'SMTP Diagnostic Test - Dr. Dana E. Roxas Dental Clinic'])

@section('content')
    <h2>SMTP Configuration Test</h2>
    <p>Hello Clinic Administrator,</p>
    <p>This is a diagnostic test email. Receiving it shows that this message reached your inbox; it does not confirm delivery of any other email.</p>

    <div class="card">
        <div class="detail-row">
            <span class="detail-label">Status</span>
            <span class="detail-value">Diagnostic message</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Mail Driver</span>
            <span class="detail-value">{{ config('mail.default') }}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Sender Address</span>
            <span class="detail-value">{{ config('mail.from.address') }}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Dispatched At</span>
            <span class="detail-value">{{ now()->setTimezone('Asia/Manila')->format('Y-m-d h:i:s A T') }}</span>
        </div>
    </div>

    <p style="font-size: 13px; color: #64748b; margin-top: 16px;">
        Other clinic emails use the same mail settings.
    </p>
@endsection
