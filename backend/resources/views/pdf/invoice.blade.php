@extends('pdf.layout', ['title' => 'Invoice', 'docNumber' => $invoice->invoice_number])

@section('content')
<table class="grid"><tr>
    <td style="vertical-align:top;">
        @if ($paid)<span class="badge paid">&#10003; Paid</span>@else<span class="badge due">Payment due</span>@endif
        <p class="doc-title" style="margin-top:6px;">Invoice</p>
        <div class="muted">Invoice no. <span class="ink" style="font-weight:bold;">{{ $invoice->invoice_number }}</span></div>
        <div class="muted" style="margin-top:8px;">Billed to</div>
        <div class="ink" style="font-weight:bold; font-size:12px;">{{ $patientName }}</div>
    </td>
    <td style="width:42%; vertical-align:top;">
        <div class="hero"><div class="label">Amount due</div><div class="amount">{{ $amountDue }}</div>@if ($issuedOn)<div class="muted">Issued {{ $issuedOn }}</div>@endif</div>
    </td>
</tr></table>

<div class="section">Invoice details</div>
<div class="box"><table class="grid kv">
    <tr><td class="k">Invoice number</td><td class="v">{{ $invoice->invoice_number }}</td></tr>
    @if ($branch)<tr><td class="k">Clinic branch</td><td class="v">{{ $branch->name }}</td></tr>@endif
    @if ($issuedOn)<tr><td class="k">Issued on</td><td class="v">{{ $issuedOn }}</td></tr>@endif
    <tr><td class="k">Status</td><td class="v">{{ $paid ? 'Paid' : 'Payment due' }}</td></tr>
</table></div>

@include('pdf.items', ['invoice' => $invoice])

@unless ($paid)
    <div class="note warn">Amount due: {{ $amountDue }}. You can pay online from your patient portal, or at the clinic front desk.</div>
@endunless
@endsection
