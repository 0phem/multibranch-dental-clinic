@extends('emails.layout', ['subject' => 'Verify your Dr. Dana E. Roxas Dental Clinic account'])

@section('content')
    <h2>Account Verification Code</h2>
    <p>Hello,</p>
    <p>Thank you for registering with Dr. Dana E. Roxas Dental Clinic. Please use the one-time verification code below to activate your patient account and access your care portal:</p>
    
    <div class="otp-code">
        {{ $code }}
    </div>

    <div class="card">
        <div class="detail-row">
            <span class="detail-label">Code Validity</span>
            <span class="detail-value">10 minutes</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Single Use</span>
            <span class="detail-value">Yes</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Security Notice</span>
            <span class="detail-value">Never share this code with anyone</span>
        </div>
    </div>

    <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
        If you did not request this verification code or create an account, no action is required and you can safely ignore this email.
    </p>
@endsection
