@extends('pdf.layout', ['title' => 'Payment Receipt', 'docNumber' => $receipt->receipt_number])

@section('content')
<table class="grid"><tr>
    <td style="vertical-align:top;">
        <span class="badge paid">&#10003; Paid</span>
        <p class="doc-title" style="margin-top:6px;">Payment Receipt</p>
        <div class="muted">Receipt no. <span class="ink" style="font-weight:bold;">{{ $receipt->receipt_number }}</span></div>
        <div class="muted" style="margin-top:8px;">Received from</div>
        <div class="ink" style="font-weight:bold; font-size:12px;">{{ $patientName }}</div>
    </td>
    <td style="width:42%; vertical-align:top;">
        <div class="hero"><div class="label">Amount paid</div><div class="amount">{{ $amount }}</div><div class="muted">{{ $paidAt }}</div></div>
    </td>
</tr></table>

<div class="section">Receipt details</div>
<div class="box"><table class="grid kv">
    <tr><td class="k">Receipt number</td><td class="v">{{ $receipt->receipt_number }}</td></tr>
    <tr><td class="k">Invoice number</td><td class="v">{{ $invoice->invoice_number }}</td></tr>
    @if ($branch)<tr><td class="k">Clinic branch</td><td class="v">{{ $branch->name }}</td></tr>@endif
    <tr><td class="k">Payment date</td><td class="v">{{ $paidAt }}</td></tr>
    <tr><td class="k">Payment method</td><td class="v">{{ $method }}</td></tr>
    @if ($reference)<tr><td class="k">Reference ID</td><td class="v mono">{{ $reference }}</td></tr>@endif
    <tr><td class="k">Balance remaining</td><td class="v">{{ $balance }}</td></tr>
</table></div>

@if ($invoice->lines->isNotEmpty())
    @include('pdf.items', ['invoice' => $invoice])
@endif

<div class="note {{ $settled ? '' : 'warn' }}">{{ $settled ? 'Fully settled. This invoice has no remaining balance.' : 'Balance remaining: '.$balance.'.' }}</div>
@endsection
