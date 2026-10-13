@extends('emails.layout', ['subject' => $subjectLine, 'preheader' => $preheader, 'reason' => $reason])

@section('content')
    @include('emails.partials.heading', ['text' => $heading])
    <p style="margin:0 0 12px;">Hi {{ $name }},</p>
    <p style="margin:0 0 12px;">{{ $intro }}</p>
    @include('emails.partials.code', ['code' => $code, 'minutes' => $minutes])
    @include('emails.partials.callout', ['tone' => 'info', 'text' => 'Never share this code with anyone, including clinic staff.'])
    <p style="margin:0 0 12px; font-size:14px; color:#5b6b7f;">{{ $ignore }}</p>
@endsection
