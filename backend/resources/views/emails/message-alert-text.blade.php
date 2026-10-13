@extends('emails.layout-text', ['reason' => 'You received this because the clinic sent you a message while you were not signed in. You get at most one of these emails per conversation every few minutes.'])

@section('content')
You have a new message

Hi {{ $name }},

The {{ $clinic }} team sent you a message in your patient portal. Sign in to read and reply.

Sign in to read it: {{ $link }}

For your privacy, messages are never included in email.
@endsection
