@extends('emails.layout-text', ['reason' => 'You received this because someone ran the clinic mail diagnostic.'])

@section('content')
Mail settings test

This is a diagnostic test email. Receiving it shows that this message reached your inbox; it does not confirm delivery of any other email.

Mail driver: {{ config('mail.default') }}
Sender address: {{ config('mail.from.address') }}
Sent at: {{ \App\Support\ClinicClock::now()->format('F j, Y g:i:s A') }} (Philippine time)
@endsection
