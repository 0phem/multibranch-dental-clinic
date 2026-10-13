@extends('emails.layout', ['subject' => $subjectLine, 'preheader' => $preheader, 'reason' => $reason])

@section('content')
    @include('emails.partials.heading', ['eyebrow' => $eyebrow, 'text' => $heading])
    <p style="margin:0 0 12px;">Hi {{ $name }},</p>
    <p style="margin:0 0 4px;">{{ $intro }}</p>
    @include('emails.partials.code', ['code' => $code, 'minutes' => $minutes])
    @include('emails.partials.callout', ['tone' => 'info', 'text' => 'Never share this code with anyone, including clinic staff. We will never call or message you to ask for it.'])
    <p class="t-muted" style="margin:0 0 8px; font-size:14px; line-height:21px; color:#5b6b7f;">{{ $ignore }}</p>
@endsection
