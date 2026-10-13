@extends('emails.layout', ['subject' => $subjectLine, 'preheader' => 'Choose your password to start using the clinic system.', 'reason' => 'You received this because the clinic Owner invited this address to a '.$role.' account.'])

@section('content')
    @include('emails.partials.heading', ['text' => 'You’re invited to the clinic system'])
    <p style="margin:0 0 12px;">Hi {{ $name }},</p>
    <p style="margin:0 0 12px;">The clinic Owner has created a <strong>{{ $role }}</strong> account for you at {{ $clinic }}. Choose your password to activate it. The link works once and expires in {{ $expireHours }} hours.</p>
    @include('emails.partials.button', ['url' => $link, 'label' => 'Set your password'])
    @include('emails.partials.callout', ['tone' => 'info', 'text' => 'If you did not expect this invitation, ignore this email. Nobody can use the account until a password is set through this link.'])
@endsection
