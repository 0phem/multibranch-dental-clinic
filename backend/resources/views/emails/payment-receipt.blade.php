@extends('emails.v2.layout', [
    'subject' => $subjectLine, 'branch' => $branch,
    'preheader' => 'Thank you! We received '.$amount.' for invoice '.$invoice->invoice_number.'. Your PDF receipt is attached.',
    'reason' => 'You received this because a payment was recorded for your account at '.\App\Support\Brand::name().'.',
])

@section('content')
    <p style="margin:0 0 16px;">@include('emails.v2.partials.badge', ['tone' => 'paid', 'text' => 'Paid'])</p>
    @include('emails.v2.partials.heading', ['text' => 'Payment Receipt'])
    <p style="margin:0 0 4px;">Hi {{ $firstName }},</p>
    <p style="margin:0;">Thank you for your payment. Here is your receipt for invoice <strong>{{ $invoice->invoice_number }}</strong>.</p>

    @include('emails.v2.partials.amount', ['label' => 'Amount paid', 'amount' => $amount, 'note' => $paidAt])

    @include('emails.v2.partials.details', ['title' => 'Receipt details', 'rows' => [
        ['Receipt number', $receipt->receipt_number],
        ['Invoice number', $invoice->invoice_number],
        ['Clinic branch', $branch?->name],
        ['Payment date', $paidAt],
        ['Payment method', $method],
        ['Reference', $referenceShort],
        ['Balance remaining', $balance],
    ]])

    @if ($invoice->lines->isNotEmpty())
        @include('emails.v2.partials.items', ['invoice' => $invoice])
    @endif

    @include('emails.v2.partials.callout', $settled
        ? ['tone' => 'success', 'text' => 'Fully settled. This invoice has no remaining balance.']
        : ['tone' => 'warning', 'text' => 'Balance remaining: '.$balance.'.'])

    @if ($bir)
        @include('emails.v2.partials.details', ['title' => 'Business registration', 'rows' => collect($bir)->map(fn ($v, $k) => [$k, $v])->values()->all()])
    @endif

    <p class="t-muted" style="margin:6px 0 0; font-size:15px; line-height:22px; color:#5b6b7f;">&#128206;&nbsp; A PDF copy of this Payment Receipt is attached for printing or saving.</p>

    @include('emails.v2.partials.next-steps', ['branch' => $branch, 'links' => [['Book your next appointment', $bookUrl], ['View your receipts', $portalUrl]]])
@endsection
