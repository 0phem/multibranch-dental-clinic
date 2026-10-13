@extends('emails.layout', ['subject' => $subjectLine, 'preheader' => 'A message is waiting for you in your patient portal.', 'reason' => 'You received this because the clinic sent you a message while you were not signed in. You get at most one of these emails per conversation every few minutes.'])

@section('content')
    @include('emails.partials.heading', ['eyebrow' => 'Patient portal', 'text' => 'You have a new message'])
    <p style="margin:0 0 12px;">Hi {{ $name }},</p>
    <p style="margin:0 0 12px;">The {{ $clinic }} team sent you a message in your patient portal. Sign in to read it and reply.</p>
    @include('emails.partials.button', ['url' => $link, 'label' => 'Sign in to read it'])
    @include('emails.partials.callout', ['tone' => 'info', 'text' => 'For your privacy, messages are never included in email.'])
@endsection
