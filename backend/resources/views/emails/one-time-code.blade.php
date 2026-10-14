@extends('emails.v2.layout', ['subject' => $subjectLine, 'preheader' => $preheader, 'reason' => $reason])

@section('content')
    @include('emails.v2.partials.heading', ['eyebrow' => $eyebrow, 'text' => $heading])
    <p style="margin:0 0 6px;">Hi {{ $name }},</p>
    <p style="margin:0;">{{ $intro }} It works once.</p>
    @include('emails.v2.partials.code', ['code' => $code, 'minutes' => $minutes])
    @include('emails.v2.partials.callout', ['tone' => 'info', 'text' => 'Never share this code with anyone, including clinic staff. We will never call or message you to ask for it.'])
    <p class="t-muted" style="margin:0 0 10px; font-size:15px; line-height:23px; color:#5b6b7f;">{{ $ignore }}</p>
@endsection
