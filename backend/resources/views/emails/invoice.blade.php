@extends('emails.layout', [
    'subject' => $subjectLine, 'branch' => $branch,
    'preheader' => ($paid ? 'Invoice '.$invoice->invoice_number.' is fully paid.' : 'Amount due: '.$amountDue.' for your visit. Review and pay in your patient portal.'),
    'reason' => 'You received this because the clinic issued an invoice for your visit at '.\App\Support\Brand::name().'.',
])

@section('content')
    <p style="margin:0 0 14px;">@include('emails.partials.badge', $paid ? ['tone' => 'success', 'text' => 'Paid'] : ['tone' => 'due', 'text' => 'Payment due'])</p>
    @include('emails.partials.heading', ['text' => 'Invoice'])
    <p style="margin:0 0 4px;">Hi {{ $firstName }},</p>
    <p style="margin:0;">Here is the invoice for your visit{{ $branch ? ' at '.$branch->name : '' }}. It lists each procedure that was performed.</p>

    @include('emails.partials.amount', ['label' => 'Amount due', 'amount' => $amountDue, 'note' => $issuedOn ? 'Issued '.$issuedOn : null])

    @include('emails.partials.details', ['title' => 'Invoice details', 'rows' => [
        ['Invoice number', $invoice->invoice_number],
        ['Clinic branch', $branch?->name],
        ['Issued on', $issuedOn],
        ['Status', $paid ? 'Paid' : 'Payment due'],
    ]])

    @include('emails.partials.items', ['invoice' => $invoice])

    @if ($bir)
        @include('emails.partials.details', ['title' => 'Business registration', 'rows' => collect($bir)->map(fn ($v, $k) => [$k, $v])->values()->all()])
    @endif

    @unless ($paid)
        @include('emails.partials.button', ['url' => $portalUrl, 'label' => 'Review and pay'])
        <p class="t-muted" style="margin:0 0 8px; font-size:14px; line-height:21px; color:#5b6b7f;">You can pay online from your patient portal, or at the clinic front desk.</p>
    @endunless
    <p class="t-muted" style="margin:0 0 8px; font-size:14px; line-height:21px; color:#5b6b7f;">&#128206; A PDF copy of this invoice is attached to this email.</p>
@endsection
