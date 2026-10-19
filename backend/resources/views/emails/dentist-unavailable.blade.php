@extends('emails.v2.layout', [
    'subject' => $subjectLine, 'branch' => $appointment->branch,
    'preheader' => 'Your dentist is not available at '.$start->format('g:i A').' on '.$start->format('F j').'. Please choose a new time.',
    'reason' => 'You received this because you have an appointment at '.\App\Support\Brand::name().' at a time your dentist is no longer available.',
])

@section('content')
    @include('emails.partials-test-banner')
    <p style="margin:0 0 14px;">@include('emails.v2.partials.badge', ['tone' => 'due', 'text' => 'Closed on '.$start->format('M j')])</p>
    @include('emails.v2.partials.heading', ['text' => 'Please choose a new time'])
    <p style="margin:0 0 4px;">Hi {{ $firstName }},</p>
    @include('emails.v2.partials.message', ['paragraphs' => $paragraphs])
    @include('emails.v2.partials.details', ['title' => 'Your appointment', 'rows' => [
        ['Reference', $appointment->appointment_code],
        ['Clinic branch', $appointment->branch?->name],
        ['Date', $start->format('F j, Y (l)')],
        ['Time', $start->format('g:i A')],
        ['Reason', $reason],
        ['Phone', $phone],
    ]])
    @include('emails.v2.partials.button', ['url' => $rescheduleUrl, 'label' => 'Choose a new time'])
@endsection
