@extends('emails.v2.layout', ['subject' => $subjectLine, 'preheader' => 'You have been invited to join the '.$clinic.' team. Accept to choose your password.', 'reason' => 'You received this because the clinic Owner invited this address to a '.$role.' account.'])

@section('content')
    @include('emails.v2.partials.heading', ['eyebrow' => 'Team invitation', 'text' => 'You’re invited to join the team'])
    <p style="margin:0 0 12px;">Hi {{ $name }},</p>
    <p style="margin:0 0 12px;">The clinic Owner has created a <strong>{{ $role }}</strong> account for you at {{ $clinic }}. Accept the invitation to choose your password and activate it.</p>
    @include('emails.v2.partials.details', ['rows' => [['Role', $role], ['Link valid for', $expireHours.' hours, one use']]])
    @include('emails.v2.partials.button', ['url' => $link, 'label' => 'Accept invitation'])
    @include('emails.v2.partials.callout', ['tone' => 'info', 'text' => 'If you did not expect this invitation, ignore this email. Nobody can use the account until a password is set through this link.'])
@endsection
