@extends('emails.v2.layout', [
    'subject' => $subjectLine, 'branch' => $appointment->branch,
    'preheader' => 'Choose a new time that suits you.',
    'reason' => 'You received this because an appointment booked for your account at '.\App\Support\Brand::name().' was missed.',
])

@section('content')
    @include('emails.partials-test-banner')
    @include('emails.v2.partials.heading', ['text' => 'We missed you'])
    <p style="margin:0 0 4px;">Hi {{ $firstName }},</p>
    @include('emails.v2.partials.message', ['paragraphs' => $paragraphs])
    @include('emails.v2.partials.button', ['url' => $bookUrl, 'label' => 'Book a new time'])
    <p class="t-muted" style="margin:0 0 8px; font-size:14px; line-height:21px; color:#5b6b7f;">If this is a mistake, please call the branch and we’ll sort it out.</p>
@endsection
