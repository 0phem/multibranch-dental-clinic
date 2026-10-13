@extends('emails.layout', ['subject' => 'Your invitation to Dr. Dana E. Roxas Dental Clinic'])

@section('content')
    <h2>You have been invited</h2>
    <p>Hello {{ $name }},</p>
    <p>The clinic Owner has invited you to sign in to the Dr. Dana E. Roxas Dental Clinic system as <strong>{{ $role }}</strong>. Open the link below to choose your password. The link works once.</p>
    <p><a href="{{ $link }}">Set your password</a></p>
    <div class="card">
        <div class="detail-row">
            <span class="detail-label">Link valid for</span>
            <span class="detail-value">{{ $expireHours }} hours</span>
        </div>
    </div>
    <p style="font-size: 13px; color: #64748b; margin-top: 16px;">If you did not expect this invitation, ignore this email. The clinic will never ask you for your password.</p>
@endsection
