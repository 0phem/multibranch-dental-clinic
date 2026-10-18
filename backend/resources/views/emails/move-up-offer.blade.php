@extends('emails.v2.layout', [
    'subject' => $subjectLine, 'branch' => $appointment->branch,
    'preheader' => 'An earlier time on '.$newStart->format('M j').' at '.$newStart->format('g:i A').'. First to accept gets it.',
    'reason' => 'You received this because you have an appointment later that day at '.\App\Support\Brand::name().' and an earlier time opened.',
])

@section('content')
    @include('emails.partials-test-banner')
    <p style="margin:0 0 14px;">@include('emails.v2.partials.badge', ['tone' => 'paid', 'text' => 'Earlier time'])</p>
    @include('emails.v2.partials.heading', ['text' => 'An earlier time is available'])
    <p style="margin:0 0 4px;">Hi {{ $firstName }},</p>
    @include('emails.v2.partials.message', ['paragraphs' => $paragraphs])
    @include('emails.v2.partials.details', ['title' => 'Your choice', 'rows' => [
        ['Earlier time', $newStart->format('l, F j').' at '.$newStart->format('g:i A')],
        ['Your current time', $oldStart->format('l, F j').' at '.$oldStart->format('g:i A')],
        ['Clinic branch', $appointment->branch?->name],
        ['Reference', $appointment->appointment_code],
    ]])
    @include('emails.v2.partials.button', ['url' => $acceptUrl, 'label' => 'Take the earlier time'])
    <p class="t-muted" style="margin:0 0 8px; font-size:14px; line-height:21px; color:#5b6b7f;">The button asks you to confirm first. If another patient accepts first, your appointment stays as it is.</p>
@endsection
