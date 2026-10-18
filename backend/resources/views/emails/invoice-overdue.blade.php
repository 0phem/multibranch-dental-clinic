@extends('emails.v2.layout', [
    'subject' => $subjectLine, 'branch' => $branch,
    'preheader' => 'Balance '.$balance.' on invoice '.$invoice->invoice_number.'. Pay online in your patient portal.',
    'reason' => 'You received this because an invoice issued to you by '.\App\Support\Brand::name().' still has a balance.',
])

@section('content')
    @include('emails.partials-test-banner')
    <p style="margin:0 0 14px;">@include('emails.v2.partials.badge', ['tone' => 'due', 'text' => 'Payment due'])</p>
    @include('emails.v2.partials.heading', ['text' => 'A reminder about your invoice'])
    <p style="margin:0 0 4px;">Hi {{ $firstName }},</p>
    @include('emails.v2.partials.message', ['paragraphs' => $paragraphs])
    @include('emails.v2.partials.amount', ['label' => 'Balance', 'amount' => $balance, 'note' => $issuedOn ? 'Issued '.$issuedOn : null])
    @include('emails.v2.partials.details', ['title' => 'Invoice', 'rows' => [
        ['Invoice number', $invoice->invoice_number],
        ['Clinic branch', $branch?->name],
        ['Issued on', $issuedOn],
        ['Balance', $balance],
    ]])
    @include('emails.v2.partials.button', ['url' => $payUrl, 'label' => 'Pay online'])
@endsection
