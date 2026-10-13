@extends('emails.layout-text', ['reason' => $reason])

@section('content')
{{ $heading }}

Hi {{ $name }},

{{ $intro }}

Your code: {{ substr($code, 0, 3) }} {{ substr($code, 3) }}
It expires in {{ $minutes }} minutes and works once.

Never share this code with anyone, including clinic staff.

{{ $ignore }}
@endsection
