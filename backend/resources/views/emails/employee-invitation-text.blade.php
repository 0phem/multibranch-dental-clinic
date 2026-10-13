@extends('emails.layout-text', ['reason' => 'You received this because the clinic Owner invited this address to a '.$role.' account.'])

@section('content')
You're invited to the clinic system

Hi {{ $name }},

The clinic Owner has created a {{ $role }} account for you at {{ $clinic }}. Choose your password to activate it. The link works once and expires in {{ $expireHours }} hours.

Set your password: {{ $link }}

If you did not expect this invitation, ignore this email. Nobody can use the account until a password is set through this link.
@endsection
