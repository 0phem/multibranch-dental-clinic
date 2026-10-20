@extends('emails.layout-text', ['branch' => $branch, 'reason' => 'You received this because you visited '.\App\Support\Brand::name().' and your dentist asked to see you again.'])

@section('content')
@if ($test)[TEST] Sent from Administration > Automations, only to you; the details may be examples.

@endif
Time for your follow-up visit

Hi {!! $firstName !!},

@foreach ($paragraphs as $paragraph)
{!! $paragraph !!}

@endforeach
Book a visit: {!! $bookUrl !!}
@endsection
