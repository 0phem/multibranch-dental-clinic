@extends('emails.v2.layout', [
    'subject' => $subjectLine, 'branch' => $branch,
    'preheader' => ($paid ? 'Invoice '.$invoice->invoice_number.' is fully paid.' : 'Amount due: '.$amountDue.'. Review and pay securely in your patient portal.'),
    'reason' => 'You received this because the clinic issued an invoice for your visit at '.\App\Support\Brand::name().'.',
])

@section('content')
    <p style="margin:0 0 16px;">@include('emails.v2.partials.badge', $paid ? ['tone' => 'paid', 'text' => 'Paid'] : ['tone' => 'due', 'text' => 'Payment due'])</p>
    @include('emails.v2.partials.heading', ['text' => 'Your invoice'])
    <p style="margin:0 0 4px;">Hi {{ $firstName }},</p>
    <p style="margin:0;">Thank you for visiting{{ $branch ? ' '.$branch->name : '' }}. Here is your invoice, with each procedure that was performed.</p>

    @include('emails.v2.partials.amount', ['label' => 'Amount due', 'amount' => $amountDue, 'note' => $issuedOn ? 'Issued '.$issuedOn : null])

    @include('emails.v2.partials.details', ['title' => 'Invoice details', 'rows' => [
        ['Invoice number', $invoice->invoice_number],
        ['Clinic branch', $branch?->name],
        ['Issued on', $issuedOn],
        ['Status', $paid ? 'Paid' : 'Payment due'],
    ]])

    @include('emails.v2.partials.items', ['invoice' => $invoice])

    @if ($bir)
        @include('emails.v2.partials.details', ['title' => 'Business registration', 'rows' => collect($bir)->map(fn ($v, $k) => [$k, $v])->values()->all()])
    @endif

    @unless ($paid)
        @include('emails.v2.partials.button', ['url' => $portalUrl, 'label' => 'Review and pay'])
        <p class="t-muted" style="margin:0 0 8px; font-size:15px; line-height:22px; color:#5b6b7f; text-align:center;">Pay online in your patient portal, or at the clinic front desk.</p>
    @endunless
    <p class="t-muted" style="margin:10px 0 8px; font-size:15px; line-height:22px; color:#5b6b7f;">&#128206;&nbsp; A PDF copy of this invoice is attached.</p>
@endsection
