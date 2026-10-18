@extends('emails.v2.layout', [
    'subject' => $subjectLine, 'branch' => $branch,
    'preheader' => 'Book your next visit at a time that suits you.',
    'reason' => 'You received this because you visited '.\App\Support\Brand::name().' and the clinic sends a check-up reminder after a while.',
])

@section('content')
    @include('emails.partials-test-banner')
    @include('emails.v2.partials.heading', ['text' => 'Time for your check-up'])
    <p style="margin:0 0 4px;">Hi {{ $firstName }},</p>
    @include('emails.v2.partials.message', ['paragraphs' => $paragraphs])
    @include('emails.v2.partials.button', ['url' => $bookUrl, 'label' => 'Book a visit'])
@endsection
