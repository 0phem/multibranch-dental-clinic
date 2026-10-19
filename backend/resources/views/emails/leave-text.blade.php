@extends('emails.layout-text', ['reason' => 'You received this because you request or approve leave at '.\App\Support\Brand::name().'. The private note is never included in email.'])

@section('content')
@if ($test)[TEST] Sent from Administration > Automations, only to you; the details may be examples.

@endif
Hi {!! $name !!},

@foreach ($paragraphs as $paragraph)
{!! $paragraph !!}

@endforeach
Sign in to the clinic system: {!! $link !!}
@endsection
