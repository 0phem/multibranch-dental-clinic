@extends('emails.layout', ['subject' => 'SMTP Diagnostic Test - '.\App\Support\Brand::name(), 'preheader' => 'Mail settings diagnostic message.', 'reason' => 'You received this because someone ran the clinic mail diagnostic.'])

@section('content')
    @include('emails.partials.heading', ['eyebrow' => 'Diagnostic', 'text' => 'Mail settings test'])
    <p style="margin:0 0 18px;">This is a diagnostic test email. Receiving it shows that this message reached your inbox; it does not confirm delivery of any other email.</p>
    @include('emails.partials.details', ['rows' => [
        ['Mail driver', config('mail.default')],
        ['Sender address', config('mail.from.address')],
        ['Sent at', \App\Support\ClinicClock::now()->format('F j, Y g:i:s A').' (Philippine time)'],
    ]])
    <p class="t-muted" style="margin:0 0 8px; font-size:14px; color:#5b6b7f;">Other clinic emails use the same mail settings.</p>
@endsection
