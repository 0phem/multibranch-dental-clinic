@extends('emails.layout', [
    'subject' => $subjectLine, 'branch' => $branch,
    'preheader' => 'We received your payment of '.$amount.' for invoice '.$invoice->invoice_number.'. Your PDF receipt is attached.',
    'reason' => 'You received this because a payment was recorded for your account at '.\App\Support\Brand::name().'.',
])

@section('content')
    <p style="margin:0 0 14px;">@include('emails.partials.badge', ['tone' => 'success', 'text' => 'Paid'])</p>
    @include('emails.partials.heading', ['text' => 'Payment Receipt'])
    <p style="margin:0 0 4px;">Hi {{ $firstName }},</p>
    <p style="margin:0;">Thank you. We received your payment for invoice <strong>{{ $invoice->invoice_number }}</strong>. Here are the details for your records.</p>

    @include('emails.partials.amount', ['label' => 'Amount paid', 'amount' => $amount, 'note' => $paidAt])

    @include('emails.partials.details', ['title' => 'Receipt details', 'rows' => [
        ['Receipt number', $receipt->receipt_number],
        ['Invoice number', $invoice->invoice_number],
        ['Clinic branch', $branch?->name],
        ['Payment date', $paidAt],
        ['Payment method', $method],
        ['Reference ID', $reference, true],
        ['Balance remaining', $balance],
    ]])

    @if ($invoice->lines->isNotEmpty())
        @include('emails.partials.items', ['invoice' => $invoice])
    @endif

    @include('emails.partials.callout', $settled
        ? ['tone' => 'success', 'text' => 'Fully settled. This invoice has no remaining balance.']
        : ['tone' => 'warning', 'text' => 'Balance remaining: '.$balance.'.'])

    @if ($bir)
        @include('emails.partials.details', ['title' => 'Business registration', 'rows' => collect($bir)->map(fn ($v, $k) => [$k, $v])->values()->all()])
    @endif

    @include('emails.partials.button', ['url' => $portalUrl, 'label' => 'View in your patient portal'])
    <p class="t-muted" style="margin:0 0 8px; font-size:14px; line-height:21px; color:#5b6b7f;">&#128206; A PDF copy of this Payment Receipt is attached to this email for printing or saving.</p>
@endsection
