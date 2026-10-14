@extends('emails.layout-text', ['reason' => $reason])

@section('content')
{!! $heading !!}

Hi {!! $name !!},

{!! $intro !!}

Your verification code: {!! $code !!}
It expires in {!! $minutes !!} minutes and works once.

Never share this code with anyone, including clinic staff. We will never call or message you to ask for it.

{!! $ignore !!}
@endsection
